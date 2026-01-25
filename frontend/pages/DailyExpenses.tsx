import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import DailyExpenseForm from '../components/DailyExpenseForm';
import { DailyExpense } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';

const DailyExpenses: React.FC = () => {
  const { currentUser } = useAuth();
  const { addDailyExpense, getDailyExpenses } = useData();
  const { alert } = useUI();
  const [formKey, setFormKey] = useState(0);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);

  useEffect(() => {
    if (!currentUser?.name || !getDailyExpenses) return;
    getDailyExpenses(currentUser.name)
      .then(result => {
        if (result && Array.isArray(result.expenses)) {
          setExpenses(result.expenses);
          setOpeningBalance(Number(result.openingBalance || 0));
        } else {
          setExpenses([]);
          setOpeningBalance(0);
        }
      })
      .catch(() => {
        setExpenses([]);
        setOpeningBalance(0);
      });
  }, [currentUser, getDailyExpenses, formKey]);

  const handleReset = () => {
    setFormKey(prev => prev + 1);
  };

  const handleSave = async (data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>) => {
    await addDailyExpense(data);
    await alert('Daily Expense Saved', 'Daily expense recorded successfully.', { confirmText: 'OK' });
    handleReset();
  };

  return (
    <div className="relative">
      <PageHeader
        title="Daily Expenses"
        subtitle="Record daily expense and receipt entries."
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
            openingBalance={openingBalance}
            cancelLabel="Re-set"
            submitLabel="Add Daily Expense"
          />
        </div>
      </main>
    </div>
  );
};

export default DailyExpenses;
