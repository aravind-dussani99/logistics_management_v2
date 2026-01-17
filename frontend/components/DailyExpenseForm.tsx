import React, { useEffect, useMemo, useState } from 'react';
import { DailyExpense } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { formatCurrency } from '../utils';

const RATE_PARTY_LABELS = [
  { value: 'mine-quarry', label: 'Mine & Quarry' },
  { value: 'vendor-customer', label: 'Vendor & Customer' },
  { value: 'royalty-owner', label: 'Royalty Owner' },
  { value: 'transport-owner', label: 'Transport & Owner' },
];

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
}

const DailyExpenseForm: React.FC<DailyExpenseFormProps> = ({
  onSave,
  onClose,
  onSubmitSuccess,
  initialData,
  expenses,
  openingBalance,
  isViewMode = false,
  defaultSiteExpense,
}) => {
  const { currentUser } = useAuth();
  const {
    mineQuarries,
    vendorCustomers,
    royaltyOwnerProfiles,
    transportOwnerProfiles,
    loadMineQuarries,
    loadVendorCustomers,
    loadRoyaltyOwnerProfiles,
    loadTransportOwnerProfiles,
  } = useData();
  const [formData, setFormData] = useState({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    from: currentUser?.name || '',
    to: initialData?.to || '',
    via: initialData?.via || '',
    headAccount: initialData?.headAccount || '',
    ratePartyType: initialData?.ratePartyType || '',
    ratePartyId: initialData?.ratePartyId || '',
    amount: initialData?.amount || 0,
    category: initialData?.category || '',
    subCategory: initialData?.subCategory || '',
    remarks: initialData?.remarks || '',
    type: initialData?.type || 'DEBIT',
  });
  const [isBusinessExpense, setIsBusinessExpense] = useState(
    defaultSiteExpense ?? Boolean(initialData?.siteExpense || initialData?.ratePartyType || initialData?.ratePartyId)
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const ratePartyOptions = useMemo(() => {
    switch (formData.ratePartyType) {
      case 'mine-quarry':
        return mineQuarries.map(item => ({ id: item.id, name: item.name }));
      case 'vendor-customer':
        return vendorCustomers.map(item => ({ id: item.id, name: item.name }));
      case 'royalty-owner':
        return royaltyOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
      case 'transport-owner':
        return transportOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
      default:
        return [];
    }
  }, [formData.ratePartyType, mineQuarries, vendorCustomers, royaltyOwnerProfiles, transportOwnerProfiles]);

  const allDestinations = useMemo(() => Array.from(new Set(expenses.map(e => e.to))), [expenses]);

  useEffect(() => {
    if (currentUser?.name && formData.from !== currentUser.name) {
      setFormData(prev => ({ ...prev, from: currentUser.name }));
    }
  }, [currentUser, formData.from]);

  useEffect(() => {
    if (!isBusinessExpense || !formData.ratePartyType) return;
    switch (formData.ratePartyType) {
      case 'mine-quarry':
        loadMineQuarries();
        break;
      case 'vendor-customer':
        loadVendorCustomers();
        break;
      case 'royalty-owner':
        loadRoyaltyOwnerProfiles();
        break;
      case 'transport-owner':
        loadTransportOwnerProfiles();
        break;
      default:
        break;
    }
  }, [
    isBusinessExpense,
    formData.ratePartyType,
    loadMineQuarries,
    loadVendorCustomers,
    loadRoyaltyOwnerProfiles,
    loadTransportOwnerProfiles,
  ]);

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(p => ({ ...p, to: value }));
    if (value) {
      setSuggestions(allDestinations.filter(d => d.toLowerCase().includes(value.toLowerCase())).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    if (formData.ratePartyId) {
      const selected = ratePartyOptions.find(item => item.id === formData.ratePartyId);
      if (selected) {
        setFormData(prev => ({
          ...prev,
          to: selected.name,
        }));
      }
    }
  }, [formData.ratePartyId, ratePartyOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...formData, siteExpense: isBusinessExpense, counterpartyName: '' } as Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>, initialData?.id);
    onSubmitSuccess?.();
  };

  const getAvailableBalance = () => {
    if (initialData) return initialData.availableBalance;

    const sorted = [...expenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
        <div className="sm:col-span-3 flex justify-around p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Available Balance</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(availableBalance)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Closing Balance</p>
            <p className={`text-2xl font-bold ${isLowBalance ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
              {formatCurrency(closingBalance)}
            </p>
          </div>
        </div>

        <InputField label="Date" id="date" name="date" type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} isReadOnly={isViewMode} required />

        <InputField label="Transaction Type" id="type" name="type" type="select" value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value as 'DEBIT' | 'CREDIT' }))} isReadOnly={isViewMode} required>
          <option value="DEBIT">Expense (Money Out)</option>
          <option value="CREDIT">Money In / Top Up</option>
        </InputField>

        <InputField label="Amount" id="amount" name="amount" type="number" step="0.01" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value === '' ? '' : parseFloat(e.target.value) }))} isReadOnly={isViewMode} required />

        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
          <div className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={isBusinessExpense}
                onChange={e => {
                  const checked = e.target.checked;
                  setIsBusinessExpense(checked);
                  if (!checked) {
                    setFormData(prev => ({ ...prev, ratePartyType: '', ratePartyId: '' }));
                  }
                }}
                disabled={isViewMode}
              />
              Site Expense
            </label>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Check this box to link this transaction to a rate party.</p>
          </div>
          <InputField label="Via (Optional)" id="via" name="via" type="text" value={formData.via} onChange={e => setFormData(p => ({ ...p, via: e.target.value }))} isReadOnly={isViewMode} />
          <div className="relative">
            <InputField label={formData.type === 'DEBIT' ? 'To (Destination)' : 'From (Source)'} id="to" name="to" type="text" value={formData.to} onChange={handleToChange} isReadOnly={isViewMode} required autoComplete="off" />
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
          {isBusinessExpense && (
            <>
              <InputField label="Rate Party Type" id="ratePartyType" name="ratePartyType" type="select" value={formData.ratePartyType} onChange={e => setFormData(p => ({ ...p, ratePartyType: e.target.value, ratePartyId: '' }))} isReadOnly={isViewMode}>
                <option value="">Select rate party type...</option>
                {RATE_PARTY_LABELS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </InputField>
              <InputField label="Rate Party" id="ratePartyId" name="ratePartyId" type="select" value={formData.ratePartyId} onChange={e => setFormData(p => ({ ...p, ratePartyId: e.target.value }))} isReadOnly={isViewMode}>
                <option value="">Select rate party...</option>
                {ratePartyOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </InputField>
            </>
          )}
        </div>
        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <InputField label="Head Account" id="headAccount" name="headAccount" type="text" value={formData.headAccount} onChange={e => setFormData(p => ({ ...p, headAccount: e.target.value }))} isReadOnly={isViewMode} required />
          <InputField label="Category" id="category" name="category" type="text" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} isReadOnly={isViewMode} />
          <InputField label="Sub-Category" id="subCategory" name="subCategory" type="text" value={formData.subCategory} onChange={e => setFormData(p => ({ ...p, subCategory: e.target.value }))} isReadOnly={isViewMode} />
        </div>
        <div className="sm:col-span-3">
          <InputField label="Remarks" id="remarks" name="remarks" type="textarea" value={formData.remarks} onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))} isReadOnly={isViewMode} />
        </div>
      </div>
      <div className="pt-8 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
        >
          {isViewMode ? 'Close' : 'Cancel'}
        </button>
        {!isViewMode && (
          <button
            type="submit"
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none"
          >
            Save Transaction
          </button>
        )}
      </div>
    </form>
  );
};

export default DailyExpenseForm;
