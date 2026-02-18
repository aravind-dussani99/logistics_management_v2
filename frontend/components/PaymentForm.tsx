import React, { useMemo, useState, useEffect } from 'react';
import { Payment, PaymentType, RatePartyType, TripUploadFile, TripUploadPayload } from '../types';
import { useData } from '../contexts/DataContext';
import { formatCurrency } from '../utils';

interface PaymentFormProps {
  initialData?: Payment;
  onSave: (data: Omit<Payment, 'id'>, id?: string) => void;
  onClose: () => void;
  isViewMode?: boolean;
  submitLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  hideSecondary?: boolean;
}

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const PaymentForm: React.FC<PaymentFormProps> = ({
  initialData,
  onSave,
  onClose,
  isViewMode = false,
  submitLabel = 'Save Payment',
  secondaryLabel,
  onSecondary,
  hideSecondary = false,
}) => {
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
  const [showOptional, setShowOptional] = useState(isViewMode);
  const [previewFile, setPreviewFile] = useState<TripUploadFile | null>(null);
  const isReceipt = type === PaymentType.RECEIPT;
  const fromLabel = isReceipt ? 'From Name' : 'From';
  const toLabel = isReceipt ? 'To Account' : 'To';

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

  const normalizeName = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');


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
      if (item.fromAccount) values.add(item.fromAccount);
      if (item.toAccount) values.add(item.toAccount);
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
      if (!payment.toAccount && payment.ratePartyName && payment.type === PaymentType.RECEIPT) {
        const key = normalizeName(payment.ratePartyName);
        map.set(key, (map.get(key) || 0) + amountValue);
      }
      if (!payment.fromAccount && payment.ratePartyName && payment.type === PaymentType.PAYMENT) {
        const key = normalizeName(payment.ratePartyName);
        map.set(key, (map.get(key) || 0) - amountValue);
      }
    });
    return map;
  }, [payments]);

  const ratePartyBalances = useMemo(() => {
    const tripTotals = new Map<string, number>();
    const paymentTotals = new Map<string, number>();
    const counterpartyTotals = new Map<string, number>();

    const ensureKey = (name: string) => {
      if (!name) return;
      const key = normalizeName(name);
      if (!tripTotals.has(key)) tripTotals.set(key, 0);
      if (!paymentTotals.has(key)) paymentTotals.set(key, 0);
    };

    vendorCustomers.forEach(item => ensureKey(item.name));
    mineQuarries.forEach(item => ensureKey(item.name));
    transportOwnerProfiles.forEach(item => ensureKey(item.name));
    royaltyOwnerProfiles.forEach(item => ensureKey(item.name));
    payments.forEach(item => {
      if (item.ratePartyName) ensureKey(item.ratePartyName);
      if (!item.ratePartyName && item.fromAccount) ensureKey(item.fromAccount);
      if (!item.ratePartyName && item.toAccount) ensureKey(item.toAccount);
    });

    const addTripAmount = (name: string, amountValue: number) => {
      if (!name) return;
      const key = normalizeName(name);
      tripTotals.set(key, (tripTotals.get(key) || 0) + amountValue);
    };

    trips.forEach(trip => {
      const customerName = trip.actualVendorCustomerName || trip.customer || '';
      addTripAmount(customerName, Number(trip.revenue || 0));
      addTripAmount(trip.quarryName || '', Number(trip.materialCost || 0));
      addTripAmount(trip.transporterName || '', Number(trip.transportCost || 0));
      addTripAmount(trip.royaltyOwnerName || '', Number(trip.royaltyCost || 0));
    });

    payments.forEach(payment => {
      const resolvedName = payment.ratePartyName
        || (payment.ratePartyType && payment.ratePartyId
          ? ratePartyNameById.get(`${payment.ratePartyType}:${payment.ratePartyId}`) || ''
          : '');
      const amountValue = Number(payment.amount || 0);
      if (resolvedName) {
        const key = normalizeName(resolvedName);
        const partyType = payment.ratePartyType || ratePartyTypeByName.get(key);
        if (partyType) {
          const signedAmount = partyType === 'vendor-customer'
            ? (payment.type === PaymentType.RECEIPT ? amountValue : -amountValue)
            : (payment.type === PaymentType.PAYMENT ? amountValue : -amountValue);
          paymentTotals.set(key, (paymentTotals.get(key) || 0) + signedAmount);
        } else {
          const delta = payment.type === PaymentType.RECEIPT ? amountValue : -amountValue;
          counterpartyTotals.set(key, (counterpartyTotals.get(key) || 0) + delta);
        }
        if (payment.type === PaymentType.RECEIPT && payment.fromAccount) {
          const key = normalizeName(payment.fromAccount);
          counterpartyTotals.set(key, (counterpartyTotals.get(key) || 0) + amountValue);
        }
        if (payment.type === PaymentType.PAYMENT && payment.toAccount) {
          const key = normalizeName(payment.toAccount);
          counterpartyTotals.set(key, (counterpartyTotals.get(key) || 0) - amountValue);
        }
        return;
      }

      if (payment.type === PaymentType.RECEIPT && payment.fromAccount) {
        const key = normalizeName(payment.fromAccount);
        paymentTotals.set(key, (paymentTotals.get(key) || 0) - amountValue);
        counterpartyTotals.set(key, (counterpartyTotals.get(key) || 0) + amountValue);
      }
      if (payment.type === PaymentType.PAYMENT && payment.toAccount) {
        const key = normalizeName(payment.toAccount);
        paymentTotals.set(key, (paymentTotals.get(key) || 0) + amountValue);
        counterpartyTotals.set(key, (counterpartyTotals.get(key) || 0) - amountValue);
      }
    });

    const balances = new Map<string, number>();
    const allKeys = new Set<string>([...tripTotals.keys(), ...paymentTotals.keys(), ...counterpartyTotals.keys()]);
    allKeys.forEach(key => {
      const tripTotal = tripTotals.get(key) || 0;
      const paid = paymentTotals.get(key) || 0;
      if (tripTotal !== 0 || ratePartyTypeByName.has(key)) {
        balances.set(key, tripTotal - paid);
      } else {
        balances.set(key, counterpartyTotals.get(key) || 0);
      }
    });
    return balances;
  }, [trips, payments, ratePartyNameById, ratePartyTypeByName, vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles]);

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

  const resolvedFromBalance = fromAccount ? (accountBalances.get(normalizeName(fromAccount)) ?? 0) : undefined;
  const resolvedToBalance = toAccount ? (accountBalances.get(normalizeName(toAccount)) ?? 0) : undefined;
  const resolvedRatePartyBalance = ratePartyName ? (ratePartyBalances.get(normalizeName(ratePartyName)) ?? 0) : undefined;
  const amountValue = Number(amount || 0);
  const resolvedPartyMeta = ratePartyName ? resolveRateParty(ratePartyName) : null;
  const projectedFromBalance = resolvedFromBalance !== undefined
    ? resolvedFromBalance - (Number.isNaN(amountValue) ? 0 : amountValue)
    : undefined;
  const projectedRatePartyBalance = resolvedRatePartyBalance !== undefined
    ? (() => {
      if (Number.isNaN(amountValue)) return resolvedRatePartyBalance;
      if (resolvedPartyMeta?.type === 'vendor-customer') {
        return type === PaymentType.RECEIPT
          ? resolvedRatePartyBalance - amountValue
          : resolvedRatePartyBalance + amountValue;
      }
      if (resolvedPartyMeta?.type) {
        return type === PaymentType.PAYMENT
          ? resolvedRatePartyBalance - amountValue
          : resolvedRatePartyBalance + amountValue;
      }
      return type === PaymentType.PAYMENT
        ? resolvedRatePartyBalance - amountValue
        : resolvedRatePartyBalance + amountValue;
    })()
    : undefined;

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

  const isImageFile = (file: TripUploadFile) => {
    const name = file.name.toLowerCase();
    return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif') || name.endsWith('.webp');
  };

  const isPreviewable = (file: TripUploadFile) => Boolean(file.url);

  const renderUploadList = (label: string, list: TripUploadFile[]) => {
    return (
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return;
    setErrorMessage('');

    if (!date || !type || !fromAccount || !ratePartyName || !amount || !remarks) {
      setErrorMessage('Date, transaction type, from, to, amount, and remarks are required.');
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Type *</label>
          <div className="mt-1 inline-flex w-full rounded-full border border-gray-300 bg-white p-1 shadow-sm dark:border-gray-600 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setType(PaymentType.PAYMENT)}
              disabled={isViewMode}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${type === PaymentType.PAYMENT ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}
            >
              Payment Out
            </button>
            <button
              type="button"
              onClick={() => setType(PaymentType.RECEIPT)}
              disabled={isViewMode}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${type === PaymentType.RECEIPT ? 'bg-primary text-white shadow' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'}`}
            >
              Payment In
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="from-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{fromLabel} *</label>
          <input
            id="from-account"
            type="text"
            value={fromAccount}
            onChange={(e) => setFromAccount(e.target.value)}
            disabled={isViewMode}
            list={fromAccount ? "account-list" : undefined}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          />
          {resolvedFromBalance !== undefined && (
            <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">Balance: {formatCurrency(resolvedFromBalance)}</p>
          )}
        </div>
        <div>
          <label htmlFor="via" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Via (Optional)</label>
          <input
            id="via"
            type="text"
            value={via}
            onChange={(e) => setVia(e.target.value)}
            disabled={isViewMode}
            list={via ? "via-list" : undefined}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div>
          <label htmlFor="rate-party-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{toLabel} *</label>
          <input
            id="rate-party-name"
            type="text"
            value={ratePartyName}
            onChange={(e) => setRatePartyName(e.target.value)}
            disabled={isViewMode}
            list={ratePartyName ? "rate-party-list" : undefined}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          />
          {resolvedRatePartyBalance !== undefined && (
            <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">Balance: {formatCurrency(resolvedRatePartyBalance)}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount *</label>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start">
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onWheel={(event) => event.currentTarget.blur()}
              required
              disabled={isViewMode}
              placeholder="Enter amount"
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 sm:max-w-[11rem]"
            />
            {projectedRatePartyBalance !== undefined && (
              <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 sm:ml-28 sm:-mt-8">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">To after:</div>
                  <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(projectedRatePartyBalance)}</div>
                </div>
              </div>
            )}
          </div>
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

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/40">
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
          {!hideSecondary && (
            <button
              type="button"
              onClick={onSecondary || onClose}
              className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
            >
              {isViewMode ? 'Close' : (secondaryLabel || 'Cancel')}
            </button>
          )}
          {!isViewMode && (
            <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
              {submitLabel}
            </button>
          )}
        </div>
      </div>
      {showOptional && (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <label htmlFor="head-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Head Account</label>
            <input
              id="head-account"
              type="text"
            value={headAccount}
            onChange={(e) => setHeadAccount(e.target.value)}
            disabled={isViewMode}
            list={headAccount ? "account-list" : undefined}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          />
          </div>
          <div>
            <label htmlFor="to-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300">To Account</label>
            <input
              id="to-account"
              type="text"
            value={toAccount}
            onChange={(e) => setToAccount(e.target.value)}
            disabled={isViewMode}
            list={toAccount ? "account-list" : undefined}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
          />
            {resolvedToBalance !== undefined && (
              <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">Balance: {formatCurrency(resolvedToBalance)}</p>
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
            list={tripId ? "trip-id-list" : undefined}
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
            list={category ? "category-list" : undefined}
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
      )}

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
    </form>
  );
};

export default PaymentForm;
