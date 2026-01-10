import React, { useMemo, useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { dailyExpenseApi } from '../services/dailyExpenseApi';
import { DailyExpense, Payment, PaymentType, RatePartyType, Trip } from '../types';

type RatePartySummary = {
  key: string;
  type: RatePartyType;
  name: string;
  trips: Trip[];
  totalTons: number;
  grossAmount: number;
  paidAmount: number;
  balance: number;
};

const RATE_PARTY_LABELS: Record<RatePartyType, string> = {
  'vendor-customer': 'Vendor & Customer',
  'mine-quarry': 'Mine & Quarry',
  'royalty-owner': 'Royalty Owner',
  'transport-owner': 'Transport & Owner',
};

const AccountLedgerOverview: React.FC = () => {
  const { trips, advances, payments, vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles, loadTrips, loadAdvances, loadPayments, loadVendorCustomers, loadMineQuarries, loadRoyaltyOwnerProfiles, loadTransportOwnerProfiles, refreshKey } = useData();
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [selectedType, setSelectedType] = useState<RatePartyType | 'all'>('all');
  const [selectedParty, setSelectedParty] = useState<string>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    loadTrips();
    loadAdvances();
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
  }, [loadTrips, loadAdvances, loadPayments, loadVendorCustomers, loadMineQuarries, loadRoyaltyOwnerProfiles, loadTransportOwnerProfiles, refreshKey]);

  const partyIdLookup = useMemo(() => {
    const map = new Map<string, string>();
    vendorCustomers.forEach(item => map.set(`vendor-customer:${item.name}`, item.id));
    mineQuarries.forEach(item => map.set(`mine-quarry:${item.name}`, item.id));
    royaltyOwnerProfiles.forEach(item => map.set(`royalty-owner:${item.name}`, item.id));
    transportOwnerProfiles.forEach(item => map.set(`transport-owner:${item.name}`, item.id));
    return map;
  }, [vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles]);

  const summaries = useMemo<RatePartySummary[]>(() => {
    const bucket = new Map<string, RatePartySummary>();
    const addSummary = (type: RatePartyType, name: string, trip: Trip) => {
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
      summary.trips.push(trip);
      summary.totalTons += Number(trip.netWeight || 0);
      if (type === 'vendor-customer') summary.grossAmount += Number(trip.revenue || 0);
      if (type === 'mine-quarry') summary.grossAmount += Number(trip.materialCost || 0);
      if (type === 'transport-owner') summary.grossAmount += Number(trip.transportCost || 0);
      if (type === 'royalty-owner') summary.grossAmount += Number(trip.royaltyCost || 0);
    };

    trips.forEach(trip => {
      if (trip.customer) addSummary('vendor-customer', trip.customer, trip);
      if (trip.quarryName) addSummary('mine-quarry', trip.quarryName, trip);
      if (trip.transporterName) addSummary('transport-owner', trip.transporterName, trip);
      if (trip.royaltyOwnerName) addSummary('royalty-owner', trip.royaltyOwnerName, trip);
    });

    const addPayment = (type: RatePartyType | undefined, name: string | undefined, amount: number) => {
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

    const addPaymentRecord = (payment: Payment, partyName: string) => {
      if (!payment.ratePartyType) return;
      const isCustomer = payment.ratePartyType === 'vendor-customer';
      const signedAmount = payment.type === PaymentType.RECEIPT
        ? (isCustomer ? payment.amount : -payment.amount)
        : (isCustomer ? -payment.amount : payment.amount);
      addPayment(payment.ratePartyType as RatePartyType, partyName, signedAmount);
    };

    advances.forEach(advance => {
      if (!advance.ratePartyType || !advance.ratePartyId) return;
      const match = Array.from(partyIdLookup.entries()).find(([key, id]) => key.startsWith(`${advance.ratePartyType}:`) && id === advance.ratePartyId);
      if (match) {
        const name = match[0].split(':').slice(1).join(':');
        addPayment(advance.ratePartyType, name, advance.amount);
      }
    });

    expenses.forEach(expense => {
      if (!expense.ratePartyType || !expense.ratePartyId) return;
      const match = Array.from(partyIdLookup.entries()).find(([key, id]) => key.startsWith(`${expense.ratePartyType}:`) && id === expense.ratePartyId);
      if (match) {
        const name = match[0].split(':').slice(1).join(':');
        addPayment(expense.ratePartyType, name, expense.amount);
      }
    });

    payments.forEach(payment => {
      if (!payment.ratePartyType || !payment.ratePartyId) return;
      const match = Array.from(partyIdLookup.entries()).find(([key, id]) => key.startsWith(`${payment.ratePartyType}:`) && id === payment.ratePartyId);
      if (match) {
        const name = match[0].split(':').slice(1).join(':');
        addPaymentRecord(payment, name);
      }
    });

    bucket.forEach(summary => {
      summary.balance = summary.grossAmount - summary.paidAmount;
    });

    return Array.from(bucket.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [trips, advances, expenses, payments, partyIdLookup]);

  const filteredSummaries = useMemo(() => {
    return summaries.filter(summary => {
      if (selectedType !== 'all' && summary.type !== selectedType) return false;
      if (selectedParty !== 'all' && summary.key !== selectedParty) return false;
      return true;
    });
  }, [summaries, selectedType, selectedParty]);

  const selectedSummary = filteredSummaries.find(item => item.key === selectedKey) || null;
  const selectedPartyId = useMemo(() => {
    if (!selectedSummary) return null;
    return partyIdLookup.get(`${selectedSummary.type}:${selectedSummary.name}`) || null;
  }, [partyIdLookup, selectedSummary]);

  const paymentRows = useMemo(() => {
    if (!selectedSummary || !selectedPartyId) return [];
    const rows: Array<{ id: string; date: string; source: string; direction: string; amount: number; remarks?: string }> = [];
    advances
      .filter(advance => advance.ratePartyType === selectedSummary.type && advance.ratePartyId === selectedPartyId)
      .forEach(advance => {
        rows.push({
          id: `advance-${advance.id}`,
          date: advance.date,
          source: 'Advance',
          direction: 'Paid',
          amount: -Number(advance.amount || 0),
          remarks: advance.remarks,
        });
      });
    expenses
      .filter(expense => expense.ratePartyType === selectedSummary.type && expense.ratePartyId === selectedPartyId)
      .forEach(expense => {
        const signedAmount = expense.type === 'DEBIT' ? -Number(expense.amount || 0) : Number(expense.amount || 0);
        rows.push({
          id: `expense-${expense.id}`,
          date: expense.date,
          source: 'Daily Expense',
          direction: expense.type === 'DEBIT' ? 'Debit' : 'Credit',
          amount: signedAmount,
          remarks: expense.remarks,
        });
      });
    payments
      .filter(payment => payment.ratePartyType === selectedSummary.type && payment.ratePartyId === selectedPartyId)
      .forEach(payment => {
        const isCustomer = payment.ratePartyType === 'vendor-customer';
        const signedAmount = payment.type === PaymentType.RECEIPT
          ? (isCustomer ? Number(payment.amount || 0) : -Number(payment.amount || 0))
          : (isCustomer ? -Number(payment.amount || 0) : Number(payment.amount || 0));
        rows.push({
          id: `payment-${payment.id}`,
          date: payment.date,
          source: 'Payment',
          direction: payment.type,
          amount: signedAmount,
          remarks: payment.remarks,
        });
      });
    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [advances, expenses, payments, selectedPartyId, selectedSummary]);

  const exportCsv = () => {
    const header = ['Rate Party Type', 'Rate Party', 'Trips', 'Net Tons', 'Total', 'Paid', 'Balance'];
    const rows = filteredSummaries.map(item => [
      RATE_PARTY_LABELS[item.type],
      item.name,
      item.trips.length,
      item.totalTons.toFixed(2),
      item.grossAmount.toFixed(2),
      item.paidAmount.toFixed(2),
      item.balance.toFixed(2),
    ]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'account_ledger_overview.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rows = filteredSummaries.map(item => [
      item.name,
      RATE_PARTY_LABELS[item.type],
      item.trips.length,
      item.totalTons.toFixed(2),
      item.grossAmount.toFixed(2),
      item.paidAmount.toFixed(2),
      item.balance.toFixed(2),
    ]);
    const selectedTripsTable = selectedSummary ? `
          <h3>Trip Details - ${selectedSummary.name}</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Material</th>
                <th>Net Tons</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${selectedSummary.trips.map(trip => `
                <tr>
                  <td>${trip.date?.split('T')[0] || ''}</td>
                  <td>${trip.vehicleNumber || ''}</td>
                  <td>${trip.material || ''}</td>
                  <td>${Number(trip.netWeight || 0).toFixed(2)}</td>
                  <td>${trip.status || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
    ` : '';
    const paymentsTable = selectedSummary ? `
          <h3>Payments & Expenses - ${selectedSummary.name}</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${paymentRows.map(row => `
                <tr>
                  <td>${row.date?.split('T')[0] || ''}</td>
                  <td>${row.source}</td>
                  <td>${row.direction}</td>
                  <td>${row.amount.toFixed(2)}</td>
                  <td>${row.remarks || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
    ` : '';
    const html = `
      <html>
        <head>
          <title>Account Ledger Overview</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f2f2f2; }
            h3 { margin-top: 24px; }
          </style>
        </head>
        <body>
          <h2>Account Ledger Overview</h2>
          <table>
            <thead>
              <tr>
                <th>Rate Party</th>
                <th>Type</th>
                <th>Trips</th>
                <th>Net Tons</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          ${selectedTripsTable}
          ${paymentsTable}
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
        title="Account Ledger Overview"
        subtitle="Rate party balances, trips, and payments summary"
        filters={[]}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Export CSV', action: exportCsv }}
        secondaryAction={{ label: 'Export PDF', action: exportPdf }}
      />
      <main className="pt-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Rate Party Type</label>
            <select
              value={selectedType}
              onChange={(event) => {
                setSelectedType(event.target.value as RatePartyType | 'all');
                setSelectedParty('all');
                setSelectedKey(null);
              }}
              className="mt-2 px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm"
            >
              <option value="all">All</option>
              {Object.entries(RATE_PARTY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Rate Party</label>
            <select
              value={selectedParty}
              onChange={(event) => {
                setSelectedParty(event.target.value);
                setSelectedKey(event.target.value === 'all' ? null : event.target.value);
              }}
              className="mt-2 px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm"
            >
              <option value="all">All</option>
              {summaries
                .filter(item => selectedType === 'all' || item.type === selectedType)
                .map(item => (
                  <option key={item.key} value={item.key}>{item.name}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Rate Party', 'Type', 'Trips', 'Net Tons', 'Total', 'Paid', 'Balance'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSummaries.map(item => (
                  <tr
                    key={item.key}
                    onClick={() => setSelectedKey(item.key)}
                    className={`cursor-pointer ${selectedKey === item.key ? 'bg-blue-50 dark:bg-gray-700/60' : 'bg-white dark:bg-gray-800'}`}
                  >
                    <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-300">{RATE_PARTY_LABELS[item.type]}</td>
                    <td className="px-6 py-3 text-sm">{item.trips.length}</td>
                    <td className="px-6 py-3 text-sm">{item.totalTons.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm">{item.grossAmount.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-green-500">{item.paidAmount.toFixed(2)}</td>
                    <td className={`px-6 py-3 text-sm font-semibold ${item.balance >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {item.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {filteredSummaries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-6 text-center text-sm text-gray-500">
                      No rate party data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedSummary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedSummary.name}</h3>
                <p className="text-sm text-gray-500">{RATE_PARTY_LABELS[selectedSummary.type]}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                Trips: {selectedSummary.trips.length} · Net Tons: {selectedSummary.totalTons.toFixed(2)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Date', 'Vehicle', 'Material', 'Net Tons', 'Status'].map(header => (
                      <th key={header} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedSummary.trips.map(trip => (
                    <tr key={trip.id}>
                      <td className="px-4 py-2 text-sm">{trip.date?.split('T')[0]}</td>
                      <td className="px-4 py-2 text-sm">{trip.vehicleNumber}</td>
                      <td className="px-4 py-2 text-sm">{trip.material}</td>
                      <td className="px-4 py-2 text-sm">{Number(trip.netWeight || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm capitalize">{trip.status}</td>
                    </tr>
                  ))}
                  {selectedSummary.trips.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                        No trips recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Date', 'Source', 'Type', 'Amount', 'Remarks'].map(header => (
                      <th key={header} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paymentRows.map(row => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 text-sm">{row.date?.split('T')[0]}</td>
                      <td className="px-4 py-2 text-sm">{row.source}</td>
                      <td className="px-4 py-2 text-sm">{row.direction}</td>
                      <td className={`px-4 py-2 text-sm ${row.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {row.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm">{row.remarks || '-'}</td>
                    </tr>
                  ))}
                  {paymentRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                        No payments or expenses recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AccountLedgerOverview;
