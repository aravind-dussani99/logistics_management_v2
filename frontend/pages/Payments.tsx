import React, { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import PaymentForm from '../components/PaymentForm';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { Payment } from '../types';

const Payments: React.FC = () => {
  const data = useData();
  const {
    addPayment,
    loadPayments,
    loadVendorCustomers,
    loadMineQuarries,
    loadRoyaltyOwnerProfiles,
    loadTransportOwnerProfiles,
    refreshKey,
  } = data;
  const { alert } = useUI();
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    loadPayments?.();
    loadVendorCustomers?.();
    loadMineQuarries?.();
    loadRoyaltyOwnerProfiles?.();
    loadTransportOwnerProfiles?.();
  }, [loadPayments, loadVendorCustomers, loadMineQuarries, loadRoyaltyOwnerProfiles, loadTransportOwnerProfiles, refreshKey]);

  const handleReset = () => {
    setFormKey(prev => prev + 1);
  };

  const handleSave = async (data: Omit<Payment, 'id'>) => {
    await addPayment(data);
    await alert('Payment Saved', 'Payment recorded successfully.', { confirmText: 'OK' });
    handleReset();
  };

  return (
    <div className="relative">
      <PageHeader
        title="Payments"
        subtitle="Add payment and receipt entries."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showAddAction={false}
      />
      <main className="pt-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <PaymentForm
            key={formKey}
            onSave={handleSave}
            onClose={handleReset}
            onSecondary={handleReset}
            secondaryLabel="Re-set"
            submitLabel="Add Payment"
          />
        </div>
      </main>
    </div>
  );
};

export default Payments;
