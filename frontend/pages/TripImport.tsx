import React, { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { Trip } from '../types';

interface ParsedTrip {
  rowNumber: number;
  key: string;
  data: Omit<Trip, 'id' | 'paymentStatus' | 'revenue' | 'materialCost' | 'transportCost' | 'royaltyCost' | 'profit' | 'status' | 'createdBy'>;
  duplicate?: boolean;
  issues?: string[];
  warnings?: string[];
}

interface ParseError {
  rowNumber: number;
  message: string;
}

const normalizeHeader = (value: string) => value.trim().toLowerCase();
const DATE_INPUT_HINT = 'Expected: YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY';

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['Date', 'DATE', 'Trip Date', 'TripDate'],
  invoice: ['Invoice & DC Number', 'Invoice/DC Number', 'Invoice Number', 'Invoice/DC', 'Invoice DC Number', 'Invoice & Dc Number'],
  vendorCustomer: ['Vendor & Customer Name', 'Vendor Name', 'Customer Name', 'Vendor Customer', 'Vendor'],
  transportOwner: ['Transport & Owner Name', 'Transport Owner Name', 'Transporter Name', 'Transport Owner', 'Transporter'],
  vehicle: ['Vehicle No', 'VEHICLE NO', 'Vehicle Number', 'Vehicle', 'Vehicle No.'],
  mineQuarry: ['Mine & Quarry Name', 'Quarry Name', 'Mine Name', 'Mine/Quarry', 'Quarry'],
  material: ['Material Type', 'Material'],
  royaltyOwner: ['Royalty Owner Name', 'Royalty Owner', 'Royalty'],
  netWeight: ['Net Weight (Tons)', 'Net Weight', 'Net Weight (Ton)', 'Net Weight (T)'],
  pickupPlace: ['Pickup Place', 'Pickup', 'Pick-up Place'],
  dropOffPlace: ['Drop-off Place', 'Dropoff Place', 'Drop Off Place', 'Drop-off', 'Drop Off'],
};

const REQUIRED_FIELDS: Array<{ key: keyof typeof HEADER_ALIASES; label: string }> = [
  { key: 'date', label: 'date' },
  { key: 'invoice', label: 'invoice & dc number' },
  { key: 'vendorCustomer', label: 'vendor & customer name' },
  { key: 'transportOwner', label: 'transport & owner name' },
  { key: 'vehicle', label: 'vehicle number' },
  { key: 'mineQuarry', label: 'mine & quarry name' },
  { key: 'material', label: 'material type' },
  { key: 'royaltyOwner', label: 'royalty owner name' },
  { key: 'netWeight', label: 'net weight (tons)' },
  { key: 'pickupPlace', label: 'pickup place' },
  { key: 'dropOffPlace', label: 'drop-off place' },
];

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

const parseDate = (value: string): { value: string; warning?: string } => {
  const trimmed = value.trim();
  if (!trimmed) return { value: '' };
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const isoMonth = String(Number(month)).padStart(2, '0');
    const isoDay = String(Number(day)).padStart(2, '0');
    return { value: `${year}-${isoMonth}-${isoDay}` };
  }
  if (/[a-zA-Z]/.test(trimmed)) {
    const wordDate = new Date(trimmed);
    if (!Number.isNaN(wordDate.getTime())) {
      return { value: wordDate.toISOString().split('T')[0] };
    }
  }
  const parts = trimmed.split(/[./-]/).map(part => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const [partA, partB, yearPart] = parts;
    const yearNum = Number(yearPart.length === 2 ? `20${yearPart}` : yearPart);
    const numA = Number(partA);
    const numB = Number(partB);
    if (yearNum && numA && numB) {
      let dayNum = numA;
      let monthNum = numB;
      let warning: string | undefined;
      if (numA > 12 && numB <= 12) {
        dayNum = numA;
        monthNum = numB;
      } else if (numB > 12 && numA <= 12) {
        dayNum = numB;
        monthNum = numA;
      } else if (numA <= 12 && numB <= 12) {
        dayNum = numA;
        monthNum = numB;
        warning = 'Assumed DD/MM/YYYY for ambiguous date.';
      }
      const candidate = new Date(yearNum, monthNum - 1, dayNum);
      if (!Number.isNaN(candidate.getTime()) && candidate.getDate() === dayNum && candidate.getMonth() === monthNum - 1) {
        const isoMonth = String(monthNum).padStart(2, '0');
        const isoDay = String(dayNum).padStart(2, '0');
        return { value: `${yearNum}-${isoMonth}-${isoDay}`, warning };
      }
    }
  }
  const fallback = new Date(trimmed);
  if (Number.isNaN(fallback.getTime())) return { value: '' };
  return { value: fallback.toISOString().split('T')[0], warning: 'Date parsed using browser locale.' };
};

