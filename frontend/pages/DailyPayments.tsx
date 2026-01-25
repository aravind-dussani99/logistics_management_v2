import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import DailyExpenseForm from '../components/DailyExpenseForm';
import { DailyExpense } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

const DailyPayments: React.FC = () => {
  const { currentUser } = useAuth();
  const { addDailyExpense, getDailyExpenses } = useData();
  const { alert } = useUI();
  const [formKey, setFormKey] = useState(0);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);

  useEffect(() => {
    if (!currentUser?.name || !getDailyExpenses) return;
    getDailyExpenses(currentUser.name)
      .then(setExpenses)
      .catch(() => setExpenses([]));
  }, [currentUser, getDailyExpenses, formKey]);

  const handleReset = () => {
    setFormKey(prev => prev + 1);
  };

  const handleSave = async (data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>) => {
    await addDailyExpense(data);
    await alert('Daily Payment Saved', 'Daily payment recorded successfully.', { confirmText: 'OK' });
    handleReset();
  };

  return (
    <div className="relative">
      <PageHeader
        title="Daily Payments"
        subtitle="Record daily payment entries and receipts."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showAddAction={false}
      />
      <main className="pt-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <DailyExpenseForm
            key={formKey}
            onSave={handleSave}
            onClose={handleReset}
            onSubmitSuccess={handleReset}
            initialData={undefined}
            expenses={expenses}
            openingBalance={0}
            cancelLabel="Re-set"
            submitLabel="Add Daily Payment"
          />
        </div>
      </main>
    </div>
  );
};

export default DailyPayments;
