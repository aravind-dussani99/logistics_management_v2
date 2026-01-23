import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { PaymentType } from '../types';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import { useData } from '../contexts/DataContext';
import AccountingTable from '../components/AccountingTable';
import { formatDateDisplay } from '../utils';

const getMtdRange = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return {
      dateFrom: formatDate(startOfMonth),
      dateTo: formatDate(today)
    };
};

export interface AccountSummary {
    id: string; // This will now be the unique ID from the source object
    name: string;
    type: string;
    totalTrips: number;
    totalTonnage: number;
    totalAmount: number;
    balance: number;
    lastActivityDate: string;
}

const Accounting: React.FC = () => {
    const { trips: allTrips, payments, vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles, loadTrips, loadPayments, loadVendorCustomers, loadMineQuarries, loadTransportOwnerProfiles, loadRoyaltyOwnerProfiles, refreshKey } = useData();
    const [filters, setFilters] = useState<Filters>(getMtdRange());
    const [activeTab, setActiveTab] = useState<'vp' | 'vr' | 'cr' | 'others' | 'aged'>('vp');

    useEffect(() => {
        loadTrips();
        loadPayments();
        loadVendorCustomers();
        loadMineQuarries();
        loadTransportOwnerProfiles();
        loadRoyaltyOwnerProfiles();
    }, [loadTrips, loadPayments, loadVendorCustomers, loadMineQuarries, loadTransportOwnerProfiles, loadRoyaltyOwnerProfiles, refreshKey]);

    const allDataForFilters = useMemo(() => {
        return {
            transportOwners: transportOwnerProfiles.map(item => ({ id: item.id, name: item.name })),
            customers: vendorCustomers.map(item => ({ id: item.id, name: item.name })),
            quarries: mineQuarries.map(item => ({ id: item.id, name: item.name })),
            royaltyOwners: royaltyOwnerProfiles.map(item => ({ id: item.id, name: item.name })),
        };
    }, [transportOwnerProfiles, vendorCustomers, mineQuarries, royaltyOwnerProfiles]);
    
    const filteredTrips = useMemo(() => {
        return allTrips.filter(trip => {
            if (filters.dateFrom && trip.date < filters.dateFrom) return false;
            if (filters.dateTo && trip.date > filters.dateTo) return false;
            return true;
        });
    }, [allTrips, filters]);

    const filteredPayments = useMemo(() => {
        return payments.filter(payment => {
            const dateValue = payment.date ? payment.date.split('T')[0] : '';
            if (filters.dateFrom && dateValue < filters.dateFrom) return false;
            if (filters.dateTo && dateValue > filters.dateTo) return false;
            return true;
        });
    }, [payments, filters]);

    const accountSummaries = useMemo(() => {
        const summaryMap: Map<string, AccountSummary> = new Map();
        const getOrCreate = (id: string, name: string, type: AccountSummary['type']) => {
            if (!summaryMap.has(id)) {
                summaryMap.set(id, {
                    id,
                    name,
                    type,
                    totalTrips: 0,
                    totalTonnage: 0,
                    totalAmount: 0,
                    balance: 0,
                    lastActivityDate: '',
                });
            }
            return summaryMap.get(id)!;
        };

        vendorCustomers.forEach(item => getOrCreate(item.id, item.name, 'Customer'));
        mineQuarries.forEach(item => getOrCreate(item.id, item.name, 'Vendor-Quarry'));
        transportOwnerProfiles.forEach(item => getOrCreate(item.id, item.name, 'Vendor-Transport'));
        royaltyOwnerProfiles.forEach(item => getOrCreate(item.id, item.name, 'Vendor-Royalty'));

        filteredTrips.forEach(trip => {
            const customerId = vendorCustomers.find(c => c.name === trip.customer)?.id;
            if (customerId) {
                const summary = getOrCreate(customerId, trip.customer, 'Customer');
                summary.balance += trip.revenue;
                summary.totalAmount += trip.revenue;
                summary.totalTrips += 1;
                summary.totalTonnage += trip.netWeight || trip.tonnage;
                summary.lastActivityDate = trip.date;
            }

            const quarryOwnerId = mineQuarries.find(q => q.name === trip.quarryName)?.id;
            if (quarryOwnerId) {
                const summary = getOrCreate(quarryOwnerId, trip.quarryName, 'Vendor-Quarry');
                summary.balance -= trip.materialCost;
                summary.totalAmount += trip.materialCost;
                summary.totalTrips += 1;
                summary.totalTonnage += trip.netWeight || trip.tonnage;
                summary.lastActivityDate = trip.date;
            }

            const transporterId = transportOwnerProfiles.find(t => t.name === trip.transporterName)?.id;
            if (transporterId) {
                const summary = getOrCreate(transporterId, trip.transporterName, 'Vendor-Transport');
                summary.balance -= trip.transportCost;
                summary.totalAmount += trip.transportCost;
                summary.totalTrips += 1;
                summary.totalTonnage += trip.netWeight || trip.tonnage;
                summary.lastActivityDate = trip.date;
            }

            const royaltyId = royaltyOwnerProfiles.find(r => r.name === trip.royaltyOwnerName)?.id;
            if (royaltyId) {
                const summary = getOrCreate(royaltyId, trip.royaltyOwnerName, 'Vendor-Royalty');
                summary.balance -= trip.royaltyCost;
                summary.totalAmount += trip.royaltyCost;
                summary.totalTrips += 1;
                summary.totalTonnage += trip.netWeight || trip.tonnage;
                summary.lastActivityDate = trip.date;
            }
        });

        filteredPayments.forEach(payment => {
            if (!payment.ratePartyType) return;
            let summary: AccountSummary | undefined;
            if (payment.ratePartyId) {
                summary = summaryMap.get(payment.ratePartyId);
            }
            if (!summary && payment.ratePartyName) {
                summary = Array.from(summaryMap.values()).find(item => item.name.toLowerCase() === payment.ratePartyName?.toLowerCase());
            }
            if (!summary) return;
            const isCustomer = payment.ratePartyType === 'vendor-customer';
            const delta = payment.type === PaymentType.RECEIPT
                ? (isCustomer ? -payment.amount : payment.amount)
                : (isCustomer ? payment.amount : -payment.amount);
            summary.balance += delta;
            if (payment.date) summary.lastActivityDate = payment.date;
        });

        const allTransactions = [...filteredTrips, ...filteredPayments].sort((a, b) => b.date.localeCompare(a.date));
        summaryMap.forEach(summary => {
            if (summary.lastActivityDate) return;
            const lastTx = allTransactions.find(tx => {
                if ('customer' in tx) {
                    return tx.customer === summary.name
                        || tx.quarryName === summary.name
                        || tx.transporterName === summary.name
                        || tx.royaltyOwnerName === summary.name;
                }
                if ('ratePartyId' in tx) {
                    return tx.ratePartyId === summary.id || tx.ratePartyName?.toLowerCase() === summary.name.toLowerCase();
                }
                return false;
            });
            if (lastTx) summary.lastActivityDate = lastTx.date;
        });

        return Array.from(summaryMap.values());
    }, [filteredTrips, filteredPayments, vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles]);
    
    const { vendorPayables, vendorReceivables, customerReceivables, otherExpenses, agedBalances } = useMemo(() => {
        const vp: AccountSummary[] = [];
        const vr: AccountSummary[] = [];
        const cr: AccountSummary[] = [];
        const others: AccountSummary[] = [];
        const aged: AccountSummary[] = [];
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        accountSummaries.forEach(acc => {
             const hasBalance = Math.abs(acc.balance) > 0.01;
             if (!hasBalance && acc.totalTrips === 0) return;

            if (acc.type === 'Vendor-Quarry' || acc.type === 'Vendor-Transport' || acc.type === 'Vendor-Royalty') {
                if (acc.balance < 0) vp.push(acc); 
                else if (acc.balance > 0) vr.push(acc);
            } else if (acc.type === 'Customer') {
                if (acc.balance > 0) cr.push(acc);
            } else {
                others.push(acc);
            }

            const isInactive = !acc.lastActivityDate || new Date(acc.lastActivityDate) < thirtyDaysAgo;
            if (hasBalance && isInactive) {
                aged.push(acc);
            }
        });
        return { vendorPayables: vp, vendorReceivables: vr, customerReceivables: cr, otherExpenses: others, agedBalances: aged };
    }, [accountSummaries]);
    
    const dateRangeSubtitle = useMemo(() => {
        if (!filters.dateFrom || !filters.dateTo) return "Showing all transactions";
        const from = formatDateDisplay(filters.dateFrom);
        const to = formatDateDisplay(filters.dateTo);
        return `Showing transactions from ${from} to ${to}`;
    }, [filters.dateFrom, filters.dateTo]);

    const totalPayable = vendorPayables.reduce((sum, p) => sum + Math.abs(p.balance), 0);
    const totalReceivable = customerReceivables.reduce((sum, r) => sum + r.balance, 0);
    const totalAgedBalance = agedBalances.reduce((sum, b) => sum + Math.abs(b.balance), 0);

    const tabs = [
        { id: 'vp', label: `Vendor Payables (${vendorPayables.length})` },
        { id: 'vr', label: `Vendor Receivables (${vendorReceivables.length})` },
        { id: 'cr', label: `Customer Receivables (${customerReceivables.length})` },
        { id: 'others', label: `Others & Expenses (${otherExpenses.length})`},
        { id: 'aged', label: `Aged Balances (${agedBalances.length})` },
    ];

    return (
        <div className="relative">
            <PageHeader
                title="Total Accounts Overview"
                subtitle={dateRangeSubtitle}
                filters={filters}
                onFilterChange={setFilters}
                filterData={allDataForFilters}
                showFilters={['date']}
            />
            
            <main className="pt-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total Payables" value={`₹${totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon="arrow-up-circle-outline" color="bg-red-500" comparisonText="Amount owed to vendors" />
                    <StatCard title="Total Receivables" value={`₹${totalReceivable.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon="arrow-down-circle-outline" color="bg-green-500" comparisonText="Amount owed by customers" />
                    <StatCard title="Total Aged Balance" value={`₹${totalAgedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon="time-outline" color="bg-yellow-500" comparisonText="Follow-up required" />
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <nav className="-mb-px flex space-x-6 px-6 overflow-x-auto" aria-label="Tabs">
                             {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex-shrink-0 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                                        activeTab === tab.id
                                        ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-300'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="p-4">
                        {activeTab === 'vp' && (
                            <AccountingTable
                                data={vendorPayables}
                                allTrips={allTrips}
                                payments={filteredPayments}
                                type="payable"
                                masterData={{ vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles }}
                            />
                        )}
                        {activeTab === 'vr' && (
                            <AccountingTable
                                data={vendorReceivables}
                                allTrips={allTrips}
                                payments={filteredPayments}
                                type="receivable"
                                masterData={{ vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles }}
                            />
                        )}
                        {activeTab === 'cr' && (
                            <AccountingTable
                                data={customerReceivables}
                                allTrips={allTrips}
                                payments={filteredPayments}
                                type="receivable"
                                masterData={{ vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles }}
                            />
                        )}
                        {activeTab === 'others' && (
                            <AccountingTable
                                data={otherExpenses}
                                allTrips={allTrips}
                                payments={filteredPayments}
                                type="other"
                                masterData={{ vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles }}
                            />
                        )}
                        {activeTab === 'aged' && (
                            <AccountingTable
                                data={agedBalances}
                                allTrips={allTrips}
                                payments={filteredPayments}
                                type="aged"
                                masterData={{ vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles }}
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Accounting;
