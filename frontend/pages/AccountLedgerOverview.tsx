import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import PaymentReconciliation, { PaymentReconciliationHandle } from './PaymentReconciliation';
import { useData } from '../contexts/DataContext';
import { dailyExpenseApi } from '../services/dailyExpenseApi';
import { DailyExpense, Payment, PaymentType, RatePartyType, Trip } from '../types';

type RatePartySummary = {
  key: string;
  type: RatePartyType | 'account';
  name: string;
  trips: Trip[];
  totalTons: number;
  grossAmount: number;
  paidAmount: number;
  balance: number;
};

const RATE_PARTY_LABELS: Record<RatePartyType | 'account', string> = {
  'vendor-customer': 'Vendor & Customer',
  'mine-quarry': 'Mine & Quarry',
  'royalty-owner': 'Royalty Owner',
  'transport-owner': 'Transport & Owner',
  account: 'Account',
};

const getMtdRange = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return {
    dateFrom: formatDate(startOfMonth),
    dateTo: formatDate(today),
  };
};

const AccountLedgerOverview: React.FC = () => {
  const { trips, payments, vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles, loadTrips, loadPayments, loadVendorCustomers, loadMineQuarries, loadRoyaltyOwnerProfiles, loadTransportOwnerProfiles, refreshKey } = useData();
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [filters, setFilters] = useState<Filters>(getMtdRange());
  const [activeTab, setActiveTab] = useState<'abstract' | 'history' | 'party' | 'head'>('history');
  const partyExportRef = useRef<PaymentReconciliationHandle | null>(null);
  const headExportRef = useRef<PaymentReconciliationHandle | null>(null);

  useEffect(() => {
    loadTrips();
    loadPayments();
    loadVendorCustomers();
    loadMineQuarries();
    loadRoyaltyOwnerProfiles();
    loadTransportOwnerProfiles();
    dailyExpenseApi.getAll()
      .then(setExpenses)
      .catch((error) => {
        console.warn('Failed to load daily expenses for ledger', error);
        setExpenses([]);
      });
  }, [loadTrips, loadPayments, loadVendorCustomers, loadMineQuarries, loadRoyaltyOwnerProfiles, loadTransportOwnerProfiles, refreshKey]);

  const partyIdLookup = useMemo(() => {
    const map = new Map<string, string>();
    vendorCustomers.forEach(item => map.set(`vendor-customer:${item.name}`, item.id));
    mineQuarries.forEach(item => map.set(`mine-quarry:${item.name}`, item.id));
    royaltyOwnerProfiles.forEach(item => map.set(`royalty-owner:${item.name}`, item.id));
    transportOwnerProfiles.forEach(item => map.set(`transport-owner:${item.name}`, item.id));
    return map;
  }, [vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles]);

  const partyNameLookup = useMemo(() => {
    const map = new Map<string, { type: RatePartyType; id: string; name: string }>();
    vendorCustomers.forEach(item => map.set(item.name.toLowerCase(), { type: 'vendor-customer', id: item.id, name: item.name }));
    mineQuarries.forEach(item => map.set(item.name.toLowerCase(), { type: 'mine-quarry', id: item.id, name: item.name }));
    royaltyOwnerProfiles.forEach(item => map.set(item.name.toLowerCase(), { type: 'royalty-owner', id: item.id, name: item.name }));
    transportOwnerProfiles.forEach(item => map.set(item.name.toLowerCase(), { type: 'transport-owner', id: item.id, name: item.name }));
    return map;
  }, [vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles]);

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
    return expenses.filter(expense => {
      const expenseDate = expense.date ? new Date(expense.date) : null;
      if (fromDate && expenseDate && expenseDate < fromDate) return false;
      if (toDate && expenseDate && expenseDate > toDate) return false;
      return true;
    });
  }, [expenses, filters.dateFrom, filters.dateTo]);

  const buildSummaries = useCallback((
    tripsSource: Trip[],
    expensesSource: DailyExpense[],
    paymentsSource: Payment[],
  ) => {
    const bucket = new Map<string, RatePartySummary>();
    const addSummary = (type: RatePartyType | 'account', name: string, trip?: Trip) => {
      const key = `${type}:${name}`;
      if (!bucket.has(key)) {
        bucket.set(key, {
          key,
          type,
          name,
          trips: [],
          totalTons: 0,
          grossAmount: 0,
          paidAmount: 0,
          balance: 0,
        });
      }
      const summary = bucket.get(key)!;
      if (trip) {
        summary.trips.push(trip);
        summary.totalTons += Number(trip.netWeight || 0);
        if (type === 'vendor-customer') summary.grossAmount += Number(trip.revenue || 0);
        if (type === 'mine-quarry') summary.grossAmount += Number(trip.materialCost || 0);
        if (type === 'transport-owner') summary.grossAmount += Number(trip.transportCost || 0);
        if (type === 'royalty-owner') summary.grossAmount += Number(trip.royaltyCost || 0);
      }
    };

    tripsSource.forEach(trip => {
      if (trip.customer) addSummary('vendor-customer', trip.customer, trip);
      if (trip.quarryName) addSummary('mine-quarry', trip.quarryName, trip);
      if (trip.transporterName) addSummary('transport-owner', trip.transporterName, trip);
      if (trip.royaltyOwnerName) addSummary('royalty-owner', trip.royaltyOwnerName, trip);
    });

    const addPayment = (type: RatePartyType | 'account' | undefined, name: string | undefined, amount: number) => {
      if (!type || !name) return;
      const key = `${type}:${name}`;
      if (!bucket.has(key)) {
        bucket.set(key, {
          key,
          type,
          name,
          trips: [],
          totalTons: 0,
          grossAmount: 0,
          paidAmount: 0,
          balance: 0,
        });
      }
    bucket.get(key)!.paidAmount += Number(amount || 0);
    };

    const resolvePaymentParty = (payment: Payment) => {
      if (payment.ratePartyType && payment.ratePartyId) {
        const match = Array.from(partyIdLookup.entries()).find(([key, id]) => key.startsWith(`${payment.ratePartyType}:`) && id === payment.ratePartyId);
        if (match) {
          const name = match[0].split(':').slice(1).join(':');
          return { type: payment.ratePartyType as RatePartyType, name };
        }
      }
      if (payment.ratePartyName) {
        const lookup = partyNameLookup.get(payment.ratePartyName.trim().toLowerCase());
        if (lookup) return { type: lookup.type, name: lookup.name };
        return { type: 'account' as const, name: payment.ratePartyName };
      }
      return null;
    };

    const addPaymentRecord = (payment: Payment) => {
      const resolved = resolvePaymentParty(payment);
      if (!resolved) return;
      const isCustomer = resolved.type === 'vendor-customer';
      const signedAmount = payment.type === PaymentType.RECEIPT
        ? (isCustomer ? payment.amount : -payment.amount)
        : (isCustomer ? -payment.amount : payment.amount);
      addPayment(resolved.type, resolved.name, signedAmount);
    };

    expensesSource.forEach(expense => {
      if (!expense.ratePartyType || !expense.ratePartyId) return;
      const match = Array.from(partyIdLookup.entries()).find(([key, id]) => key.startsWith(`${expense.ratePartyType}:`) && id === expense.ratePartyId);
      if (match) {
        const name = match[0].split(':').slice(1).join(':');
        addPayment(expense.ratePartyType, name, expense.amount);
      }
    });

    paymentsSource.forEach(payment => {
      addPaymentRecord(payment);
      if (payment.fromAccount) {
        addSummary('account', payment.fromAccount);
      }
      if (payment.toAccount) {
        addSummary('account', payment.toAccount);
      }
    });

    bucket.forEach(summary => {
      if (summary.type === 'account') {
        summary.balance = summary.grossAmount - summary.paidAmount;
      } else {
        summary.balance = summary.grossAmount - summary.paidAmount;
      }
    });

    return Array.from(bucket.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [partyIdLookup, partyNameLookup]);

  const summaries = useMemo<RatePartySummary[]>(() => {
    return buildSummaries(filteredTrips, filteredExpenses, filteredPayments);
  }, [buildSummaries, filteredTrips, filteredExpenses, filteredPayments]);

  const historicalSummaries = useMemo<RatePartySummary[]>(() => {
    const allSummaries = buildSummaries(trips, expenses, payments);
    return allSummaries.filter(item => Math.abs(item.balance) > 0.01);
  }, [buildSummaries, trips, expenses, payments]);

  const filteredSummaries = summaries;
  const visibleSummaries = activeTab === 'history' ? historicalSummaries : filteredSummaries;

  const getActionLabel = (summary: RatePartySummary) => {
    const balance = summary.balance;
    if (Math.abs(balance) <= 0.01) return 'Settled';
    const isCustomer = summary.type === 'vendor-customer';
    const isSupplier = summary.type === 'mine-quarry'
      || summary.type === 'transport-owner'
      || summary.type === 'royalty-owner';
    if (isCustomer) {
      return balance > 0 ? 'Follow up to receive' : 'Refund/Adjust';
    }
    if (isSupplier) {
      return balance > 0 ? 'Pay pending' : 'Recover overpaid';
    }
    return balance > 0 ? 'Receive pending' : 'Pay pending';
  };

  const exportCsv = () => {
    const exportItems = activeTab === 'history' ? historicalSummaries : filteredSummaries;
    const header = ['Type', 'Name/Account', 'Trips', 'Net Tons', 'Total Amount', 'Paid', 'Balance', 'Action'];
    const rows = exportItems.map(item => [
      RATE_PARTY_LABELS[item.type],
      item.name,
      item.trips.length,
      item.totalTons.toFixed(2),
      item.grossAmount.toFixed(2),
      item.paidAmount.toFixed(2),
      item.balance.toFixed(2),
      getActionLabel(item),
    ]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'logistics_accounts_reports.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = (items: RatePartySummary[]) => {
    const rows = items.map(item => [
      item.name,
      RATE_PARTY_LABELS[item.type],
      item.trips.length,
      item.totalTons.toFixed(2),
      item.grossAmount.toFixed(2),
      item.paidAmount.toFixed(2),
      item.balance.toFixed(2),
      getActionLabel(item),
    ]);
    const html = `
      <html>
        <head>
          <title>Logistics Accounts Reports</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f2f2f2; }
            h3 { margin-top: 24px; }
          </style>
        </head>
        <body>
          <h2>Logistics Accounts Reports</h2>
          <table>
            <thead>
              <tr>
                <th>Name/Account</th>
                <th>Type</th>
                <th>Trips</th>
                <th>Net Tons</th>
                <th>Total Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const popup = window.open('', '_blank', 'width=1000,height=700');
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const exportCurrentTabPdf = () => {
    if (activeTab === 'abstract') {
      exportPdf(filteredSummaries);
      return;
    }
    if (activeTab === 'history') {
      exportPdf(historicalSummaries);
      return;
    }
    if (activeTab === 'party') {
      const html = partyExportRef.current?.buildPrintHtml();
      if (!html) return;
      const popup = window.open('', '_blank', 'width=1000,height=700');
      if (!popup) return;
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
      return;
    }
    if (activeTab === 'head') {
      const html = headExportRef.current?.buildPrintHtml();
      if (!html) return;
      const popup = window.open('', '_blank', 'width=1000,height=700');
      if (!popup) return;
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
      return;
    }
    const tabId = activeTab === 'party' ? 'ledger-tab-party' : 'ledger-tab-head';
    const content = document.getElementById(tabId);
    if (!content) return;
    const html = `
      <html>
        <head>
          <title>Logistics Accounts Reports</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f2f2f2; }
            h3 { margin-top: 24px; }
            button { display: none !important; }
          </style>
        </head>
        <body>
          <h2>Logistics Accounts Reports</h2>
          ${content.innerHTML}
        </body>
      </html>
    `;
    const popup = window.open('', '_blank', 'width=1000,height=700');
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <div>
      <PageHeader
        title="Logistics Accounts Reports"
        subtitle="Rate party balances, trips, and payments summary"
        filters={filters}
        onFilterChange={setFilters}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showFilters={activeTab === 'history' ? [] : ['date']}
        pageAction={{ label: 'Export CSV', action: exportCsv }}
        secondaryAction={{ label: 'Export PDF', action: exportCurrentTabPdf }}
      />
      <main className="pt-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'history' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Historical Abstract
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('abstract')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'abstract' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Abstract
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('party')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'party' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Name / Account
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('head')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'head' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Head Account
          </button>
        </div>

        {activeTab === 'abstract' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Name/Account', 'Type', 'Trips', 'Net Tons', 'Total Amount', 'Paid', 'Balance', 'Action'].map(header => (
                      <th key={header} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleSummaries.map(item => (
                    <tr key={item.key} className="bg-white dark:bg-gray-800">
                      <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-300">{RATE_PARTY_LABELS[item.type]}</td>
                      <td className="px-6 py-3 text-sm">{item.trips.length}</td>
                      <td className="px-6 py-3 text-sm">{item.totalTons.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm">{item.grossAmount.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm text-green-500">{item.paidAmount.toFixed(2)}</td>
                      <td className={`px-6 py-3 text-sm font-semibold ${item.balance >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {item.balance.toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">{getActionLabel(item)}</td>
                    </tr>
                  ))}
                  {visibleSummaries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-6 text-center text-sm text-gray-500">
                        {activeTab === 'history' ? 'No outstanding balances found.' : 'No data available for this date range.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Name/Account', 'Type', 'Trips', 'Net Tons', 'Total Amount', 'Paid', 'Balance', 'Action'].map(header => (
                      <th key={header} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleSummaries.map(item => (
                    <tr key={item.key} className="bg-white dark:bg-gray-800">
                      <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-300">{RATE_PARTY_LABELS[item.type]}</td>
                      <td className="px-6 py-3 text-sm">{item.trips.length}</td>
                      <td className="px-6 py-3 text-sm">{item.totalTons.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm">{item.grossAmount.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm text-green-500">{item.paidAmount.toFixed(2)}</td>
                      <td className={`px-6 py-3 text-sm font-semibold ${item.balance >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {item.balance.toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">{getActionLabel(item)}</td>
                    </tr>
                  ))}
                  {visibleSummaries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-6 text-center text-sm text-gray-500">
                        No outstanding balances found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'party' && (
          <div id="ledger-tab-party">
            <PaymentReconciliation
              ref={partyExportRef}
              showHeader={false}
              initialMode="party"
              hideModeToggle
              hideDownload
              hidePrint
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
            />
          </div>
        )}

        {activeTab === 'head' && (
          <div id="ledger-tab-head">
            <PaymentReconciliation
              ref={headExportRef}
              showHeader={false}
              initialMode="head"
              hideModeToggle
              hideDownload
              hidePrint
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default AccountLedgerOverview;
