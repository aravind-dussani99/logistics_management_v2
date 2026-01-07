import React, { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import PaymentForm from '../components/PaymentForm';
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { Payment, PaymentType, RatePartyType } from '../types';
import { formatCurrency, formatDateDisplay } from '../utils';

const ITEMS_PER_PAGE = 12;

const RATE_PARTY_LABELS: Record<RatePartyType, string> = {
  'vendor-customer': 'Vendor & Customer',
  'mine-quarry': 'Mine & Quarry',
  'royalty-owner': 'Royalty Owner',
  'transport-owner': 'Transport & Owner',
};

const Payments: React.FC = () => {
  const { payments, addPayment, updatePayment, deletePayment, vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles } = useData();
  const { openModal, closeModal } = useUI();
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', type: 'all', query: '' });
  const [currentPage, setCurrentPage] = useState(1);

  const ratePartyNameById = useMemo(() => {
    const map = new Map<string, string>();
    vendorCustomers.forEach(item => map.set(`vendor-customer:${item.id}`, item.name));
    mineQuarries.forEach(item => map.set(`mine-quarry:${item.id}`, item.name));
    royaltyOwnerProfiles.forEach(item => map.set(`royalty-owner:${item.id}`, item.name));
    transportOwnerProfiles.forEach(item => map.set(`transport-owner:${item.id}`, item.name));
    return map;
  }, [vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles]);

  const filteredPayments = useMemo(() => {
    return payments
      .filter(payment => {
        const dateValue = payment.date ? payment.date.split('T')[0] : '';
        if (filters.dateFrom && dateValue < filters.dateFrom) return false;
        if (filters.dateTo && dateValue > filters.dateTo) return false;
        if (filters.type !== 'all' && payment.type !== filters.type) return false;
        if (filters.query) {
          const query = filters.query.toLowerCase();
          const ratePartyName = payment.ratePartyId && payment.ratePartyType
            ? (ratePartyNameById.get(`${payment.ratePartyType}:${payment.ratePartyId}`) || '')
            : '';
          const counterparty = payment.counterpartyName || '';
          if (!ratePartyName.toLowerCase().includes(query) && !counterparty.toLowerCase().includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, filters, ratePartyNameById]);

  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE) || 1;
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPayments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPayments, currentPage]);

  const handleAdd = () => {
    openModal('Add Payment', <PaymentForm onSave={handleSave} onClose={closeModal} />);
  };

  const handleEdit = (payment: Payment) => {
    openModal('Edit Payment', <PaymentForm initialData={payment} onSave={handleSave} onClose={closeModal} />);
  };

  const handleView = (payment: Payment) => {
    openModal('View Payment', <PaymentForm initialData={payment} onSave={() => {}} onClose={closeModal} isViewMode />);
  };

  const handleDelete = (payment: Payment) => {
    openModal('Delete Payment', (
      <ConfirmDeleteDialog
        message="Delete this payment record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={closeModal}
        onConfirm={async () => {
          await deletePayment(payment.id);
          closeModal();
        }}
      />
    ));
  };

  const handleSave = async (data: Omit<Payment, 'id'>, id?: string) => {
    if (id) {
      await updatePayment(id, data);
    } else {
      await addPayment(data);
    }
    closeModal();
  };

  const getRatePartyName = (payment: Payment) => {
    if (!payment.ratePartyType || !payment.ratePartyId) return '-';
    return ratePartyNameById.get(`${payment.ratePartyType}:${payment.ratePartyId}`) || '-';
  };

  return (
    <div className="relative">
      <PageHeader
        title="Payments"
        subtitle="Track payment and receipt entries by rate party."
        filters={{ dateFrom: filters.dateFrom, dateTo: filters.dateTo }}
        onFilterChange={(next) => setFilters(prev => ({ ...prev, ...next }))}
        filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
        showFilters={['date']}
        pageAction={{ label: 'Add Payment', action: handleAdd }}
      />
      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[200px]">
            <label className="text-xs text-gray-500 dark:text-gray-400">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All</option>
              <option value={PaymentType.PAYMENT}>Payment</option>
              <option value={PaymentType.RECEIPT}>Receipt</option>
            </select>
          </div>
          <div className="min-w-[260px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Rate Party / Counterparty</label>
            <input
              type="text"
              value={filters.query}
              onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
              placeholder="Search by name..."
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="ml-auto">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['S. No.', 'Date', 'Type', 'Rate Party Type', 'Rate Party', 'Amount', 'Method', 'Remarks', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedPayments.map((payment, index) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(payment.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${payment.type === PaymentType.PAYMENT ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {payment.type === PaymentType.PAYMENT ? 'Payment' : 'Receipt'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{payment.ratePartyType ? RATE_PARTY_LABELS[payment.ratePartyType as RatePartyType] : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getRatePartyName(payment)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${payment.type === PaymentType.PAYMENT ? 'text-red-500' : 'text-green-500'}`}>
                      {payment.type === PaymentType.PAYMENT ? '-' : '+'} {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{payment.method || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm max-w-xs truncate">{payment.remarks || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleView(payment)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                      <button onClick={() => handleEdit(payment)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDelete(payment)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedPayments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No payments found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Payments;
