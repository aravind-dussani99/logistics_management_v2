import React, { useCallback, useEffect, useMemo, useState, useImperativeHandle } from 'react';
import Pagination from '../components/Pagination';
import { useData } from '../contexts/DataContext';
import { computeTripGstAmount, formatCurrency, formatDateDisplay, getCombinedRatePerTon, resolveTripRate } from '../utils';
import { RatePartyType, Trip } from '../types';

type PartySummary = {
  tripTotal: number;
  paymentTotal: number;
  balance: number;
};

type AccountReconciliationProps = {
  initialMode?: 'party' | 'head';
  hideModeToggle?: boolean;
  hideDownload?: boolean;
  hidePrint?: boolean;
  dateFrom?: string;
  dateTo?: string;
};

const getComboLabel = (comboTypes: RatePartyType[]): string => {
  const hasMine = comboTypes.includes('mine-quarry');
  const hasTransport = comboTypes.includes('transport-owner');
  const hasRoyalty = comboTypes.includes('royalty-owner');
  if (hasMine && hasTransport && hasRoyalty) return 'Mine_Royalty_Transport';
  if (hasMine && hasTransport) return 'Mine_Transport';
  if (hasMine && hasRoyalty) return 'Mine_Royalty';
  if (hasTransport && hasRoyalty) return 'Royalty_Transport';
  return 'Individual';
};

const getRateModeLabel = (trip: Trip, comboTypes: RatePartyType[]): string => {
  const uniqueComboTypes = Array.from(new Set(comboTypes));
  if (uniqueComboTypes.length === 3) return 'Mine_Royalty_Transport';
  if (uniqueComboTypes.length === 2) {
    const comboLabel = getComboLabel(uniqueComboTypes);
    const presentTypes: RatePartyType[] = [];
    if (trip.quarryName) presentTypes.push('mine-quarry');
    if (trip.transporterName) presentTypes.push('transport-owner');
    if (trip.royaltyOwnerName) presentTypes.push('royalty-owner');
    const missingType = presentTypes.find(type => !uniqueComboTypes.includes(type));
    if (!missingType) return comboLabel;
    const missingLabel = missingType === 'mine-quarry'
      ? 'Mine'
      : (missingType === 'transport-owner' ? 'Transport' : 'Royalty');
    return `${comboLabel} + ${missingLabel}`;
  }
  return 'Individual';
};

export type AccountReconciliationHandle = {
  buildPrintHtml: () => string | null;
};

