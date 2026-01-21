import React, { useMemo, useState, useEffect } from 'react';
import { Payment, PaymentType, RatePartyType, TripUploadFile, TripUploadPayload } from '../types';
import { useData } from '../contexts/DataContext';
import { formatCurrency } from '../utils';

interface PaymentFormProps {
  initialData?: Payment;
  onSave: (data: Omit<Payment, 'id'>, id?: string) => void;
  onClose: () => void;
  isViewMode?: boolean;
}

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const PaymentForm: React.FC<PaymentFormProps> = ({ initialData, onSave, onClose, isViewMode = false }) => {
  const { vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles, trips, payments } = useData();
  const [date, setDate] = useState(initialData?.date?.split('T')[0] || getTodayDate());
  const [type, setType] = useState<PaymentType>(initialData?.type || PaymentType.PAYMENT);
  const [fromAccount, setFromAccount] = useState(initialData?.fromAccount || '');
  const [ratePartyName, setRatePartyName] = useState(initialData?.ratePartyName || '');
  const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : '');
  const [remarks, setRemarks] = useState(initialData?.remarks || '');
  const [headAccount, setHeadAccount] = useState(initialData?.headAccount || '');
  const [via, setVia] = useState(initialData?.via || '');
  const [toAccount, setToAccount] = useState(initialData?.toAccount || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [subCategory, setSubCategory] = useState(initialData?.subCategory || '');
  const [tripId, setTripId] = useState(initialData?.tripId ? String(initialData.tripId) : '');
  const [paymentReceiptFiles, setPaymentReceiptFiles] = useState<TripUploadFile[]>([]);
  const [bankAccountFiles, setBankAccountFiles] = useState<TripUploadFile[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

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

  const ratePartyNameById = useMemo(() => {
    const map = new Map<string, string>();
    vendorCustomers.forEach(item => map.set(`vendor-customer:${item.id}`, item.name));
    mineQuarries.forEach(item => map.set(`mine-quarry:${item.id}`, item.name));
    transportOwnerProfiles.forEach(item => map.set(`transport-owner:${item.id}`, item.name));
    royaltyOwnerProfiles.forEach(item => map.set(`royalty-owner:${item.id}`, item.name));
    return map;
  }, [vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles]);

  useEffect(() => {
    if (initialData?.ratePartyName || ratePartyName) return;
    if (initialData?.ratePartyType && initialData?.ratePartyId) {
      const name = ratePartyNameById.get(`${initialData.ratePartyType}:${initialData.ratePartyId}`);
      if (name) setRatePartyName(name);
    }
  }, [initialData, ratePartyName, ratePartyNameById]);

  useEffect(() => {
    setPaymentReceiptFiles(parseUploadValue(initialData?.paymentReceiptUploads));
    setBankAccountFiles(parseUploadValue(initialData?.bankAccountUploads));
  }, [initialData]);

  const normalizeName = (value: string) => value.trim().toLowerCase();

  const ratePartyTypeByName = useMemo(() => {
    const map = new Map<string, RatePartyType>();
    vendorCustomers.forEach(item => map.set(normalizeName(item.name), 'vendor-customer'));
    mineQuarries.forEach(item => map.set(normalizeName(item.name), 'mine-quarry'));
    transportOwnerProfiles.forEach(item => map.set(normalizeName(item.name), 'transport-owner'));
    royaltyOwnerProfiles.forEach(item => map.set(normalizeName(item.name), 'royalty-owner'));
    return map;
  }, [vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles]);

  const ratePartyOptions = useMemo(() => {
    const values = new Set<string>();
    vendorCustomers.forEach(item => values.add(item.name));
    mineQuarries.forEach(item => values.add(item.name));
    transportOwnerProfiles.forEach(item => values.add(item.name));
    royaltyOwnerProfiles.forEach(item => values.add(item.name));
    payments.forEach(item => {
      if (item.ratePartyName) values.add(item.ratePartyName);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles, payments]);

  const accountOptions = useMemo(() => {
    const values = new Set<string>();
    payments.forEach(item => {
      if (item.fromAccount) values.add(item.fromAccount);
      if (item.toAccount) values.add(item.toAccount);
      if (item.headAccount) values.add(item.headAccount);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [payments]);

  const viaOptions = useMemo(() => ['Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI', 'PhonePe', 'GPay'], []);

  const accountBalances = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach(payment => {
      const amountValue = Number(payment.amount || 0);
      if (payment.fromAccount) {
        const key = normalizeName(payment.fromAccount);
        map.set(key, (map.get(key) || 0) - amountValue);
      }
      if (payment.toAccount) {
        const key = normalizeName(payment.toAccount);
        map.set(key, (map.get(key) || 0) + amountValue);
      }
    });
    return map;
  }, [payments]);

  const ratePartyBalances = useMemo(() => {
    const tripTotals = new Map<string, number>();
    const paymentTotals = new Map<string, number>();

    const addTripAmount = (name: string, amountValue: number) => {
      if (!name) return;
      const key = normalizeName(name);
      tripTotals.set(key, (tripTotals.get(key) || 0) + amountValue);
    };

    trips.forEach(trip => {
      addTripAmount(trip.customer || '', Number(trip.revenue || 0));
      addTripAmount(trip.quarryName || '', Number(trip.materialCost || 0));
      addTripAmount(trip.transporterName || '', Number(trip.transportCost || 0));
      addTripAmount(trip.royaltyOwnerName || '', Number(trip.royaltyCost || 0));
    });

    payments.forEach(payment => {
      const resolvedName = payment.ratePartyName
        || (payment.ratePartyType && payment.ratePartyId
          ? ratePartyNameById.get(`${payment.ratePartyType}:${payment.ratePartyId}`) || ''
          : '');
      if (!resolvedName) return;
      const key = normalizeName(resolvedName);
      const partyType = payment.ratePartyType || ratePartyTypeByName.get(key);
      const amountValue = Number(payment.amount || 0);
      const signedAmount = partyType === 'vendor-customer'
        ? (payment.type === PaymentType.RECEIPT ? amountValue : -amountValue)
        : (payment.type === PaymentType.PAYMENT ? amountValue : -amountValue);
      paymentTotals.set(key, (paymentTotals.get(key) || 0) + signedAmount);
    });

    const balances = new Map<string, number>();
    tripTotals.forEach((value, key) => {
      const paid = paymentTotals.get(key) || 0;
      balances.set(key, value - paid);
    });
    paymentTotals.forEach((value, key) => {
      if (!balances.has(key)) {
        balances.set(key, -value);
      }
    });
    return balances;
  }, [trips, payments, ratePartyNameById, ratePartyTypeByName]);

  const resolvedFromBalance = fromAccount ? accountBalances.get(normalizeName(fromAccount)) : undefined;
  const resolvedToBalance = toAccount ? accountBalances.get(normalizeName(toAccount)) : undefined;
  const resolvedRatePartyBalance = ratePartyName ? ratePartyBalances.get(normalizeName(ratePartyName)) : undefined;

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    setFiles: React.Dispatch<React.SetStateAction<TripUploadFile[]>>
  ) => {
    const selected = event.target.files;
    if (!selected || selected.length === 0) return;
    const fileList = Array.from(selected);
    const entries = await Promise.all(fileList.map(file => new Promise<TripUploadFile>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, url: String(reader.result || '') });
      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
      reader.readAsDataURL(file);
    })));
    setFiles(entries);
  };

  const resolveRateParty = (name: string) => {
    const normalized = normalizeName(name);
    if (!normalized) return null;
    const matches: { type: RatePartyType; id: string }[] = [];
    vendorCustomers.forEach(item => {
      if (normalizeName(item.name) === normalized) matches.push({ type: 'vendor-customer', id: item.id });
    });
    mineQuarries.forEach(item => {
      if (normalizeName(item.name) === normalized) matches.push({ type: 'mine-quarry', id: item.id });
    });
    transportOwnerProfiles.forEach(item => {
      if (normalizeName(item.name) === normalized) matches.push({ type: 'transport-owner', id: item.id });
    });
    royaltyOwnerProfiles.forEach(item => {
      if (normalizeName(item.name) === normalized) matches.push({ type: 'royalty-owner', id: item.id });
    });
    if (matches.length === 1) return matches[0];
    return null;
  };

  const renderUploadList = (label: string, list: TripUploadFile[]) => {
    if (!list.length) return null;
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        <div className="grid gap-2">
          {list.map((file, idx) => (
            <a
              key={`${file.name}-${idx}`}
              href={file.url || '#'}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              {file.name}
            </a>
          ))}
        </div>
      </div>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return;
    setErrorMessage('');

    if (!date || !type || !fromAccount || !toAccount || !ratePartyName || !amount || !remarks) {
      setErrorMessage('Date, transaction type, from account, to account, counterparty name, amount, and remarks are required.');
      return;
    }

    const amountValue = Number(amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setErrorMessage('Amount must be greater than 0.');
      return;
    }

    const resolvedParty = resolveRateParty(ratePartyName);
    const payload: Omit<Payment, 'id'> = {
      date,
      type,
      amount: amountValue,
      fromAccount,
      ratePartyName,
      remarks,
      headAccount: headAccount || undefined,
      via: via || undefined,
      toAccount: toAccount || undefined,
      category: category || undefined,
      subCategory: subCategory || undefined,
      tripId: tripId ? Number(tripId) : undefined,
      ratePartyType: resolvedParty?.type,
      ratePartyId: resolvedParty?.id,
      paymentReceiptUploads: paymentReceiptFiles.length ? paymentReceiptFiles : undefined,
      bankAccountUploads: bankAccountFiles.length ? bankAccountFiles : undefined,
    };
    onSave(payload, initialData?.id);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-8">
      {errorMessage && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div>
          <label htmlFor="payment-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date *</label>
          <input
            id="payment-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={isViewMode}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div>
          <label htmlFor="payment-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Type *</label>
          <select
            id="payment-type"
            value={type}
            onChange={(e) => setType(e.target.value as PaymentType)}
            disabled={isViewMode}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          >
            <option value={PaymentType.PAYMENT}>Payment Out</option>
            <option value={PaymentType.RECEIPT}>Payment In</option>
          </select>
        </div>
        <div>
          <label htmlFor="from-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300">From Account *</label>
          <input
            id="from-account"
            type="text"
            value={fromAccount}
            onChange={(e) => setFromAccount(e.target.value)}
            disabled={isViewMode}
            list="account-list"
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          />
          {resolvedFromBalance !== undefined && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Balance: {formatCurrency(resolvedFromBalance)}</p>
          )}
        </div>
        <div>
          <label htmlFor="rate-party-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Counterparty Name *</label>
          <input
            id="rate-party-name"
            type="text"
            value={ratePartyName}
            onChange={(e) => setRatePartyName(e.target.value)}
            disabled={isViewMode}
            list="rate-party-list"
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          />
          {resolvedRatePartyBalance !== undefined && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Balance: {formatCurrency(resolvedRatePartyBalance)}</p>
          )}
        </div>
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount *</label>
          <input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            disabled={isViewMode}
            placeholder="Enter amount"
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Remarks *</label>
          <textarea
            id="remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={isViewMode}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/40">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Optional Details</h4>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <label htmlFor="head-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Head Account</label>
            <input
              id="head-account"
              type="text"
              value={headAccount}
              onChange={(e) => setHeadAccount(e.target.value)}
              disabled={isViewMode}
              list="account-list"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="via" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Via</label>
            <input
              id="via"
              type="text"
              value={via}
              onChange={(e) => setVia(e.target.value)}
              disabled={isViewMode}
              list="via-list"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="to-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300">To Account *</label>
            <input
              id="to-account"
              type="text"
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              disabled={isViewMode}
              list="account-list"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
            />
            {resolvedToBalance !== undefined && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Balance: {formatCurrency(resolvedToBalance)}</p>
            )}
          </div>
          <div>
            <label htmlFor="trip-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Trip ID</label>
            <input
              id="trip-id"
              type="text"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              disabled={isViewMode}
              list="trip-id-list"
              placeholder="Search trip number..."
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isViewMode}
              list="category-list"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="sub-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sub-Category</label>
            <input
              id="sub-category"
              type="text"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              disabled={isViewMode}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="payment-receipt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Receipt</label>
            {isViewMode ? (
              renderUploadList('Receipts', paymentReceiptFiles)
            ) : (
              <input
                id="payment-receipt"
                type="file"
                onChange={(event) => handleFileChange(event, setPaymentReceiptFiles)}
                disabled={isViewMode}
                accept="image/*,application/pdf"
                multiple
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
              />
            )}
          </div>
          <div>
            <label htmlFor="bank-account-attachment" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Account Details</label>
            {isViewMode ? (
              renderUploadList('Bank Details', bankAccountFiles)
            ) : (
              <input
                id="bank-account-attachment"
                type="file"
                onChange={(event) => handleFileChange(event, setBankAccountFiles)}
                disabled={isViewMode}
                accept="image/*,application/pdf"
                multiple
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
              />
            )}
          </div>
        </div>
      </div>

      <datalist id="account-list">
        {accountOptions.map(value => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="rate-party-list">
        {ratePartyOptions.map(value => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="via-list">
        {viaOptions.map(value => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="trip-id-list">
        {trips?.slice(0, 100).map(trip => (
          <option key={trip.id} value={trip.id}>Trip #{trip.id} - {trip.invoiceDCNumber}</option>
        ))}
      </datalist>
      <datalist id="category-list">
        <option value="Operational" />
        <option value="Administrative" />
        <option value="Maintenance" />
      </datalist>

      <div className="pt-4 flex justify-end space-x-3">
        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          {isViewMode ? 'Close' : 'Cancel'}
        </button>
        {!isViewMode && (
          <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
            Save Payment
          </button>
        )}
      </div>
    </form>
  );
};

export default PaymentForm;
