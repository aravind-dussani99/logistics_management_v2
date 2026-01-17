import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { Trip } from '../types';

interface ParsedTrip {
  rowNumber: number;
  key: string;
  data: Omit<Trip, 'id' | 'paymentStatus' | 'revenue' | 'materialCost' | 'transportCost' | 'royaltyCost' | 'profit' | 'status' | 'createdBy'>;
  duplicate?: boolean;
}

interface ParseError {
  rowNumber: number;
  message: string;
}

const REQUIRED_HEADERS = [
  'DATE',
  'Invoice & DC Number',
  'Vendor & Customer Name',
  'Transport & Owner Name',
  'VEHICLE NO',
  'Mine & Quarry Name',
  'Material Type',
  'Royalty Owner Name',
  'Net Weight (Tons)',
  'Pickup Place',
  'Drop-off Place',
];

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const parseCsvText = (text: string) => {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some(cell => cell.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }
    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some(cell => cell.trim() !== '')) {
      rows.push(row);
    }
  }
  return rows;
};

const parseDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/[./-]/).map(part => part.trim());
  if (parts.length < 3) return '';
  const [day, month, yearPart] = parts;
  const yearNum = Number(yearPart.length === 2 ? `20${yearPart}` : yearPart);
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (!yearNum || !monthNum || !dayNum) return '';
  const isoMonth = String(monthNum).padStart(2, '0');
  const isoDay = String(dayNum).padStart(2, '0');
  return `${yearNum}-${isoMonth}-${isoDay}`;
};