const TripImport: React.FC = () => {
  const { trips, loadTrips, addTripAtomic } = useData();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [headerOverrides, setHeaderOverrides] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [parsedTrips, setParsedTrips] = useState<ParsedTrip[]>([]);
  const [failedRows, setFailedRows] = useState<ParsedTrip[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [completionModal, setCompletionModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const headerOptions = useMemo(() => rows[0] || [], [rows]);
  const getPreferredHeader = (key: string) => {
    const aliases = HEADER_ALIASES[key] || [];
    const match = headerOptions.find(header =>
      aliases.some(alias => normalizeHeader(alias) === normalizeHeader(header))
    );
    return match || '';
  };

  const getColumnIndex = (aliases: string[], overrideKey?: string) => {
    if (overrideKey) {
      const override = headerOverrides[overrideKey];
      if (override) {
        const col = headerMap.get(normalizeHeader(override));
        if (col !== undefined) return col;
      }
    }
    for (const alias of aliases) {
      const col = headerMap.get(normalizeHeader(alias));
      if (col !== undefined) return col;
    }
    return undefined;
  };

  const getValueFromRow = (row: string[], aliases: string[], overrideKey?: string) => {
    const col = getColumnIndex(aliases, overrideKey);
    return col === undefined ? '' : (row[col] || '').trim();
  };

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
  const readyRows = useMemo(() => parsedTrips.filter(row => !row.duplicate && !excludedRowsSet.has(row.rowNumber) && (!row.issues || row.issues.length === 0)), [parsedTrips, excludedRowsSet]);
  const reviewRows = useMemo(() => parsedTrips.filter(row => (row.issues || []).length > 0 && !excludedRowsSet.has(row.rowNumber)), [parsedTrips, excludedRowsSet]);
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
  }, [existingKeys, rows.length, headerOverrides]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setHeaderOverrides({});
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

  const recomputeDuplicates = (entries: ParsedTrip[]) => {
    const fileKeys = new Set<string>();
    return entries
      .slice()
      .sort((a, b) => a.rowNumber - b.rowNumber)
      .map(entry => {
        const key = `${entry.data.date}|${entry.data.invoiceDCNumber}`;
        const isDuplicate = Boolean(entry.data.date && entry.data.invoiceDCNumber) && (existingKeys.has(key) || fileKeys.has(key));
        if (!fileKeys.has(key)) {
          fileKeys.add(key);
        }
        return {
          ...entry,
          key,
          duplicate: isDuplicate,
        };
      });
  };

  const validateRow = (data: ParsedTrip['data']) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    const dateParsed = parseDate(data.date || '');
    if (!dateParsed.value) {
      issues.push(`Invalid date format. ${DATE_INPUT_HINT}`);
    } else if (dateParsed.warning) {
      warnings.push(dateParsed.warning);
    }
    if (!data.customer) {
      issues.push('Vendor & Customer Name is required.');
    }
    if (!data.vehicleNumber) {
      issues.push('Vehicle number is required.');
    }
    if (!data.invoiceDCNumber) {
      issues.push('Invoice/DC Number is required.');
    }
    if (!Number.isFinite(Number(data.netWeight))) {
      issues.push('Net Weight must be a valid number.');
    }
    return { issues, warnings, date: dateParsed.value || data.date };
  };

  const updateRowValue = (rowNumber: number, field: keyof ParsedTrip['data'], value: string) => {
    setParsedTrips(prev => {
      const updated = prev.map(entry => {
        if (entry.rowNumber !== rowNumber) return entry;
        let nextData: ParsedTrip['data'] = { ...entry.data };
        if (field !== 'netWeight') {
          (nextData as Record<string, string>)[field] = value;
        }
        if (field === 'netWeight') {
          const weight = Number(value || 0);
          nextData = {
            ...nextData,
            netWeight: weight,
            grossWeight: weight,
            royaltyTons: weight,
            tonnage: weight,
          };
        }
        const result = validateRow(nextData);
        return {
          ...entry,
          data: { ...nextData, date: result.date },
          issues: result.issues,
          warnings: result.warnings,
        };
      });
      return recomputeDuplicates(updated);
    });
  };

  const validateAndParse = () => {
    if (rows.length === 0) {
      setErrors([{ rowNumber: 0, message: 'CSV file is empty.' }]);
      setParsedTrips([]);
      return;
    }
    const missingHeaders = REQUIRED_FIELDS.filter(field => {
      const aliases = HEADER_ALIASES[field.key];
      return getColumnIndex(aliases, field.key) === undefined;
    });
    if (missingHeaders.length > 0) {
      setErrors([{ rowNumber: 0, message: `Missing headers: ${missingHeaders.map(field => field.label).join(', ')}` }]);
      setParsedTrips([]);
      return;
    }

    const parsed: ParsedTrip[] = [];
    const parseErrors: ParseError[] = [];

    rows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      const issues: string[] = [];
      const warnings: string[] = [];
      const dateValue = getValueFromRow(row, HEADER_ALIASES.date, 'date');
      const dateParsed = parseDate(dateValue);
      const date = dateParsed.value;
      if (dateParsed.warning) warnings.push(dateParsed.warning);
      const netWeightRaw = getValueFromRow(row, HEADER_ALIASES.netWeight, 'netWeight');
      const netWeight = Number(netWeightRaw || 0);

      if (!date) {
        issues.push(`Invalid date format. ${DATE_INPUT_HINT}`);
      }
      const invoiceNumber = getValueFromRow(row, HEADER_ALIASES.invoice, 'invoice');
      const vehicleNumber = getValueFromRow(row, HEADER_ALIASES.vehicle, 'vehicle');
      if (!getValueFromRow(row, HEADER_ALIASES.vendorCustomer, 'vendorCustomer')) {
        issues.push('Vendor & Customer Name is required.');
      }
      if (!vehicleNumber) {
        issues.push('Vehicle number is required.');
      }
      if (!invoiceNumber) {
        issues.push('Invoice/DC Number is required.');
      }
      if (!Number.isFinite(netWeight)) {
        issues.push('Net Weight must be a valid number.');
      }

      const key = `${date}|${invoiceNumber}`;
      parsed.push({
        rowNumber,
        key,
        issues,
        warnings,
        data: {
          date,
          place: getValueFromRow(row, HEADER_ALIASES.dropOffPlace, 'dropOffPlace'),
          pickupPlace: getValueFromRow(row, HEADER_ALIASES.pickupPlace, 'pickupPlace'),
          dropOffPlace: getValueFromRow(row, HEADER_ALIASES.dropOffPlace, 'dropOffPlace'),
          customer: getValueFromRow(row, HEADER_ALIASES.vendorCustomer, 'vendorCustomer'),
          invoiceDCNumber: invoiceNumber,
          quarryName: getValueFromRow(row, HEADER_ALIASES.mineQuarry, 'mineQuarry'),
          royaltyOwnerName: getValueFromRow(row, HEADER_ALIASES.royaltyOwner, 'royaltyOwner'),
          material: getValueFromRow(row, HEADER_ALIASES.material, 'material'),
          vehicleNumber,
          transporterName: getValueFromRow(row, HEADER_ALIASES.transportOwner, 'transportOwner'),
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
    setParsedTrips(recomputeDuplicates(parsed));
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
    setProgressTotal(rowsToImport.length);
    setProgressCurrent(0);
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
      setProgressCurrent(index + 1);
    }
    setIsSubmitting(false);
    setFailedRows(failed);
    const duplicateCount = totalDuplicateCount;
    const summaryMessage = [
      cancelRef.current ? `Import cancelled after ${successCount} trips.` : `Imported ${successCount} trips.`,
      duplicateCount ? `${duplicateCount} duplicates skipped.` : '',
      failed.length ? `${failed.length} remaining rows not imported.` : '',
    ].filter(Boolean).join(' '));
    setSubmitMessage(summaryMessage);
    setCompletionModal({ open: true, message: summaryMessage });
    setParsedTrips([]);
    setRows([]);
    setErrors([]);
    setExcludedRowNumbers([]);
    setShowDuplicateDialog(false);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="mt-2 text-sm text-gray-600 dark:text-gray-300" />
            {fileName && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loaded: {fileName}</div>}
          </div>

          {rows.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
              <div className="font-semibold text-gray-700 dark:text-gray-200">Column mapping</div>
              <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
                {REQUIRED_FIELDS.map(field => {
                  const selected = headerOverrides[field.key] ?? getPreferredHeader(field.key);
                  return (
                    <label key={field.key} className="space-y-1">
                      <span className="block text-[11px] uppercase tracking-wide text-gray-500">{field.label}</span>
                      <select
                        value={selected}
                        onChange={event => {
                          const value = event.target.value;
                          setHeaderOverrides(prev => ({
                            ...prev,
                            [field.key]: value,
                          }));
                        }}
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      >
                        <option value="">Select column</option>
                        {headerOptions.map(header => (
                          <option key={`${field.key}-${header}`} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

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
              {` ${readyRows.length} ready,`}
              {` ${reviewRows.length} need review,`}
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
          {isSubmitting && progressTotal > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500 dark:text-gray-300">
                Processing {progressCurrent} / {progressTotal}
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.round((progressCurrent / progressTotal) * 100))}%` }}
                />
              </div>
            </div>
          )}
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

          {reviewRows.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rows needing review</div>
              <div className="overflow-x-auto rounded-md border border-amber-200 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-900/10">
                <table className="min-w-full text-xs">
                  <thead className="bg-amber-100/70 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100">
                    <tr>
                      {['Row', 'Date', 'Invoice/DC', 'Vendor', 'Transport', 'Vehicle', 'Mine/Quarry', 'Material', 'Royalty Owner', 'Net Weight', 'Pickup', 'Drop-off', 'Issues', 'Actions'].map(header => (
                        <th key={header} className="px-3 py-2 text-left uppercase tracking-wide">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map(row => (
                      <tr key={`review-${row.rowNumber}`} className="even:bg-amber-50/60 dark:even:bg-amber-900/20">
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.date || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'date', event.target.value)}
                            placeholder="YYYY-MM-DD"
                            className="w-28 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.invoiceDCNumber || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'invoiceDCNumber', event.target.value)}
                            className="w-28 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.customer || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'customer', event.target.value)}
                            className="w-32 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.transporterName || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'transporterName', event.target.value)}
                            className="w-32 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.vehicleNumber || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'vehicleNumber', event.target.value)}
                            className="w-24 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.quarryName || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'quarryName', event.target.value)}
                            className="w-28 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.material || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'material', event.target.value)}
                            className="w-24 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.royaltyOwnerName || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'royaltyOwnerName', event.target.value)}
                            className="w-28 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.netWeight === 0 ? '' : String(row.data.netWeight)}
                            onChange={event => updateRowValue(row.rowNumber, 'netWeight', event.target.value)}
                            className="w-20 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.pickupPlace || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'pickupPlace', event.target.value)}
                            className="w-24 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.dropOffPlace || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'dropOffPlace', event.target.value)}
                            className="w-24 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2 text-xxs text-amber-900 dark:text-amber-100">
                          <div className="space-y-1">
                            {(row.issues || []).map(issue => (
                              <div key={issue}>{issue}</div>
                            ))}
                            {(row.warnings || []).map(warning => (
                              <div key={warning} className="text-amber-700 dark:text-amber-300">{warning}</div>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleExcludeRow(row.rowNumber)}
                            className="text-xxs font-medium text-blue-600 hover:underline"
                          >
                            Exclude
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                        ) : row.issues && row.issues.length > 0 ? (
                          <div className="text-xxs font-semibold text-amber-600">Needs review</div>
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
            {REQUIRED_FIELDS.map(field => (
              <li key={field.key}>{field.label}</li>
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
      {completionModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Import Summary</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{completionModal.message}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCompletionModal({ open: false, message: '' });
                  setSubmitMessage('');
                  setProgressCurrent(0);
                  setProgressTotal(0);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripImport;
