
import React, { useEffect, useMemo, useState } from 'react';
import { Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from '../components/StatCard';
import { DailySummary, FinancialStatus, DailyExpense, PaymentType } from '../types';
import { useData } from '../contexts/DataContext';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import { formatCurrency } from '../utils';
import { dailyExpenseApi } from '../services/dailyExpenseApi';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Financials: React.FC = () => {
    const { trips, advances, payments, loadTrips, loadAdvances, loadPayments, refreshKey } = useData();
    const [filters, setFilters] = useState<Filters>({});
    const [allExpenses, setAllExpenses] = useState<DailyExpense[]>([]);

    useEffect(() => {
        loadTrips();
        loadAdvances();
        loadPayments();
        dailyExpenseApi.getAll().then(setAllExpenses).catch(() => setAllExpenses([]));
    }, [loadTrips, loadAdvances, loadPayments, refreshKey]);

    const getAdvanceTotalForTrip = (tripId: number, ratePartyType: string) => {
        return advances
            .filter(advance => advance.tripId === tripId && advance.ratePartyType === ratePartyType)
            .reduce((sum, advance) => sum + (advance.amount || 0), 0);
    };

    const summary = useMemo<DailySummary>(() => {
        const totalTrips = trips.length;
        const totalRevenue = trips.reduce((sum, trip) => sum + (trip.revenue || 0), 0);
        const totalCost = trips.reduce((sum, trip) => sum + (trip.materialCost || 0) + (trip.transportCost || 0) + (trip.royaltyCost || 0), 0);
        const totalProfit = trips.reduce((sum, trip) => sum + (trip.profit || 0), 0);
        return { totalTrips, totalRevenue, totalCost, totalProfit };
    }, [trips]);

    const financials = useMemo<FinancialStatus>(() => {
        const expenseAdjustments = allExpenses.reduce((acc, item) => {
            if (!item.ratePartyType) return acc;
            const amount = item.type === 'DEBIT' ? item.amount : -item.amount;
            acc[item.ratePartyType] = (acc[item.ratePartyType] || 0) + amount;
            return acc;
        }, {} as Record<string, number>);

        const paymentAdjustments = payments.reduce((acc, item) => {
            if (!item.ratePartyType) return acc;
            const isCustomer = item.ratePartyType === 'vendor-customer';
            const amount = item.type === PaymentType.RECEIPT
                ? (isCustomer ? item.amount : -item.amount)
                : (isCustomer ? -item.amount : item.amount);
            acc[item.ratePartyType] = (acc[item.ratePartyType] || 0) + amount;
            return acc;
        }, {} as Record<string, number>);

        const outstandingCustomer = trips.reduce((sum, trip) => {
            const advancesForCustomer = getAdvanceTotalForTrip(trip.id, 'vendor-customer');
            return sum + Math.max(0, (trip.revenue || 0) - advancesForCustomer);
        }, 0);
        const outstandingTransporter = trips.reduce((sum, trip) => {
            const advancesForTransporter = getAdvanceTotalForTrip(trip.id, 'transport-owner');
            return sum + Math.max(0, (trip.transportCost || 0) - advancesForTransporter);
        }, 0);
        const outstandingQuarry = trips.reduce((sum, trip) => {
            const advancesForQuarry = getAdvanceTotalForTrip(trip.id, 'mine-quarry');
            return sum + Math.max(0, (trip.materialCost || 0) - advancesForQuarry);
        }, 0);
        return {
            outstandingCustomer: Math.max(0, outstandingCustomer - (expenseAdjustments['vendor-customer'] || 0) - (paymentAdjustments['vendor-customer'] || 0)),
            outstandingTransporter: Math.max(0, outstandingTransporter - (expenseAdjustments['transport-owner'] || 0) - (paymentAdjustments['transport-owner'] || 0)),
            outstandingQuarry: Math.max(0, outstandingQuarry - (expenseAdjustments['mine-quarry'] || 0) - (paymentAdjustments['mine-quarry'] || 0)),
        };
    }, [trips, advances, allExpenses, payments]);

    const costData = useMemo<ChartData[]>(() => {
        const transportCost = trips.reduce((sum, trip) => sum + (trip.transportCost || 0), 0);
        const materialCost = trips.reduce((sum, trip) => sum + (trip.materialCost || 0), 0);
        const royaltyCost = trips.reduce((sum, trip) => sum + (trip.royaltyCost || 0), 0);
        return [
            { name: 'Transport', value: transportCost },
            { name: 'Material', value: materialCost },
            { name: 'Royalty', value: royaltyCost },
        ];
    }, [trips]);

    return (
        <div className="relative">
            <PageHeader
                title="Financials"
                subtitle="An overview of your company's financial performance."
                filters={filters}
                onFilterChange={setFilters}
                filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
                showFilters={['date']}
                showAddAction={false}
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
