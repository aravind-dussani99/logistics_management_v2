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
    const { getDailyExpenses, addDailyExpense, updateDailyExpense, deleteDailyExpense, getSupervisorAccounts } = useData();
    const { openModal, closeModal } = useUI();

    const [expenses, setExpenses] = useState<DailyExpense[]>([]);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [filters, setFilters] = useState<{ dateFrom?: string; dateTo?: string; destination?: string; supervisor?: string }>(getMtdRange());
    const [currentPage, setCurrentPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
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
        openModal('Add New Transaction', <ExpenseForm onSave={handleSave} onClose={closeModal} expenses={expenses} openingBalance={openingBalance} />);
    };

    const handleEditExpense = (expense: DailyExpense) => {
        openModal('Edit Transaction', <ExpenseForm onSave={handleSave} onClose={closeModal} initialData={expense} expenses={expenses} openingBalance={openingBalance} />);
    };
    
    const handleViewExpense = (expense: DailyExpense) => {
        openModal('View Transaction', <ExpenseForm onSave={() => {}} onClose={closeModal} initialData={expense} expenses={expenses} openingBalance={openingBalance} isViewMode={true} />);
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
                    setRefreshKey(k => k + 1);
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
            setRefreshKey(k => k + 1); // Trigger re-fetch
            closeModal();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save transaction.';
            openModal('Save Failed', (
                <AlertDialog message={message} onConfirm={closeModal} />
            ));
        }
    };

    const filteredExpenses = useMemo(() => {
        const openingBalanceEntry = { id: 'opening', date: '---', from: 'System', to: 'Opening Balance', amount: 0, remarks: '', availableBalance: 0, closingBalance: 0, type: 'CREDIT' as const, via: '', category: '', subCategory: '', counterpartyName: '' };
        
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
        const headers = ["Date", "From", "To", "Amount", "Type", "Remarks", "Closing Balance"];
        const rows = filteredExpenses.map(e => [
            e.date,
            e.from,
            `"${e.to.replace(/"/g, '""')}"`,
            e.amount,
            e.type,
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
                filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }} // Mock data, not used
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
                                        ? ['S. No.', 'Date', 'Supervisor', 'Opening Balance', 'From/To', 'Amount', 'Category', 'Sub-Category', 'Remarks', 'Closing Balance', 'Actions']
                                        : ['S. No.', 'Date', 'Opening Balance', 'From/To', 'Amount', 'Category', 'Sub-Category', 'Remarks', 'Closing Balance', 'Actions']
                                    ).map(h => (
                                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {(() => {
                                    const rows: React.ReactNode[] = [];
                                    let lastDate = '';
                                    const colSpan = canViewAll ? 11 : 10;
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

// --- Form Component ---

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> & {label: string, children?: React.ReactNode, isReadOnly?: boolean}> = ({ label, children, isReadOnly, ...props }) => {
    const inputValue = props.type === 'number' && (props.value === 0 || props.value === '0') ? '' : props.value;
    return (
        <div>
            <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            {isReadOnly ? (
                 <div className="mt-1 block w-full px-3 py-2 text-gray-500 dark:text-gray-400 min-h-[42px] flex items-center bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600">{props.value}</div>
            ) : props.type === 'textarea' ? (
                <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} rows={3} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
            ) : props.type === 'select' ? (
                <select {...props as React.SelectHTMLAttributes<HTMLSelectElement>} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm">{children}</select>
            ) : (
                <input {...props} value={inputValue} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
            )}
        </div>
    );
};

interface ExpenseFormProps {
    onSave: (data: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>, id?: string) => void;
    onClose: () => void;
    initialData?: DailyExpense;
    expenses: DailyExpense[];
    openingBalance: number;
    isViewMode?: boolean;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSave, onClose, initialData, expenses, openingBalance, isViewMode = false }) => {
    const { currentUser } = useAuth();
    const { mineQuarries, vendorCustomers, royaltyOwnerProfiles, transportOwnerProfiles } = useData();
    const [formData, setFormData] = useState({
        date: initialData?.date || new Date().toISOString().split('T')[0],
        from: currentUser?.name || '',
        to: initialData?.to || '',
        via: initialData?.via || '',
        ratePartyType: initialData?.ratePartyType || '',
        ratePartyId: initialData?.ratePartyId || '',
        amount: initialData?.amount || 0,
        category: initialData?.category || '',
        subCategory: initialData?.subCategory || '',
        remarks: initialData?.remarks || '',
        type: initialData?.type || 'DEBIT',
    });
    const [isBusinessExpense, setIsBusinessExpense] = useState(Boolean(initialData?.ratePartyType || initialData?.ratePartyId));
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const ratePartyOptions = useMemo(() => {
        switch (formData.ratePartyType) {
            case 'mine-quarry':
                return mineQuarries.map(item => ({ id: item.id, name: item.name }));
            case 'vendor-customer':
                return vendorCustomers.map(item => ({ id: item.id, name: item.name }));
            case 'royalty-owner':
                return royaltyOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
            case 'transport-owner':
                return transportOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
            default:
                return [];
        }
    }, [formData.ratePartyType, mineQuarries, vendorCustomers, royaltyOwnerProfiles, transportOwnerProfiles]);

    const allDestinations = useMemo(() => Array.from(new Set(expenses.map(e => e.to))), [expenses]);

    useEffect(() => {
        if (currentUser?.name && formData.from !== currentUser.name) {
            setFormData(prev => ({ ...prev, from: currentUser.name }));
        }
    }, [currentUser, formData.from]);

    const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData(p => ({...p, to: value}));
        if (value) {
            setSuggestions(allDestinations.filter(d => d.toLowerCase().includes(value.toLowerCase())).slice(0, 5));
        } else {
            setSuggestions([]);
        }
    };

    useEffect(() => {
        if (formData.ratePartyId) {
            const selected = ratePartyOptions.find(item => item.id === formData.ratePartyId);
            if (selected) {
                setFormData(prev => ({
                    ...prev,
                    to: selected.name,
                }));
            }
        }
    }, [formData.ratePartyId, ratePartyOptions]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, counterpartyName: '' } as Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>, initialData?.id);
    };

    const getAvailableBalance = () => {
        if (initialData) return initialData.availableBalance;
        
        const sorted = [...expenses].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastExpense = sorted[sorted.length-1];
        return lastExpense ? lastExpense.closingBalance : openingBalance;
    };
    
    const availableBalance = getAvailableBalance();
    const amountChange = formData.type === 'DEBIT' ? -(Number(formData.amount) || 0) : (Number(formData.amount) || 0);
    const closingBalance = availableBalance + amountChange;
    const isLowBalance = closingBalance < (openingBalance * 0.10);

    return (
         <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="sm:col-span-3 flex justify-around p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Available Balance</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(availableBalance)}</p>
                    </div>
                     <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Closing Balance</p>
                        <p className={`text-2xl font-bold ${isLowBalance ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>{formatCurrency(closingBalance)}</p>
                    </div>
                </div>
                
                <InputField label="Date" id="date" name="date" type="date" value={formData.date} onChange={e => setFormData(p => ({...p, date: e.target.value}))} isReadOnly={isViewMode} required />
                
                <InputField label="Transaction Type" id="type" name="type" type="select" value={formData.type} onChange={e => setFormData(p => ({...p, type: e.target.value as 'DEBIT' | 'CREDIT'}))} isReadOnly={isViewMode} required>
                    <option value="DEBIT">Expense (Money Out)</option>
                    <option value="CREDIT">Money In / Top Up</option>
                </InputField>

                <InputField label="Amount" id="amount" name="amount" type="number" step="0.01" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: e.target.value === '' ? '' : parseFloat(e.target.value)}))} isReadOnly={isViewMode} required />

                <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
                    <div className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                            <input
                                type="checkbox"
                                checked={isBusinessExpense}
                                onChange={e => {
                                    const checked = e.target.checked;
                                    setIsBusinessExpense(checked);
                                    if (!checked) {
                                        setFormData(prev => ({ ...prev, ratePartyType: '', ratePartyId: '' }));
                                    }
                                }}
                                disabled={isViewMode}
                            />
                            Site Expense
                        </label>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Check this box to link this transaction to a rate party.</p>
                    </div>
                    <InputField label="Via (Optional)" id="via" name="via" type="text" value={formData.via} onChange={e => setFormData(p => ({...p, via: e.target.value }))} isReadOnly={isViewMode} />
                    <div className="relative">
                        <InputField label={formData.type === 'DEBIT' ? 'To (Destination)' : 'From (Source)'} id="to" name="to" type="text" value={formData.to} onChange={handleToChange} isReadOnly={isViewMode} required autoComplete="off" />
                         {suggestions.length > 0 && !isViewMode && (
                            <ul className="absolute z-10 w-full bg-white dark:bg-gray-900 border dark:border-gray-600 rounded-md mt-1 max-h-40 overflow-y-auto">
                                {suggestions.map(s => (
                                    <li key={s} onClick={() => { setFormData(p => ({...p, to: s})); setSuggestions([]); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">{s}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {isBusinessExpense && (
                        <>
                            <InputField label="Rate Party Type" id="ratePartyType" name="ratePartyType" type="select" value={formData.ratePartyType} onChange={e => setFormData(p => ({...p, ratePartyType: e.target.value, ratePartyId: '' }))} isReadOnly={isViewMode}>
                                <option value="">Select rate party type...</option>
                                {RATE_PARTY_LABELS.map(item => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                            </InputField>
                            <InputField label="Rate Party" id="ratePartyId" name="ratePartyId" type="select" value={formData.ratePartyId} onChange={e => setFormData(p => ({...p, ratePartyId: e.target.value }))} isReadOnly={isViewMode}>
                                <option value="">Select rate party...</option>
                                {ratePartyOptions.map(option => (
                                    <option key={option.id} value={option.id}>{option.name}</option>
                                ))}
                            </InputField>
                        </>
                    )}
                </div>
                <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <InputField label="Category" id="category" name="category" type="text" value={formData.category} onChange={e => setFormData(p => ({...p, category: e.target.value }))} isReadOnly={isViewMode} />
                    <InputField label="Sub-Category" id="subCategory" name="subCategory" type="text" value={formData.subCategory} onChange={e => setFormData(p => ({...p, subCategory: e.target.value }))} isReadOnly={isViewMode} />
                </div>
                <div className="sm:col-span-3">
                    <InputField label="Remarks" id="remarks" name="remarks" type="textarea" value={formData.remarks} onChange={e => setFormData(p => ({...p, remarks: e.target.value}))} isReadOnly={isViewMode} />
                </div>
            </div>
             <div className="pt-8 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
                    {isViewMode ? 'Close' : 'Cancel'}
                </button>
                {!isViewMode && (
                    <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
                        Save Transaction
                    </button>
                )}
            </div>
        </form>
    )
}

export default DailyExpenses;
