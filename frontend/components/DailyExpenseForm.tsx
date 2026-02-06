import React, { useEffect, useMemo, useState } from 'react';
import { DailyExpense, TripUploadFile, TripUploadPayload } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { formatCurrency } from '../utils';

const InputField: React.FC<
  React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> &
    React.SelectHTMLAttributes<HTMLSelectElement> & {
      label: string;
      isReadOnly?: boolean;
      children?: React.ReactNode;
    }
> = ({ label, isReadOnly, children, ...props }) => {
  const toId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'field';
  const inputId = props.id || props.name || toId(label);
  const inputName = props.name || inputId;
  const inputValue = props.type === 'number' && (props.value === 0 || props.value === '0') ? '' : props.value;
  const handleWheel: React.WheelEventHandler<HTMLInputElement> = event => {
    if (props.type === 'number') {
      event.currentTarget.blur();
    }
    props.onWheel?.(event);
  };
  return (
    <div className="col-span-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {isReadOnly ? (
        <div
          id={inputId}
          role="textbox"
          aria-readonly="true"
          className="mt-1 block w-full px-3 py-2 text-gray-500 dark:text-gray-400 min-h-[42px] flex items-center bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600"
        >
          {props.value || '-'}
        </div>
      ) : props.type === 'select' ? (
        <select
          {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
          id={inputId}
          name={inputName}
          className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
        >
          {children}
        </select>
      ) : props.type === 'textarea' ? (
        <textarea
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          id={inputId}
          name={inputName}
          rows={2}
          className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
        />
      ) : (
        <input
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          id={inputId}
          name={inputName}
          value={inputValue}
          onWheel={handleWheel}
          className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
        />
      )}
    </div>
  );
};

interface DailyExpenseFormProps {
  onSave: (data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>, id?: string) => Promise<void> | void;
  onClose: () => void;
  onSubmitSuccess?: () => void;
  initialData?: DailyExpense;
  expenses: DailyExpense[];
  openingBalance: number;
  isViewMode?: boolean;
  defaultSiteExpense?: boolean;
  cancelLabel?: string;
  submitLabel?: string;
}

