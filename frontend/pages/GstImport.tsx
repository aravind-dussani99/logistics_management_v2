import React, { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { Trip } from '../types';

interface ParsedRow {
  rowNumber: number;
  data: {
    date: string;
    tripId: string;
    invoice: string;
    materialOwner: string;
    vehicleNumber: string;
    netTons: number | '';
    gstRatePerTon: number | '';
    gstPercentage: number | '';
    gstAmount: number | '';
  };
  issues?: string[];
}

interface ParseError {
  rowNumber: number;
  message: string;
}

const REQUIRED_HEADERS: Array<{ key: keyof typeof HEADER_ALIASES; label: string }> = [
  { key: 'date', label: 'date' },
  { key: 'tripId', label: 'trip #' },
  { key: 'invoice', label: 'invoice/dc' },
  { key: 'materialOwner', label: 'material owner' },
  { key: 'vehicleNumber', label: 'vehicle number' },
  { key: 'netTons', label: 'net tons' },
  { key: 'gstRatePerTon', label: 'trip rate for gst' },
  { key: 'gstPercentage', label: 'gst %' },
  { key: 'gstAmount', label: 'gst amount' },
];

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['Date', 'Trip Date'],
  tripId: ['Trip #', 'Trip', 'Trip ID', 'TripId'],
  invoice: ['Invoice/DC', 'Invoice & DC', 'Invoice/DC Number', 'Invoice Number'],
  materialOwner: ['Material Owner', 'Mine & Quarry Name', 'Quarry Name', 'Mine Name'],
  vehicleNumber: ['Vehicle Number', 'Vehicle No', 'Vehicle'],
  netTons: ['Net Tons', 'Net Weight', 'Net Weight (Tons)', 'Net Weight (Ton)'],
  gstRatePerTon: ['Trip Rate for GST', 'GST Rate/Ton', 'GST Rate Per Ton'],
  gstPercentage: ['GST %', 'GST Percentage', 'GST Percent'],
  gstAmount: ['GST Amount', 'GST Total', 'GST Value'],
};

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
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }
    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
  }
  return rows;
};

const parseDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`;
  }
  const parts = trimmed.split(/[./-]/).map(part => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const [partA, partB, yearPart] = parts;
    const yearNum = Number(yearPart.length === 2 ? `20${yearPart}` : yearPart);
    const numA = Number(partA);
    const numB = Number(partB);
    if (yearNum && numA && numB) {
      const dayNum = numA;
      const monthNum = numB;
      const candidate = new Date(yearNum, monthNum - 1, dayNum);
      if (!Number.isNaN(candidate.getTime()) && candidate.getDate() === dayNum && candidate.getMonth() === monthNum - 1) {
        return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      }
    }
  }
  const fallback = new Date(trimmed);
  if (Number.isNaN(fallback.getTime())) return '';
  return fallback.toISOString().split('T')[0];
};

const normalizeAmount = (value: string) => {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return '';
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : '';
};

const normalizeTripId = (value: string) => {
  const cleaned = value.replace(/[^0-9]/g, '').trim();
  return cleaned;
};

const GstImport: React.FC = () => {
  const { trips, loadTrips, updateTrip } = useData();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [headerOverrides, setHeaderOverrides] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [failedRows, setFailedRows] = useState<ParsedRow[]>([]);
  const [excludedRowNumbers, setExcludedRowNumbers] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const cancelRef = useRef(false);

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

  const excludedRowsSet = useMemo(() => new Set(excludedRowNumbers), [excludedRowNumbers]);

  const getRowIssues = (row: ParsedRow['data']) => {
    const issues: string[] = [];
    if (!row.date) issues.push('Date is required.');
    if (!row.tripId && !row.invoice) issues.push('Trip # or Invoice/DC is required.');
    if (!row.materialOwner) issues.push('Material Owner is required.');
    if (!row.vehicleNumber) issues.push('Vehicle number is required.');
    if (row.netTons === '') issues.push('Net tons is required.');
    if (row.gstRatePerTon === '') issues.push('Trip rate for GST is required.');
    if (row.gstPercentage === '') issues.push('GST % is required.');
    if (row.gstAmount === '') issues.push('GST amount is required.');
    return issues;
  };

  const activeRows = useMemo(
    () => parsedRows.filter(row => !excludedRowsSet.has(row.rowNumber)),
    [parsedRows, excludedRowsSet],
  );
  const readyRows = useMemo(
    () => activeRows.filter(row => getRowIssues(row.data).length === 0),
    [activeRows],
  );
  const reviewRows = activeRows;

  useEffect(() => {
    if (rows.length > 0) validateAndParse();
  }, [rows.length, headerOverrides]);

  const validateHeaders = () => {
    const missing = REQUIRED_HEADERS.filter(header => {
      const aliases = HEADER_ALIASES[header.key];
      return getColumnIndex(aliases, header.key) === undefined;
    }).map(item => item.label);
    if (missing.length > 0) {
      return { rowNumber: 1, message: `Missing required headers: ${missing.join(', ')}` };
    }
    return null;
  };

  const validateAndParse = () => {
    const headerError = validateHeaders();
    if (headerError) {
      setErrors([headerError]);
      setParsedRows([]);
      return;
    }
    const parsed: ParsedRow[] = [];
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 1;
      const dateValue = parseDate(getValueFromRow(row, HEADER_ALIASES.date, 'date'));
      const tripId = normalizeTripId(getValueFromRow(row, HEADER_ALIASES.tripId, 'tripId'));
      const invoice = getValueFromRow(row, HEADER_ALIASES.invoice, 'invoice');
      const materialOwner = getValueFromRow(row, HEADER_ALIASES.materialOwner, 'materialOwner');
      const vehicleNumber = getValueFromRow(row, HEADER_ALIASES.vehicleNumber, 'vehicleNumber');
      const netTons = normalizeAmount(getValueFromRow(row, HEADER_ALIASES.netTons, 'netTons'));
      const gstRatePerTon = normalizeAmount(getValueFromRow(row, HEADER_ALIASES.gstRatePerTon, 'gstRatePerTon'));
      const gstPercentage = normalizeAmount(getValueFromRow(row, HEADER_ALIASES.gstPercentage, 'gstPercentage'));
      const gstAmount = normalizeAmount(getValueFromRow(row, HEADER_ALIASES.gstAmount, 'gstAmount'));
      parsed.push({
        rowNumber,
        data: {
          date: dateValue,
          tripId,
          invoice,
          materialOwner,
          vehicleNumber,
          netTons,
          gstRatePerTon,
          gstPercentage,
          gstAmount,
        },
      });
    }
    setErrors([]);
    setParsedRows(parsed);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSubmitMessage('');
    setHeaderOverrides({});
    const text = await file.text();
    setRows(parseCsvText(text));
  };

  const updateRowValue = (rowNumber: number, field: keyof ParsedRow['data'], value: string) => {
    setParsedRows(prev => prev.map(row => {
      if (row.rowNumber !== rowNumber) return row;
      let nextValue: string | number | '' = value;
      if (['netTons', 'gstRatePerTon', 'gstPercentage', 'gstAmount'].includes(field)) {
        nextValue = normalizeAmount(value);
      }
      if (field === 'tripId') {
        nextValue = normalizeTripId(value);
      }
      return {
        ...row,
        data: { ...row.data, [field]: nextValue },
      };
    }));
  };

  const resolveTrip = (row: ParsedRow['data']) => {
    if (row.tripId) {
      const match = trips.find(trip => String(trip.id) === row.tripId);
      if (match) return match;
    }
    if (row.invoice && row.date) {
      const match = trips.find(trip => {
        const tripDate = (trip.date || '').split('T')[0];
        return tripDate === row.date && trip.invoiceDCNumber === row.invoice;
      });
      if (match) return match;
    }
    return null;
  };

  const handleImport = async () => {
    setSubmitMessage('');
    setFailedRows([]);
    if (parsedRows.length === 0) {
      setSubmitMessage('No rows to import.');
      return;
    }
    if (readyRows.length === 0) {
      setSubmitMessage('No valid rows to import.');
      return;
    }
    setIsSubmitting(true);
    cancelRef.current = false;
    const failed: ParsedRow[] = [];
    for (let index = 0; index < readyRows.length; index += 1) {
      if (cancelRef.current) {
        failed.push(...readyRows.slice(index));
        break;
      }
      const row = readyRows[index];
      try {
        const trip = resolveTrip(row.data);
        if (!trip) {
          failed.push({ ...row, issues: ['Trip not found.'] });
          continue;
        }
        const netTons = Number(row.data.netTons || 0);
        const gstRate = Number(row.data.gstRatePerTon || 0);
        const gstPercent = Number(row.data.gstPercentage || 0);
        const computedAmount = netTons * gstRate * (gstPercent / 100);
        const gstAmount = row.data.gstAmount === '' ? computedAmount : Number(row.data.gstAmount || 0);
        await updateTrip(trip.id, {
          gstRatePerTon: gstRate,
          gstPercentage: gstPercent,
          gstAmount,
        });
      } catch (error) {
        failed.push(row);
      }
    }
    setIsSubmitting(false);
    setFailedRows(failed);
    setParsedRows(failed);
    setExcludedRowNumbers([]);
    setSubmitMessage(cancelRef.current
      ? 'Import cancelled.'
      : `Import completed. ${failed.length} row(s) failed.`);
  };

  return (
    <div className="relative">
      <PageHeader
        title="GST Import"
        subtitle="Upload a CSV file to update GST values for trips."
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

          {rows.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
              <div className="font-semibold text-gray-700 dark:text-gray-200">Column mapping</div>
              <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
                {REQUIRED_HEADERS.map(field => {
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

          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
            <div className="font-semibold text-gray-700 dark:text-gray-200">CSV headers (lowercase)</div>
            <div className="mt-1">date, trip #, invoice/dc, material owner, vehicle number, net tons, trip rate for gst, gst %, gst amount</div>
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
              {errors.map(err => (
                <div key={`${err.rowNumber}-${err.message}`}>Row {err.rowNumber}: {err.message}</div>
              ))}
            </div>
          )}

          {parsedRows.length > 0 && errors.length === 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {parsedRows.length} rows parsed — {readyRows.length} ready, {reviewRows.length - readyRows.length} need review.
            </div>
          )}

          <button
            type="button"
            onClick={handleImport}
            disabled={isSubmitting || parsedRows.length === 0 || errors.length > 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {isSubmitting ? 'Importing...' : 'Import GST'}
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

          {submitMessage && (
            <div className="text-xs text-gray-600 dark:text-gray-300">{submitMessage}</div>
          )}

          {failedRows.length > 0 && (
            <div className="text-xs text-amber-700">
              {failedRows.length} row(s) failed during import.
            </div>
          )}

          {reviewRows.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rows needing review</div>
              <div className="overflow-x-auto rounded-md border border-amber-200 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-900/10">
                <table className="min-w-full text-xs">
                  <thead className="bg-amber-100/70 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100">
                    <tr>
                      {['Row', 'Date', 'Trip #', 'Invoice/DC', 'Material Owner', 'Vehicle', 'Net Tons', 'GST Rate', 'GST %', 'GST Amount', 'Issues', 'Actions'].map(header => (
                        <th key={header} className="px-3 py-2 text-left uppercase tracking-wide">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map(row => {
                      const rowIssues = getRowIssues(row.data);
                      return (
                        <tr key={`review-${row.rowNumber}`} className="even:bg-amber-50/60 dark:even:bg-amber-900/20">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2">
                            <input
                              value={row.data.date || ''}
                              onChange={event => updateRowValue(row.rowNumber, 'date', event.target.value)}
                              placeholder="YYYY-MM-DD"
                              className="w-24 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.data.tripId || ''}
                              onChange={event => updateRowValue(row.rowNumber, 'tripId', event.target.value)}
                              className="w-20 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.data.invoice || ''}
                              onChange={event => updateRowValue(row.rowNumber, 'invoice', event.target.value)}
                              className="w-28 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.data.materialOwner || ''}
                              onChange={event => updateRowValue(row.rowNumber, 'materialOwner', event.target.value)}
                              className="w-28 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
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
                              value={row.data.netTons === '' ? '' : String(row.data.netTons)}
                              onChange={event => updateRowValue(row.rowNumber, 'netTons', event.target.value)}
                              className="w-20 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.data.gstRatePerTon === '' ? '' : String(row.data.gstRatePerTon)}
                              onChange={event => updateRowValue(row.rowNumber, 'gstRatePerTon', event.target.value)}
                              className="w-20 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.data.gstPercentage === '' ? '' : String(row.data.gstPercentage)}
                              onChange={event => updateRowValue(row.rowNumber, 'gstPercentage', event.target.value)}
                              className="w-16 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.data.gstAmount === '' ? '' : String(row.data.gstAmount)}
                              onChange={event => updateRowValue(row.rowNumber, 'gstAmount', event.target.value)}
                              className="w-24 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                            />
                          </td>
                          <td className="px-3 py-2 text-amber-700">
                            {rowIssues.map(issue => (
                              <div key={`${row.rowNumber}-${issue}`}>{issue}</div>
                            ))}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setExcludedRowNumbers(prev => [...prev, row.rowNumber])}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Exclude
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GstImport;