const TripImport: React.FC = () => {
  const { trips, loadTrips, addTripAtomic } = useData();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [parsedTrips, setParsedTrips] = useState<ParsedTrip[]>([]);
  const [failedRows, setFailedRows] = useState<ParsedTrip[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const headerMap = useMemo(() => {
    if (rows.length === 0) return new Map<string, number>();
    return rows[0].reduce((map, header, index) => {
      map.set(normalizeHeader(header), index);
      return map;
    }, new Map<string, number>());
  }, [rows]);

  const existingKeys = useMemo(() => {
    return new Set(trips.map(trip => `${trip.date}|${trip.invoiceDCNumber}|${trip.vehicleNumber}`));
  }, [trips]);

  useEffect(() => {
    if (rows.length > 0) {
      validateAndParse();
    }
  }, [existingKeys, rows.length]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSubmitMessage('');
    const text = await file.text();
    const parsed = parseCsvText(text);
    setRows(parsed);
    setParsedTrips([]);
    setErrors([]);
    setFailedRows([]);
  };

  const validateAndParse = () => {
    if (rows.length === 0) {
      setErrors([{ rowNumber: 0, message: 'CSV file is empty.' }]);
      setParsedTrips([]);
      return;
    }
    const missingHeaders = REQUIRED_HEADERS.filter(header => !headerMap.has(normalizeHeader(header)));
    if (missingHeaders.length > 0) {
      setErrors([{ rowNumber: 0, message: `Missing headers: ${missingHeaders.join(', ')}` }]);
      setParsedTrips([]);
      return;
    }

    const parsed: ParsedTrip[] = [];
    const parseErrors: ParseError[] = [];
    const fileKeys = new Set<string>();

    rows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      const getValue = (header: string) => {
        const col = headerMap.get(normalizeHeader(header));
        return col === undefined ? '' : (row[col] || '').trim();
      };
      const date = parseDate(getValue('DATE'));
      const netWeight = Number(getValue('Net Weight (Tons)') || 0);

      if (!date) {
        parseErrors.push({ rowNumber, message: 'Invalid date format.' });
        return;
      }
      const invoiceNumber = getValue('Invoice & DC Number');
      const vehicleNumber = getValue('VEHICLE NO');
      if (!getValue('Vendor & Customer Name')) {
        parseErrors.push({ rowNumber, message: 'Vendor & Customer Name is required.' });
        return;
      }
      if (!getValue('VEHICLE NO')) {
        parseErrors.push({ rowNumber, message: 'Vehicle number is required.' });
        return;
      }

      const key = `${date}|${invoiceNumber}|${vehicleNumber}`;
      const isDuplicate = existingKeys.has(key) || fileKeys.has(key);
      if (!fileKeys.has(key)) {
        fileKeys.add(key);
      }
      parsed.push({
        rowNumber,
        key,
        duplicate: isDuplicate,
        data: {
          date,
          place: getValue('Drop-off Place'),
          pickupPlace: getValue('Pickup Place'),
          dropOffPlace: getValue('Drop-off Place'),
          customer: getValue('Vendor & Customer Name'),
          invoiceDCNumber: invoiceNumber,
          quarryName: getValue('Mine & Quarry Name'),
          royaltyOwnerName: getValue('Royalty Owner Name'),
          material: getValue('Material Type'),
          vehicleNumber,
          transporterName: getValue('Transport & Owner Name'),
          transportOwnerMobileNumber: '',
          netWeight,
          emptyWeight: 0,
          grossWeight: netWeight,
          royaltyNumber: '',
          royaltyTons: netWeight,
          royaltyM3: 0,
          deductionPercentage: 0,
          sizeChangePercentage: 0,
          tonnage: netWeight,
          agent: '',
          rateOverrideEnabled: false,
          rateOverride: null,
        },
      });
    });

    setErrors(parseErrors);
    setParsedTrips(parsed);
  };

  const handleImport = async () => {
    setSubmitMessage('');
    setFailedRows([]);
    if (parsedTrips.length === 0) {
      setSubmitMessage('No trips to import.');
      return;
    }
    setIsSubmitting(true);
    const rowsToImport = parsedTrips.filter(trip => !trip.duplicate);
    if (rowsToImport.length === 0) {
      setIsSubmitting(false);
      setSubmitMessage('No new trips to import (duplicates detected).');
      return;
    }
    let successCount = 0;
    const failed: ParsedTrip[] = [];
    for (const trip of rowsToImport) {
      try {
        await addTripAtomic(trip.data, {
          vendorCustomer: true,
          mineQuarry: true,
          royaltyOwner: true,
          transportOwner: true,
          vehicleMaster: true,
          materialType: true,
          pickupPlace: true,
          dropOffPlace: true,
        });
        successCount += 1;
      } catch (error) {
        console.error('Failed to import trip row', trip.rowNumber, error);
        failed.push(trip);
      }
    }
    setIsSubmitting(false);
    setFailedRows(failed);
    const duplicateCount = parsedTrips.filter(row => row.duplicate).length;
    setSubmitMessage([
      `Imported ${successCount} trips.`,
      duplicateCount ? `${duplicateCount} duplicates skipped.` : '',
      failed.length ? `${failed.length} failed.` : '',
    ].filter(Boolean).join(' '));
  };

  const retryFailed = async () => {
    if (failedRows.length === 0) return;
    setIsSubmitting(true);
    const failed: ParsedTrip[] = [];
    let successCount = 0;
    for (const row of failedRows) {
      try {
        await addTripAtomic(row.data, {
          vendorCustomer: true,
          mineQuarry: true,
          royaltyOwner: true,
          transportOwner: true,
          vehicleMaster: true,
          materialType: true,
          pickupPlace: true,
          dropOffPlace: true,
        });
        successCount += 1;
      } catch (error) {
        console.error('Retry failed for row', row.rowNumber, error);
        failed.push(row);
      }
    }
    setIsSubmitting(false);
    setFailedRows(failed);
    setSubmitMessage(`Retried ${successCount} rows. ${failed.length} still failing.`);
  };

  return (
    <div className="relative">
      <PageHeader
        title="Trip Import"
        subtitle="Upload a CSV file in the fixed format to import trips in bulk."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showAddAction={false}
      />

      <main className="pt-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">CSV File</label>
            <input type="file" accept=".csv" onChange={handleFileChange} className="mt-2 text-sm text-gray-600 dark:text-gray-300" />
            {fileName && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loaded: {fileName}</div>}
          </div>

          <button
            type="button"
            onClick={validateAndParse}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Validate File
          </button>

          {errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errors.slice(0, 5).map(err => (
                <div key={`${err.rowNumber}-${err.message}`}>Row {err.rowNumber}: {err.message}</div>
              ))}
              {errors.length > 5 && <div>And {errors.length - 5} more errors.</div>}
            </div>
          )}

          {parsedTrips.length > 0 && errors.length === 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {parsedTrips.length} rows parsed —
              {` ${parsedTrips.filter(row => !row.duplicate).length} ready,`}
              {` ${parsedTrips.filter(row => row.duplicate).length} duplicates.`}
            </div>
          )}

          <button
            type="button"
            onClick={handleImport}
            disabled={isSubmitting || parsedTrips.length === 0 || errors.length > 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {isSubmitting ? 'Importing...' : 'Import Trips'}
          </button>

          {failedRows.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-xs text-amber-700">
                {failedRows.length} rows failed during import.
              </div>
              <button
                type="button"
                onClick={retryFailed}
                disabled={isSubmitting}
                className="px-3 py-1 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
              >
                Retry Failed
              </button>
            </div>
          )}

          {parsedTrips.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
                  <tr>
                    {['Row', 'Date', 'Vendor', 'Vehicle', 'Net Weight', 'Status'].map(header => (
                      <th key={header} className="px-3 py-2 text-left uppercase tracking-wide">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedTrips.map(row => (
                    <tr key={row.rowNumber} className="even:bg-gray-50 dark:even:bg-gray-800">
                      <td className="px-3 py-1">{row.rowNumber}</td>
                      <td className="px-3 py-1">{row.data.date}</td>
                      <td className="px-3 py-1">{row.data.customer}</td>
                      <td className="px-3 py-1">{row.data.vehicleNumber}</td>
                      <td className="px-3 py-1">{row.data.netWeight}</td>
                      <td className="px-3 py-1">
                        {row.duplicate ? (
                          <span className="text-xxs font-semibold text-red-600">Duplicate</span>
                        ) : (
                          <span className="text-xxs font-semibold text-emerald-600">Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {submitMessage && (
            <div className="text-sm text-gray-600 dark:text-gray-300">{submitMessage}</div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Required CSV Headers</h3>
          <ul className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            {REQUIRED_HEADERS.map(header => (
              <li key={header}>{header}</li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
};

export default TripImport;
