import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { formatCurrency, formatDateDisplay } from '../utils';
import { RatePartyType } from '../types';

type PartySummary = {
  tripTotal: number;
  paymentTotal: number;
  balance: number;
};

type PaymentReconciliationProps = {
  showHeader?: boolean;
  initialMode?: 'party' | 'head';
  hideModeToggle?: boolean;
  hideDownload?: boolean;
  hidePrint?: boolean;
  dateFrom?: string;
  dateTo?: string;
};

const PaymentReconciliation: React.FC<PaymentReconciliationProps> = ({
  showHeader = true,
  initialMode = 'party',
  hideModeToggle = false,
  hideDownload = false,
  hidePrint = false,
  dateFrom,
  dateTo,
}) => {
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
  const [mode, setMode] = useState<'party' | 'head'>(initialMode);
  const [selectedParty, setSelectedParty] = useState('');
  const [selectedHeadAccount, setSelectedHeadAccount] = useState('');
  const safeTrips = Array.isArray(trips) ? trips : [];
  const safePayments = Array.isArray(payments) ? payments : [];

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

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const normalizeName = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

  function resolveAccountMatch(payment: (typeof payments)[number], key: string) {
    const fromMatch = normalizeName(payment.fromAccount || '') === key;
    const toMatch = normalizeName(payment.toAccount || '') === key;
    if (fromMatch || toMatch) {
      return { fromMatch, toMatch, viaCounterparty: false };
    }
    const counterpartyMatch = normalizeName(payment.ratePartyName || '') === key;
    if (counterpartyMatch && !payment.toAccount && payment.type === 'RECEIPT') {
      return { fromMatch: false, toMatch: true, viaCounterparty: true };
    }
    if (counterpartyMatch && !payment.fromAccount && payment.type === 'PAYMENT') {
      return { fromMatch: true, toMatch: false, viaCounterparty: true };
    }
    return null;
  }

  function getCounterpartyDelta(payment: (typeof payments)[number], key: string) {
    const amount = Number(payment.amount || 0);
    const fromMatch = normalizeName(payment.fromAccount || '') === key;
    const toMatch = normalizeName(payment.toAccount || '') === key;
    const counterpartyMatch = normalizeName(payment.ratePartyName || '') === key;
    if (payment.type === 'RECEIPT') {
      if (fromMatch || (counterpartyMatch && !payment.fromAccount)) return amount;
      return 0;
    }
    if (payment.type === 'PAYMENT') {
      if (counterpartyMatch || toMatch) return -amount;
      return 0;
    }
    return 0;
  }

  const filteredTrips = useMemo(() => {
    if (!dateFrom && !dateTo) return safeTrips;
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    return safeTrips.filter(trip => {
      const tripDate = trip.date ? new Date(trip.date) : null;
      if (fromDate && tripDate && tripDate < fromDate) return false;
      if (toDate && tripDate && tripDate > toDate) return false;
      return true;
    });
  }, [safeTrips, dateFrom, dateTo]);

  const filteredPayments = useMemo(() => {
    if (!dateFrom && !dateTo) return safePayments;
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    return safePayments.filter(payment => {
      const paymentDate = payment.date ? new Date(payment.date) : null;
      if (fromDate && paymentDate && paymentDate < fromDate) return false;
      if (toDate && paymentDate && paymentDate > toDate) return false;
      return true;
    });
  }, [safePayments, dateFrom, dateTo]);

  const ratePartyNameById = useMemo(() => {
    const map = new Map<string, string>();
    vendorCustomers.forEach(item => map.set(`vendor-customer:${item.id}`, item.name));
    mineQuarries.forEach(item => map.set(`mine-quarry:${item.id}`, item.name));
    transportOwnerProfiles.forEach(item => map.set(`transport-owner:${item.id}`, item.name));
    royaltyOwnerProfiles.forEach(item => map.set(`royalty-owner:${item.id}`, item.name));
    return map;
  }, [vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles]);

  const accountOptions = useMemo(() => {
    const values = new Set<string>();
    filteredPayments.forEach(item => {
      if (item.fromAccount) values.add(item.fromAccount);
      if (item.toAccount) values.add(item.toAccount);
      if (item.headAccount) values.add(item.headAccount);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [filteredPayments]);

  const partyOptions = useMemo(() => {
    const values = new Set<string>();
    vendorCustomers.forEach(item => values.add(item.name));
    mineQuarries.forEach(item => values.add(item.name));
    transportOwnerProfiles.forEach(item => values.add(item.name));
    royaltyOwnerProfiles.forEach(item => values.add(item.name));
    filteredPayments.forEach(item => {
      if (item.ratePartyName) values.add(item.ratePartyName);
      if (!item.ratePartyName && item.fromAccount) values.add(item.fromAccount);
      if (!item.ratePartyName && item.toAccount) values.add(item.toAccount);
      if (item.ratePartyType && item.ratePartyId) {
        const resolved = ratePartyNameById.get(`${item.ratePartyType}:${item.ratePartyId}`);
        if (resolved) values.add(resolved);
      }
    });
    accountOptions.forEach(option => values.add(option));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles, filteredPayments, ratePartyNameById, accountOptions]);

  const headAccountOptions = useMemo(() => {
    const values = new Set<string>();
    filteredPayments.forEach(item => {
      if (item.headAccount) values.add(item.headAccount);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [filteredPayments]);

  const selectedPartyKey = normalizeName(selectedParty);
  const internalAccountKeys = useMemo(() => {
    const values = new Set<string>();
    filteredPayments.forEach(payment => {
      if (payment.toAccount) values.add(normalizeName(payment.toAccount));
      if (payment.headAccount) values.add(normalizeName(payment.headAccount));
      if (payment.type === 'RECEIPT' && payment.fromAccount && !payment.toAccount && payment.ratePartyName) {
        values.add(normalizeName(payment.ratePartyName));
      }
    });
    return values;
  }, [filteredPayments]);
  const isAccountSelection = selectedPartyKey ? internalAccountKeys.has(selectedPartyKey) : false;

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
    if (!types.has('vendor-customer')) {
      const matchesTripCustomer = filteredTrips.some(trip => {
        const actualName = trip.actualVendorCustomerName || '';
        if (actualName && normalizeName(actualName) === selectedPartyKey) return true;
        if (trip.customer && normalizeName(trip.customer) === selectedPartyKey) return true;
        if (trip.vendorName && normalizeName(trip.vendorName) === selectedPartyKey) return true;
        return false;
      });
      if (matchesTripCustomer) types.add('vendor-customer');
    }
    return types;
  }, [selectedPartyKey, vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles, filteredTrips]);

  const partyTripRows = useMemo(() => {
    if (!selectedPartyKey) return [];
    return filteredTrips
      .map(trip => {
        const revenue = Number(trip.revenue || 0);
        const materialCost = Number(trip.materialCost || 0);
        const transportCost = Number(trip.transportCost || 0);
        const royaltyCost = Number(trip.royaltyCost || 0);
        const matchesCustomer = (trip.actualVendorCustomerName && normalizeName(trip.actualVendorCustomerName) === selectedPartyKey)
          || (trip.customer && normalizeName(trip.customer) === selectedPartyKey)
          || (trip.vendorName && normalizeName(trip.vendorName) === selectedPartyKey);
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
  }, [filteredTrips, selectedPartyKey]);

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
    return filteredPayments.filter(payment => {
      const name = payment.ratePartyName
        || (payment.ratePartyType && payment.ratePartyId
          ? ratePartyNameById.get(`${payment.ratePartyType}:${payment.ratePartyId}`) || ''
          : '');
      if (name && normalizeName(name) === selectedPartyKey) return true;
      if (!name && normalizeName(payment.fromAccount || '') === selectedPartyKey) return true;
      if (!name && normalizeName(payment.toAccount || '') === selectedPartyKey) return true;
      return false;
    });
  }, [filteredPayments, ratePartyNameById, selectedPartyKey]);

  const nonTripTransactionRows = useMemo(() => {
    if (!selectedPartyKey) return [];
    return filteredPayments.filter(payment => {
      if (normalizeName(payment.ratePartyName || '') === selectedPartyKey) return true;
      if (normalizeName(payment.fromAccount || '') === selectedPartyKey) return true;
      if (normalizeName(payment.toAccount || '') === selectedPartyKey) return true;
      return false;
    });
  }, [filteredPayments, selectedPartyKey]);

  const accountStatementRows = useMemo(() => {
    if (!selectedPartyKey || !isAccountSelection) return [];
    return filteredPayments.filter(payment => resolveAccountMatch(payment, selectedPartyKey));
  }, [filteredPayments, selectedPartyKey, isAccountSelection]);

  const ratePartyTypeByName = useMemo(() => {
    const map = new Map<string, RatePartyType>();
    vendorCustomers.forEach(item => map.set(normalizeName(item.name), 'vendor-customer'));
    mineQuarries.forEach(item => map.set(normalizeName(item.name), 'mine-quarry'));
    transportOwnerProfiles.forEach(item => map.set(normalizeName(item.name), 'transport-owner'));
    royaltyOwnerProfiles.forEach(item => map.set(normalizeName(item.name), 'royalty-owner'));
    return map;
  }, [vendorCustomers, mineQuarries, transportOwnerProfiles, royaltyOwnerProfiles]);

  const resolvePaymentPartyType = useCallback((payment: (typeof payments)[number]) => {
    if (payment.ratePartyType) return payment.ratePartyType as RatePartyType;
    const name = payment.ratePartyName
      || (payment.ratePartyType && payment.ratePartyId
        ? ratePartyNameById.get(`${payment.ratePartyType}:${payment.ratePartyId}`) || ''
        : '');
    if (name) {
      const inferred = ratePartyTypeByName.get(normalizeName(name));
      if (inferred) return inferred;
    }
    if (selectedPartyTypes.size === 1) {
      return Array.from(selectedPartyTypes)[0];
    }
    if (payment.type === 'RECEIPT' && selectedPartyTypes.has('vendor-customer')) {
      return 'vendor-customer';
    }
    if (payment.type === 'PAYMENT') {
      if (selectedPartyTypes.has('mine-quarry')) return 'mine-quarry';
      if (selectedPartyTypes.has('transport-owner')) return 'transport-owner';
      if (selectedPartyTypes.has('royalty-owner')) return 'royalty-owner';
    }
    if (selectedPartyTypes.has('vendor-customer')) return 'vendor-customer';
    if (selectedPartyTypes.has('mine-quarry')) return 'mine-quarry';
    if (selectedPartyTypes.has('transport-owner')) return 'transport-owner';
    if (selectedPartyTypes.has('royalty-owner')) return 'royalty-owner';
    return null;
  }, [ratePartyNameById, ratePartyTypeByName, selectedPartyTypes]);

  const partySummary: PartySummary = useMemo(() => {
    const tripTotal = partyTripRows.reduce((sum, row) => sum + row.amount, 0);
    const paymentTotal = partyPaymentRows.reduce((sum, row) => {
      const amount = Number(row.amount || 0);
      const partyType = resolvePaymentPartyType(row);
      if (!partyType) return sum;
      const isCustomer = partyType === 'vendor-customer';
      const signed = row.type === 'RECEIPT'
        ? (isCustomer ? amount : -amount)
        : (isCustomer ? -amount : amount);
      return sum + signed;
    }, 0);
    return {
      tripTotal,
      paymentTotal,
      balance: tripTotal - paymentTotal,
    };
  }, [partyTripRows, partyPaymentRows, resolvePaymentPartyType]);

  const partyHasTrips = partyTripRows.length > 0;
  const partyPaymentTotals = useMemo(() => {
    if (!selectedPartyKey) return { inflow: 0, outflow: 0 };
    if (isAccountSelection) {
      return accountStatementRows.reduce(
        (acc, payment) => {
          const amount = Number(payment.amount || 0);
          const match = resolveAccountMatch(payment, selectedPartyKey);
          if (!match) return acc;
          if (match.toMatch) acc.inflow += amount;
          if (match.fromMatch) acc.outflow += amount;
          return acc;
        },
        { inflow: 0, outflow: 0 }
      );
    }
    if (!partyHasTrips) {
      return nonTripTransactionRows.reduce(
        (acc, payment) => {
          const amount = Number(payment.amount || 0);
          const delta = getCounterpartyDelta(payment, selectedPartyKey);
          if (delta > 0) acc.inflow += amount;
          if (delta < 0) acc.outflow += amount;
          return acc;
        },
        { inflow: 0, outflow: 0 }
      );
    }
    return { inflow: 0, outflow: 0 };
  }, [selectedPartyKey, isAccountSelection, accountStatementRows, partyHasTrips, nonTripTransactionRows, getCounterpartyDelta]);

  const partyPaymentBalance = partyHasTrips
    ? partySummary.balance
    : partyPaymentTotals.inflow - partyPaymentTotals.outflow;

  const partyTransactionRows = useMemo(() => {
    if (!selectedPartyKey) return [];
    const rows = partyHasTrips
      ? partyPaymentRows
      : (isAccountSelection ? accountStatementRows : nonTripTransactionRows);
    return [...rows].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return (a.id || 0) - (b.id || 0);
    });
  }, [selectedPartyKey, partyHasTrips, isAccountSelection, accountStatementRows, partyPaymentRows, nonTripTransactionRows]);

  const headPaymentRows = useMemo(() => {
    if (!selectedHeadAccount) return [];
    const key = normalizeName(selectedHeadAccount);
    return filteredPayments.filter(payment => normalizeName(payment.headAccount || '') === key);
  }, [filteredPayments, selectedHeadAccount]);

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
      {showHeader && (
        <PageHeader
          title="Payment Reconciliation"
          subtitle="Cross-check trip charges, payments, and balances for a rate party or account."
          filters={{}}
          onFilterChange={() => undefined}
          filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
          showFilters={[]}
          showAddAction={false}
        />
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!hideModeToggle && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setMode('party')}
                className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === 'party' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
              >
                Name / Account
              </button>
              <button
                type="button"
                onClick={() => setMode('head')}
                className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === 'head' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
              >
                Head Account
              </button>
            </div>
          )}
          {!hideDownload && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Download PDF
              </button>
            </div>
          )}
        </div>

        <div className="mt-4">
          {mode === 'party' ? (
            <div className="space-y-4">
              <div className="max-w-md">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name / Account</label>
                <input
                  type="text"
                  value={selectedParty}
                  onChange={(event) => setSelectedParty(event.target.value)}
                  list="recon-party-list"
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800"
                  placeholder="Select or type a name or account"
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
                    <p className="text-gray-500 dark:text-gray-400">{partyHasTrips ? 'Trips Total' : 'Total In'}</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {partyHasTrips ? formatCurrency(partySummary.tripTotal) : formatCurrency(partyPaymentTotals.inflow)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400">{partyHasTrips ? 'Payments Total' : 'Total Out'}</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {partyHasTrips ? formatCurrency(partySummary.paymentTotal) : formatCurrency(partyPaymentTotals.outflow)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400">Balance</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(partyPaymentBalance)}</p>
                  </div>
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
              <span>{partyHasTrips ? 'Payments' : 'Transactions'}</span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleExportPayments}
                  className="rounded-md border border-primary px-3 py-1 text-primary transition hover:bg-primary hover:text-white"
                >
                  Export Payments CSV
                </button>
                {!hidePrint && (
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="rounded-md border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Print
                  </button>
                )}
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
                    {!partyHasTrips && <th className="px-4 py-3 text-left">Opening Balance</th>}
                    {!partyHasTrips && <th className="px-4 py-3 text-left">Closing Balance</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let runningBalance = 0;
                    return partyTransactionRows.map(payment => {
                    const match = isAccountSelection ? resolveAccountMatch(payment, selectedPartyKey) : null;
                    const displayFrom = match?.viaCounterparty && match.fromMatch && !payment.fromAccount
                      ? selectedParty
                      : (payment.fromAccount || '-');
                    const displayTo = match?.viaCounterparty && match.toMatch && !payment.toAccount
                      ? selectedParty
                      : (payment.toAccount || '-');
                    const amountValue = Number(payment.amount || 0);
                    let delta = 0;
                    if (!partyHasTrips) {
                      if (isAccountSelection) {
                        if (match?.toMatch) delta += amountValue;
                        if (match?.fromMatch) delta -= amountValue;
                      } else {
                        delta = getCounterpartyDelta(payment, selectedPartyKey);
                      }
                    }
                    const openingBalance = runningBalance;
                    const closingBalance = openingBalance + delta;
                    runningBalance = closingBalance;
                    return (
                      <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-4 py-3">{formatDateDisplay(payment.date)}</td>
                        <td className="px-4 py-3">{payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
                        <td className="px-4 py-3">{displayFrom}</td>
                        <td className="px-4 py-3">{displayTo}</td>
                        <td className="px-4 py-3">{formatCurrency(amountValue)}</td>
                        {!partyHasTrips && <td className="px-4 py-3">{formatCurrency(openingBalance)}</td>}
                        {!partyHasTrips && <td className="px-4 py-3">{formatCurrency(closingBalance)}</td>}
                      </tr>
                    );
                    });
                  })()}
                  {partyTransactionRows.length === 0 && (
                    <tr>
                      <td colSpan={partyHasTrips ? 5 : 7} className="px-4 py-6 text-center text-sm text-gray-500">
                        No transactions found for this selection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {partyHasTrips && (
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
                {!hidePrint && (
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="rounded-md border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Print
                  </button>
                )}
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
          )}
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
                  <th className="px-4 py-3 text-left">Name</th>
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
