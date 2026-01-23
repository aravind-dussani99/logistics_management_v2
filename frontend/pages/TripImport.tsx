import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const isoMonth = String(Number(month)).padStart(2, '0');
    const isoDay = String(Number(day)).padStart(2, '0');
    return `${year}-${isoMonth}-${isoDay}`;
  }
  const parts = trimmed.split(/[./-]/).map(part => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const [partA, partB, yearPart] = parts;
    const yearNum = Number(yearPart.length === 2 ? `20${yearPart}` : yearPart);
    const monthNum = Number(partB);
    const dayNum = Number(partA);
    if (yearNum && monthNum && dayNum) {
      const isoMonth = String(monthNum).padStart(2, '0');
      const isoDay = String(dayNum).padStart(2, '0');
      return `${yearNum}-${isoMonth}-${isoDay}`;
    }
  }
  const fallback = new Date(trimmed);
  if (Number.isNaN(fallback.getTime())) return '';
  return fallback.toISOString().split('T')[0];
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
  const cancelRef = useRef(false);
  const [excludedRowNumbers, setExcludedRowNumbers] = useState<number[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

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

  const formatKeyDate = (value: string | null | undefined) => {
    if (!value) return '';
    const normalized = new Date(value);
    if (Number.isNaN(normalized.getTime())) return '';
    return normalized.toISOString().split('T')[0];
  };

  const existingKeys = useMemo(() => {
    return new Set(trips.map(trip => `${formatKeyDate(trip.date)}|${trip.invoiceDCNumber}`));
  }, [trips]);

  const excludedRowsSet = useMemo(() => new Set(excludedRowNumbers), [excludedRowNumbers]);
  const duplicateRows = useMemo(() => parsedTrips.filter(row => row.duplicate && !excludedRowsSet.has(row.rowNumber)), [parsedTrips, excludedRowsSet]);
  const readyRows = useMemo(() => parsedTrips.filter(row => !row.duplicate && !excludedRowsSet.has(row.rowNumber)), [parsedTrips, excludedRowsSet]);
  const totalDuplicateCount = parsedTrips.filter(row => row.duplicate).length;
  const toggleExcludeRow = (rowNumber: number) => {
    setExcludedRowNumbers(prev => (prev.includes(rowNumber) ? prev : [...prev, rowNumber]));
  };
  const excludeAllDuplicates = () => {
    setExcludedRowNumbers(prev => Array.from(new Set([...prev, ...duplicateRows.map(row => row.rowNumber)])));
  };

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
    setExcludedRowNumbers([]);
    setShowDuplicateDialog(false);
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

      const key = `${date}|${invoiceNumber}`;
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
    setExcludedRowNumbers([]);
    setShowDuplicateDialog(false);
  };

  const handleImport = async () => {
    setSubmitMessage('');
    setFailedRows([]);
    if (parsedTrips.length === 0) {
      setSubmitMessage('No trips to import.');
      return;
    }
    setIsSubmitting(true);
    cancelRef.current = false;
    const rowsToImport = readyRows;
    if (rowsToImport.length === 0) {
      setIsSubmitting(false);
      const hasPendingDuplicates = duplicateRows.length > 0;
      setSubmitMessage(hasPendingDuplicates ? 'No trips selected for import because duplicates remain. Remove them first.' : 'No new trips to import.');
      return;
    }
    let successCount = 0;
    let failed: ParsedTrip[] = [];
    for (let index = 0; index < rowsToImport.length; index += 1) {
      if (cancelRef.current) {
        failed = rowsToImport.slice(index);
        break;
      }
      const trip = rowsToImport[index];
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
        failed = rowsToImport.slice(index);
        break;
      }
    }
    setIsSubmitting(false);
    setFailedRows(failed);
    const duplicateCount = totalDuplicateCount;
    setSubmitMessage([
      cancelRef.current ? `Import cancelled after ${successCount} trips.` : `Imported ${successCount} trips.`,
      duplicateCount ? `${duplicateCount} duplicates skipped.` : '',
      failed.length ? `${failed.length} remaining rows not imported.` : '',
    ].filter(Boolean).join(' '));
  };

  const retryFailed = async () => {
    if (failedRows.length === 0) return;
    setIsSubmitting(true);
    cancelRef.current = false;
    const failed: ParsedTrip[] = [];
    let successCount = 0;
    for (let index = 0; index < failedRows.length; index += 1) {
      if (cancelRef.current) {
        failed.push(...failedRows.slice(index));
        break;
      }
      const row = failedRows[index];
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
        failed.push(...failedRows.slice(index));
        break;
      }
    }
    setIsSubmitting(false);
    setFailedRows(failed);
    setSubmitMessage(cancelRef.current
      ? `Import cancelled after retrying ${successCount} rows.`
      : `Retried ${successCount} rows. ${failed.length} still pending.`);
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

          {duplicateRows.length > 0 && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 space-y-2">
              <p className="font-semibold">Duplicate Invoice & Date combinations detected.</p>
              <p className="text-xs text-yellow-800">
                {duplicateRows.length} row{duplicateRows.length > 1 ? 's' : ''} share invoice/DC + date values that already exist.
                Remove them before importing or exclude them from the preview.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={excludeAllDuplicates}
                  className="px-3 py-1 text-xs font-semibold text-yellow-900 border border-yellow-400 rounded-md hover:bg-yellow-100"
                >
                  Remove duplicates
                </button>
                <button
                  type="button"
                  onClick={() => setShowDuplicateDialog(true)}
                  className="px-3 py-1 text-xs font-semibold text-yellow-900 border border-yellow-400 rounded-md hover:bg-yellow-100"
                >
                  View duplicates
                </button>
              </div>
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
          {isSubmitting && (
            <button
              type="button"
              onClick={() => {
                cancelRef.current = true;
                setSubmitMessage('Cancelling import...');
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
            >
              Cancel Import
            </button>
          )}

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
                      <td className="px-3 py-1 space-y-1">
                        {row.duplicate ? (
                          <div className="text-xxs font-semibold text-red-600">Duplicate</div>
                        ) : (
                          <div className="text-xxs font-semibold text-emerald-600">Ready</div>
                        )}
                        {excludedRowsSet.has(row.rowNumber) && (
                          <div className="text-xxs font-semibold text-gray-500">Excluded</div>
                        )}
                        {row.duplicate && !excludedRowsSet.has(row.rowNumber) && (
                          <button
                            type="button"
                            onClick={() => toggleExcludeRow(row.rowNumber)}
                            className="text-xxs font-medium text-blue-600 hover:underline"
                          >
                            Remove from import
                          </button>
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
      {showDuplicateDialog && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Duplicate rows</h3>
              <button
                type="button"
                onClick={() => setShowDuplicateDialog(false)}
                className="text-xs uppercase text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              >
                Close
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              These rows share the same invoice/DC and date. You can exclude any of them without editing the CSV.
            </p>
            <ul className="space-y-2 text-xs text-gray-700 dark:text-gray-200 max-h-64 overflow-y-auto">
              {duplicateRows.map(row => (
                <li key={`dup-${row.rowNumber}`} className="flex justify-between items-center">
                  <span>Row {row.rowNumber} · {row.data.invoiceDCNumber || 'No Invoice'} · {row.data.date}</span>
                  <button
                    type="button"
                    onClick={() => toggleExcludeRow(row.rowNumber)}
                    className="text-blue-600 hover:underline"
                  >
                    Exclude
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  excludeAllDuplicates();
                  setShowDuplicateDialog(false);
                }}
                className="px-3 py-1 text-xs font-semibold text-gray-200 bg-primary rounded-md hover:bg-primary-dark"
              >
                Remove all
              </button>
              <button
                type="button"
                onClick={() => setShowDuplicateDialog(false)}
                className="px-3 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripImport;
