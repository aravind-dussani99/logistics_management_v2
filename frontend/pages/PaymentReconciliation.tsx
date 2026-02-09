import React, { useCallback, useEffect, useMemo, useState, useImperativeHandle } from 'react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
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

export type PaymentReconciliationHandle = {
  buildPrintHtml: () => string | null;
};

const PaymentReconciliation = React.forwardRef<PaymentReconciliationHandle, PaymentReconciliationProps>(({
  showHeader = true,
  initialMode = 'party',
  hideModeToggle = false,
  hideDownload = false,
  hidePrint = false,
  dateFrom,
  dateTo,
}, ref) => {
  const PAYMENT_PAGE_SIZE = 40;
  const TRIP_PAGE_SIZE = 40;
  const {
    trips,
    payments,
    materialRates,
    vendorCustomers,
    mineQuarries,
    transportOwnerProfiles,
    royaltyOwnerProfiles,
    loadTrips,
    loadPayments,
    loadMaterialRates,
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
    loadMaterialRates();
    loadVendorCustomers();
    loadMineQuarries();
    loadTransportOwnerProfiles();
    loadRoyaltyOwnerProfiles();
  }, [
    loadTrips,
    loadPayments,
    loadMaterialRates,
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
        const comboRates = materialRates.filter(rate =>
          rate.tripId === trip.id && String(rate.remarks || '').toLowerCase().includes('combo rate')
        );
        const comboRatePerTon = comboRates.length > 0 ? Number(comboRates[0].ratePerTon || 0) : 0;
        const comboRateParties = new Set(comboRates.map(rate => rate.ratePartyType));
        const comboMine = comboRateParties.has('mine-quarry');
        const comboTransport = comboRateParties.has('transport-owner');
        const comboRoyalty = comboRateParties.has('royalty-owner');
        const matchesCustomer = (trip.actualVendorCustomerName && normalizeName(trip.actualVendorCustomerName) === selectedPartyKey)
          || (trip.customer && normalizeName(trip.customer) === selectedPartyKey)
          || (trip.vendorName && normalizeName(trip.vendorName) === selectedPartyKey);
        const matchesQuarry = trip.quarryName && normalizeName(trip.quarryName) === selectedPartyKey;
        const matchesTransport = trip.transporterName && normalizeName(trip.transporterName) === selectedPartyKey;
        const matchesRoyalty = trip.royaltyOwnerName && normalizeName(trip.royaltyOwnerName) === selectedPartyKey;
        if (!matchesCustomer && !matchesQuarry && !matchesTransport && !matchesRoyalty) return null;

        const netWeight = Number(trip.netWeight || 0);
        const comboAmount = netWeight * comboRatePerTon;
        const comboAppliesToParty = (matchesQuarry && comboMine)
          || (matchesTransport && comboTransport)
          || (matchesRoyalty && comboRoyalty);

        const matchedRevenue = matchesCustomer ? revenue : 0;
        const matchedMaterial = matchesQuarry && !comboMine ? materialCost : 0;
        const matchedTransport = matchesTransport && !comboTransport ? transportCost : 0;
        const matchedRoyalty = matchesRoyalty && !comboRoyalty ? royaltyCost : 0;
        const matchedCombo = comboAppliesToParty ? comboAmount : 0;
        const matchedTotal = matchedRevenue + matchedMaterial + matchedTransport + matchedRoyalty + matchedCombo;
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
          comboRate: comboRatePerTon,
          comboAmount: matchedCombo,
          comboMine,
          comboTransport,
          comboRoyalty,
          hasCombo: comboRatePerTon > 0,
          hasCustomer: matchesCustomer,
          hasMine: Boolean(matchesQuarry),
          hasTransport: Boolean(matchesTransport),
          hasRoyalty: Boolean(matchesRoyalty),
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
        comboRate: number;
        comboAmount: number;
        comboMine: boolean;
        comboTransport: boolean;
        comboRoyalty: boolean;
        hasCombo: boolean;
        hasCustomer: boolean;
        hasMine: boolean;
        hasTransport: boolean;
        hasRoyalty: boolean;
        customerRate: number;
        mineRate: number;
        transportRate: number;
        royaltyRate: number;
        totalValue: number;
        amount: number;
      }>;
  }, [filteredTrips, materialRates, selectedPartyKey]);

  const partyTripRowsSorted = useMemo(() => {
    return [...partyTripRows].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return a.id - b.id;
    });
  }, [partyTripRows]);

  const showCustomerColumns = partyTripRowsSorted.some(row => row.hasCustomer);
  const showCombinedColumns = partyTripRowsSorted.some(row => row.hasCombo);
  const showMineColumns = partyTripRowsSorted.some(row => row.hasMine && !row.comboMine);
  const showTransportColumns = partyTripRowsSorted.some(row => row.hasTransport && !row.comboTransport);
  const showRoyaltyColumns = partyTripRowsSorted.some(row => row.hasRoyalty && !row.comboRoyalty);
  const tripColCount = 6
    + (showMineColumns ? 3 : 0)
    + (showTransportColumns ? 4 : 0)
    + (showCustomerColumns ? 2 : 0)
    + (showRoyaltyColumns ? 2 : 0)
    + (showCombinedColumns ? 2 : 0);

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

  const partyHasTrips = partyTripRows.length > 0;
  const partyHasVendor = selectedPartyTypes.has('vendor-customer');
  const partyHasSupplier = selectedPartyTypes.has('mine-quarry')
    || selectedPartyTypes.has('transport-owner')
    || selectedPartyTypes.has('royalty-owner');
  const isCustomerParty = partyHasTrips && partyHasVendor && !partyHasSupplier;
  const isSupplierParty = partyHasTrips && partyHasSupplier && !partyHasVendor;

  const partySummary: PartySummary = useMemo(() => {
    const tripTotal = partyTripRows.reduce((sum, row) => sum + row.amount, 0);
    const receivedTotal = partyPaymentRows.reduce((sum, row) => {
      const amount = Number(row.amount || 0);
      return row.type === 'RECEIPT' ? sum + amount : sum;
    }, 0);
    const paidTotal = partyPaymentRows.reduce((sum, row) => {
      const amount = Number(row.amount || 0);
      return row.type === 'PAYMENT' ? sum + amount : sum;
    }, 0);
    const netPayments = isSupplierParty ? paidTotal - receivedTotal : receivedTotal - paidTotal;
    const paymentTotal = isCustomerParty
      ? receivedTotal
      : isSupplierParty
        ? paidTotal
        : receivedTotal + paidTotal;
    return {
      tripTotal,
      paymentTotal,
      balance: tripTotal - netPayments,
    };
  }, [partyTripRows, partyPaymentRows, isCustomerParty, isSupplierParty]);

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
  const paymentTotalLabel = partyHasTrips
    ? (isCustomerParty ? 'Received Total' : isSupplierParty ? 'Paid Total' : 'Payments Total')
    : 'Total Out';
  const balanceLabel = partyHasTrips
    ? (partyPaymentBalance === 0
      ? 'Settled'
      : (partyPaymentBalance > 0
        ? (isCustomerParty ? 'Under Received' : isSupplierParty ? 'Under Paid' : 'Balance')
        : (isCustomerParty ? 'Over Received' : isSupplierParty ? 'Over Paid' : 'Balance')))
    : 'Balance';
  const balanceValue = partyHasTrips && balanceLabel !== 'Balance'
    ? formatCurrency(Math.abs(partyPaymentBalance))
    : formatCurrency(partyPaymentBalance);
  const balanceTone = partyHasTrips
    ? (partyPaymentBalance === 0
      ? 'text-green-600 dark:text-green-400'
      : (partyPaymentBalance > 0
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400'))
    : 'text-gray-900 dark:text-gray-100';

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

  const [paymentPage, setPaymentPage] = useState(1);
  const [tripPage, setTripPage] = useState(1);

  useEffect(() => {
    setPaymentPage(1);
    setTripPage(1);
  }, [selectedPartyKey, mode]);

  const paymentTotalPages = Math.max(1, Math.ceil(partyTransactionRows.length / PAYMENT_PAGE_SIZE));
  const tripTotalPages = Math.max(1, Math.ceil(partyTripRowsSorted.length / TRIP_PAGE_SIZE));
  const paymentSliceStart = (paymentPage - 1) * PAYMENT_PAGE_SIZE;
  const tripSliceStart = (tripPage - 1) * TRIP_PAGE_SIZE;
  const paymentSlice = partyTransactionRows.slice(paymentSliceStart, paymentSliceStart + PAYMENT_PAGE_SIZE);
  const tripSlice = partyTripRowsSorted.slice(tripSliceStart, tripSliceStart + TRIP_PAGE_SIZE);

  const getAccountDisplay = useCallback((payment: (typeof payments)[number]) => {
    const match = resolveAccountMatch(payment, selectedPartyKey);
    const counterparty = payment.ratePartyName || '-';
    const rawFrom = payment.fromAccount || '';
    const rawTo = payment.toAccount || '';
    const displayFrom = match?.viaCounterparty && match.fromMatch && !rawFrom
      ? selectedParty
      : (rawFrom || counterparty || '-');
    const displayTo = match?.viaCounterparty && match.toMatch && !rawTo
      ? selectedParty
      : (rawTo || counterparty || '-');
    return { match, displayFrom, displayTo };
  }, [resolveAccountMatch, selectedPartyKey, selectedParty]);

  const accountCreditRows = useMemo(() => {
    if (!isAccountSelection) return [];
    return accountStatementRows
      .filter(payment => resolveAccountMatch(payment, selectedPartyKey)?.toMatch)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [accountStatementRows, isAccountSelection, resolveAccountMatch, selectedPartyKey]);

  const accountDebitRows = useMemo(() => {
    if (!isAccountSelection) return [];
    return accountStatementRows
      .filter(payment => resolveAccountMatch(payment, selectedPartyKey)?.fromMatch)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [accountStatementRows, isAccountSelection, resolveAccountMatch, selectedPartyKey]);

  const accountCreditSummary = useMemo(() => {
    if (!isAccountSelection) return [];
    const map = new Map<string, { name: string; count: number; total: number }>();
    accountCreditRows.forEach(payment => {
      const { displayFrom } = getAccountDisplay(payment);
      const key = displayFrom || '-';
      const entry = map.get(key) || { name: key, count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(payment.amount || 0);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [accountCreditRows, isAccountSelection, getAccountDisplay]);

  const accountDebitSummary = useMemo(() => {
    if (!isAccountSelection) return [];
    const map = new Map<string, { name: string; count: number; total: number }>();
    accountDebitRows.forEach(payment => {
      const { displayTo } = getAccountDisplay(payment);
      const key = displayTo || '-';
      const entry = map.get(key) || { name: key, count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(payment.amount || 0);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [accountDebitRows, isAccountSelection, getAccountDisplay]);

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
      ...(showCombinedColumns ? ['Combined Rate/Ton', 'Combined Amount'] : []),
      ...(showMineColumns ? ['Mine Rate/Ton', 'Mine Amount'] : []),
      ...(showTransportColumns ? ['Transport Rate/Ton', 'Transport Amount'] : []),
      ...(showRoyaltyColumns ? ['Royalty Rate/Ton', 'Royalty Amount'] : []),
      'Total Value',
    ];
    const rows = partyTripRowsSorted.map(row => [
      `#${row.id}`,
      formatDateDisplay(row.date),
      row.invoice || '-',
      ...(showMineColumns ? [row.material || '-'] : []),
      ...(showTransportColumns ? [row.pickupPlace || '-', row.dropOffPlace || '-'] : []),
      row.netWeight.toFixed(2),
      ...(showCustomerColumns ? [row.customerRate.toFixed(2), row.revenue.toFixed(2)] : []),
      ...(showCombinedColumns ? [row.comboRate.toFixed(2), row.comboAmount.toFixed(2)] : []),
      ...(showMineColumns ? [row.mineRate.toFixed(2), row.materialCost.toFixed(2)] : []),
      ...(showTransportColumns ? [row.transportRate.toFixed(2), row.transportCost.toFixed(2)] : []),
      ...(showRoyaltyColumns ? [row.royaltyRate.toFixed(2), row.royaltyCost.toFixed(2)] : []),
      row.totalValue.toFixed(2),
    ]);
    exportCsv(`reconciliation_trips_${selectedPartyKey || 'party'}.csv`, [header, ...rows]);
  };

  const handleExportPayments = () => {
    const header = ['Date', 'Type', 'From', 'To', 'Amount'];
    const rows = partyTransactionRows.map(payment => [
      formatDateDisplay(payment.date),
      payment.type === 'PAYMENT' ? 'Payment' : 'Receipt',
      payment.fromAccount || '-',
      payment.toAccount || payment.ratePartyName || '-',
      Number(payment.amount || 0).toFixed(2),
    ]);
    exportCsv(`reconciliation_payments_${selectedPartyKey || 'party'}.csv`, [header, ...rows]);
  };

  const buildPrintHtml = useCallback(() => {
    if (mode === 'party' && !selectedParty) return null;
    if (mode === 'head' && !selectedHeadAccount) return null;
    const baseStyles = `
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; text-align: left; }
      th { background: #f3f4f6; text-transform: uppercase; letter-spacing: 0.02em; }
      h2 { margin: 0 0 12px; }
      h3 { margin: 18px 0 8px; }
    `;

    if (mode === 'party') {
      let runningBalance = 0;
      const paymentRowsHtml = partyTransactionRows.map(payment => {
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
        const balanceCells = !partyHasTrips
          ? `<td>${formatCurrency(openingBalance)}</td><td>${formatCurrency(closingBalance)}</td>`
          : '';
        return `
          <tr>
            <td>${formatDateDisplay(payment.date)}</td>
            <td>${payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
            <td>${displayFrom}</td>
            <td>${displayTo}</td>
            <td>${formatCurrency(amountValue)}</td>
            ${balanceCells}
          </tr>
        `;
      }).join('');

      const paymentHeader = `
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>From</th>
          <th>To</th>
          <th>Amount</th>
          ${!partyHasTrips ? '<th>Opening Balance</th><th>Closing Balance</th>' : ''}
        </tr>
      `;

      const tripsHeader = `
        <tr>
          <th>Trip #</th>
          <th>Date</th>
          <th>Invoice/DC</th>
          ${showMineColumns ? '<th>Material</th>' : ''}
          ${showTransportColumns ? '<th>Pickup</th><th>Drop-off</th>' : ''}
          <th>Net Qty</th>
          ${showCustomerColumns ? '<th>Customer Rate/Ton</th><th>Customer Amount</th>' : ''}
          ${showCombinedColumns ? '<th>Combined Rate/Ton</th><th>Combined Amount</th>' : ''}
          ${showMineColumns ? '<th>Mine Rate/Ton</th><th>Mine Amount</th>' : ''}
          ${showTransportColumns ? '<th>Transport Rate/Ton</th><th>Transport Amount</th>' : ''}
          ${showRoyaltyColumns ? '<th>Royalty Rate/Ton</th><th>Royalty Amount</th>' : ''}
          <th>Total Value</th>
        </tr>
      `;

      const tripsRowsHtml = partyTripRowsSorted.map(row => `
        <tr>
          <td>#${row.id}</td>
          <td>${formatDateDisplay(row.date)}</td>
          <td>${row.invoice || '-'}</td>
          ${showMineColumns ? `<td>${row.material || '-'}</td>` : ''}
          ${showTransportColumns ? `<td>${row.pickupPlace || '-'}</td><td>${row.dropOffPlace || '-'}</td>` : ''}
          <td>${row.netWeight.toFixed(2)}</td>
          ${showCustomerColumns ? `<td>${formatCurrency(row.customerRate)}</td><td>${formatCurrency(row.revenue)}</td>` : ''}
          ${showCombinedColumns ? `<td>${formatCurrency(row.comboRate)}</td><td>${formatCurrency(row.comboAmount)}</td>` : ''}
          ${showMineColumns ? `<td>${formatCurrency(row.mineRate)}</td><td>${formatCurrency(row.materialCost)}</td>` : ''}
          ${showTransportColumns ? `<td>${formatCurrency(row.transportRate)}</td><td>${formatCurrency(row.transportCost)}</td>` : ''}
          ${showRoyaltyColumns ? `<td>${formatCurrency(row.royaltyRate)}</td><td>${formatCurrency(row.royaltyCost)}</td>` : ''}
          <td>${formatCurrency(row.totalValue)}</td>
        </tr>
      `).join('');

      const tripsTable = partyHasTrips ? `
        <h3>Trips</h3>
        <table>
          <thead>${tripsHeader}</thead>
          <tbody>${tripsRowsHtml || `<tr><td colspan="${tripColCount}">No trips found for this rate party.</td></tr>`}</tbody>
        </table>
      ` : '';

      return `
        <html>
          <head>
            <title>Payment Reconciliation</title>
            <style>${baseStyles}</style>
          </head>
          <body>
            <h2>Payment Reconciliation</h2>
            <div><strong>Name/Account:</strong> ${selectedParty}</div>
            <h3>${partyHasTrips ? 'Payments' : 'Transactions'}</h3>
            <table>
              <thead>${paymentHeader}</thead>
              <tbody>${paymentRowsHtml || `<tr><td colspan="${partyHasTrips ? 5 : 7}">No transactions found for this selection.</td></tr>`}</tbody>
            </table>
            ${tripsTable}
          </body>
        </html>
      `;
    }

    const headRowsHtml = headPaymentRows.map(payment => `
      <tr>
        <td>${formatDateDisplay(payment.date)}</td>
        <td>${payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
        <td>${payment.fromAccount || '-'}</td>
        <td>${payment.toAccount || '-'}</td>
        <td>${formatCurrency(Number(payment.amount || 0))}</td>
        <td>${payment.ratePartyName || '-'}</td>
      </tr>
    `).join('');

    return `
      <html>
        <head>
          <title>Payment Reconciliation</title>
          <style>${baseStyles}</style>
        </head>
        <body>
          <h2>Payment Reconciliation</h2>
          <div><strong>Head Account:</strong> ${selectedHeadAccount}</div>
          <h3>Head Account Payments</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Amount</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>${headRowsHtml || '<tr><td colspan="6">No payments found for this head account.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `;
  }, [
    mode,
    selectedParty,
    selectedHeadAccount,
    selectedPartyKey,
    resolveAccountMatch,
    partyTransactionRows,
    partyHasTrips,
    isAccountSelection,
    headPaymentRows,
    partyTripRowsSorted,
    showMineColumns,
    showTransportColumns,
    showCustomerColumns,
    showRoyaltyColumns,
    showCombinedColumns,
    tripColCount,
    getCounterpartyDelta,
  ]);

  useImperativeHandle(ref, () => ({
    buildPrintHtml,
  }), [buildPrintHtml]);

  const handlePrint = () => {
    const html = buildPrintHtml();
    if (!html) return;
    const popup = window.open('', '_blank', 'width=1000,height=700');
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
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
                  list={selectedParty ? "recon-party-list" : undefined}
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
                    <p className="text-gray-500 dark:text-gray-400">{paymentTotalLabel}</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {partyHasTrips ? formatCurrency(partySummary.paymentTotal) : formatCurrency(partyPaymentTotals.outflow)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800">
                    <p className="text-gray-500 dark:text-gray-400">{balanceLabel}</p>
                    <p className={`text-lg font-semibold ${balanceTone}`}>{balanceValue}</p>
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
                  list={selectedHeadAccount ? "recon-head-list" : undefined}
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
          {isAccountSelection && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                  Credits Summary
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      <tr>
                        <th className="px-4 py-3 text-left">S. No.</th>
                        <th className="px-4 py-3 text-left">From</th>
                        <th className="px-4 py-3 text-left">Transactions</th>
                        <th className="px-4 py-3 text-left">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountCreditSummary.map((item, index) => (
                        <tr key={item.name} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-3">{index + 1}</td>
                          <td className="px-4 py-3">{item.name}</td>
                          <td className="px-4 py-3">{item.count}</td>
                          <td className="px-4 py-3">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                      {accountCreditSummary.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No credits found for this selection.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                  Debits Summary
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      <tr>
                        <th className="px-4 py-3 text-left">S. No.</th>
                        <th className="px-4 py-3 text-left">To</th>
                        <th className="px-4 py-3 text-left">Transactions</th>
                        <th className="px-4 py-3 text-left">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountDebitSummary.map((item, index) => (
                        <tr key={item.name} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-3">{index + 1}</td>
                          <td className="px-4 py-3">{item.name}</td>
                          <td className="px-4 py-3">{item.count}</td>
                          <td className="px-4 py-3">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                      {accountDebitSummary.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No debits found for this selection.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {!isAccountSelection && (
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
              <Pagination
                currentPage={paymentPage}
                totalPages={paymentTotalPages}
                onPageChange={setPaymentPage}
                totalItems={partyTransactionRows.length}
                pageSize={PAYMENT_PAGE_SIZE}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left">S. No.</th>
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
                    return paymentSlice.map((payment, index) => {
                    const { match, displayFrom, displayTo } = isAccountSelection
                      ? getAccountDisplay(payment)
                      : {
                        match: null,
                        displayFrom: payment.fromAccount || '-',
                        displayTo: payment.toAccount || payment.ratePartyName || '-',
                      };
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
                        <td className="px-4 py-3">{paymentSliceStart + index + 1}</td>
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
                      <td colSpan={partyHasTrips ? 6 : 8} className="px-4 py-6 text-center text-sm text-gray-500">
                        No transactions found for this selection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}
          {isAccountSelection && (
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                  Credits Statement
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      <tr>
                        <th className="px-4 py-3 text-left">S. No.</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">From</th>
                        <th className="px-4 py-3 text-left">To</th>
                        <th className="px-4 py-3 text-left">Amount</th>
                        <th className="px-4 py-3 text-left">Opening Balance</th>
                        <th className="px-4 py-3 text-left">Closing Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let runningBalance = 0;
                        return accountCreditRows.map((payment, index) => {
                          const { displayFrom, displayTo } = getAccountDisplay(payment);
                          const amountValue = Number(payment.amount || 0);
                          const openingBalance = runningBalance;
                          const closingBalance = openingBalance + amountValue;
                          runningBalance = closingBalance;
                          return (
                            <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="px-4 py-3">{index + 1}</td>
                              <td className="px-4 py-3">{formatDateDisplay(payment.date)}</td>
                              <td className="px-4 py-3">{payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
                              <td className="px-4 py-3">{displayFrom}</td>
                              <td className="px-4 py-3">{displayTo}</td>
                              <td className="px-4 py-3">{formatCurrency(amountValue)}</td>
                              <td className="px-4 py-3">{formatCurrency(openingBalance)}</td>
                              <td className="px-4 py-3">{formatCurrency(closingBalance)}</td>
                            </tr>
                          );
                        });
                      })()}
                      {accountCreditRows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                            No credits found for this selection.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                  Debits Statement
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      <tr>
                        <th className="px-4 py-3 text-left">S. No.</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">From</th>
                        <th className="px-4 py-3 text-left">To</th>
                        <th className="px-4 py-3 text-left">Amount</th>
                        <th className="px-4 py-3 text-left">Opening Balance</th>
                        <th className="px-4 py-3 text-left">Closing Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let runningBalance = 0;
                        return accountDebitRows.map((payment, index) => {
                          const { displayFrom, displayTo } = getAccountDisplay(payment);
                          const amountValue = Number(payment.amount || 0);
                          const openingBalance = runningBalance;
                          const closingBalance = openingBalance - amountValue;
                          runningBalance = closingBalance;
                          return (
                            <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="px-4 py-3">{index + 1}</td>
                              <td className="px-4 py-3">{formatDateDisplay(payment.date)}</td>
                              <td className="px-4 py-3">{payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
                              <td className="px-4 py-3">{displayFrom}</td>
                              <td className="px-4 py-3">{displayTo}</td>
                              <td className="px-4 py-3">{formatCurrency(amountValue)}</td>
                              <td className="px-4 py-3">{formatCurrency(openingBalance)}</td>
                              <td className="px-4 py-3">{formatCurrency(closingBalance)}</td>
                            </tr>
                          );
                        });
                      })()}
                      {accountDebitRows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                            No debits found for this selection.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
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
              <Pagination
                currentPage={tripPage}
                totalPages={tripTotalPages}
                onPageChange={setTripPage}
                totalItems={partyTripRowsSorted.length}
                pageSize={TRIP_PAGE_SIZE}
              />
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left">S. No.</th>
                    <th className="px-4 py-3 text-left">Trip #</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Invoice/DC</th>
                    {showMineColumns && <th className="px-4 py-3 text-left">Material</th>}
                    {showTransportColumns && <th className="px-4 py-3 text-left">Pickup</th>}
                    {showTransportColumns && <th className="px-4 py-3 text-left">Drop-off</th>}
                    <th className="px-4 py-3 text-left">Net Qty</th>
                    {showCustomerColumns && <th className="px-4 py-3 text-left">Customer Rate/Ton</th>}
                    {showCustomerColumns && <th className="px-4 py-3 text-left">Customer Amount</th>}
                    {showCombinedColumns && <th className="px-4 py-3 text-left">Combined Rate/Ton</th>}
                    {showCombinedColumns && <th className="px-4 py-3 text-left">Combined Amount</th>}
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
                  {tripSlice.map((row, index) => (
                    <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3">{tripSliceStart + index + 1}</td>
                      <td className="px-4 py-3">#{row.id}</td>
                      <td className="px-4 py-3">{formatDateDisplay(row.date)}</td>
                      <td className="px-4 py-3">{row.invoice || '-'}</td>
                      {showMineColumns && <td className="px-4 py-3">{row.material || '-'}</td>}
                      {showTransportColumns && <td className="px-4 py-3">{row.pickupPlace || '-'}</td>}
                      {showTransportColumns && <td className="px-4 py-3">{row.dropOffPlace || '-'}</td>}
                      <td className="px-4 py-3">{row.netWeight.toFixed(2)}</td>
                      {showCustomerColumns && <td className="px-4 py-3">{formatCurrency(row.customerRate)}</td>}
                      {showCustomerColumns && <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>}
                      {showCombinedColumns && <td className="px-4 py-3">{formatCurrency(row.comboRate)}</td>}
                      {showCombinedColumns && <td className="px-4 py-3">{formatCurrency(row.comboAmount)}</td>}
                      {showMineColumns && <td className="px-4 py-3">{formatCurrency(row.mineRate)}</td>}
                      {showMineColumns && <td className="px-4 py-3">{formatCurrency(row.materialCost)}</td>}
                      {showTransportColumns && <td className="px-4 py-3">{formatCurrency(row.transportRate)}</td>}
                      {showTransportColumns && <td className="px-4 py-3">{formatCurrency(row.transportCost)}</td>}
                      {showRoyaltyColumns && <td className="px-4 py-3">{formatCurrency(row.royaltyRate)}</td>}
                      {showRoyaltyColumns && <td className="px-4 py-3">{formatCurrency(row.royaltyCost)}</td>}
                    <td className="px-4 py-3">{formatCurrency(row.totalValue)}</td>
                    </tr>
                  ))}
                  {partyTripRowsSorted.length === 0 && (
                    <tr>
                      <td colSpan={tripColCount + 1} className="px-4 py-6 text-center text-sm text-gray-500">No trips found for this rate party.</td>
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
                  <th className="px-4 py-3 text-left">S. No.</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">From</th>
                  <th className="px-4 py-3 text-left">To</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Name</th>
                </tr>
              </thead>
              <tbody>
                {headPaymentRows.map((payment, index) => (
                  <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{index + 1}</td>
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
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">No payments found for this head account.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

PaymentReconciliation.displayName = 'PaymentReconciliation';

export default PaymentReconciliation;