const AccountReconciliation = React.forwardRef(function AccountReconciliation({
  initialMode = 'party',
  hideModeToggle = false,
  hideDownload = false,
  hidePrint = false,
  dateFrom,
  dateTo,
}: AccountReconciliationProps, ref: React.Ref<AccountReconciliationHandle>) {
  const PAYMENT_PAGE_SIZE = 40;
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
    const getExplicitComboTypes = (tripId: number): RatePartyType[] => {
      const types: RatePartyType[] = [];
      if (resolveTripRate(materialRates, tripId, 'mine-quarry', { comboOnly: true })) types.push('mine-quarry');
      if (resolveTripRate(materialRates, tripId, 'transport-owner', { comboOnly: true })) types.push('transport-owner');
      if (resolveTripRate(materialRates, tripId, 'royalty-owner', { comboOnly: true })) types.push('royalty-owner');
      return types;
    };
    return filteredTrips
      .map(trip => {
        const revenue = Number(trip.revenue || 0);
        const comboRatePerTon = getCombinedRatePerTon(materialRates, trip.id);
        const comboRateParties = new Set<RatePartyType>(getExplicitComboTypes(trip.id));
        const comboMine = comboRateParties.has('mine-quarry');
        const comboTransport = comboRateParties.has('transport-owner');
        const comboRoyalty = comboRateParties.has('royalty-owner');
        const latestMineRate = resolveTripRate(materialRates, trip.id, 'mine-quarry');
        const latestTransportRate = resolveTripRate(materialRates, trip.id, 'transport-owner');
        const latestRoyaltyRate = resolveTripRate(materialRates, trip.id, 'royalty-owner');
        const matchesCustomer = (trip.actualVendorCustomerName && normalizeName(trip.actualVendorCustomerName) === selectedPartyKey)
          || (trip.customer && normalizeName(trip.customer) === selectedPartyKey)
          || (trip.vendorName && normalizeName(trip.vendorName) === selectedPartyKey);
        const matchesQuarry = (trip.quarryName && normalizeName(trip.quarryName) === selectedPartyKey)
          || (latestMineRate?.ratePartyName && normalizeName(latestMineRate.ratePartyName) === selectedPartyKey);
        const matchesTransport = (trip.transporterName && normalizeName(trip.transporterName) === selectedPartyKey)
          || (latestTransportRate?.ratePartyName && normalizeName(latestTransportRate.ratePartyName) === selectedPartyKey);
        const matchesRoyalty = (trip.royaltyOwnerName && normalizeName(trip.royaltyOwnerName) === selectedPartyKey)
          || (latestRoyaltyRate?.ratePartyName && normalizeName(latestRoyaltyRate.ratePartyName) === selectedPartyKey);
        if (!matchesCustomer && !matchesQuarry && !matchesTransport && !matchesRoyalty) return null;

        const netWeight = Number(trip.netWeight || 0);
        const comboAmount = netWeight * comboRatePerTon;
        const comboAppliesToParty = (matchesQuarry && comboMine)
          || (matchesTransport && comboTransport)
          || (matchesRoyalty && comboRoyalty);

        const matchedRevenue = matchesCustomer ? revenue : 0;
        const mineRate = resolveTripRate(materialRates, trip.id, 'mine-quarry', { comboOnly: false });
        const transportRate = resolveTripRate(materialRates, trip.id, 'transport-owner', { comboOnly: false });
        const royaltyRate = resolveTripRate(materialRates, trip.id, 'royalty-owner', { comboOnly: false });
        const mineRatePerTon = Number(mineRate?.ratePerTon || 0);
        const transportRatePerTon = Number(transportRate?.ratePerTon || 0);
        const royaltyRatePerTon = Number(royaltyRate?.ratePerTon || 0);
        const materialFallback = Number(trip.materialCost || 0);
        const transportFallback = Number(trip.transportCost || 0);
        const royaltyFallback = Number(trip.royaltyCost || 0);
        const matchedMaterial = matchesQuarry && !comboMine
          ? (mineRate ? (mineRatePerTon * netWeight) : materialFallback)
          : 0;
        const matchedTransport = matchesTransport && !comboTransport
          ? (transportRate ? (transportRatePerTon * netWeight) : transportFallback)
          : 0;
        const matchedRoyalty = matchesRoyalty && !comboRoyalty
          ? (royaltyRate ? (royaltyRatePerTon * netWeight) : royaltyFallback)
          : 0;
        const matchedCombo = comboAppliesToParty ? comboAmount : 0;
        const gstRate = Number(trip.gstRatePerTon || 0);
        const gstPercent = Number(trip.gstPercentage || 0);
        const gstAmount = computeTripGstAmount(trip);
        const matchedTotal = matchedRevenue + matchedMaterial + matchedTransport + matchedRoyalty + matchedCombo;
        const mineDisplayRate = matchesQuarry && !comboMine
          ? (mineRate ? mineRatePerTon : (netWeight > 0 ? materialFallback / netWeight : 0))
          : 0;
        const transportDisplayRate = matchesTransport && !comboTransport
          ? (transportRate ? transportRatePerTon : (netWeight > 0 ? transportFallback / netWeight : 0))
          : 0;
        const royaltyDisplayRate = matchesRoyalty && !comboRoyalty
          ? (royaltyRate ? royaltyRatePerTon : (netWeight > 0 ? royaltyFallback / netWeight : 0))
          : 0;
        return {
          id: trip.id,
          date: trip.date,
          invoice: trip.invoiceDCNumber,
          material: trip.material,
          mineQuarryName: trip.quarryName,
          royaltyOwnerName: trip.royaltyOwnerName,
          vehicleNumber: trip.vehicleNumber,
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
          mineRate: mineDisplayRate,
          transportRate: transportDisplayRate,
          royaltyRate: royaltyDisplayRate,
          totalValue: matchedTotal,
          gstRatePerTon: gstRate,
          gstPercentage: gstPercent,
          gstAmount,
          rateMode: getRateModeLabel(trip, Array.from(comboRateParties)),
          amount: matchedTotal + gstAmount,
        };
      })
      .filter(Boolean) as Array<{
        id: number;
        date: string;
        invoice?: string;
        material?: string;
        mineQuarryName?: string;
        royaltyOwnerName?: string;
        vehicleNumber?: string;
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
        gstRatePerTon: number;
        gstPercentage: number;
        gstAmount: number;
        rateMode: string;
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

  const mineIndividualRows = useMemo(
    () => partyTripRowsSorted.filter(row => row.hasMine && !row.comboMine && row.materialCost > 0),
    [partyTripRowsSorted],
  );
  const royaltyIndividualRows = useMemo(
    () => partyTripRowsSorted.filter(row => row.hasRoyalty && !row.comboRoyalty && row.royaltyCost > 0),
    [partyTripRowsSorted],
  );
  const transportIndividualRows = useMemo(
    () => partyTripRowsSorted.filter(row => row.hasTransport && !row.comboTransport && row.transportCost > 0),
    [partyTripRowsSorted],
  );

  const comboActivitySections = useMemo(() => {
    const getSectionLabel = (rateMode: string) => rateMode.split(' + ')[0];
    const map = new Map<string, {
      key: string;
      title: string;
      includesTransport: boolean;
      rows: Array<(typeof partyTripRowsSorted)[number]>;
    }>();
    const sectionOrder = [
      'Mine_Royalty_Transport',
      'Mine_Royalty + Transport',
      'Mine_Transport + Royalty',
      'Royalty_Transport + Mine',
      'Mine_Royalty',
      'Mine_Transport',
      'Royalty_Transport',
    ];
    partyTripRowsSorted.forEach(row => {
      if (!row.comboAmount || row.comboAmount <= 0) return;
      if (row.rateMode === 'Individual') return;
      const title = getSectionLabel(row.rateMode);
      const key = title;
      if (!map.has(key)) {
        map.set(key, { key, title, includesTransport: title.includes('Transport'), rows: [] });
      }
      map.get(key)!.rows.push(row);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aOrder = sectionOrder.indexOf(a.title);
      const bOrder = sectionOrder.indexOf(b.title);
      if (aOrder !== -1 && bOrder !== -1) return aOrder - bOrder;
      if (aOrder !== -1) return -1;
      if (bOrder !== -1) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [partyTripRowsSorted]);

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

  const partySummary: PartySummary & { tripBaseTotal: number; gstTotal: number } = useMemo(() => {
    const tripBaseTotal = partyTripRows.reduce((sum, row) => sum + row.totalValue, 0);
    const gstTotal = partyTripRows.reduce((sum, row) => sum + row.gstAmount, 0);
    const tripTotal = tripBaseTotal + gstTotal;
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
      tripBaseTotal,
      gstTotal,
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

  useEffect(() => {
    setPaymentPage(1);
  }, [selectedPartyKey, mode]);

  const paymentTotalPages = Math.max(1, Math.ceil(partyTransactionRows.length / PAYMENT_PAGE_SIZE));
  const paymentSliceStart = (paymentPage - 1) * PAYMENT_PAGE_SIZE;
  const paymentSlice = partyTransactionRows.slice(paymentSliceStart, paymentSliceStart + PAYMENT_PAGE_SIZE);

  const paymentTableTotals = useMemo(() => ({
    count: partyTransactionRows.length,
    amount: partyTransactionRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
  }), [partyTransactionRows]);

  const gstTableTotals = useMemo(() => ({
    count: partyTripRowsSorted.length,
    qty: partyTripRowsSorted.reduce((sum, row) => sum + Number(row.netWeight || 0), 0),
    amount: partyTripRowsSorted.reduce((sum, row) => sum + Number(row.gstAmount || 0), 0),
  }), [partyTripRowsSorted]);

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

  const accountCreditTotals = useMemo(() => ({
    count: accountCreditSummary.reduce((sum, item) => sum + item.count, 0),
    amount: accountCreditSummary.reduce((sum, item) => sum + item.total, 0),
  }), [accountCreditSummary]);

  const accountDebitTotals = useMemo(() => ({
    count: accountDebitSummary.reduce((sum, item) => sum + item.count, 0),
    amount: accountDebitSummary.reduce((sum, item) => sum + item.total, 0),
  }), [accountDebitSummary]);

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
      const kpiHtml = `
        <table style="margin-top:12px;">
          <thead>
            <tr>
              <th>${partyHasTrips ? 'Trips Total' : 'Total In'}</th>
              <th>${paymentTotalLabel}</th>
              <th>${balanceLabel}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div>${partyHasTrips ? formatCurrency(partySummary.tripTotal) : formatCurrency(partyPaymentTotals.inflow)}</div>
                ${partyHasTrips ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;">Trip: ${formatCurrency(partySummary.tripBaseTotal)} · GST: ${formatCurrency(partySummary.gstTotal)}</div>` : ''}
              </td>
              <td>${partyHasTrips ? formatCurrency(partySummary.paymentTotal) : formatCurrency(partyPaymentTotals.outflow)}</td>
              <td>${balanceValue}</td>
            </tr>
          </tbody>
        </table>
      `;

      const paymentHeader = `
        <tr>
          <th>S. No.</th>
          <th>Date</th>
          <th>Type</th>
          <th>From</th>
          <th>To</th>
          <th>Amount</th>
          ${!partyHasTrips ? '<th>Opening Balance</th><th>Closing Balance</th>' : ''}
        </tr>
      `;

      let runningBalance = 0;
      const paymentRowsHtml = partyTransactionRows.map((payment, index) => {
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
        const balanceCells = !partyHasTrips
          ? `<td>${formatCurrency(openingBalance)}</td><td>${formatCurrency(closingBalance)}</td>`
          : '';
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${formatDateDisplay(payment.date)}</td>
            <td>${payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
            <td>${displayFrom}</td>
            <td>${displayTo}</td>
            <td>${formatCurrency(amountValue)}</td>
            ${balanceCells}
          </tr>
        `;
      }).join('');

      const buildSimpleTripTable = (
        title: string,
        rows: typeof partyTripRowsSorted,
        rateHeader: string,
        amountAccessor: (row: typeof partyTripRowsSorted[number]) => number,
        rateAccessor: (row: typeof partyTripRowsSorted[number]) => number,
        includeTransportCols = false,
      ) => `
        ${rows.length > 0 ? `
          <h3>${title}</h3>
          <div style="font-size:12px;color:#6b7280;margin:4px 0 8px;">
            Total Count: ${rows.length} · Total Qty: ${rows.reduce((sum, row) => sum + row.netWeight, 0).toFixed(2)} · Total Amount: ${formatCurrency(rows.reduce((sum, row) => sum + amountAccessor(row), 0))}
          </div>
          <table>
            <thead>
              <tr>
                <th>S. No.</th>
                <th>Date</th>
                <th>Trip #</th>
                <th>Invoice/DC</th>
                <th>Vehicle Number</th>
                <th>Material Type</th>
                ${includeTransportCols ? '<th>Pickup</th><th>Drop-off</th>' : ''}
                <th>Qty</th>
                <th>${rateHeader}</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${formatDateDisplay(row.date)}</td>
                  <td>#${row.id}</td>
                  <td>${row.invoice || '-'}</td>
                  <td>${row.vehicleNumber || '-'}</td>
                  <td>${row.material || '-'}</td>
                  ${includeTransportCols ? `<td>${row.pickupPlace || '-'}</td><td>${row.dropOffPlace || '-'}</td>` : ''}
                  <td>${row.netWeight.toFixed(2)}</td>
                  <td>${formatCurrency(rateAccessor(row))}</td>
                  <td>${formatCurrency(amountAccessor(row))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      `;

      const comboTablesHtml = comboActivitySections.map(section => `
        <h3>${section.title}</h3>
        <div style="font-size:12px;color:#6b7280;margin:4px 0 8px;">
          Total Count: ${section.rows.length} · Total Qty: ${section.rows.reduce((sum, row) => sum + row.netWeight, 0).toFixed(2)} · Total Amount: ${formatCurrency(section.rows.reduce((sum, row) => sum + row.comboAmount, 0))}
        </div>
        <table>
          <thead>
            <tr>
              <th>S. No.</th>
              <th>Date</th>
              <th>Trip #</th>
              <th>Invoice/DC</th>
              <th>Vehicle Number</th>
              <th>Material Type</th>
              ${section.includesTransport ? '<th>Pickup</th><th>Drop-off</th>' : ''}
              <th>Qty</th>
              <th>Rate/Ton</th>
              <th>Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${section.rows.map((row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${formatDateDisplay(row.date)}</td>
                <td>#${row.id}</td>
                <td>${row.invoice || '-'}</td>
                <td>${row.vehicleNumber || '-'}</td>
                <td>${row.material || '-'}</td>
                ${section.includesTransport ? `<td>${row.pickupPlace || '-'}</td><td>${row.dropOffPlace || '-'}</td>` : ''}
                <td>${row.netWeight.toFixed(2)}</td>
                <td>${formatCurrency(row.comboRate)}</td>
                <td>${formatCurrency(row.comboAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `).join('');

      const tripsTable = partyHasTrips ? `
        ${buildSimpleTripTable('Mine & Quarry', mineIndividualRows, 'Mine Rate/Ton', row => row.materialCost, row => row.mineRate)}
        ${buildSimpleTripTable('Royalty', royaltyIndividualRows, 'Royalty Rate/Ton', row => row.royaltyCost, row => row.royaltyRate)}
        ${buildSimpleTripTable('Transport', transportIndividualRows, 'Transport Rate/Ton', row => row.transportCost, row => row.transportRate, true)}
        ${comboTablesHtml}
      ` : '';

      const gstTable = partyHasTrips ? `
        <h3>Trip GST Details</h3>
        <div style="font-size:12px;color:#6b7280;margin:4px 0 8px;">
          Total Count: ${gstTableTotals.count} · Total Qty: ${gstTableTotals.qty.toFixed(2)} · Total GST Amount: ${formatCurrency(gstTableTotals.amount)}
        </div>
        <table>
          <thead>
            <tr>
              <th>S. No.</th>
              <th>Date</th>
              <th>Trip #</th>
              <th>Invoice/DC</th>
              <th>Material Owner</th>
              <th>Vehicle Number</th>
              <th>Material Type</th>
              <th>Net Tons</th>
              <th>Trip Rate for GST</th>
              <th>GST %</th>
              <th>GST Amount</th>
            </tr>
          </thead>
          <tbody>
            ${partyTripRowsSorted.map((row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${formatDateDisplay(row.date)}</td>
                <td>#${row.id}</td>
                <td>${row.invoice || '-'}</td>
                <td>${row.mineQuarryName || '-'}</td>
                <td>${row.vehicleNumber || '-'}</td>
                <td>${row.material || '-'}</td>
                <td>${row.netWeight.toFixed(2)}</td>
                <td>${formatCurrency(row.gstRatePerTon)}</td>
                <td>${row.gstPercentage.toFixed(2)}</td>
                <td>${formatCurrency(row.gstAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '';

      const summaryTables = isAccountSelection ? `
        <h3>Credits Summary · ${formatCurrency(accountCreditTotals.amount)}</h3>
        <table>
          <thead>
            <tr>
              <th>S. No.</th>
              <th>From</th>
              <th>Transactions</th>
              <th>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${accountCreditSummary.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.name}</td>
                <td>${item.count}</td>
                <td>${formatCurrency(item.total)}</td>
              </tr>
            `).join('')}
            ${accountCreditSummary.length > 0 ? `
              <tr>
                <td colspan="2"><strong>Total</strong></td>
                <td><strong>${accountCreditTotals.count}</strong></td>
                <td><strong>${formatCurrency(accountCreditTotals.amount)}</strong></td>
              </tr>
            ` : '<tr><td colspan="4">No credits found for this selection.</td></tr>'}
          </tbody>
        </table>

        <h3>Debits Summary · ${formatCurrency(accountDebitTotals.amount)}</h3>
        <table>
          <thead>
            <tr>
              <th>S. No.</th>
              <th>To</th>
              <th>Transactions</th>
              <th>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${accountDebitSummary.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.name}</td>
                <td>${item.count}</td>
                <td>${formatCurrency(item.total)}</td>
              </tr>
            `).join('')}
            ${accountDebitSummary.length > 0 ? `
              <tr>
                <td colspan="2"><strong>Total</strong></td>
                <td><strong>${accountDebitTotals.count}</strong></td>
                <td><strong>${formatCurrency(accountDebitTotals.amount)}</strong></td>
              </tr>
            ` : '<tr><td colspan="4">No debits found for this selection.</td></tr>'}
          </tbody>
        </table>
      ` : '';

      const statementHeader = `
        <tr>
          <th>S. No.</th>
          <th>Date</th>
          <th>Type</th>
          <th>From</th>
          <th>To</th>
          <th>Amount</th>
          <th>Opening Balance</th>
          <th>Closing Balance</th>
        </tr>
      `;

      let creditRunningBalance = 0;
      const creditStatementRows = accountCreditRows.map((payment, index) => {
        const { displayFrom, displayTo } = getAccountDisplay(payment);
        const amountValue = Number(payment.amount || 0);
        const openingBalance = creditRunningBalance;
        const closingBalance = openingBalance + amountValue;
        creditRunningBalance = closingBalance;
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${formatDateDisplay(payment.date)}</td>
            <td>${payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
            <td>${displayFrom}</td>
            <td>${displayTo}</td>
            <td>${formatCurrency(amountValue)}</td>
            <td>${formatCurrency(openingBalance)}</td>
            <td>${formatCurrency(closingBalance)}</td>
          </tr>
        `;
      }).join('');

      let debitRunningBalance = 0;
      const debitStatementRows = accountDebitRows.map((payment, index) => {
        const { displayFrom, displayTo } = getAccountDisplay(payment);
        const amountValue = Number(payment.amount || 0);
        const openingBalance = debitRunningBalance;
        const closingBalance = openingBalance - amountValue;
        debitRunningBalance = closingBalance;
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${formatDateDisplay(payment.date)}</td>
            <td>${payment.type === 'PAYMENT' ? 'Payment' : 'Receipt'}</td>
            <td>${displayFrom}</td>
            <td>${displayTo}</td>
            <td>${formatCurrency(amountValue)}</td>
            <td>${formatCurrency(openingBalance)}</td>
            <td>${formatCurrency(closingBalance)}</td>
          </tr>
        `;
      }).join('');

      const statementTables = isAccountSelection ? `
        <h3>Credits Statement</h3>
        <table>
          <thead>${statementHeader}</thead>
          <tbody>${creditStatementRows || '<tr><td colspan="8">No credits found for this selection.</td></tr>'}</tbody>
        </table>
        <h3>Debits Statement</h3>
        <table>
          <thead>${statementHeader}</thead>
          <tbody>${debitStatementRows || '<tr><td colspan="8">No debits found for this selection.</td></tr>'}</tbody>
        </table>
      ` : '';

      return `
        <html>
          <head>
            <title>Logistics Accounts Reports</title>
            <style>${baseStyles}</style>
          </head>
          <body>
            <h2>Logistics Accounts Reports</h2>
            <div><strong>Name / Account:</strong> ${selectedParty}</div>
            ${kpiHtml}
            ${isAccountSelection ? summaryTables : ''}
            <h3>${partyHasTrips ? 'Payments' : 'Transactions'}</h3>
            <div style="font-size:12px;color:#6b7280;margin:4px 0 8px;">
              Total Count: ${paymentTableTotals.count} · Total Amount: ${formatCurrency(paymentTableTotals.amount)}
            </div>
            <table>
              <thead>${paymentHeader}</thead>
              <tbody>${paymentRowsHtml || `<tr><td colspan="${partyHasTrips ? 6 : 8}">No transactions found for this selection.</td></tr>`}</tbody>
            </table>
            ${statementTables}
            ${tripsTable}
            ${gstTable}
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
          <title>Logistics Accounts Reports</title>
          <style>${baseStyles}</style>
        </head>
        <body>
          <h2>Logistics Accounts Reports</h2>
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
    getAccountDisplay,
    accountCreditSummary,
    accountDebitSummary,
    accountCreditTotals,
    accountDebitTotals,
    accountCreditRows,
    accountDebitRows,
    partySummary,
    partyPaymentTotals,
    paymentTotalLabel,
    balanceLabel,
    balanceValue,
    paymentTableTotals,
    gstTableTotals,
    headPaymentRows,
    partyTripRowsSorted,
    mineIndividualRows,
    royaltyIndividualRows,
    transportIndividualRows,
    comboActivitySections,
    showMineColumns,
    showTransportColumns,
    showCustomerColumns,
    showRoyaltyColumns,
    showCombinedColumns,
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
                    {partyHasTrips && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Trip: {formatCurrency(partySummary.tripBaseTotal)} · GST: {formatCurrency(partySummary.gstTotal)}
                      </p>
                    )}
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
                  Credits Summary · {formatCurrency(accountCreditTotals.amount)}
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
                      {accountCreditSummary.length > 0 && (
                        <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                          <td className="px-4 py-3" colSpan={2}>Total</td>
                          <td className="px-4 py-3">{accountCreditTotals.count}</td>
                          <td className="px-4 py-3">{formatCurrency(accountCreditTotals.amount)}</td>
                        </tr>
                      )}
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
                  Debits Summary · {formatCurrency(accountDebitTotals.amount)}
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
                      {accountDebitSummary.length > 0 && (
                        <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                          <td className="px-4 py-3" colSpan={2}>Total</td>
                          <td className="px-4 py-3">{accountDebitTotals.count}</td>
                          <td className="px-4 py-3">{formatCurrency(accountDebitTotals.amount)}</td>
                        </tr>
                      )}
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
              <span>
                {partyHasTrips ? 'Payments' : 'Transactions'}
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  Total Count: {paymentTableTotals.count} · Total Amount: {formatCurrency(paymentTableTotals.amount)}
                </span>
              </span>
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
            <>
              {mineIndividualRows.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                    Mine & Quarry
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      Total Count: {mineIndividualRows.length} · Total Qty: {mineIndividualRows.reduce((sum, row) => sum + row.netWeight, 0).toFixed(2)} · Total Amount: {formatCurrency(mineIndividualRows.reduce((sum, row) => sum + row.materialCost, 0))}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                        <tr>
                          <th className="px-4 py-3 text-left">S. No.</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Trip #</th>
                          <th className="px-4 py-3 text-left">Invoice/DC</th>
                          <th className="px-4 py-3 text-left">Vehicle Number</th>
                          <th className="px-4 py-3 text-left">Material Type</th>
                          <th className="px-4 py-3 text-left">Qty</th>
                          <th className="px-4 py-3 text-left">Mine Rate/Ton</th>
                          <th className="px-4 py-3 text-left">Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mineIndividualRows.map((row, index) => (
                          <tr key={`mine-${row.id}`} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="px-4 py-3">{index + 1}</td>
                            <td className="px-4 py-3">{formatDateDisplay(row.date)}</td>
                            <td className="px-4 py-3">#{row.id}</td>
                            <td className="px-4 py-3">{row.invoice || '-'}</td>
                            <td className="px-4 py-3">{row.vehicleNumber || '-'}</td>
                            <td className="px-4 py-3">{row.material || '-'}</td>
                            <td className="px-4 py-3">{row.netWeight.toFixed(2)}</td>
                            <td className="px-4 py-3">{formatCurrency(row.mineRate)}</td>
                            <td className="px-4 py-3">{formatCurrency(row.materialCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {royaltyIndividualRows.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                    Royalty
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      Total Count: {royaltyIndividualRows.length} · Total Qty: {royaltyIndividualRows.reduce((sum, row) => sum + row.netWeight, 0).toFixed(2)} · Total Amount: {formatCurrency(royaltyIndividualRows.reduce((sum, row) => sum + row.royaltyCost, 0))}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                        <tr>
                          <th className="px-4 py-3 text-left">S. No.</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Trip #</th>
                          <th className="px-4 py-3 text-left">Invoice/DC</th>
                          <th className="px-4 py-3 text-left">Vehicle Number</th>
                          <th className="px-4 py-3 text-left">Qty</th>
                          <th className="px-4 py-3 text-left">Royalty Rate/Ton</th>
                          <th className="px-4 py-3 text-left">Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {royaltyIndividualRows.map((row, index) => (
                          <tr key={`royalty-${row.id}`} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="px-4 py-3">{index + 1}</td>
                            <td className="px-4 py-3">{formatDateDisplay(row.date)}</td>
                            <td className="px-4 py-3">#{row.id}</td>
                            <td className="px-4 py-3">{row.invoice || '-'}</td>
                            <td className="px-4 py-3">{row.vehicleNumber || '-'}</td>
                            <td className="px-4 py-3">{row.netWeight.toFixed(2)}</td>
                            <td className="px-4 py-3">{formatCurrency(row.royaltyRate)}</td>
                            <td className="px-4 py-3">{formatCurrency(row.royaltyCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {transportIndividualRows.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                    Transport
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      Total Count: {transportIndividualRows.length} · Total Qty: {transportIndividualRows.reduce((sum, row) => sum + row.netWeight, 0).toFixed(2)} · Total Amount: {formatCurrency(transportIndividualRows.reduce((sum, row) => sum + row.transportCost, 0))}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                        <tr>
                          <th className="px-4 py-3 text-left">S. No.</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Trip #</th>
                          <th className="px-4 py-3 text-left">Invoice/DC</th>
                          <th className="px-4 py-3 text-left">Vehicle Number</th>
                          <th className="px-4 py-3 text-left">Pickup</th>
                          <th className="px-4 py-3 text-left">Drop-off</th>
                          <th className="px-4 py-3 text-left">Qty</th>
                          <th className="px-4 py-3 text-left">Transport Rate/Ton</th>
                          <th className="px-4 py-3 text-left">Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transportIndividualRows.map((row, index) => (
                          <tr key={`transport-${row.id}`} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="px-4 py-3">{index + 1}</td>
                            <td className="px-4 py-3">{formatDateDisplay(row.date)}</td>
                            <td className="px-4 py-3">#{row.id}</td>
                            <td className="px-4 py-3">{row.invoice || '-'}</td>
                            <td className="px-4 py-3">{row.vehicleNumber || '-'}</td>
                            <td className="px-4 py-3">{row.pickupPlace || '-'}</td>
                            <td className="px-4 py-3">{row.dropOffPlace || '-'}</td>
                            <td className="px-4 py-3">{row.netWeight.toFixed(2)}</td>
                            <td className="px-4 py-3">{formatCurrency(row.transportRate)}</td>
                            <td className="px-4 py-3">{formatCurrency(row.transportCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {comboActivitySections.map(section => (
                <div key={section.key} className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                    {section.title}
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      Total Count: {section.rows.length} · Total Qty: {section.rows.reduce((sum, row) => sum + row.netWeight, 0).toFixed(2)} · Total Amount: {formatCurrency(section.rows.reduce((sum, row) => sum + row.comboAmount, 0))}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                        <tr>
                          <th className="px-4 py-3 text-left">S. No.</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Trip #</th>
                          <th className="px-4 py-3 text-left">Invoice/DC</th>
                          <th className="px-4 py-3 text-left">Vehicle Number</th>
                          <th className="px-4 py-3 text-left">Material Type</th>
                          {section.includesTransport && <th className="px-4 py-3 text-left">Pickup</th>}
                          {section.includesTransport && <th className="px-4 py-3 text-left">Drop-off</th>}
                          <th className="px-4 py-3 text-left">Qty</th>
                          <th className="px-4 py-3 text-left">Rate/Ton</th>
                          <th className="px-4 py-3 text-left">Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, index) => (
                          <tr key={`${section.key}-${row.id}`} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="px-4 py-3">{index + 1}</td>
                            <td className="px-4 py-3">{formatDateDisplay(row.date)}</td>
                            <td className="px-4 py-3">#{row.id}</td>
                            <td className="px-4 py-3">{row.invoice || '-'}</td>
                            <td className="px-4 py-3">{row.vehicleNumber || '-'}</td>
                            <td className="px-4 py-3">{row.material || '-'}</td>
                            {section.includesTransport && <td className="px-4 py-3">{row.pickupPlace || '-'}</td>}
                            {section.includesTransport && <td className="px-4 py-3">{row.dropOffPlace || '-'}</td>}
                            <td className="px-4 py-3">{row.netWeight.toFixed(2)}</td>
                            <td className="px-4 py-3">{formatCurrency(row.comboRate)}</td>
                            <td className="px-4 py-3">{formatCurrency(row.comboAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                  Trip GST Details
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                    Total Count: {gstTableTotals.count} · Total Qty: {gstTableTotals.qty.toFixed(2)} · Total GST Amount: {formatCurrency(gstTableTotals.amount)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      <tr>
                        <th className="px-4 py-3 text-left">S. No.</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Trip #</th>
                        <th className="px-4 py-3 text-left">Invoice/DC</th>
                        <th className="px-4 py-3 text-left">Material Owner</th>
                        <th className="px-4 py-3 text-left">Vehicle Number</th>
                        <th className="px-4 py-3 text-left">Material Type</th>
                        <th className="px-4 py-3 text-left">Net Tons</th>
                        <th className="px-4 py-3 text-left">Trip Rate for GST</th>
                        <th className="px-4 py-3 text-left">GST %</th>
                        <th className="px-4 py-3 text-left">GST Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partyTripRowsSorted.map((row, index) => (
                        <tr key={`gst-${row.id}`} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-3">{index + 1}</td>
                          <td className="px-4 py-3">{formatDateDisplay(row.date)}</td>
                          <td className="px-4 py-3">#{row.id}</td>
                          <td className="px-4 py-3">{row.invoice || '-'}</td>
                          <td className="px-4 py-3">{row.mineQuarryName || '-'}</td>
                          <td className="px-4 py-3">{row.vehicleNumber || '-'}</td>
                          <td className="px-4 py-3">{row.material || '-'}</td>
                          <td className="px-4 py-3">{row.netWeight.toFixed(2)}</td>
                          <td className="px-4 py-3">{formatCurrency(row.gstRatePerTon)}</td>
                          <td className="px-4 py-3">{row.gstPercentage.toFixed(2)}</td>
                          <td className="px-4 py-3">{formatCurrency(row.gstAmount)}</td>
                        </tr>
                      ))}
                      {partyTripRowsSorted.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-4 py-6 text-center text-sm text-gray-500">No trips found for this rate party.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
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

AccountReconciliation.displayName = 'AccountReconciliation';

export default AccountReconciliation;
