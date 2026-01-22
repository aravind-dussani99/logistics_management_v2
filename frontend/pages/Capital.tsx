import React, { useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import AccountingTable from '../components/AccountingTable';
import PageHeader from '../components/PageHeader';
import { AccountSummary } from './Accounting';
import StatCard from '../components/StatCard';
import { formatCurrency } from '../utils';

const Capital: React.FC = () => {
    const { payments, vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles, loadPayments, loadVendorCustomers, loadMineQuarries, loadTransportOwnerProfiles, loadRoyaltyOwnerProfiles, refreshKey } = useData();

    useEffect(() => {
        loadPayments();
        loadVendorCustomers();
        loadMineQuarries();
        loadTransportOwnerProfiles();
        loadRoyaltyOwnerProfiles();
    }, [loadPayments, loadVendorCustomers, loadMineQuarries, loadTransportOwnerProfiles, loadRoyaltyOwnerProfiles, refreshKey]);

    const accountSummaries = useMemo(() => {
        const summaryMap: Map<string, AccountSummary> = new Map();
        const getOrCreate = (name: string) => {
            const key = name.trim().toLowerCase();
            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    id: key,
                    name,
                    type: 'Account',
                    totalTrips: 0,
                    totalTonnage: 0,
                    totalAmount: 0,
                    balance: 0,
                    lastActivityDate: '',
                });
            }
            return summaryMap.get(key)!;
        };

        payments.forEach(payment => {
            if (payment.fromAccount) {
                const summary = getOrCreate(payment.fromAccount);
                summary.balance -= Number(payment.amount || 0);
                if (payment.date) summary.lastActivityDate = payment.date;
            }
            if (payment.toAccount) {
                const summary = getOrCreate(payment.toAccount);
                summary.balance += Number(payment.amount || 0);
                if (payment.date) summary.lastActivityDate = payment.date;
            }
        });

        return Array.from(summaryMap.values());

    }, [payments]);

    const { totalBalance, totalInflow, totalOutflow } = useMemo(() => {
        const inflow = payments.reduce((sum, payment) => sum + (payment.toAccount ? Number(payment.amount || 0) : 0), 0);
        const outflow = payments.reduce((sum, payment) => sum + (payment.fromAccount ? Number(payment.amount || 0) : 0), 0);
        const balance = accountSummaries.reduce((sum, acc) => sum + acc.balance, 0);
        return { totalBalance: balance, totalInflow: inflow, totalOutflow: outflow };
    }, [accountSummaries]);


    return (
        <div className="relative">
            <PageHeader
                title="Total Accounts Reports"
                subtitle="Track your investments, loans, bank balances, and other capital accounts."
                filters={{}}
                onFilterChange={() => {}}
                filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
            />

            <main className="pt-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total Account Balance" value={formatCurrency(totalBalance)} icon="business-outline" color="bg-green-500" />
                    <StatCard title="Total Inflow" value={formatCurrency(totalInflow)} icon="cash-outline" color="bg-blue-500" />
                    <StatCard title="Total Outflow" value={formatCurrency(totalOutflow)} icon="rocket-outline" color="bg-red-500" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <div className="p-4">
                        <AccountingTable 
                            data={accountSummaries} 
                            payments={payments}
                            type="other" 
                            allTrips={[]}
                            masterData={{ vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles }}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Capital;
