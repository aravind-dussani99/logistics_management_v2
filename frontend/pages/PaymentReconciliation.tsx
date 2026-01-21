import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatDateDisplay } from '../utils';
import { RatePartyType } from '../types';

type PartySummary = {
  tripTotal: number;
  paymentTotal: number;
  balance: number;
};

const PaymentReconciliation: React.FC = () => {
  const {
    trips,
    payments,
    vendorCustomers,
    mineQuarries,
    transportOwnerProfiles,
    royaltyOwnerProfiles,
    loadTrips,
    loadPayments,
    loadVendorCustomers,
    loadMineQuarries,
    loadTransportOwnerProfiles,
    loadRoyaltyOwnerProfiles,
    refreshKey,
  } = useData();
  const [mode, setMode] = useState<'party' | 'account' | 'head'>('party');
  const [selectedParty, setSelectedParty] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedHeadAccount, setSelectedHeadAccount] = useState('');

  useEffect(() => {
    loadTrips();
    loadPayments();
    loadVendorCustomers();
    loadMineQuarries();
    loadTransportOwnerProfiles();
    loadRoyaltyOwnerProfiles();
  }, [
    loadTrips,
    loadPayments,
    loadVendorCustomers,
    loadMineQuarries,
    loadTransportOwnerProfiles,
    loadRoyaltyOwnerProfiles,
    refreshKey,
  ]);

  const normalizeName = (value: string) => value.trim().toLowerCase();

  const ratePartyNameById = useMemo(() => {
    const map = new Map<string, string>();
    vendorCustomers.forEach(item => map.set(`vendor-customer:${item.id}`, item.name));
    mineQuarries.forEach(item => map.set(`mine-quarry:${item.id}`, item.name));
    transportOwnerProfiles.forEach(item => map.set(`transport-owner:${item.id}`, item.name));
    royaltyOwnerProfiles.forEach(item => map.set(`royalty-owner:${item.id}`, item.name));
    return map;
  }, [vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles]);

  const partyOptions = useMemo(() => {
    const values = new Set<string>();
    vendorCustomers.forEach(item => values.add(item.name));
    mineQuarries.forEach(item => values.add(item.name));
    transportOwnerProfiles.forEach(item => values.add(item.name));
    royaltyOwnerProfiles.forEach(item => values.add(item.name));
    payments.forEach(item => {
      if (item.ratePartyName) values.add(item.ratePartyName);
      if (item.ratePartyType && item.ratePartyId) {
        const resolved = ratePartyNameById.get(`${item.ratePartyType}:${item.ratePartyId}`);
        if (resolved) values.add(resolved);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles, payments, ratePartyNameById]);

  const accountOptions = useMemo(() => {
    const values = new Set<string>();
    payments.forEach(item => {
      if (item.fromAccount) values.add(item.fromAccount);
      if (item.toAccount) values.add(item.toAccount);
      if (item.headAccount) values.add(item.headAccount);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [payments]);

  const headAccountOptions = useMemo(() => {
    const values = new Set<string>();
    payments.forEach(item => {
      if (item.headAccount) values.add(item.headAccount);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [payments]);

  const selectedPartyKey = normalizeName(selectedParty);

  const selectedPartyTypes = useMemo(() => {
    if (!selectedPartyKey) return new Set<RatePartyType>();
    const types = new Set<RatePartyType>();
    vendorCustomers.forEach(item => {
      if (normalizeName(item.name) === selectedPartyKey) types.add('vendor-customer');
    });
    mineQuarries.forEach(item => {
      if (normalizeName(item.name) === selectedPartyKey) types.add('mine-quarry');
    });
    transportOwnerProfiles.forEach(item => {
      if (normalizeName(item.name) === selectedPartyKey) types.add('transport-owner');
    });
    royaltyOwnerProfiles.forEach(item => {
      if (normalizeName(item.name) === selectedPartyKey) types.add('royalty-owner');
    });
    return types;
  }, [selectedPartyKey, vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles]);

  const partyTripRows = useMemo(() => {
    if (!selectedPartyKey) return [];
    return trips
      .map(trip => {
        const revenue = Number(trip.revenue || 0);
        const materialCost = Number(trip.materialCost || 0);
        const transportCost = Number(trip.transportCost || 0);
        const royaltyCost = Number(trip.royaltyCost || 0);
        const matchesCustomer = trip.customer && normalizeName(trip.customer) === selectedPartyKey;
        const matchesQuarry = trip.quarryName && normalizeName(trip.quarryName) === selectedPartyKey;
        const matchesTransport = trip.transporterName && normalizeName(trip.transporterName) === selectedPartyKey;
        const matchesRoyalty = trip.royaltyOwnerName && normalizeName(trip.royaltyOwnerName) === selectedPartyKey;
        if (!matchesCustomer && !matchesQuarry && !matchesTransport && !matchesRoyalty) return null;

        const matchedRevenue = matchesCustomer ? revenue : 0;
        const matchedMaterial = matchesQuarry ? materialCost : 0;
        const matchedTransport = matchesTransport ? transportCost : 0;
        const matchedRoyalty = matchesRoyalty ? royaltyCost : 0;
        const matchedTotal = matchedRevenue + matchedMaterial + matchedTransport + matchedRoyalty;
        const netWeight = Number(trip.netWeight || 0);
        return {
          id: trip.id,
          date: trip.date,
          invoice: trip.invoiceDCNumber,
          material: trip.material,
          pickupPlace: trip.pickupPlace,
          dropOffPlace: trip.dropOffPlace,
          netWeight,
          revenue: matchedRevenue,
          materialCost: matchedMaterial,
          transportCost: matchedTransport,
          royaltyCost: matchedRoyalty,
          customerRate: netWeight > 0 ? matchedRevenue / netWeight : 0,
          mineRate: netWeight > 0 ? matchedMaterial / netWeight : 0,
          transportRate: netWeight > 0 ? matchedTransport / netWeight : 0,
          royaltyRate: netWeight > 0 ? matchedRoyalty / netWeight : 0,
          totalValue: matchedTotal,
          amount: matchedTotal,
        };
      })
      .filter(Boolean) as Array<{
        id: number;
        date: string;
        invoice?: string;
        material?: string;
        pickupPlace?: string;
        dropOffPlace?: string;
        netWeight: number;
        revenue: number;
        materialCost: number;
        transportCost: number;
        royaltyCost: number;
        customerRate: number;
        mineRate: number;
        transportRate: number;
        royaltyRate: number;
        totalValue: number;
        amount: number;
      }>;
  }, [trips, selectedPartyKey]);

  const showCustomerColumns = selectedPartyTypes.has('vendor-customer');
  const showMineColumns = selectedPartyTypes.has('mine-quarry');
  const showTransportColumns = selectedPartyTypes.has('transport-owner');
  const showRoyaltyColumns = selectedPartyTypes.has('royalty-owner');
  const tripColCount = 6
    + (showMineColumns ? 3 : 0)
    + (showTransportColumns ? 4 : 0)
    + (showCustomerColumns ? 2 : 0)
    + (showRoyaltyColumns ? 2 : 0);

  const partyPaymentRows = useMemo(() => {
    if (!selectedPartyKey) return [];
    return payments.filter(payment => {
    const name = payment.ratePartyName
      || (payment.ratePartyType && payment.ratePartyId
        ? ratePartyNameById.get(`${payment.ratePartyType}:${payment.ratePartyId}`) || ''
        : '');
      return name && normalizeName(name) === selectedPartyKey;
    });
  }, [payments, ratePartyNameById, selectedPartyKey]);

  const partySummary: PartySummary = useMemo(() => {
    const tripTotal = partyTripRows.reduce((sum, row) => sum + row.amount, 0);
    const paymentTotal = partyPaymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return {
      tripTotal,
      paymentTotal,
      balance: tripTotal - paymentTotal,
    };
  }, [partyTripRows, partyPaymentRows]);

  const accountPaymentRows = useMemo(() => {
    if (!selectedAccount) return [];
    const key = normalizeName(selectedAccount);
    return payments.filter(payment => {
      return normalizeName(payment.fromAccount || '') === key || normalizeName(payment.toAccount || '') === key;
    });
  }, [payments, selectedAccount]);

  const accountBalance = useMemo(() => {
    if (!selectedAccount) return 0;
    const key = normalizeName(selectedAccount);
    return accountPaymentRows.reduce((sum, payment) => {
      const amount = Number(payment.amount || 0);
      if (normalizeName(payment.toAccount || '') === key) return sum + amount;
      if (normalizeName(payment.fromAccount || '') === key) return sum - amount;
      return sum;
    }, 0);
  }, [accountPaymentRows, selectedAccount]);

  const headPaymentRows = useMemo(() => {
    if (!selectedHeadAccount) return [];
    const key = normalizeName(selectedHeadAccount);
    return payments.filter(payment => normalizeName(payment.headAccount || '') === key);
  }, [payments, selectedHeadAccount]);

  const headBalance = useMemo(() => {
    if (!selectedHeadAccount) return 0;
    return headPaymentRows.reduce((sum, payment) => {
      const amount = Number(payment.amount || 0);
      return payment.type === 'RECEIPT' ? sum + amount : sum - amount;
    }, 0);
  }, [headPaymentRows, selectedHeadAccount]);

  const exportCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTrips = () => {
    const header = [
      'Trip #',
      'Date',
      'Invoice/DC',
      ...(showMineColumns ? ['Material Type'] : []),
      ...(showTransportColumns ? ['Pickup Location', 'Drop-off Location'] : []),
      'Net Qty',
      ...(showCustomerColumns ? ['Customer Rate/Ton', 'Customer Amount'] : []),
      ...(showMineColumns ? ['Mine Rate/Ton', 'Mine Amount'] : []),
      ...(showTransportColumns ? ['Transport Rate/Ton', 'Transport Amount'] : []),
      ...(showRoyaltyColumns ? ['Royalty Rate/Ton', 'Royalty Amount'] : []),
      'Total Value',
      'Matched Amount',
    ];
    const rows = partyTripRows.map(row => [
      `#${row.id}`,
      formatDateDisplay(row.date),
      row.invoice || '-',
      ...(showMineColumns ? [row.material || '-'] : []),
      ...(showTransportColumns ? [row.pickupPlace || '-', row.dropOffPlace || '-'] : []),
      row.netWeight.toFixed(2),
      ...(showCustomerColumns ? [row.customerRate.toFixed(2), row.revenue.toFixed(2)] : []),
      ...(showMineColumns ? [row.mineRate.toFixed(2), row.materialCost.toFixed(2)] : []),
      ...(showTransportColumns ? [row.transportRate.toFixed(2), row.transportCost.toFixed(2)] : []),
      ...(showRoyaltyColumns ? [row.royaltyRate.toFixed(2), row.royaltyCost.toFixed(2)] : []),
      row.totalValue.toFixed(2),
      row.amount.toFixed(2),
    ]);
    exportCsv(`reconciliation_trips_${selectedPartyKey || 'party'}.csv`, [header, ...rows]);
  };

  const handleExportPayments = () => {
    const header = ['Date', 'Type', 'From', 'To', 'Amount'];
    const rows = partyPaymentRows.map(payment => [
      formatDateDisplay(payment.date),
      payment.type === 'PAYMENT' ? 'Payment' : 'Receipt',
      payment.fromAccount || '-',
      payment.toAccount || '-',
      Number(payment.amount || 0).toFixed(2),
    ]);
    exportCsv(`reconciliation_payments_${selectedPartyKey || 'party'}.csv`, [header, ...rows]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Reconciliation"
        subtitle="Cross-check trip charges, payments, and balances for a rate party or account."
        filters={{}}
        onFilterChange={() => undefined}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showFilters={[]}
        showAddAction={false}
      />

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode('party')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === 'party' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Counterparty
          </button>
          <button
            type="button"
            onClick={() => setMode('account')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === 'account' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Account
          </button>
          <button
            type="button"
            onClick={() => setMode('head')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === 'head' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Head Account
          </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="mt-4">
          {mode === 'party' ? (
            <div className="space-y-4">
              <div className="max-w-md">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Counterparty Name</label>
                <input
                  type="text"
                  value={selectedParty}
                  onChange={(event) => setSelectedParty(event.target.value)}
                  list="recon-party-list"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800"
                  placeholder="Select or type a rate party name"
                />
                <datalist id="recon-party-list">
                  {partyOptions.map(option => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>

              {selectedParty && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400">Trips Total</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(partySummary.tripTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400">Payments Total</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(partySummary.paymentTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400">Balance</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(partySummary.balance)}</p>
                  </div>
                </div>
              )}
            </div>
          ) : mode === 'account' ? (
            <div className="space-y-4">
              <div className="max-w-md">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Account</label>
                <input
                  type="text"
                  value={selectedAccount}
                  onChange={(event) => setSelectedAccount(event.target.value)}
                  list="recon-account-list"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800"
                  placeholder="Select or type an account"
                />
                <datalist id="recon-account-list">
                  {accountOptions.map(option => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
              {selectedAccount && (
                <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
                  <p className="text-gray-500 dark:text-gray-400">Balance</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(accountBalance)}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-w-md">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Head Account</label>
                <input
                  type="text"
                  value={selectedHeadAccount}
                  onChange={(event) => setSelectedHeadAccount(event.target.value)}
                  list="recon-head-list"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800"
                  placeholder="Select or type a head account"
                />
                <datalist id="recon-head-list">
                  {headAccountOptions.map(option => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
              {selectedHeadAccount && (
                <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
                  <p className="text-gray-500 dark:text-gray-400">Balance</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(headBalance)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {mode === 'party' && selectedParty && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
              <span>Trips</span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleExportTrips}
                  className="rounded-md border border-primary px-3 py-1 text-primary transition hover:bg-primary hover:text-white"
                >
                  Export Trips CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded-md border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Print
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left">Trip #</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Invoice/DC</th>
                    {showMineColumns && <th className="px-4 py-3 text-left">Material</th>}
                    {showTransportColumns && <th className="px-4 py-3 text-left">Pickup</th>}
                    {showTransportColumns && <th className="px-4 py-3 text-left">Drop-off</th>}
                    <th className="px-4 py-3 text-left">Net Qty</th>
                    {showCustomerColumns && <th className="px-4 py-3 text-left">Customer Rate/Ton</th>}
                    {showCustomerColumns && <th className="px-4 py-3 text-left">Customer Amount</th>}
                    {showMineColumns && <th className="px-4 py-3 text-left">Mine Rate/Ton</th>}
                    {showMineColumns && <th className="px-4 py-3 text-left">Mine Amount</th>}
                    {showTransportColumns && <th className="px-4 py-3 text-left">Transport Rate/Ton</th>}
                    {showTransportColumns && <th className="px-4 py-3 text-left">Transport Amount</th>}
                    {showRoyaltyColumns && <th className="px-4 py-3 text-left">Royalty Rate/Ton</th>}
                    {showRoyaltyColumns && <th className="px-4 py-3 text-left">Royalty Amount</th>}
                    <th className="px-4 py-3 text-left">Total Value</th>
                    <th className="px-4 py-3 text-left">Matched Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {partyTripRows.map(row => (
                    <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3">#{row.id}</td>
                      <td className="px-4 py-3">{formatDateDisplay(row.date)}</td>
                      <td className="px-4 py-3">{row.invoice || '-'}</td>
                      {showMineColumns && <td className="px-4 py-3">{row.material || '-'}</td>}
                      {showTransportColumns && <td className="px-4 py-3">{row.pickupPlace || '-'}</td>}
                      {showTransportColumns && <td className="px-4 py-3">{row.dropOffPlace || '-'}</td>}
                      <td className="px-4 py-3">{row.netWeight.toFixed(2)}</td>
                      {showCustomerColumns && <td className="px-4 py-3">{formatCurrency(row.customerRate)}</td>}
                      {showCustomerColumns && <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>}
                      {showMineColumns && <td className="px-4 py-3">{formatCurrency(row.mineRate)}</td>}
                      {showMineColumns && <td className="px-4 py-3">{formatCurrency(row.materialCost)}</td>}
                      {showTransportColumns && <td className="px-4 py-3">{formatCurrency(row.transportRate)}</td>}
                      {showTransportColumns && <td className="px-4 py-3">{formatCurrency(row.transportCost)}</td>}
                      {showRoyaltyColumns && <td className="px-4 py-3">{formatCurrency(row.royaltyRate)}</td>}
                      {showRoyaltyColumns && <td className="px-4 py-3">{formatCurrency(row.royaltyCost)}</td>}
                      <td className="px-4 py-3">{formatCurrency(row.totalValue)}</td>
                      <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  {partyTripRows.length === 0 && (
                    <tr>
                      <td colSpan={tripColCount} className="px-4 py-6 text-center text-sm text-gray-500">No trips found for this rate party.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
              <span>Payments</span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleExportPayments}
                  className="rounded-md border border-primary px-3 py-1 text-primary transition hover:bg-primary hover:text-white"
                >
                  Export Payments CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded-md border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Print
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">From</th>
                    <th className="px-4 py-3 text-left">To</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {partyPaymentRows.map(payment => (
                    <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3">{formatDateDisplay(payment.date)}</td>
                      <td className="px-4 py-3">{payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
                      <td className="px-4 py-3">{payment.fromAccount || '-'}</td>
                      <td className="px-4 py-3">{payment.toAccount || '-'}</td>
                      <td className="px-4 py-3">{formatCurrency(Number(payment.amount || 0))}</td>
                    </tr>
                  ))}
                  {partyPaymentRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No payments found for this rate party.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {mode === 'account' && selectedAccount && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            Account Payments
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">From</th>
                  <th className="px-4 py-3 text-left">To</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Rate Party</th>
                </tr>
              </thead>
              <tbody>
                {accountPaymentRows.map(payment => (
                  <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{formatDateDisplay(payment.date)}</td>
                    <td className="px-4 py-3">{payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
                    <td className="px-4 py-3">{payment.fromAccount || '-'}</td>
                    <td className="px-4 py-3">{payment.toAccount || '-'}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(payment.amount || 0))}</td>
                    <td className="px-4 py-3">{payment.ratePartyName || '-'}</td>
                  </tr>
                ))}
                {accountPaymentRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No payments found for this account.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'head' && selectedHeadAccount && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            Head Account Payments
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">From</th>
                  <th className="px-4 py-3 text-left">To</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Counterparty</th>
                </tr>
              </thead>
              <tbody>
                {headPaymentRows.map(payment => (
                  <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{formatDateDisplay(payment.date)}</td>
                    <td className="px-4 py-3">{payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
                    <td className="px-4 py-3">{payment.fromAccount || '-'}</td>
                    <td className="px-4 py-3">{payment.toAccount || '-'}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(payment.amount || 0))}</td>
                    <td className="px-4 py-3">{payment.ratePartyName || '-'}</td>
                  </tr>
                ))}
                {headPaymentRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No payments found for this head account.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentReconciliation;
