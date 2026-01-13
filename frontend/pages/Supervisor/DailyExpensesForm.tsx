import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DailyExpense } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import PageHeader from '../../components/PageHeader';
import DailyExpenseForm from '../../components/DailyExpenseForm';

const SupervisorDailyExpensesForm: React.FC<{ defaultSiteExpense?: boolean; title?: string }> = ({ defaultSiteExpense, title = 'Daily Expenses' }) => {
  const { currentUser } = useAuth();
  const { getDailyExpenses, addDailyExpense, refreshData } = useData();
  const navigate = useNavigate();
  const [formKey, setFormKey] = useState(0);
  const [filters, setFilters] = useState({});
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    getDailyExpenses(currentUser.name).then(({ expenses: list, openingBalance: balance }) => {
      setExpenses(list);
      setOpeningBalance(balance);
    });
  }, [currentUser, getDailyExpenses]);

  const handleReset = () => setFormKey(prev => prev + 1);
  const handleSuccess = () => navigate('/dashboard');

  const handleSave = async (data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>) => {
    const payload = {
      ...data,
      from: currentUser?.name || data.from,
    };
    await addDailyExpense(payload);
    refreshData();
  };

  return (
    <div className="relative">
      <PageHeader
        title={title}
        filters={filters}
        onFilterChange={setFilters}
        filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
        showFilters={[]}
        showAddAction={false}
      />
      <main className="pt-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <DailyExpenseForm
            key={formKey}
            onSave={handleSave}
            onClose={handleReset}
            onSubmitSuccess={handleSuccess}
            expenses={expenses}
            openingBalance={openingBalance}
            defaultSiteExpense={defaultSiteExpense}
          />
        </div>
      </main>
    </div>
  );
};

export default SupervisorDailyExpensesForm;
