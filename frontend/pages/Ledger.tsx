import React, { useState, useMemo, useEffect } from 'react';
import { LedgerEntry } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import AddLedgerEntryForm from '../components/AddLedgerEntryForm';
import Pagination from '../components/Pagination';
import StatCard from '../components/StatCard';
import { formatCurrency, formatDateDisplay } from '../utils';

const ITEMS_PER_PAGE = 10;

const getDefaultDateSelection = () => {
    const today = new Date();
    return {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        dates: Array.from({ length: today.getDate() }, (_, idx) => idx + 1),
    };
};

const Ledger: React.FC = () => {
    const { ledgerEntries, updateLedgerEntry, deleteLedgerEntry, refreshKey, loadLedgerEntries, loadAccounts } = useData();
    const [filters, setFilters] = useState<Filters>({});
    const defaultSelection = getDefaultDateSelection();
    const [selectedYear, setSelectedYear] = useState<number>(defaultSelection.year);
    const [selectedMonths, setSelectedMonths] = useState<number[]>([defaultSelection.month]);
    const [selectedDates, setSelectedDates] = useState<number[]>(defaultSelection.dates);
    const [currentPage, setCurrentPage] = useState(1);
    const { openModal, closeModal, confirm } = useUI();

    useEffect(() => {
        loadLedgerEntries();
        loadAccounts();
    }, [loadLedgerEntries, loadAccounts, refreshKey]);

    const handleAddEntry = () => {
        openModal('Add New Ledger Entry', <AddLedgerEntryForm onClose={closeModal} />);
    };

    const handleEditEntry = (entry: LedgerEntry) => {
        openModal('Edit Ledger Entry', <AddLedgerEntryForm initialData={entry} onClose={closeModal} />);
    };

    const handleDeleteEntry = async (id: string) => {
        const shouldDelete = await confirm('Delete Transaction', 'Are you sure you want to delete this transaction? This action cannot be undone.');
        if (!shouldDelete) return;
        await deleteLedgerEntry(id);
    };
    
    const { filteredAndSortedEntries, totalInflow, totalOutflow } = useMemo(() => {
        const sortedEntries = [...ledgerEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let balance = 0;
        const entriesWithBalance = sortedEntries.map(entry => {
            balance = balance + (entry.type === 'CREDIT' ? entry.amount : -entry.amount);
            return { ...entry, balance };
        });

        let currentInflow = 0;
        let currentOutflow = 0;
        const filtered = entriesWithBalance.filter(entry => {
            const entryDate = new Date(entry.date);
            const entryYear = entryDate.getFullYear();
            const entryMonth = entryDate.getMonth() + 1;
            const entryDay = entryDate.getDate();
            const yearMatch = selectedYear ? entryYear === selectedYear : true;
            const monthMatch = selectedMonths.length ? selectedMonths.includes(entryMonth) : true;
            const dateMatch = selectedDates.length ? selectedDates.includes(entryDay) : true;
            const isInPeriod = yearMatch && monthMatch && dateMatch;
            if (isInPeriod) {
                if (entry.type === 'CREDIT') currentInflow += entry.amount;
                else currentOutflow += entry.amount;
            }
            return isInPeriod;
        });

        return { 
            filteredAndSortedEntries: filtered,
            totalInflow: currentInflow,
            totalOutflow: currentOutflow,
        };
    }, [ledgerEntries, selectedYear, selectedMonths, selectedDates, refreshKey]);

    const totalPages = Math.ceil(filteredAndSortedEntries.length / ITEMS_PER_PAGE);
    const paginatedEntries = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedEntries.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredAndSortedEntries, currentPage]);


    const headers = ['Date', 'Description', 'Type', 'Amount', 'Running Balance', 'Actions'];

    return (
        <div className="relative">
            <PageHeader
                title="Main Accounts Ledger"
                subtitle="Showing recent transactions."
                filters={filters}
                onFilterChange={setFilters}
                filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
                showFilters={[]}
                pageAction={{ label: 'Add Entry', action: handleAddEntry }}
            />
            
            <main className="pt-6 space-y-6">
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md px-4 py-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Year</label>
                            <select
                                value={selectedYear}
                                onChange={e => {
                                    setSelectedYear(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                            >
                                {Array.from(new Set(ledgerEntries.map(entry => new Date(entry.date).getFullYear())))
                                    .concat([defaultSelection.year])
                                    .filter((value, index, self) => self.indexOf(value) === index)
                                    .sort((a, b) => b - a)
                                    .map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Month (Multi)</label>
                            <select
                                multiple
                                value={selectedMonths.map(String)}
                                onChange={e => {
                                    const next = Array.from(e.target.selectedOptions).map(option => Number(option.value));
                                    setSelectedMonths(next);
                                    setCurrentPage(1);
                                }}
                                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                            >
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, index) => (
                                    <option key={label} value={index + 1}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Date (Multi)</label>
                            <select
                                multiple
                                value={selectedDates.map(String)}
                                onChange={e => {
                                    const next = Array.from(e.target.selectedOptions).map(option => Number(option.value));
                                    setSelectedDates(next);
                                    setCurrentPage(1);
                                }}
                                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                            >
                                {Array.from({ length: 31 }, (_, idx) => idx + 1).map(day => (
                                    <option key={day} value={day}>{day}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total Inflow (Credit)" value={formatCurrency(totalInflow)} icon="arrow-down-circle-outline" color="bg-green-500" />
                    <StatCard title="Total Outflow (Debit)" value={formatCurrency(totalOutflow)} icon="arrow-up-circle-outline" color="bg-red-500" />
                    <StatCard title="Net Cash Flow" value={formatCurrency(totalInflow - totalOutflow)} icon="swap-horizontal-outline" color="bg-blue-500" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                     <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                        <h2 className="text-xl font-semibold">All Transactions</h2>
                        <Pagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          onPageChange={setCurrentPage}
                          totalItems={filteredAndSortedEntries.length}
                          pageSize={ITEMS_PER_PAGE}
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    {headers.map(header => <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{header}</th>)}
                                </tr>
                            </thead>
                             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {paginatedEntries.map((item: LedgerEntry & { balance: number }) => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatDateDisplay(item.date)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            <div>{item.from} → {item.to}</div>
                                            <div className="text-xs text-gray-500">{item.remarks} ({item.paymentType})</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {item.type === 'CREDIT' ? 
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Credit</span>
                                                : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Debit</span>
                                            }
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${item.type === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
                                            {item.type === 'CREDIT' ? '+' : '-'} {formatCurrency(item.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(item.balance)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            <button onClick={() => handleEditEntry(item)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                                            <button onClick={() => handleDeleteEntry(item.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Ledger;
