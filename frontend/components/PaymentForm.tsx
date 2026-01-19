import React, { useMemo, useState } from 'react';
import { Payment, PaymentType, RatePartyType } from '../types';
import { useData } from '../contexts/DataContext';

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
  const { vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles, trips } = useData();
  const [date, setDate] = useState(initialData?.date?.split('T')[0] || getTodayDate());
  const [type, setType] = useState<PaymentType>(initialData?.type || PaymentType.PAYMENT);
  const [headAccount, setHeadAccount] = useState(initialData?.headAccount || '');
  const [ratePartyType, setRatePartyType] = useState<RatePartyType | ''>((initialData?.ratePartyType as RatePartyType) || '');
  const [ratePartyId, setRatePartyId] = useState(initialData?.ratePartyId || '');
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [via, setVia] = useState(initialData?.via || '');
  const [fromAccount, setFromAccount] = useState(initialData?.fromAccount || '');
  const [toAccount, setToAccount] = useState(initialData?.toAccount || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [subCategory, setSubCategory] = useState(initialData?.subCategory || '');
  const [remarks, setRemarks] = useState(initialData?.remarks || '');
  const [tripId, setTripId] = useState(initialData?.tripId ? String(initialData.tripId) : '');
  const [paymentReceiptUpload, setPaymentReceiptUpload] = useState(initialData?.paymentReceiptUpload || '');

  const partyOptions = useMemo(() => {
    switch (ratePartyType) {
      case 'vendor-customer':
        return vendorCustomers.map(item => ({ id: item.id, name: item.name }));
      case 'mine-quarry':
        return mineQuarries.map(item => ({ id: item.id, name: item.name }));
      case 'transport-owner':
        return transportOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
      case 'royalty-owner':
        return royaltyOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
      default:
        return [];
    }
  }, [ratePartyType, vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const uploadData = JSON.stringify([{ name: file.name, url: result }]);
      setPaymentReceiptUpload(uploadData);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return;

    if (!ratePartyType || !ratePartyId) {
      alert('Rate Party Type and Rate Party are required');
      return;
    }

    const payload: Omit<Payment, 'id'> = {
      date,
      type,
      headAccount,
      amount: Number(amount) || 0,
      ratePartyType,
      ratePartyId,
      via: via || undefined,
      fromAccount: fromAccount || undefined,
      toAccount: toAccount || undefined,
      category: category || undefined,
      subCategory: subCategory || undefined,
      remarks: remarks || undefined,
      tripId: tripId ? Number(tripId) : undefined,
      paymentReceiptUpload: paymentReceiptUpload || undefined,
    };
    onSave(payload, initialData?.id);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <label htmlFor="payment-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date *</label>
          <input
            id="payment-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="payment-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Type *</label>
          <select
            id="payment-type"
            value={type}
            onChange={(e) => setType(e.target.value as PaymentType)}
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={PaymentType.PAYMENT}>Payment Out</option>
            <option value={PaymentType.RECEIPT}>Payment In</option>
          </select>
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
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="head-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Head Account</label>
          <input
            id="head-account"
            type="text"
            value={headAccount}
            onChange={(e) => setHeadAccount(e.target.value)}
            disabled={isViewMode}
            list="head-account-list"
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <datalist id="head-account-list">
            <option value="Cash" />
            <option value="Bank" />
            <option value="UPI" />
          </datalist>
        </div>

        <div>
          <label htmlFor="from-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300">From Account</label>
          <input
            id="from-account"
            type="text"
            value={fromAccount}
            onChange={(e) => setFromAccount(e.target.value)}
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
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
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="via" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Via (Optional)</label>
          <input
            id="via"
            type="text"
            value={via}
            onChange={(e) => setVia(e.target.value)}
            disabled={isViewMode}
            list="via-list"
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <datalist id="via-list">
            <option value="Cash" />
            <option value="Cheque" />
            <option value="NEFT" />
            <option value="RTGS" />
            <option value="UPI" />
            <option value="PhonePe" />
            <option value="GPay" />
          </datalist>
        </div>

        <div>
          <label htmlFor="rate-party-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rate Party Type *</label>
          <select
            id="rate-party-type"
            value={ratePartyType}
            onChange={(e) => {
              setRatePartyType(e.target.value as RatePartyType);
              setRatePartyId('');
            }}
            required
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select type</option>
            <option value="vendor-customer">Vendor & Customer</option>
            <option value="mine-quarry">Mine & Quarry</option>
            <option value="transport-owner">Transport & Owner</option>
            <option value="royalty-owner">Royalty Owner</option>
          </select>
        </div>

        <div>
          <label htmlFor="rate-party" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rate Party *</label>
          <select
            id="rate-party"
            value={ratePartyId}
            onChange={(e) => setRatePartyId(e.target.value)}
            required
            disabled={isViewMode || !ratePartyType}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select rate party</option>
            {partyOptions.map(option => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="trip-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Trip ID (Optional)</label>
          <input
            id="trip-id"
            type="text"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            disabled={isViewMode}
            list="trip-id-list"
            placeholder="Search trip number..."
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <datalist id="trip-id-list">
            {trips?.slice(0, 50).map(trip => (
              <option key={trip.id} value={trip.id}>Trip #{trip.id} - {trip.invoiceDCNumber}</option>
            ))}
          </datalist>
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
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <datalist id="category-list">
            <option value="Operational" />
            <option value="Administrative" />
            <option value="Maintenance" />
          </datalist>
        </div>

        <div>
          <label htmlFor="sub-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sub-Category</label>
          <input
            id="sub-category"
            type="text"
            value={subCategory}
            onChange={(e) => setSubCategory(e.target.value)}
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="payment-receipt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Receipt</label>
          <input
            id="payment-receipt"
            type="file"
            onChange={handleFileUpload}
            disabled={isViewMode}
            accept="image/*,application/pdf"
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
          {paymentReceiptUpload && (
            <p className="mt-1 text-xs text-gray-500">Receipt uploaded</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Remarks</label>
        <textarea
          id="remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={isViewMode}
          className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          rows={3}
        />
      </div>

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