const DailyExpenseForm: React.FC<DailyExpenseFormProps> = ({
  onSave,
  onClose,
  onSubmitSuccess,
  initialData,
  expenses = [],
  openingBalance,
  isViewMode = false,
  cancelLabel = 'Cancel',
  submitLabel = 'Save Transaction',
}) => {
  const { currentUser } = useAuth();
  const {
    payments,
  } = useData();
  const [formData, setFormData] = useState({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    from: currentUser?.name || '',
    to: initialData?.to || '',
    via: initialData?.via || '',
    headAccount: initialData?.headAccount || '',
    amount: initialData?.amount || 0,
    category: initialData?.category || '',
    subCategory: initialData?.subCategory || '',
    remarks: initialData?.remarks || '',
    type: initialData?.type || 'DEBIT',
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showOptional, setShowOptional] = useState(
    isViewMode || Boolean(initialData?.via || initialData?.headAccount || initialData?.category || initialData?.subCategory || initialData?.paymentReceiptUploads || initialData?.bankAccountUploads)
  );
  const [previewFile, setPreviewFile] = useState<TripUploadFile | null>(null);
  const [paymentReceiptFiles, setPaymentReceiptFiles] = useState<TripUploadFile[]>([]);
  const [bankAccountFiles, setBankAccountFiles] = useState<TripUploadFile[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState('');

  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const allDestinations = useMemo(() => Array.from(new Set(safeExpenses.map(e => e.to))), [safeExpenses]);
  const accountOptions = useMemo(() => {
    const values = new Set<string>();
    const source = Array.isArray(payments) ? payments : [];
    source.forEach(item => {
      if (item.fromAccount) values.add(item.fromAccount);
      if (item.toAccount) values.add(item.toAccount);
      if (item.headAccount) values.add(item.headAccount);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [payments]);
  const viaOptions = useMemo(() => ['Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI', 'PhonePe', 'GPay'], []);

  useEffect(() => {
    if (currentUser?.name && !formData.from) {
      setFormData(prev => ({ ...prev, from: currentUser.name }));
    }
  }, [currentUser, formData.from]);

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(p => ({ ...p, to: value }));
    if (value) {
      setSuggestions(allDestinations.filter(d => d.toLowerCase().includes(value.toLowerCase())).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const parseUploadValue = (value?: TripUploadPayload | string | null) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const parseBreakdown = (value?: unknown) => {
    if (!value) return '';
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && 'breakdown' in parsed) {
          return String((parsed as { breakdown?: string }).breakdown || '');
        }
      } catch (error) {
        return value;
      }
      return value;
    }
    if (typeof value === 'object' && value && 'breakdown' in value) {
      return String((value as { breakdown?: string }).breakdown || '');
    }
    return '';
  };

  useEffect(() => {
    setPaymentReceiptFiles(parseUploadValue(initialData?.paymentReceiptUploads));
    setBankAccountFiles(parseUploadValue(initialData?.bankAccountUploads));
    setExpenseBreakdown(parseBreakdown(initialData?.voucherUploads));
  }, [initialData]);

  const getBreakdownTotal = (text: string) => {
    if (!text) return 0;
    const matches = text.match(/-?\d+(?:\.\d+)?/g);
    if (!matches || matches.length === 0) return 0;
    return matches.reduce((sum, entry) => {
      const value = Number(entry);
      return Number.isNaN(value) ? sum : sum + value;
    }, 0);
  };

  const breakdownTotal = getBreakdownTotal(expenseBreakdown);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      ...formData,
      voucherUploads: expenseBreakdown ? { breakdown: expenseBreakdown } : null,
      paymentReceiptUploads: paymentReceiptFiles.length ? paymentReceiptFiles : null,
      bankAccountUploads: bankAccountFiles.length ? bankAccountFiles : null,
    } as Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>, initialData?.id);
    onSubmitSuccess?.();
  };

  const getAvailableBalance = () => {
    if (initialData) return initialData.availableBalance;

    const sorted = [...safeExpenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastExpense = sorted[sorted.length - 1];
    return lastExpense ? lastExpense.closingBalance : openingBalance;
  };

  const availableBalance = getAvailableBalance();
  const amountChange = formData.type === 'DEBIT' ? -(Number(formData.amount) || 0) : Number(formData.amount) || 0;
  const closingBalance = availableBalance + amountChange;
  const isLowBalance = closingBalance < openingBalance * 0.1;

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="sm:col-span-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-sm text-gray-500 dark:text-gray-400">Available Balance</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(availableBalance)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-900/40">
            <p className="text-sm text-gray-500 dark:text-gray-400">Closing Balance</p>
            <p className={`text-2xl font-bold ${isLowBalance ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
              {formatCurrency(closingBalance)}
            </p>
          </div>
        </div>

        <InputField label="Date *" id="date" name="date" type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} isReadOnly={isViewMode} required />

        <InputField label="Transaction Type *" id="type" name="type" type="select" value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value as 'DEBIT' | 'CREDIT' }))} isReadOnly={isViewMode} required>
          <option value="DEBIT">Expense (Money Out)</option>
          <option value="CREDIT">Money In / Top Up</option>
        </InputField>

        <div className="relative">
          <InputField label="To *" id="to" name="to" type="text" value={formData.to} onChange={handleToChange} isReadOnly={isViewMode} required autoComplete="off" />
          {suggestions.length > 0 && !isViewMode && (
            <ul className="absolute z-10 w-full bg-white dark:bg-gray-900 border dark:border-gray-600 rounded-md mt-1 max-h-40 overflow-y-auto">
              {suggestions.map(s => (
                <li
                  key={s}
                  onClick={() => {
                    setFormData(p => ({ ...p, to: s }));
                    setSuggestions([]);
                  }}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-1">
          <InputField
            label="Expense Breakdown (Optional)"
            id="expenseBreakdown"
            name="expenseBreakdown"
            type="textarea"
            value={expenseBreakdown}
            onChange={e => {
              const value = e.target.value;
              setExpenseBreakdown(value);
              const total = getBreakdownTotal(value);
              setFormData(p => ({ ...p, amount: total }));
            }}
            isReadOnly={isViewMode}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Breakdown total: {formatCurrency(breakdownTotal)}</span>
          </div>
        </div>

        <InputField
          label="Amount *"
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={e => {
            setFormData(p => ({ ...p, amount: e.target.value === '' ? '' : parseFloat(e.target.value) }));
          }}
          isReadOnly={isViewMode}
          required
        />

        <InputField label="Remarks *" id="remarks" name="remarks" type="textarea" value={formData.remarks} onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))} isReadOnly={isViewMode} required />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showOptional}
            onChange={(event) => setShowOptional(event.target.checked)}
            disabled={isViewMode}
          />
          Optional Fields
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
          >
            {isViewMode ? 'Close' : cancelLabel}
          </button>
          {!isViewMode && (
            <button
              type="submit"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none"
            >
              {submitLabel}
            </button>
          )}
        </div>
      </div>

      {showOptional && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <InputField label="Head Account" id="headAccount" name="headAccount" type="text" value={formData.headAccount} onChange={e => setFormData(p => ({ ...p, headAccount: e.target.value }))} isReadOnly={isViewMode} list={formData.headAccount ? "account-list" : undefined} />
            <InputField label="Via" id="via" name="via" type="text" value={formData.via} onChange={e => setFormData(p => ({ ...p, via: e.target.value }))} isReadOnly={isViewMode} list={formData.via ? "via-list" : undefined} />
            <InputField label="Category" id="category" name="category" type="text" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} isReadOnly={isViewMode} />
            <InputField label="Sub-Category" id="subCategory" name="subCategory" type="text" value={formData.subCategory} onChange={e => setFormData(p => ({ ...p, subCategory: e.target.value }))} isReadOnly={isViewMode} />
            <div className="col-span-1">
              <label htmlFor="expense-receipt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Receipt</label>
              {isViewMode ? (
                renderUploadList('Receipts', paymentReceiptFiles)
              ) : (
                <input
                  id="expense-receipt"
                  type="file"
                  onChange={async (event) => {
                    const selected = event.target.files;
                    if (!selected || selected.length === 0) return;
                    const fileList = Array.from(selected);
                    const entries = await Promise.all(fileList.map(file => new Promise<TripUploadFile>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve({ name: file.name, url: String(reader.result || '') });
                      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
                      reader.readAsDataURL(file);
                    })));
                    setPaymentReceiptFiles(entries);
                  }}
                  disabled={isViewMode}
                  accept="image/*,application/pdf"
                  multiple
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                />
              )}
            </div>
            <div className="col-span-1">
              <label htmlFor="expense-bank-attachment" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Account Details</label>
              {isViewMode ? (
                renderUploadList('Bank Details', bankAccountFiles)
              ) : (
                <input
                  id="expense-bank-attachment"
                  type="file"
                  onChange={async (event) => {
                    const selected = event.target.files;
                    if (!selected || selected.length === 0) return;
                    const fileList = Array.from(selected);
                    const entries = await Promise.all(fileList.map(file => new Promise<TripUploadFile>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve({ name: file.name, url: String(reader.result || '') });
                      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
                      reader.readAsDataURL(file);
                    })));
                    setBankAccountFiles(entries);
                  }}
                  disabled={isViewMode}
                  accept="image/*,application/pdf"
                  multiple
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{previewFile.name}</div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              {isImageFile(previewFile) ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-h-[70vh] w-full object-contain rounded-md" />
              ) : (
                <iframe
                  title={previewFile.name}
                  src={previewFile.url}
                  className="w-full h-[70vh] rounded-md border border-gray-200 dark:border-gray-700"
                />
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <datalist id="via-list">
        {viaOptions.map(value => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="account-list">
        {accountOptions.map(value => (
          <option key={value} value={value} />
        ))}
      </datalist>
    </form>
  );
};

export default DailyExpenseForm;
  const isImageFile = (file: TripUploadFile) => {
    const name = file.name.toLowerCase();
    return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif') || name.endsWith('.webp');
  };

  const isPreviewable = (file: TripUploadFile) => Boolean(file.url);

  const renderUploadList = (label: string, list: TripUploadFile[]) => (
    <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{label}</div>
      {list.length === 0 ? (
        <div className="mt-2 text-sm text-gray-400">Not uploaded</div>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {list.map((file, idx) => (
            <li key={`${file.name}-${idx}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {isImageFile(file) ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="h-10 w-10 rounded-md object-cover border border-gray-200 dark:border-gray-600"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-xs text-gray-500">
                    DOC
                  </div>
                )}
                <span className="truncate text-gray-700 dark:text-gray-200">{file.name}</span>
              </div>
              {isPreviewable(file) ? (
                <button
                  type="button"
                  onClick={() => setPreviewFile(file)}
                  className="text-primary hover:underline"
                >
                  View
                </button>
              ) : (
                <span className="text-gray-400 text-xs">No preview</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
