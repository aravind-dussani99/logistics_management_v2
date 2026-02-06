
import React, { useEffect, useMemo, useState } from 'react';
import { Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { DailySummary, FinancialStatus, DailyExpense, PaymentType, ChartData } from '../types';
import { useData } from '../contexts/DataContext';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import { formatCurrency } from '../utils';
import { dailyExpenseApi } from '../services/dailyExpenseApi';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const getDefaultDateRange = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return {
        dateFrom: formatDate(startOfMonth),
        dateTo: formatDate(today),
    };
};

const Financials: React.FC = () => {
    const { trips, payments, loadTrips, loadPayments, refreshKey } = useData();
    const [filters, setFilters] = useState<Filters>(getDefaultDateRange());
    const [draftFilters, setDraftFilters] = useState<Filters>(getDefaultDateRange());
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [allExpenses, setAllExpenses] = useState<DailyExpense[]>([]);

    useEffect(() => {
        loadTrips();
        loadPayments();
        dailyExpenseApi.getAll().then(setAllExpenses).catch(() => setAllExpenses([]));
    }, [loadTrips, loadPayments, refreshKey]);

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
    };
    const resetDraftFilters = () => {
        const resetRange = getDefaultDateRange();
        setDraftFilters(resetRange);
        setFilters(resetRange);
    };

    const filteredTrips = useMemo(() => {
        const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
        const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
        return trips.filter(trip => {
            const tripDate = trip.date ? new Date(trip.date) : null;
            if (fromDate && tripDate && tripDate < fromDate) return false;
            if (toDate && tripDate && tripDate > toDate) return false;
            return true;
        });
    }, [trips, filters.dateFrom, filters.dateTo]);

    const filteredPayments = useMemo(() => {
        const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
        const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
        return payments.filter(payment => {
            const paymentDate = payment.date ? new Date(payment.date) : null;
            if (fromDate && paymentDate && paymentDate < fromDate) return false;
            if (toDate && paymentDate && paymentDate > toDate) return false;
            return true;
        });
    }, [payments, filters.dateFrom, filters.dateTo]);

    const filteredExpenses = useMemo(() => {
        const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
        const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
        return allExpenses.filter(expense => {
            const expenseDate = expense.date ? new Date(expense.date) : null;
            if (fromDate && expenseDate && expenseDate < fromDate) return false;
            if (toDate && expenseDate && expenseDate > toDate) return false;
            return true;
        });
    }, [allExpenses, filters.dateFrom, filters.dateTo]);

    const getAdvanceTotalForTrip = (tripId: number, ratePartyType: string) => {
        return filteredPayments
            .filter(payment => payment.tripId === tripId && payment.ratePartyType === ratePartyType && payment.type === PaymentType.PAYMENT)
            .reduce((sum, payment) => sum + (payment.amount || 0), 0);
    };

    const summary = useMemo<DailySummary>(() => {
        const totalTrips = filteredTrips.length;
        const totalRevenue = filteredTrips.reduce((sum, trip) => sum + (trip.revenue || 0), 0);
        const totalCost = filteredTrips.reduce((sum, trip) => sum + (trip.materialCost || 0) + (trip.transportCost || 0) + (trip.royaltyCost || 0), 0);
        const totalProfit = filteredTrips.reduce((sum, trip) => sum + (trip.profit || 0), 0);
        return { totalTrips, totalRevenue, totalCost, totalProfit };
    }, [filteredTrips]);

    const financials = useMemo<FinancialStatus>(() => {
        const expenseAdjustments = filteredExpenses.reduce((acc, item) => {
            if (!item.ratePartyType) return acc;
            const amount = item.type === 'DEBIT' ? item.amount : -item.amount;
            acc[item.ratePartyType] = (acc[item.ratePartyType] || 0) + amount;
            return acc;
        }, {} as Record<string, number>);

        const paymentAdjustments = filteredPayments.reduce((acc, item) => {
            // If payment is linked to a trip, it's already counted in getAdvanceTotalForTrip (which subtracts from trip cost)
            // But wait, "outstanding" = Cost - Paid.
            // If we use getAdvanceTotalForTrip, we sum payments for that trip.
            // If we use paymentAdjustments, we sum ALL payments for that party.
            // Duplicate counting?
            // The original logic had `advances` (per trip) AND `payments` (general).
            // Now ALL are payments.
            // If a payment has tripId, it counts towards that trip's logic.
            // If it doesn't, it counts towards general balance?
            // "Outstanding Customer" = (Sum of Rev - TripAdvances) - GeneralPayments?
            // If "Advance" is just a Payment with TripID, then:
            // "TripAdvances" = Payments with TripID.
            // "GeneralPayments" = Payments without TripID?
            // Or should we just sum (Total Cost - Total Payments)?
            // The original logic:
            // outstandingCustomer = (Sum(Rev - Advances)) - expenseAdj - paymentAdj.
            // It seems `paymentAdjustments` included ALL payments.
            // If `advances` were separate, they were NOT in `payments`.
            // Now `advances` ARE in `payments`.
            // So if I include them in `getAdvanceTotalForTrip`, I must EXCLUDE them from `paymentAdjustments`.

            if (!item.ratePartyType) return acc;

            // Skip payments that are counted as trip advances to avoid double counting
            if (item.tripId) return acc;

            const isCustomer = item.ratePartyType === 'vendor-customer';
            const amount = item.type === PaymentType.RECEIPT
                ? (isCustomer ? item.amount : -item.amount)
                : (isCustomer ? -item.amount : item.amount);
            acc[item.ratePartyType] = (acc[item.ratePartyType] || 0) + amount;
            return acc;
        }, {} as Record<string, number>);

        const outstandingCustomer = filteredTrips.reduce((sum, trip) => {
            const advancesForCustomer = getAdvanceTotalForTrip(trip.id, 'vendor-customer');
            return sum + Math.max(0, (trip.revenue || 0) - advancesForCustomer);
        }, 0);
        const outstandingTransporter = filteredTrips.reduce((sum, trip) => {
            const advancesForTransporter = getAdvanceTotalForTrip(trip.id, 'transport-owner');
            return sum + Math.max(0, (trip.transportCost || 0) - advancesForTransporter);
        }, 0);
        const outstandingQuarry = filteredTrips.reduce((sum, trip) => {
            const advancesForQuarry = getAdvanceTotalForTrip(trip.id, 'mine-quarry');
            return sum + Math.max(0, (trip.materialCost || 0) - advancesForQuarry);
        }, 0);
        return {
            outstandingCustomer: Math.max(0, outstandingCustomer - (expenseAdjustments['vendor-customer'] || 0) - (paymentAdjustments['vendor-customer'] || 0)),
            outstandingTransporter: Math.max(0, outstandingTransporter - (expenseAdjustments['transport-owner'] || 0) - (paymentAdjustments['transport-owner'] || 0)),
            outstandingQuarry: Math.max(0, outstandingQuarry - (expenseAdjustments['mine-quarry'] || 0) - (paymentAdjustments['mine-quarry'] || 0)),
        };
    }, [filteredTrips, filteredExpenses, filteredPayments]);

    const costData = useMemo<ChartData[]>(() => {
        const transportCost = filteredTrips.reduce((sum, trip) => sum + (trip.transportCost || 0), 0);
        const materialCost = filteredTrips.reduce((sum, trip) => sum + (trip.materialCost || 0), 0);
        const royaltyCost = filteredTrips.reduce((sum, trip) => sum + (trip.royaltyCost || 0), 0);
        return [
            { name: 'Transport', value: transportCost },
            { name: 'Material', value: materialCost },
            { name: 'Royalty', value: royaltyCost },
        ];
    }, [filteredTrips]);

    return (
        <div className="relative">
            <PageHeader
                title="Logistics Accounts Overview"
                subtitle="Overview of logistics business accounts and balances."
                filters={filters}
                onFilterChange={setFilters}
                filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
                showFilters={[]}
                showMoreFilters={[]}
                showAddAction={false}
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
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Total Trips" value={summary?.totalTrips.toString() || '0'} icon="bus-outline" color="bg-blue-500" />
                    <StatCard title="Total Revenue" value={formatCurrency(summary?.totalRevenue)} icon="cash-outline" color="bg-green-500" />
                    <StatCard title="Total Cost" value={formatCurrency(summary?.totalCost)} icon="trending-down-outline" color="bg-yellow-500" />
                    <StatCard title="Total Profit" value={formatCurrency(summary?.totalProfit)} icon="trending-up-outline" color="bg-purple-500" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4">Financial Status</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between"><span>Customer Dues:</span> <span className="font-bold text-red-500">{formatCurrency(financials?.outstandingCustomer)}</span></div>
                            <div className="flex justify-between"><span>Transporter Dues:</span> <span className="font-bold text-yellow-500">{formatCurrency(financials?.outstandingTransporter)}</span></div>
                            <div className="flex justify-between"><span>Quarry Dues:</span> <span className="font-bold text-orange-500">{formatCurrency(financials?.outstandingQuarry)}</span></div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4">Today's Cost Breakdown</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={costData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                                    {costData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </main>
        </div>
    );
};

export default Financials;
