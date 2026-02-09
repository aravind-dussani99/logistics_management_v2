import React, { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { DailyExpense, Payment, PaymentType } from '../types';

type ImportMode = 'payments' | 'daily-expenses';

interface ParsedRow {
  rowNumber: number;
  data: {
    date: string;
    transactionType: string;
    fromAccount: string;
    toName: string;
    amount: number | '';
    remarks: string;
    toAccount?: string;
    via?: string;
    headAccount?: string;
    category?: string;
    subCategory?: string;
    tripId?: string;
  };
  issues?: string[];
}

interface ParseError {
  rowNumber: number;
  message: string;
}

const REQUIRED_HEADERS: Array<{ key: keyof typeof HEADER_ALIASES; label: string }> = [
  { key: 'date', label: 'date' },
  { key: 'transactionType', label: 'transaction type' },
  { key: 'fromAccount', label: 'from account' },
  { key: 'toName', label: 'to name' },
  { key: 'amount', label: 'amount' },
  { key: 'remarks', label: 'remarks' },
];

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['Date', 'Transaction Date', 'Payment Date', 'Expense Date'],
  transactionType: ['Transaction Type', 'Type', 'Payment Type'],
  fromAccount: ['From Account', 'From', 'Paid From'],
  toName: ['To Name', 'To', 'Counterparty Name'],
  amount: ['Amount', 'Total Amount', 'Value'],
  remarks: ['Remarks', 'Note', 'Narration'],
  toAccount: ['To Account', 'Beneficiary Account'],
  via: ['Via', 'Mode', 'Payment Mode'],
  headAccount: ['Head Account', 'Head'],
  category: ['Category'],
  subCategory: ['Sub-Category', 'Sub Category', 'Subcategory'],
  tripId: ['Trip ID', 'TripId'],
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

const PaymentImport: React.FC = () => {
  const { addPayment, addDailyExpense } = useData();
  const [importMode, setImportMode] = useState<ImportMode>('payments');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [failedRows, setFailedRows] = useState<ParsedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [excludedRowNumbers, setExcludedRowNumbers] = useState<number[]>([]);
  const cancelRef = useRef(false);

  const headerMap = useMemo(() => {
    if (rows.length === 0) return new Map<string, number>();
    return rows[0].reduce((map, header, index) => {
      map.set(normalizeHeader(header), index);
      return map;
    }, new Map<string, number>());
  }, [rows]);

  const getColumnIndex = (aliases: string[]) => {
    for (const alias of aliases) {
      const col = headerMap.get(normalizeHeader(alias));
      if (col !== undefined) return col;
    }
    return undefined;
  };

  const getValueFromRow = (row: string[], aliases: string[]) => {
    const col = getColumnIndex(aliases);
    return col === undefined ? '' : (row[col] || '').trim();
  };

  const excludedRowsSet = useMemo(() => new Set(excludedRowNumbers), [excludedRowNumbers]);

  const getRowIssues = (row: ParsedRow['data']) => {
    const issues: string[] = [];
    if (!row.date) issues.push('Date is required.');
    if (!row.transactionType) issues.push('Transaction Type is required.');
    if (!row.fromAccount) issues.push('From Account is required.');
    if (!row.toName) issues.push('To Name is required.');
    if (row.amount === '') issues.push('Amount is required.');
    if (!row.remarks) issues.push('Remarks are required.');
    const normalizedType = importMode === 'payments'
      ? normalizePaymentType(row.transactionType)
      : normalizeExpenseType(row.transactionType);
    if (!normalizedType) issues.push('Transaction Type is invalid.');
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
  }, [rows.length, importMode]);

  const validateHeaders = () => {
    const missing = REQUIRED_HEADERS.filter(header => {
      const aliases = HEADER_ALIASES[header.key];
      return getColumnIndex(aliases) === undefined;
    }).map(item => item.label);
    if (missing.length > 0) {
      return { rowNumber: 1, message: `Missing required headers: ${missing.join(', ')}` };
    }
    return null;
  };

  const normalizePaymentType = (value: string) => {
    const raw = value.trim().toLowerCase();
    if (!raw) return '';
    if (raw.includes('receipt') || raw.includes('receive') || raw.includes('in') || raw.includes('credit')) return PaymentType.RECEIPT;
    if (raw.includes('payment') || raw.includes('pay') || raw.includes('out') || raw.includes('debit')) return PaymentType.PAYMENT;
    return '';
  };

  const normalizeExpenseType = (value: string) => {
    const raw = value.trim().toLowerCase();
    if (!raw) return '';
    if (raw.includes('credit') || raw.includes('top up') || raw.includes('topup') || raw.includes('receipt')) return 'CREDIT';
    if (raw.includes('debit') || raw.includes('expense') || raw.includes('payment')) return 'DEBIT';
    return '';
  };

  const validateAndParse = () => {
    const headerError = validateHeaders();
    if (headerError) {
      setErrors([headerError]);
      setParsedRows([]);
      return;
    }
    const nextErrors: ParseError[] = [];
    const parsed: ParsedRow[] = [];
    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 1;
      const dateValue = parseDate(getValueFromRow(row, HEADER_ALIASES.date));
      const transactionType = getValueFromRow(row, HEADER_ALIASES.transactionType);
      const fromAccount = getValueFromRow(row, HEADER_ALIASES.fromAccount);
      const toName = getValueFromRow(row, HEADER_ALIASES.toName);
      const amountValue = normalizeAmount(getValueFromRow(row, HEADER_ALIASES.amount));
      const remarks = getValueFromRow(row, HEADER_ALIASES.remarks);
      parsed.push({
        rowNumber,
        data: {
          date: dateValue,
          transactionType,
          fromAccount,
          toName,
          amount: amountValue,
          remarks,
          toAccount: getValueFromRow(row, HEADER_ALIASES.toAccount),
          via: getValueFromRow(row, HEADER_ALIASES.via),
          headAccount: getValueFromRow(row, HEADER_ALIASES.headAccount),
          category: getValueFromRow(row, HEADER_ALIASES.category),
          subCategory: getValueFromRow(row, HEADER_ALIASES.subCategory),
          tripId: getValueFromRow(row, HEADER_ALIASES.tripId),
        },
      });
    }
    setErrors(nextErrors);
    setParsedRows(parsed);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSubmitMessage('');
    const text = await file.text();
    setRows(parseCsvText(text));
  };

  const updateRowValue = (rowNumber: number, field: keyof ParsedRow['data'], value: string) => {
    setParsedRows(prev => prev.map(row => {
      if (row.rowNumber !== rowNumber) return row;
      const nextValue = field === 'amount' ? normalizeAmount(value) : value;
      return {
        ...row,
        data: { ...row.data, [field]: nextValue },
      };
    }));
  };

  const handleImport = async () => {
    cancelRef.current = false;
    setIsSubmitting(true);
    setSubmitMessage('');
    const failed: ParsedRow[] = [];

    for (const row of readyRows) {
      if (cancelRef.current) break;
      try {
        const normalizedType = importMode === 'payments'
          ? normalizePaymentType(row.data.transactionType)
          : normalizeExpenseType(row.data.transactionType);
        if (!normalizedType) throw new Error('Invalid type.');
        if (importMode === 'payments') {
          const payload: Omit<Payment, 'id'> = {
            date: row.data.date,
            type: normalizedType as PaymentType,
            fromAccount: row.data.fromAccount,
            ratePartyName: row.data.toName,
            amount: Number(row.data.amount || 0),
            remarks: row.data.remarks,
            toAccount: row.data.toAccount || '',
            via: row.data.via || '',
            headAccount: row.data.headAccount || '',
            category: row.data.category || '',
            subCategory: row.data.subCategory || '',
            tripId: row.data.tripId ? Number(row.data.tripId) : undefined,
          };
          await addPayment(payload);
        } else {
          const payload: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'> = {
            date: row.data.date,
            type: normalizedType as DailyExpense['type'],
            from: row.data.fromAccount,
            to: row.data.toName,
            amount: Number(row.data.amount || 0),
            remarks: row.data.remarks,
            via: row.data.via || '',
            headAccount: row.data.headAccount || '',
            category: row.data.category || '',
            subCategory: row.data.subCategory || '',
          };
          await addDailyExpense(payload);
        }
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
        title="Payment & Expense Import"
        subtitle="Upload a CSV file with the required columns to import payments or daily expenses."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showAddAction={false}
      />

      <main className="pt-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Import Type</label>
            <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
              {(['payments', 'daily-expenses'] as ImportMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setImportMode(mode)}
                  className={`px-4 py-2 text-sm font-semibold ${importMode === mode
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {mode === 'payments' ? 'Payments' : 'Daily Expenses'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">CSV File</label>
            <input type="file" accept=".csv" onChange={handleFileChange} className="mt-2 text-sm text-gray-600 dark:text-gray-300" />
            {fileName && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Loaded: {fileName}</div>}
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
            <div className="font-semibold text-gray-700 dark:text-gray-200">CSV headers (lowercase)</div>
            <div className="mt-1">Required: date, transaction type, from account, to name, amount, remarks</div>
            <div>Optional: to account, via, head account, category, sub-category, trip id</div>
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
            {isSubmitting ? 'Importing...' : `Import ${importMode === 'payments' ? 'Payments' : 'Daily Expenses'}`}
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
                      {['Row', 'Date', 'Type', 'From', 'To Name', 'Amount', 'Remarks', 'Issues', 'Actions'].map(header => (
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
                            className="w-28 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.transactionType || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'transactionType', event.target.value)}
                            className="w-32 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.fromAccount || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'fromAccount', event.target.value)}
                            className="w-32 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.toName || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'toName', event.target.value)}
                            className="w-32 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.amount === '' ? '' : String(row.data.amount)}
                            onChange={event => updateRowValue(row.rowNumber, 'amount', event.target.value)}
                            className="w-24 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.data.remarks || ''}
                            onChange={event => updateRowValue(row.rowNumber, 'remarks', event.target.value)}
                            className="w-40 rounded-md border border-amber-200 bg-white/70 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-900/40 dark:text-gray-200"
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

export default PaymentImport;
