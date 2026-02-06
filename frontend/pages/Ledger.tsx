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

const getDefaultDateRange = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return {
        dateFrom: formatDate(startOfMonth),
        dateTo: formatDate(today),
    };
};

const Ledger: React.FC = () => {
    const { ledgerEntries, updateLedgerEntry, deleteLedgerEntry, refreshKey, loadLedgerEntries, loadAccounts } = useData();
    const [filters, setFilters] = useState<Filters>(getDefaultDateRange());
    const [draftFilters, setDraftFilters] = useState<Filters>(getDefaultDateRange());
    const defaultSelection = getDefaultDateSelection();
    const [selectedYear, setSelectedYear] = useState<number>(defaultSelection.year);
    const [selectedMonths, setSelectedMonths] = useState<number[]>([defaultSelection.month]);
    const [selectedDates, setSelectedDates] = useState<number[]>(defaultSelection.dates);
    const [draftYear, setDraftYear] = useState<number>(defaultSelection.year);
    const [draftMonths, setDraftMonths] = useState<number[]>([defaultSelection.month]);
    const [draftDates, setDraftDates] = useState<number[]>(defaultSelection.dates);
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const { openModal, closeModal, confirm } = useUI();

    useEffect(() => {
        loadLedgerEntries();
        loadAccounts();
    }, [loadLedgerEntries, loadAccounts, refreshKey]);

    useEffect(() => {
        setDraftFilters(filters);
    }, [filters]);

    const allowDateTyping = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.ctrlKey || event.metaKey) return;
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowed.includes(event.key)) return;
        if (/^[0-9-]$/.test(event.key)) return;
        event.preventDefault();
    };
    const openDatePicker = (event: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
            (input as HTMLInputElement & { showPicker: () => void }).showPicker();
        }
    };
    const updateDraft = (key: keyof Filters, value: string) => {
        setDraftFilters(prev => ({ ...prev, [key]: value }));
    };
    const applyDraftFilters = () => {
        setFilters(draftFilters);
        setSelectedYear(draftYear);
        setSelectedMonths(draftMonths);
        setSelectedDates(draftDates);
        setCurrentPage(1);
    };
    const resetDraftFilters = () => {
        const resetSelection = getDefaultDateSelection();
        const resetRange = getDefaultDateRange();
        setDraftFilters(resetRange);
        setFilters(resetRange);
        setDraftYear(resetSelection.year);
        setDraftMonths([resetSelection.month]);
        setDraftDates(resetSelection.dates);
        setSelectedYear(resetSelection.year);
        setSelectedMonths([resetSelection.month]);
        setSelectedDates(resetSelection.dates);
        setCurrentPage(1);
    };

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
        const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
        const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
        const rangeActive = Boolean(fromDate || toDate);

        const filtered = entriesWithBalance.filter(entry => {
            const entryDate = new Date(entry.date);
            let isInPeriod = true;
            if (rangeActive) {
                if (fromDate && entryDate < fromDate) isInPeriod = false;
                if (toDate && entryDate > toDate) isInPeriod = false;
            } else {
                const entryYear = entryDate.getFullYear();
                const entryMonth = entryDate.getMonth() + 1;
                const entryDay = entryDate.getDate();
                const yearMatch = selectedYear ? entryYear === selectedYear : true;
                const monthMatch = selectedMonths.length ? selectedMonths.includes(entryMonth) : true;
                const dateMatch = selectedDates.length ? selectedDates.includes(entryDay) : true;
                isInPeriod = yearMatch && monthMatch && dateMatch;
            }
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
    }, [ledgerEntries, selectedYear, selectedMonths, selectedDates, filters, refreshKey]);

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
                headerRight={(
                    <div className="rounded-xl border border-gray-200/60 bg-white/90 dark:bg-gray-900/70 dark:border-gray-700/60 shadow-md px-3 py-2">
                        {filtersOpen ? (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                    <div>
                                        <label className="text-[11px] text-gray-500 dark:text-gray-400">Date From</label>
                                        <input
                                            type="date"
                                            inputMode="numeric"
                                            onKeyDown={allowDateTyping}
                                            onClick={openDatePicker}
                                            onFocus={openDatePicker}
                                            className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                            value={draftFilters.dateFrom || ''}
                                            onChange={e => updateDraft('dateFrom', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-gray-500 dark:text-gray-400">Date To</label>
                                        <input
                                            type="date"
                                            inputMode="numeric"
                                            onKeyDown={allowDateTyping}
                                            onClick={openDatePicker}
                                            onFocus={openDatePicker}
                                            className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                            value={draftFilters.dateTo || ''}
                                            onChange={e => updateDraft('dateTo', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-gray-500 dark:text-gray-400">Year</label>
                                        <select
                                            value={draftYear}
                                            onChange={e => setDraftYear(Number(e.target.value))}
                                            className="w-full h-8 text-xs px-2 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
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
                                        <label className="text-[11px] text-gray-500 dark:text-gray-400">Month (Multi)</label>
                                        <select
                                            multiple
                                            value={draftMonths.map(String)}
                                            onChange={e => setDraftMonths(Array.from(e.target.selectedOptions).map(option => Number(option.value)))}
                                            className="w-full h-20 text-xs px-2 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                                        >
                                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, index) => (
                                                <option key={label} value={index + 1}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                                    <div>
                                        <label className="text-[11px] text-gray-500 dark:text-gray-400">Date (Multi)</label>
                                        <select
                                            multiple
                                            value={draftDates.map(String)}
                                            onChange={e => setDraftDates(Array.from(e.target.selectedOptions).map(option => Number(option.value)))}
                                            className="w-full h-20 text-xs px-2 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                                        >
                                            {Array.from({ length: 31 }, (_, idx) => idx + 1).map(day => (
                                                <option key={day} value={day}>{day}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2 lg:col-span-3">
                                        <button
                                            type="button"
                                            onClick={applyDraftFilters}
                                            className="h-8 px-3 rounded-md text-xs font-medium text-white bg-primary hover:bg-primary-dark"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetDraftFilters}
                                            className="h-8 px-3 rounded-md text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                                        >
                                            Reset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFiltersOpen(false)}
                                            className="h-8 px-3 rounded-md text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                                        >
                                            Hide
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                    <ion-icon name="chevron-down-outline"></ion-icon>
                                    Show Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            />
            
            <main className="pt-6 space-y-6">

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
