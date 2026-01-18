import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { DailyExpense, Role } from '../types';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { formatCurrency, formatDateDisplay } from '../utils';
import { dailyExpenseApi } from '../services/dailyExpenseApi';
import AlertDialog from '../components/AlertDialog';
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog';
import DailyExpenseForm from '../components/DailyExpenseForm';

const ITEMS_PER_PAGE = 10;
const RATE_PARTY_LABELS = [
    { value: 'mine-quarry', label: 'Mine & Quarry' },
    { value: 'vendor-customer', label: 'Vendor & Customer' },
    { value: 'royalty-owner', label: 'Royalty Owner' },
    { value: 'transport-owner', label: 'Transport & Owner' },
];

const getMtdRange = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return {
      dateFrom: formatDate(startOfMonth),
      dateTo: formatDate(today)
    };
};

const DailyExpenses: React.FC = () => {
    const { currentUser } = useAuth();
    const { getDailyExpenses, addDailyExpense, updateDailyExpense, deleteDailyExpense, getSupervisorAccounts, refreshKey, refreshData } = useData();
    const { openModal, closeModal } = useUI();

    const [expenses, setExpenses] = useState<DailyExpense[]>([]);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [filters, setFilters] = useState<{ dateFrom?: string; dateTo?: string; destination?: string; supervisor?: string }>(getMtdRange());
    const [currentPage, setCurrentPage] = useState(1);
    const [supervisors, setSupervisors] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'transactions' | 'insights'>('transactions');
    const [insightFilters, setInsightFilters] = useState<{ category?: string; subCategory?: string; type?: string }>({});
    const canViewAll = currentUser?.role === Role.ADMIN || currentUser?.role === Role.MANAGER || currentUser?.role === Role.ACCOUNTANT;

    const fetchData = useCallback(() => {
        if (!currentUser) return;
        if (canViewAll) {
            dailyExpenseApi.getAll().then((allExpenses) => {
                setExpenses(allExpenses);
                setOpeningBalance(0);
            });
            getSupervisorAccounts().then(setSupervisors).catch(error => {
                console.error('Failed to load supervisors', error);
            });
        } else {
            getDailyExpenses(currentUser.name).then(({ expenses, openingBalance }) => {
                setExpenses(expenses);
                setOpeningBalance(openingBalance);
            });
        }
    }, [currentUser, getDailyExpenses, getSupervisorAccounts, canViewAll]);
    
    useEffect(() => {
        fetchData();
    }, [fetchData, refreshKey]);

    const handleAddExpense = () => {
        openModal('Add New Transaction', <DailyExpenseForm onSave={handleSave} onClose={closeModal} expenses={expenses} openingBalance={openingBalance} />);
    };

    const handleEditExpense = (expense: DailyExpense) => {
        openModal('Edit Transaction', <DailyExpenseForm onSave={handleSave} onClose={closeModal} initialData={expense} expenses={expenses} openingBalance={openingBalance} />);
    };
    
    const handleViewExpense = (expense: DailyExpense) => {
        openModal('View Transaction', <DailyExpenseForm onSave={() => {}} onClose={closeModal} initialData={expense} expenses={expenses} openingBalance={openingBalance} isViewMode={true} />);
    };

    const handleDeleteExpense = async (id: string) => {
        openModal('Delete Transaction', (
            <ConfirmDeleteDialog
                message="Delete this expense? This action cannot be undone."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onCancel={closeModal}
                onConfirm={async () => {
                    await deleteDailyExpense(id);
                    refreshData();
                    closeModal();
                }}
            />
        ));
    };

    const handleSave = async (data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>, id?: string) => {
        const payload = {
            ...data,
            from: currentUser?.name || data.from,
        };
        try {
            if (id) {
                await updateDailyExpense(id, payload);
            } else {
                await addDailyExpense(payload);
            }
            refreshData(); // Trigger re-fetch
            closeModal();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save transaction.';
            openModal('Save Failed', (
                <AlertDialog message={message} onConfirm={closeModal} />
            ));
        }
    };

    const filteredExpenses = useMemo(() => {
        const openingBalanceEntry = {
            id: 'opening',
            date: '---',
            from: 'System',
            to: 'Opening Balance',
            amount: 0,
            remarks: '',
            availableBalance: 0,
            closingBalance: 0,
            type: 'CREDIT' as const,
            via: '',
            headAccount: '',
            category: '',
            subCategory: '',
            counterpartyName: '',
            siteExpense: false,
        };
        
        const allEntries = [...expenses].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const chronologicalEntries = canViewAll ? allEntries : [openingBalanceEntry, ...allEntries];

        return chronologicalEntries
            .filter(e => {
                if (e.id === 'opening') return true;
                const entryDate = e.date ? e.date.split('T')[0] : '';
                if (filters.dateFrom && entryDate < filters.dateFrom) return false;
                if (filters.dateTo && entryDate > filters.dateTo) return false;
                if (filters.destination && !(e.to || '').toLowerCase().includes(filters.destination.toLowerCase())) return false;
                if (canViewAll && filters.supervisor && e.from !== filters.supervisor) return false;
                return true;
            });
    }, [expenses, filters, openingBalance, currentUser]);

    const analyticsExpenses = useMemo(() => {
        return filteredExpenses.filter(expense => expense.id !== 'opening').filter(expense => {
            if (insightFilters.type && expense.type !== insightFilters.type) return false;
            if (insightFilters.category && (expense.category || '').toLowerCase() !== insightFilters.category.toLowerCase()) return false;
            if (insightFilters.subCategory && (expense.subCategory || '').toLowerCase() !== insightFilters.subCategory.toLowerCase()) return false;
            return true;
        });
    }, [filteredExpenses, insightFilters]);

    const categoryTotals = useMemo(() => {
        const totals = new Map<string, number>();
        analyticsExpenses.forEach(expense => {
            const key = expense.category || 'Uncategorized';
            totals.set(key, (totals.get(key) || 0) + Number(expense.amount || 0));
        });
        return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
    }, [analyticsExpenses]);

    const subCategoryTotals = useMemo(() => {
        const totals = new Map<string, number>();
        analyticsExpenses.forEach(expense => {
            const key = expense.subCategory || 'Uncategorized';
            totals.set(key, (totals.get(key) || 0) + Number(expense.amount || 0));
        });
        return Array.from(totals.entries()).map(([name, value]) => ({ name, value }));
    }, [analyticsExpenses]);

    const dailyTotals = useMemo(() => {
        const totals = new Map<string, number>();
        analyticsExpenses.forEach(expense => {
            const dateKey = expense.date ? expense.date.split('T')[0] : '';
            totals.set(dateKey, (totals.get(dateKey) || 0) + Number(expense.amount || 0));
        });
        return Array.from(totals.entries())
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [analyticsExpenses]);

    const totalSpent = useMemo(() => analyticsExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0), [analyticsExpenses]);
    const totalReceived = useMemo(() => analyticsExpenses.filter(e => e.type === 'CREDIT').reduce((sum, e) => sum + Number(e.amount || 0), 0), [analyticsExpenses]);
    const totalSpentOnly = useMemo(() => analyticsExpenses.filter(e => e.type === 'DEBIT').reduce((sum, e) => sum + Number(e.amount || 0), 0), [analyticsExpenses]);
    const topCategory = useMemo(() => categoryTotals.slice().sort((a, b) => b.value - a.value)[0], [categoryTotals]);

    const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
    const paginatedExpenses = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredExpenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredExpenses, currentPage]);

    const exportToCsv = () => {
        const headers = ["Date", "Head Account", "From", "To", "Amount", "Type", "Category", "Sub-Category", "Remarks", "Closing Balance"];
        const rows = filteredExpenses.map(e => [
            e.date,
            `"${(e.headAccount || '').replace(/"/g, '""')}"`,
            e.from,
            `"${e.to.replace(/"/g, '""')}"`,
            e.amount,
            e.type,
            `"${(e.category || '').replace(/"/g, '""')}"`,
            `"${(e.subCategory || '').replace(/"/g, '""')}"`,
            `"${e.remarks.replace(/"/g, '""')}"`,
            e.closingBalance
        ]);
        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `daily_expenses_${currentUser?.name}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const lastClosingBalance = expenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.closingBalance;
    const currentBalance = lastClosingBalance !== undefined ? lastClosingBalance : openingBalance;

    return (
        <div className="relative">
             <PageHeader
                title="Daily Expenses Tracker"
                subtitle={`Current Balance: ${formatCurrency(currentBalance)}`}
                filters={filters as any}
                onFilterChange={(f) => setFilters(f as any)}
                filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }} // Mock data, not used
                pageAction={{ label: 'Add Transaction', action: handleAddExpense }}
            />

            <main className="pt-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="px-4 pt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('transactions')}
                            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'transactions' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
                        >
                            Transactions
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('insights')}
                            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'insights' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
                        >
                            Insights
                        </button>
                    </div>
                </div>
                {activeTab === 'transactions' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mt-4">
                     <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-semibold">Transaction History</h2>
                             <input 
                                type="text"
                                placeholder="Filter by destination..."
                                value={filters.destination || ''}
                                onChange={e => setFilters(f => ({...f, destination: e.target.value }))}
                                className="px-2 py-1 text-sm rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {canViewAll && (
                                <select
                                    value={filters.supervisor || ''}
                                    onChange={e => setFilters(f => ({ ...f, supervisor: e.target.value || undefined }))}
                                    className="px-2 py-1 text-sm rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">All Supervisors</option>
                                    {supervisors.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            )}
                             <button onClick={exportToCsv} className="px-3 py-1 text-xs font-medium text-green-600 border border-green-600 rounded-md hover:bg-green-600 hover:text-white transition">
                                Export to Excel
                            </button>
                        </div>
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    {(canViewAll
                                        ? ['S. No.', 'Date', 'Supervisor', 'Opening Balance', 'Head Account', 'From/To', 'Amount', 'Category', 'Sub-Category', 'Remarks', 'Closing Balance', 'Actions']
                                        : ['S. No.', 'Date', 'Opening Balance', 'Head Account', 'From/To', 'Amount', 'Category', 'Sub-Category', 'Remarks', 'Closing Balance', 'Actions']
                                    ).map(h => (
                                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {(() => {
                                    const rows: React.ReactNode[] = [];
                                    let lastDate = '';
                                    const colSpan = canViewAll ? 12 : 11;
                                    paginatedExpenses.forEach((expense, index) => {
                                        const dateLabel = formatDateDisplay(expense.date);
                                        if (canViewAll && dateLabel !== lastDate) {
                                            rows.push(
                                                <tr key={`group-${dateLabel}`} className="bg-gray-50 dark:bg-gray-700">
                                                    <td colSpan={colSpan} className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                                                        {dateLabel}
                                                    </td>
                                                </tr>
                                            );
                                            lastDate = dateLabel;
                                        }
                                        rows.push(
                                            <tr key={expense.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{dateLabel}</td>
                                                {canViewAll && (
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{expense.from || '-'}</td>
                                                )}
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{formatCurrency(expense.availableBalance || 0)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{expense.headAccount || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    {expense.type === 'CREDIT' ? `From: ${expense.to}` : `To: ${expense.to}`}
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${expense.type === 'DEBIT' ? 'text-red-500' : 'text-green-500'}`}>
                                                    {expense.type === 'DEBIT' ? '-' : '+'} {formatCurrency(expense.amount)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{expense.category || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">{expense.subCategory || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm max-w-xs truncate">{expense.remarks}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{formatCurrency(expense.closingBalance)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                    {expense.id !== 'opening' && <>
                                                        <button onClick={() => handleViewExpense(expense as DailyExpense)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                                        <button onClick={() => handleEditExpense(expense as DailyExpense)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                                                        <button onClick={() => handleDeleteExpense(expense.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                                                    </>}
                                                </td>
                                            </tr>
                                        );
                                    });
                                    return rows;
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}
                {activeTab === 'insights' && (
                    <div className="mt-4 space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-wrap gap-4 items-end">
                            <div className="min-w-[220px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Category</label>
                                <select
                                    value={insightFilters.category || ''}
                                    onChange={e => setInsightFilters(f => ({ ...f, category: e.target.value || undefined }))}
                                    className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">All Categories</option>
                                    {categoryTotals.map(item => (
                                        <option key={item.name} value={item.name}>{item.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="min-w-[220px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Sub-Category</label>
                                <select
                                    value={insightFilters.subCategory || ''}
                                    onChange={e => setInsightFilters(f => ({ ...f, subCategory: e.target.value || undefined }))}
                                    className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">All Sub-Categories</option>
                                    {subCategoryTotals.map(item => (
                                        <option key={item.name} value={item.name}>{item.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="min-w-[180px]">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Type</label>
                                <select
                                    value={insightFilters.type || ''}
                                    onChange={e => setInsightFilters(f => ({ ...f, type: e.target.value || undefined }))}
                                    className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">All</option>
                                    <option value="DEBIT">Expense</option>
                                    <option value="CREDIT">Money In</option>
                                </select>
                            </div>
                            <button onClick={exportToCsv} className="px-3 py-2 text-xs font-medium text-green-600 border border-green-600 rounded-md hover:bg-green-600 hover:text-white transition">
                                Export to Excel
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Received</p>
                                <p className="text-2xl font-semibold">{formatCurrency(totalReceived)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Spend</p>
                                <p className="text-2xl font-semibold">{formatCurrency(totalSpentOnly)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Available Balance</p>
                                <p className="text-2xl font-semibold">{formatCurrency(currentBalance)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Top Category</p>
                                <p className="text-lg font-semibold">{topCategory?.name || '-'}</p>
                                <p className="text-sm text-gray-500">{topCategory ? formatCurrency(topCategory.value) : ''}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-80">
                                <h3 className="text-sm font-semibold mb-2">Spend by Category</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={categoryTotals}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                        <Legend />
                                        <Bar dataKey="value" name="Amount" fill="#2563eb" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-80">
                                <h3 className="text-sm font-semibold mb-2">Spend by Sub-Category</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                        <Pie data={subCategoryTotals} dataKey="value" nameKey="name" outerRadius={100} label>
                                            {subCategoryTotals.map((_, idx) => (
                                                <Cell key={idx} fill={['#0ea5e9', '#22c55e', '#f97316', '#e11d48', '#8b5cf6'][idx % 5]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-80">
                            <h3 className="text-sm font-semibold mb-2">Daily Spend Trend</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dailyTotals}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                    <Line type="monotone" dataKey="value" name="Amount" stroke="#16a34a" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                            <div className="p-4 border-b dark:border-gray-700">
                                <h3 className="text-sm font-semibold">Category Details</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            {['Date', 'From/To', 'Amount', 'Category', 'Sub-Category', 'Remarks'].map(header => (
                                                <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {analyticsExpenses.map(row => (
                                            <tr key={row.id}>
                                                <td className="px-6 py-3 text-sm">{formatDateDisplay(row.date)}</td>
                                                <td className="px-6 py-3 text-sm">{row.type === 'CREDIT' ? `From: ${row.to}` : `To: ${row.to}`}</td>
                                                <td className={`px-6 py-3 text-sm font-semibold ${row.type === 'DEBIT' ? 'text-red-500' : 'text-green-500'}`}>
                                                    {row.type === 'DEBIT' ? '-' : '+'} {formatCurrency(row.amount)}
                                                </td>
                                                <td className="px-6 py-3 text-sm">{row.category || '-'}</td>
                                                <td className="px-6 py-3 text-sm">{row.subCategory || '-'}</td>
                                                <td className="px-6 py-3 text-sm max-w-xs truncate">{row.remarks || '-'}</td>
                                            </tr>
                                        ))}
                                        {analyticsExpenses.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-6 text-center text-sm text-gray-500">
                                                    No data for selected filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DailyExpenses;
