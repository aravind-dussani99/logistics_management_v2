import React, { useMemo, useState } from 'react';
import { Payment, PaymentType, RatePartyType } from '../types';
import { useData } from '../contexts/DataContext';

interface PaymentFormProps {
  initialData?: Payment;
  onSave: (data: Omit<Payment, 'id'>, id?: string) => void;
  onClose: () => void;
  isViewMode?: boolean;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ initialData, onSave, onClose, isViewMode = false }) => {
  const { vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles } = useData();
  const [date, setDate] = useState(initialData?.date?.split('T')[0] || '');
  const [type, setType] = useState<PaymentType>(initialData?.type || PaymentType.PAYMENT);
  const [ratePartyType, setRatePartyType] = useState<RatePartyType | ''>((initialData?.ratePartyType as RatePartyType) || '');
  const [ratePartyId, setRatePartyId] = useState(initialData?.ratePartyId || '');
  const [counterpartyName, setCounterpartyName] = useState(initialData?.counterpartyName || '');
  const [amount, setAmount] = useState(initialData?.amount || 0);
  const [method, setMethod] = useState(initialData?.method || '');
  const [remarks, setRemarks] = useState(initialData?.remarks || '');
  const [tripId, setTripId] = useState(initialData?.tripId ? String(initialData.tripId) : '');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return;
    const payload: Omit<Payment, 'id'> = {
      date,
      type,
      amount: Number(amount) || 0,
      ratePartyType: ratePartyType || undefined,
      ratePartyId: ratePartyId || undefined,
      counterpartyName: counterpartyName || undefined,
      method: method || undefined,
      remarks: remarks || undefined,
      tripId: tripId ? Number(tripId) : undefined,
    };
    onSave(payload, initialData?.id);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="payment-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
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
          <label htmlFor="payment-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
          <select
            id="payment-type"
            value={type}
            onChange={(e) => setType(e.target.value as PaymentType)}
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={PaymentType.PAYMENT}>Payment</option>
            <option value={PaymentType.RECEIPT}>Receipt</option>
          </select>
        </div>
        <div>
          <label htmlFor="rate-party-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rate Party Type</label>
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
          <label htmlFor="rate-party" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rate Party</label>
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
          <label htmlFor="counterparty" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Counterparty Name</label>
          <input
            id="counterparty"
            type="text"
            value={counterpartyName}
            onChange={(e) => setCounterpartyName(e.target.value)}
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
          <input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            required
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="method" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Method</label>
          <input
            id="method"
            type="text"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="trip-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Trip ID (optional)</label>
          <input
            id="trip-id"
            type="number"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            disabled={isViewMode}
            className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
          />
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
