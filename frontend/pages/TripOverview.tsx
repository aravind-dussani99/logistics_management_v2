import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { Filters } from '../components/FilterPanel';
import { MaterialRate, RatePartyType, Trip } from '../types';
import { formatCurrency, formatDateDisplay, getCombinedRatePerTon, isComboRate, resolveTripRate } from '../utils';

type TripOverviewFilters = Filters & {
  endCustomer?: string;
  rateParty?: string;
  activityMode?: '' | 'individual' | 'two-plus-one' | 'all-activities' | 'two-activities';
  pickup?: string;
  dropOff?: string;
  result?: '' | 'profit' | 'loss' | 'breakeven';
  billingView?: 'all' | 'only-billed';
};

type PurchaseComponent = {
  key: string;
  label: string;
  partyNames: string[];
  ratePerTon: number;
  amount: number;
};

type TripOverviewRow = {
  id: number;
  date: string;
  invoice: string;
  material: string;
  pickup: string;
  dropOff: string;
  vehicleNumber: string;
  qty: number;
  activityMode: string;
  activityModeKey: NonNullable<TripOverviewFilters['activityMode']>;
  ownerRatePartyNames: string;
  purchaseDetails: string;
  purchaseTotal: number;
  purchaseRatePerTon: number;
  endCustomerName: string;
  sellRatePerTon: number;
  sellAmount: number;
  marginGapPerTon: number;
  tripPnL: number;
  remark: 'Profit' | 'Loss' | 'Break-even';
  remarkAmount: number;
  involvedRateParties: string[];
  purchaseComponents: PurchaseComponent[];
  isBilled: boolean;
  routeKey: string;
};

type TripTableColumnKey =
  | 'sno'
  | 'date'
  | 'tripNo'
  | 'invoice'
  | 'material'
  | 'rateMode'
  | 'ownerRatePartyNames'
  | 'purchaseDetails'
  | 'purchaseTotal'
  | 'endCustomer'
  | 'sellRatePerTon'
  | 'sellAmount'
  | 'qty'
  | 'marginGapPerTon'
  | 'profitLoss'
  | 'remarks';

type TripTableColumnDef = {
  key: TripTableColumnKey;
  label: string;
  required?: boolean;
  thClassName: string;
  tdClassName: string;
};

const TRIP_TABLE_COLUMNS: TripTableColumnDef[] = [
  { key: 'sno', label: 'S. No.', required: true, thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3' },
  { key: 'date', label: 'Date', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
  { key: 'tripNo', label: 'Trip #', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
  { key: 'invoice', label: 'Invoice/DC', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
  { key: 'material', label: 'Material', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
  { key: 'rateMode', label: 'Rate Mode', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
  { key: 'ownerRatePartyNames', label: 'Owner / Rate Party Names', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 min-w-[260px]' },
  { key: 'purchaseDetails', label: 'Purchase Rates & Amounts', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 min-w-[420px]' },
  { key: 'purchaseTotal', label: 'Purchase Total', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
  { key: 'endCustomer', label: 'End Customer', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 min-w-[180px]' },
  { key: 'sellRatePerTon', label: 'Sell Rate/Ton', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
  { key: 'sellAmount', label: 'Sell Amount', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
  { key: 'qty', label: 'Qty', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
  { key: 'marginGapPerTon', label: 'Margin Gap/Ton', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap font-medium' },
  { key: 'profitLoss', label: 'Profit / Loss', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap font-semibold' },
  { key: 'remarks', label: 'Remarks', thClassName: 'px-4 py-3 text-left', tdClassName: 'px-4 py-3 whitespace-nowrap' },
];

const getDefaultDateRange = (): TripOverviewFilters => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return {
    dateFrom: formatDate(startOfMonth),
    dateTo: formatDate(today),
    endCustomer: '',
    rateParty: '',
    activityMode: '',
    material: '',
    pickup: '',
    dropOff: '',
    result: '',
    billingView: 'all',
  };
};

const normalize = (value?: string) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const prettyPartyType = (type: RatePartyType) => {
  if (type === 'mine-quarry') return 'Mine';
  if (type === 'transport-owner') return 'Transport';
  if (type === 'royalty-owner') return 'Royalty';
  return 'Customer';
};

const comboLabel = (types: RatePartyType[]) => {
  const hasMine = types.includes('mine-quarry');
  const hasTransport = types.includes('transport-owner');
  const hasRoyalty = types.includes('royalty-owner');
  if (hasMine && hasTransport && hasRoyalty) return 'Mine_Royalty_Transport';
  if (hasMine && hasTransport) return 'Mine_Transport';
  if (hasMine && hasRoyalty) return 'Mine_Royalty';
  if (hasTransport && hasRoyalty) return 'Royalty_Transport';
  return 'Individual';
};

const getModeCategory = (trip: Trip, comboTypes: Set<RatePartyType>): { label: string; key: NonNullable<TripOverviewFilters['activityMode']> } => {
  const presentTypes: RatePartyType[] = [];
  if (trip.quarryName) presentTypes.push('mine-quarry');
  if (trip.transporterName) presentTypes.push('transport-owner');
  if (trip.royaltyOwnerName) presentTypes.push('royalty-owner');

  if (comboTypes.size === 3) return { label: 'All Activities', key: 'all-activities' };
  if (comboTypes.size === 2) {
    const hasIndividualRemaining = presentTypes.some(type => !comboTypes.has(type));
    if (hasIndividualRemaining) return { label: '2+1 Activity', key: 'two-plus-one' };
    return { label: '2 Activities', key: 'two-activities' };
  }
  return { label: 'Individual', key: 'individual' };
};

const getRateForParty = (
  materialRates: MaterialRate[],
  trip: Trip,
  partyType: RatePartyType,
  comboOnly?: boolean,
) => resolveTripRate(materialRates, trip.id, partyType, comboOnly === undefined ? {} : { comboOnly });

const buildTripOverviewRow = (trip: Trip, materialRates: MaterialRate[]): TripOverviewRow => {
  const qty = Number(trip.netWeight || 0);
  const mineRate = getRateForParty(materialRates, trip, 'mine-quarry', false);
  const transportRate = getRateForParty(materialRates, trip, 'transport-owner', false);
  const royaltyRate = getRateForParty(materialRates, trip, 'royalty-owner', false);
  const mineComboRate = getRateForParty(materialRates, trip, 'mine-quarry');
  const transportComboRate = getRateForParty(materialRates, trip, 'transport-owner');
  const royaltyComboRate = getRateForParty(materialRates, trip, 'royalty-owner');

  const comboTypes = new Set<RatePartyType>();
  if (mineComboRate && isComboRate(mineComboRate)) comboTypes.add('mine-quarry');
  if (transportComboRate && isComboRate(transportComboRate)) comboTypes.add('transport-owner');
  if (royaltyComboRate && isComboRate(royaltyComboRate)) comboTypes.add('royalty-owner');

  const combinedRatePerTon = getCombinedRatePerTon(materialRates, trip.id);
  const purchaseComponents: PurchaseComponent[] = [];

  if (comboTypes.size > 1 && combinedRatePerTon > 0) {
    const comboTypeList = Array.from(comboTypes);
    const partyNames = comboTypeList.map(type => {
      if (type === 'mine-quarry') return mineComboRate?.ratePartyName || trip.quarryName || 'Mine';
      if (type === 'transport-owner') return transportComboRate?.ratePartyName || trip.transporterName || 'Transport';
      return royaltyComboRate?.ratePartyName || trip.royaltyOwnerName || 'Royalty';
    }).filter(Boolean);
    purchaseComponents.push({
      key: 'combo',
      label: comboLabel(comboTypeList),
      partyNames,
      ratePerTon: combinedRatePerTon,
      amount: qty * combinedRatePerTon,
    });
  }

  const pushIndividual = (
    key: RatePartyType,
    tripPartyName: string | undefined,
    rate: MaterialRate | undefined,
    fallbackAmount: number,
  ) => {
    if (!tripPartyName && !rate?.ratePartyName) return;
    if (comboTypes.has(key)) return;
    const ratePerTon = Number(rate?.ratePerTon || 0) || (qty > 0 ? fallbackAmount / qty : 0);
    if (ratePerTon <= 0 && fallbackAmount <= 0) return;
    purchaseComponents.push({
      key,
      label: prettyPartyType(key),
      partyNames: [rate?.ratePartyName || tripPartyName || prettyPartyType(key)],
      ratePerTon,
      amount: ratePerTon > 0 ? qty * ratePerTon : fallbackAmount,
    });
  };

  pushIndividual('mine-quarry', trip.quarryName, mineRate && !isComboRate(mineRate) ? mineRate : undefined, Number(trip.materialCost || 0));
  pushIndividual('transport-owner', trip.transporterName, transportRate && !isComboRate(transportRate) ? transportRate : undefined, Number(trip.transportCost || 0));
  pushIndividual('royalty-owner', trip.royaltyOwnerName, royaltyRate && !isComboRate(royaltyRate) ? royaltyRate : undefined, Number(trip.royaltyCost || 0));

  const purchaseTotal = purchaseComponents.reduce((sum, item) => sum + item.amount, 0);
  const purchaseRatePerTon = qty > 0 ? purchaseTotal / qty : 0;

  const billedEndCustomer = (trip.actualVendorCustomerName || '').trim();
  const endCustomerName = billedEndCustomer || trip.customer || trip.vendorName || '-';
  const billedRate = Number(trip.vendorCustomerRatePerTon || 0);
  const isBilled = Boolean(billedEndCustomer) && billedRate > 0;
  const fallbackSellRate = Number(trip.customerRatePerTon || 0) || (qty > 0 ? Number(trip.revenue || 0) / qty : 0);
  const sellRatePerTon = billedRate > 0 ? billedRate : fallbackSellRate;
  const sellAmount = sellRatePerTon > 0 ? qty * sellRatePerTon : Number(trip.revenue || 0);
  const marginGapPerTon = sellRatePerTon - purchaseRatePerTon;
  const tripPnL = sellAmount - purchaseTotal;

  const mode = getModeCategory(trip, comboTypes);

  const ownerRatePartyNames = purchaseComponents
    .map(item => `${item.label}: ${item.partyNames.join('+')}`)
    .join(' | ');

  const purchaseDetails = purchaseComponents
    .map(item => `${item.label} (${item.partyNames.join('+')}) @ ${item.ratePerTon.toFixed(2)} = ${item.amount.toFixed(2)}`)
    .join(' | ');

  const involvedRateParties = purchaseComponents.flatMap(item => item.partyNames).filter(Boolean);

  const remark: TripOverviewRow['remark'] = tripPnL > 0 ? 'Profit' : tripPnL < 0 ? 'Loss' : 'Break-even';

  return {
    id: trip.id,
    date: trip.date,
    invoice: trip.invoiceDCNumber || '-',
    material: trip.material || '-',
    pickup: trip.pickupPlace || trip.place || '-',
    dropOff: trip.dropOffPlace || '-',
    vehicleNumber: trip.vehicleNumber || '-',
    qty,
    activityMode: mode.label,
    activityModeKey: mode.key,
    ownerRatePartyNames: ownerRatePartyNames || '-',
    purchaseDetails: purchaseDetails || '-',
    purchaseTotal,
    purchaseRatePerTon,
    endCustomerName,
    sellRatePerTon,
    sellAmount,
    marginGapPerTon,
    tripPnL,
    remark,
    remarkAmount: Math.abs(tripPnL),
    involvedRateParties,
    purchaseComponents,
    isBilled,
    routeKey: `${trip.pickupPlace || trip.place || '-'} -> ${trip.dropOffPlace || '-'}`,
  };
};

const TripOverview: React.FC = () => {
  const { trips, materialRates, loadTrips, loadMaterialRates, refreshKey } = useData();
  const [filters, setFilters] = useState<TripOverviewFilters>(getDefaultDateRange());
  const [draftFilters, setDraftFilters] = useState<TripOverviewFilters>(getDefaultDateRange());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<TripTableColumnKey[]>(
    TRIP_TABLE_COLUMNS.map(column => column.key),
  );

  useEffect(() => {
    loadTrips();
    loadMaterialRates();
  }, [loadTrips, loadMaterialRates, refreshKey]);

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

  const openDatePicker = (event: React.MouseEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
      try {
        (input as HTMLInputElement & { showPicker: () => void }).showPicker();
      } catch {
        // Ignore non-gesture errors
      }
    }
  };

  const updateDraft = (key: keyof TripOverviewFilters, value: string) => {
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyDraftFilters = () => {
    const next = { ...draftFilters };
    if (next.dateFrom && next.dateTo && next.dateFrom > next.dateTo) {
      const swap = next.dateFrom;
      next.dateFrom = next.dateTo;
      next.dateTo = swap;
    }
    setFilters(next);
  };

  const resetDraftFilters = () => {
    const next = getDefaultDateRange();
    setDraftFilters(next);
    setFilters(next);
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

  const rows = useMemo(() => {
    return filteredTrips
      .map(trip => buildTripOverviewRow(trip, materialRates))
      .sort((a, b) => {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();
        if (aTime !== bTime) return aTime - bTime;
        return a.id - b.id;
      });
  }, [filteredTrips, materialRates]);

  const filteredRows = useMemo(() => {
    const endCustomerKey = normalize(filters.endCustomer);
    const ratePartyKey = normalize(filters.rateParty);
    const materialKey = normalize(filters.material);
    const pickupKey = normalize(filters.pickup);
    const dropOffKey = normalize(filters.dropOff);

    return rows.filter(row => {
      if ((filters.billingView || 'all') === 'only-billed' && !row.isBilled) return false;
      if (filters.activityMode && row.activityModeKey !== filters.activityMode) return false;
      if (filters.result === 'profit' && row.tripPnL <= 0) return false;
      if (filters.result === 'loss' && row.tripPnL >= 0) return false;
      if (filters.result === 'breakeven' && Math.abs(row.tripPnL) > 0.0001) return false;
      if (endCustomerKey && !normalize(row.endCustomerName).includes(endCustomerKey)) return false;
      if (ratePartyKey) {
        const matchedParty = row.involvedRateParties.some(name => normalize(name).includes(ratePartyKey));
        if (!matchedParty) return false;
      }
      if (materialKey && !normalize(row.material).includes(materialKey)) return false;
      if (pickupKey && !normalize(row.pickup).includes(pickupKey)) return false;
      if (dropOffKey && !normalize(row.dropOff).includes(dropOffKey)) return false;
      return true;
    });
  }, [rows, filters]);

  const kpis = useMemo(() => {
    const totalTrips = filteredRows.length;
    const totalTonnage = filteredRows.reduce((sum, row) => sum + row.qty, 0);
    const totalSellAmount = filteredRows.reduce((sum, row) => sum + row.sellAmount, 0);
    const totalPurchaseAmount = filteredRows.reduce((sum, row) => sum + row.purchaseTotal, 0);
    const netPnL = filteredRows.reduce((sum, row) => sum + row.tripPnL, 0);
    const totalProfit = filteredRows.reduce((sum, row) => sum + (row.tripPnL > 0 ? row.tripPnL : 0), 0);
    const totalLoss = filteredRows.reduce((sum, row) => sum + (row.tripPnL < 0 ? Math.abs(row.tripPnL) : 0), 0);
    const avgMarginPerTon = totalTonnage > 0 ? netPnL / totalTonnage : 0;
    return {
      totalTrips,
      totalTonnage,
      totalSellAmount,
      totalPurchaseAmount,
      netPnL,
      totalProfit,
      totalLoss,
      avgMarginPerTon,
    };
  }, [filteredRows]);

  const materialSummary = useMemo(() => {
    const map = new Map<string, { material: string; trips: number; qty: number; sell: number; purchase: number; pnl: number }>();
    filteredRows.forEach(row => {
      const key = row.material || 'Unknown';
      const entry = map.get(key) || { material: key, trips: 0, qty: 0, sell: 0, purchase: 0, pnl: 0 };
      entry.trips += 1;
      entry.qty += row.qty;
      entry.sell += row.sellAmount;
      entry.purchase += row.purchaseTotal;
      entry.pnl += row.tripPnL;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.pnl - a.pnl);
  }, [filteredRows]);

  const activityModeSummary = useMemo(() => {
    const map = new Map<string, { mode: string; trips: number; qty: number; sell: number; purchase: number; pnl: number }>();
    filteredRows.forEach(row => {
      const key = row.activityMode;
      const entry = map.get(key) || { mode: key, trips: 0, qty: 0, sell: 0, purchase: 0, pnl: 0 };
      entry.trips += 1;
      entry.qty += row.qty;
      entry.sell += row.sellAmount;
      entry.purchase += row.purchaseTotal;
      entry.pnl += row.tripPnL;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.trips - a.trips);
  }, [filteredRows]);

  const routeSummary = useMemo(() => {
    const map = new Map<string, {
      route: string;
      trips: number;
      qty: number;
      sell: number;
      purchase: number;
      pnl: number;
      margins: Array<{ date: string; marginPerTon: number }>;
    }>();
    filteredRows.forEach(row => {
      const key = row.routeKey;
      const entry = map.get(key) || {
        route: key,
        trips: 0,
        qty: 0,
        sell: 0,
        purchase: 0,
        pnl: 0,
        margins: [],
      };
      entry.trips += 1;
      entry.qty += row.qty;
      entry.sell += row.sellAmount;
      entry.purchase += row.purchaseTotal;
      entry.pnl += row.tripPnL;
      entry.margins.push({ date: row.date, marginPerTon: row.marginGapPerTon });
      map.set(key, entry);
    });
    return Array.from(map.values()).map(item => {
      const sortedMargins = [...item.margins].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const splitIndex = Math.floor(sortedMargins.length / 2);
      const firstHalf = sortedMargins.slice(0, Math.max(splitIndex, 1));
      const secondHalf = sortedMargins.slice(Math.max(splitIndex, 1));
      const avg = (list: Array<{ marginPerTon: number }>) => list.length > 0 ? list.reduce((sum, x) => sum + x.marginPerTon, 0) / list.length : 0;
      const firstAvg = avg(firstHalf);
      const secondAvg = avg(secondHalf.length > 0 ? secondHalf : firstHalf);
      const delta = secondAvg - firstAvg;
      const trend = delta > 25 ? 'Improving' : delta < -25 ? 'Worsening' : 'Stable';
      return {
        route: item.route,
        trips: item.trips,
        qty: item.qty,
        sell: item.sell,
        purchase: item.purchase,
        pnl: item.pnl,
        avgMarginPerTon: item.qty > 0 ? item.pnl / item.qty : 0,
        trend,
        trendDelta: delta,
      };
    }).sort((a, b) => b.pnl - a.pnl);
  }, [filteredRows]);

  const partyWiseSummary = useMemo(() => {
    type PartyContributionRow = {
      partyType: 'End Customer' | 'Mine' | 'Transport' | 'Royalty';
      name: string;
      trips: number;
      qty: number;
      sell: number;
      purchase: number;
      pnlContribution: number;
    };
    const map = new Map<string, PartyContributionRow>();
    const ensure = (partyType: PartyContributionRow['partyType'], name: string) => {
      const key = `${partyType}::${name}`;
      const existing = map.get(key);
      if (existing) return existing;
      const next: PartyContributionRow = { partyType, name, trips: 0, qty: 0, sell: 0, purchase: 0, pnlContribution: 0 };
      map.set(key, next);
      return next;
    };

    filteredRows.forEach(row => {
      if (row.endCustomerName && row.endCustomerName !== '-') {
        const customer = ensure('End Customer', row.endCustomerName);
        customer.trips += 1;
        customer.qty += row.qty;
        customer.sell += row.sellAmount;
        customer.pnlContribution += row.tripPnL;
      }

      row.purchaseComponents.forEach(component => {
        const partyType: PartyContributionRow['partyType'] =
          component.key === 'mine-quarry' || component.label.includes('Mine') ? 'Mine'
            : component.key === 'transport-owner' || component.label.includes('Transport') ? 'Transport'
              : component.key === 'royalty-owner' || component.label.includes('Royalty') ? 'Royalty'
                : component.label.includes('Mine') ? 'Mine'
                  : component.label.includes('Transport') ? 'Transport'
                    : component.label.includes('Royalty') ? 'Royalty'
                      : 'Mine';
        component.partyNames.forEach(name => {
          const party = ensure(partyType, name);
          party.trips += 1;
          party.qty += row.qty;
          party.purchase += component.amount / Math.max(component.partyNames.length, 1);
          party.pnlContribution += row.tripPnL / Math.max(row.purchaseComponents.length || 1, 1);
        });
      });
    });

    const all = Array.from(map.values());
    return {
      all,
      endCustomers: all.filter(x => x.partyType === 'End Customer').sort((a, b) => b.pnlContribution - a.pnlContribution),
      mines: all.filter(x => x.partyType === 'Mine').sort((a, b) => b.purchase - a.purchase),
      transports: all.filter(x => x.partyType === 'Transport').sort((a, b) => b.purchase - a.purchase),
      royalties: all.filter(x => x.partyType === 'Royalty').sort((a, b) => b.purchase - a.purchase),
    };
  }, [filteredRows]);

  const negativeMarginAlerts = useMemo(() => {
    const build = (label: string, keyGetter: (row: TripOverviewRow) => string) => {
      const map = new Map<string, { key: string; trips: number; lossTrips: number; totalLoss: number; avgMargin: number; sumMargin: number }>();
      filteredRows.forEach(row => {
        const key = keyGetter(row);
        if (!key || key === '-') return;
        const entry = map.get(key) || { key, trips: 0, lossTrips: 0, totalLoss: 0, avgMargin: 0, sumMargin: 0 };
        entry.trips += 1;
        entry.sumMargin += row.marginGapPerTon;
        if (row.marginGapPerTon < 0 || row.tripPnL < 0) {
          entry.lossTrips += 1;
          entry.totalLoss += Math.abs(Math.min(row.tripPnL, 0));
        }
        map.set(key, entry);
      });
      return Array.from(map.values())
        .map(item => ({ ...item, avgMargin: item.trips > 0 ? item.sumMargin / item.trips : 0, label }))
        .filter(item => item.lossTrips >= 2 && item.totalLoss > 0)
        .sort((a, b) => b.totalLoss - a.totalLoss)
        .slice(0, 5);
    };

    return [
      ...build('Material', row => row.material),
      ...build('Route', row => row.routeKey),
      ...build('End Customer', row => row.endCustomerName),
      ...build('Rate Party', row => row.involvedRateParties.join(' | ')),
    ].sort((a, b) => b.totalLoss - a.totalLoss).slice(0, 10);
  }, [filteredRows]);

  const topProfitRows = useMemo(
    () => [...filteredRows].sort((a, b) => b.tripPnL - a.tripPnL).slice(0, 5),
    [filteredRows],
  );

  const topLossRows = useMemo(
    () => [...filteredRows].sort((a, b) => a.tripPnL - b.tripPnL).slice(0, 5),
    [filteredRows],
  );

  const optionValues = useMemo(() => {
    const materials = Array.from(new Set(rows.map(row => row.material).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const endCustomers = Array.from(new Set(rows.map(row => row.endCustomerName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const rateParties = Array.from(new Set(rows.flatMap(row => row.involvedRateParties).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const pickups = Array.from(new Set(rows.map(row => row.pickup).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const dropOffs = Array.from(new Set(rows.map(row => row.dropOff).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return { materials, endCustomers, rateParties, pickups, dropOffs };
  }, [rows]);

  const activeFilterSummary = useMemo(() => {
    const tokens: string[] = [];
    if (filters.dateFrom || filters.dateTo) tokens.push(`Date: ${filters.dateFrom || 'All'} to ${filters.dateTo || 'All'}`);
    if (filters.endCustomer) tokens.push(`End Customer: ${filters.endCustomer}`);
    if (filters.rateParty) tokens.push(`Rate Party: ${filters.rateParty}`);
    if (filters.material) tokens.push(`Material: ${filters.material}`);
    if (filters.activityMode) tokens.push(`Mode: ${filters.activityMode}`);
    if (filters.pickup) tokens.push(`Pickup: ${filters.pickup}`);
    if (filters.dropOff) tokens.push(`Drop: ${filters.dropOff}`);
    if (filters.result) tokens.push(`Result: ${filters.result}`);
    if ((filters.billingView || 'all') === 'only-billed') tokens.push('Billing: Only Billed Trips');
    return tokens;
  }, [filters]);

  const selectedColumnKeySet = useMemo(() => new Set(selectedColumnKeys), [selectedColumnKeys]);

  const visibleTripColumns = useMemo(
    () => TRIP_TABLE_COLUMNS.filter(column => column.required || selectedColumnKeySet.has(column.key)),
    [selectedColumnKeySet],
  );

  const toggleTripColumn = (key: TripTableColumnKey) => {
    const column = TRIP_TABLE_COLUMNS.find(item => item.key === key);
    if (!column || column.required) return;
    setSelectedColumnKeys(prev => (
      prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]
    ));
  };

  const resetTripColumns = () => {
    setSelectedColumnKeys(TRIP_TABLE_COLUMNS.map(column => column.key));
  };

  const getTripColumnTextValue = (columnKey: TripTableColumnKey, row: TripOverviewRow, index: number): string => {
    switch (columnKey) {
      case 'sno': return String(index + 1);
      case 'date': return formatDateDisplay(row.date);
      case 'tripNo': return `#${row.id}`;
      case 'invoice': return row.invoice;
      case 'material': return row.material;
      case 'rateMode': return row.activityMode;
      case 'ownerRatePartyNames': return row.ownerRatePartyNames;
      case 'purchaseDetails': return row.purchaseDetails;
      case 'purchaseTotal': return row.purchaseTotal.toFixed(2);
      case 'endCustomer': return row.endCustomerName;
      case 'sellRatePerTon': return row.sellRatePerTon.toFixed(2);
      case 'sellAmount': return row.sellAmount.toFixed(2);
      case 'qty': return row.qty.toFixed(2);
      case 'marginGapPerTon': return row.marginGapPerTon.toFixed(2);
      case 'profitLoss': return row.tripPnL.toFixed(2);
      case 'remarks': return `${row.remark} ${row.remarkAmount.toFixed(2)}`;
      default: return '';
    }
  };

  const getTripColumnDisplayValue = (columnKey: TripTableColumnKey, row: TripOverviewRow, index: number): string => {
    switch (columnKey) {
      case 'purchaseTotal': return formatCurrency(row.purchaseTotal);
      case 'sellRatePerTon': return formatCurrency(row.sellRatePerTon);
      case 'sellAmount': return formatCurrency(row.sellAmount);
      case 'marginGapPerTon': return formatCurrency(row.marginGapPerTon);
      case 'profitLoss': return formatCurrency(row.tripPnL);
      case 'remarks': return `${row.remark} ${formatCurrency(row.remarkAmount)}`;
      default: return getTripColumnTextValue(columnKey, row, index);
    }
  };

  const renderTripColumnCell = (column: TripTableColumnDef, row: TripOverviewRow, index: number) => {
    if (column.key === 'marginGapPerTon') {
      return (
        <td
          key={`${column.key}-${row.id}`}
          className={`${column.tdClassName} ${row.marginGapPerTon >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}
        >
          {formatCurrency(row.marginGapPerTon)}
        </td>
      );
    }

    if (column.key === 'profitLoss') {
      return (
        <td
          key={`${column.key}-${row.id}`}
          className={`${column.tdClassName} ${row.tripPnL >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}
        >
          {formatCurrency(row.tripPnL)}
        </td>
      );
    }

    if (column.key === 'remarks') {
      return (
        <td key={`${column.key}-${row.id}`} className={column.tdClassName}>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.remark === 'Profit'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : row.remark === 'Loss'
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}>
            {row.remark} {formatCurrency(row.remarkAmount)}
          </span>
        </td>
      );
    }

    return (
      <td key={`${column.key}-${row.id}`} className={column.tdClassName}>
        {getTripColumnDisplayValue(column.key, row, index)}
      </td>
    );
  };

  const getTripFooterValue = (columnKey: TripTableColumnKey, visibleIndex: number): string => {
    if (visibleIndex === 0) return 'Total';
    switch (columnKey) {
      case 'purchaseTotal': return formatCurrency(kpis.totalPurchaseAmount);
      case 'sellAmount': return formatCurrency(kpis.totalSellAmount);
      case 'qty': return kpis.totalTonnage.toFixed(2);
      case 'marginGapPerTon': return formatCurrency(kpis.avgMarginPerTon);
      case 'profitLoss': return formatCurrency(kpis.netPnL);
      default: return '-';
    }
  };

  const exportCsv = () => {
    const headers = visibleTripColumns.map(column => column.label);
    const rowsCsv = filteredRows.map((row, index) =>
      visibleTripColumns.map(column => getTripColumnTextValue(column.key, row, index)),
    );
    const csvContent = [headers, ...rowsCsv]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trip_overview_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const headersHtml = visibleTripColumns.map(column => `<th>${column.label}</th>`).join('');
    const rowsHtml = filteredRows.map((row, index) => `
      <tr>
        ${visibleTripColumns.map(column => `<td>${getTripColumnDisplayValue(column.key, row, index)}</td>`).join('')}
      </tr>
    `).join('');
    const html = `
      <html><head><title>Logistics Accounts Overview</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111827}
        table{width:100%;border-collapse:collapse;margin-top:12px;border:1px solid #6b7280}
        th,td{border:1px solid #6b7280;padding:6px 8px;font-size:11px;text-align:left;vertical-align:top}
        th{background:#e5e7eb}
        .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
        .card{border:1px solid #d1d5db;padding:8px;border-radius:6px}
      </style></head><body>
      <h2>Logistics Accounts Overview</h2>
      <div>${activeFilterSummary.length ? activeFilterSummary.join(' | ') : 'Filters: None (All data in date range)'}</div>
      <div class="kpi">
        <div class="card"><strong>Total Trips</strong><br/>${kpis.totalTrips}</div>
        <div class="card"><strong>Total Tonnage</strong><br/>${kpis.totalTonnage.toFixed(2)}</div>
        <div class="card"><strong>Total Sell</strong><br/>${formatCurrency(kpis.totalSellAmount)}</div>
        <div class="card"><strong>Total Purchase</strong><br/>${formatCurrency(kpis.totalPurchaseAmount)}</div>
        <div class="card"><strong>Net P/L</strong><br/>${formatCurrency(kpis.netPnL)}</div>
        <div class="card"><strong>Total Profit</strong><br/>${formatCurrency(kpis.totalProfit)}</div>
        <div class="card"><strong>Total Loss</strong><br/>${formatCurrency(kpis.totalLoss)}</div>
        <div class="card"><strong>Avg Margin / Ton</strong><br/>${formatCurrency(kpis.avgMarginPerTon)}</div>
      </div>
      <h3>Trip Profit / Loss Statement</h3>
      <table>
        <thead><tr>
          ${headersHtml}
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="${visibleTripColumns.length}">No trips found for selected filters.</td></tr>`}</tbody>
      </table>
      </body></html>`;
    const popup = window.open('', '_blank', 'width=1200,height=800');
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logistics Accounts Overview"
        subtitle="Trip-wise purchase vs sell analysis with profit / loss insights."
        filters={filters}
        onFilterChange={(next) => setFilters(next as TripOverviewFilters)}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showFilters={[]}
        showMoreFilters={[]}
        showAddAction={false}
        headerRight={(
          <div className="rounded-xl border border-gray-200/60 bg-white/90 px-3 py-2 shadow-md dark:border-gray-700/60 dark:bg-gray-900/70">
            {filtersOpen ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Date From</label>
                    <input
                      type="date"
                      value={draftFilters.dateFrom || ''}
                      onChange={e => updateDraft('dateFrom', e.target.value)}
                      onKeyDown={allowDateTyping}
                      onClick={openDatePicker}
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Date To</label>
                    <input
                      type="date"
                      value={draftFilters.dateTo || ''}
                      onChange={e => updateDraft('dateTo', e.target.value)}
                      onKeyDown={allowDateTyping}
                      onClick={openDatePicker}
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">End Customer</label>
                    <input
                      type="text"
                      value={draftFilters.endCustomer || ''}
                      onChange={e => updateDraft('endCustomer', e.target.value)}
                      list="trip-overview-end-customers"
                      placeholder="All"
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Rate Party</label>
                    <input
                      type="text"
                      value={draftFilters.rateParty || ''}
                      onChange={e => updateDraft('rateParty', e.target.value)}
                      list="trip-overview-rate-parties"
                      placeholder="All"
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Material</label>
                    <input
                      type="text"
                      value={draftFilters.material || ''}
                      onChange={e => updateDraft('material', e.target.value)}
                      list="trip-overview-materials"
                      placeholder="All"
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Activity Mode</label>
                    <select
                      value={draftFilters.activityMode || ''}
                      onChange={e => updateDraft('activityMode', e.target.value)}
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    >
                      <option value="">All</option>
                      <option value="individual">Individual</option>
                      <option value="two-plus-one">2+1 Activity</option>
                      <option value="all-activities">All Activities</option>
                      <option value="two-activities">2 Activities</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">From (Pickup)</label>
                    <input
                      type="text"
                      value={draftFilters.pickup || ''}
                      onChange={e => updateDraft('pickup', e.target.value)}
                      list="trip-overview-pickups"
                      placeholder="All"
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">To (Drop-off)</label>
                    <input
                      type="text"
                      value={draftFilters.dropOff || ''}
                      onChange={e => updateDraft('dropOff', e.target.value)}
                      list="trip-overview-dropoffs"
                      placeholder="All"
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Billing View</label>
                    <select
                      value={draftFilters.billingView || 'all'}
                      onChange={e => updateDraft('billingView', e.target.value as TripOverviewFilters['billingView'])}
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    >
                      <option value="all">All Trips</option>
                      <option value="only-billed">Only Billed Trips</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Result</label>
                    <select
                      value={draftFilters.result || ''}
                      onChange={e => updateDraft('result', e.target.value)}
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900"
                    >
                      <option value="">All</option>
                      <option value="profit">Profit</option>
                      <option value="loss">Loss</option>
                      <option value="breakeven">Break-even</option>
                    </select>
                  </div>
                </div>
                <datalist id="trip-overview-end-customers">
                  {optionValues.endCustomers.map(item => <option key={`toc-${item}`} value={item} />)}
                </datalist>
                <datalist id="trip-overview-rate-parties">
                  {optionValues.rateParties.map(item => <option key={`tor-${item}`} value={item} />)}
                </datalist>
                <datalist id="trip-overview-materials">
                  {optionValues.materials.map(item => <option key={`tom-${item}`} value={item} />)}
                </datalist>
                <datalist id="trip-overview-pickups">
                  {optionValues.pickups.map(item => <option key={`top-${item}`} value={item} />)}
                </datalist>
                <datalist id="trip-overview-dropoffs">
                  {optionValues.dropOffs.map(item => <option key={`tod-${item}`} value={item} />)}
                </datalist>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={applyDraftFilters}
                    className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-white hover:bg-primary-dark"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={resetDraftFilters}
                    className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  <ion-icon name="funnel-outline"></ion-icon>
                  <span>Show Filters</span>
                </button>
              </div>
            )}
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Trips</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.totalTrips}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Tonnage</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.totalTonnage.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Sell Amount</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(kpis.totalSellAmount)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Purchase Amount</div>
          <div className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(kpis.totalPurchaseAmount)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Net P/L</div>
          <div className={`mt-1 text-2xl font-semibold ${kpis.netPnL >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>
            {formatCurrency(kpis.netPnL)}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Profit</div>
          <div className="mt-1 text-2xl font-semibold text-green-700 dark:text-green-400">{formatCurrency(kpis.totalProfit)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Loss</div>
          <div className="mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-400">{formatCurrency(kpis.totalLoss)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Avg Margin / Ton</div>
          <div className={`mt-1 text-2xl font-semibold ${kpis.avgMarginPerTon >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-rose-700 dark:text-rose-400'}`}>
            {formatCurrency(kpis.avgMarginPerTon)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 xl:col-span-2">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            Negative Margin Alerts (Repeated Loss Patterns)
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-rose-50 text-xs uppercase text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                <tr>
                  <th className="px-4 py-3 text-left">Pattern Type</th>
                  <th className="px-4 py-3 text-left">Pattern</th>
                  <th className="px-4 py-3 text-left">Trips</th>
                  <th className="px-4 py-3 text-left">Loss Trips</th>
                  <th className="px-4 py-3 text-left">Avg Margin/Ton</th>
                  <th className="px-4 py-3 text-left">Total Loss</th>
                </tr>
              </thead>
              <tbody>
                {negativeMarginAlerts.map((item, index) => (
                  <tr key={`neg-alert-${item.label}-${index}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{item.label}</td>
                    <td className="px-4 py-3">{item.key}</td>
                    <td className="px-4 py-3">{item.trips}</td>
                    <td className="px-4 py-3 text-rose-700 dark:text-rose-400 font-medium">{item.lossTrips}</td>
                    <td className={`px-4 py-3 ${item.avgMargin >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatCurrency(item.avgMargin)}</td>
                    <td className="px-4 py-3 text-rose-700 dark:text-rose-400 font-semibold">{formatCurrency(item.totalLoss)}</td>
                  </tr>
                ))}
                {negativeMarginAlerts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No repeated negative-margin patterns found for current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            Material Summary
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">Material</th>
                  <th className="px-4 py-3 text-left">Trips</th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">Sell</th>
                  <th className="px-4 py-3 text-left">Purchase</th>
                  <th className="px-4 py-3 text-left">P/L</th>
                </tr>
              </thead>
              <tbody>
                {materialSummary.map(item => (
                  <tr key={`mat-${item.material}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{item.material}</td>
                    <td className="px-4 py-3">{item.trips}</td>
                    <td className="px-4 py-3">{item.qty.toFixed(2)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.sell)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.purchase)}</td>
                    <td className={`px-4 py-3 font-medium ${item.pnl >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatCurrency(item.pnl)}</td>
                  </tr>
                ))}
                {materialSummary.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No data for selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            Activity Mode Summary
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Trips</th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">Sell</th>
                  <th className="px-4 py-3 text-left">Purchase</th>
                  <th className="px-4 py-3 text-left">P/L</th>
                </tr>
              </thead>
              <tbody>
                {activityModeSummary.map(item => (
                  <tr key={`mode-${item.mode}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{item.mode}</td>
                    <td className="px-4 py-3">{item.trips}</td>
                    <td className="px-4 py-3">{item.qty.toFixed(2)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.sell)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.purchase)}</td>
                    <td className={`px-4 py-3 font-medium ${item.pnl >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatCurrency(item.pnl)}</td>
                  </tr>
                ))}
                {activityModeSummary.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No data for selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            Route-wise Summary (Pickup → Drop-off)
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">Route</th>
                  <th className="px-4 py-3 text-left">Trips</th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">Avg Margin/Ton</th>
                  <th className="px-4 py-3 text-left">P/L</th>
                  <th className="px-4 py-3 text-left">Trend</th>
                </tr>
              </thead>
              <tbody>
                {routeSummary.map(item => (
                  <tr key={`route-${item.route}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{item.route}</td>
                    <td className="px-4 py-3">{item.trips}</td>
                    <td className="px-4 py-3">{item.qty.toFixed(2)}</td>
                    <td className={`px-4 py-3 ${item.avgMarginPerTon >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatCurrency(item.avgMarginPerTon)}</td>
                    <td className={`px-4 py-3 font-medium ${item.pnl >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatCurrency(item.pnl)}</td>
                    <td className={`px-4 py-3 ${item.trend === 'Improving' ? 'text-green-700 dark:text-green-400' : item.trend === 'Worsening' ? 'text-rose-700 dark:text-rose-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {item.trend} ({formatCurrency(item.trendDelta)})
                    </td>
                  </tr>
                ))}
                {routeSummary.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No route data for selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            Party-wise Summary (Profit Contribution)
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Trips</th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">Sell</th>
                  <th className="px-4 py-3 text-left">Purchase</th>
                  <th className="px-4 py-3 text-left">P/L Contribution</th>
                </tr>
              </thead>
              <tbody>
                {partyWiseSummary.all.slice(0, 20).map((item, index) => (
                  <tr key={`party-summary-${item.partyType}-${item.name}-${index}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{item.partyType}</td>
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3">{item.trips}</td>
                    <td className="px-4 py-3">{item.qty.toFixed(2)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.sell)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.purchase)}</td>
                    <td className={`px-4 py-3 ${item.pnlContribution >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatCurrency(item.pnlContribution)}</td>
                  </tr>
                ))}
                {partyWiseSummary.all.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">No party-wise contribution data for selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            Top 5 Profitable Trips
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {topProfitRows.filter(row => row.tripPnL > 0).map(row => (
              <div key={`profit-${row.id}`} className="flex items-center justify-between px-6 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100">#{row.id} · {row.material}</div>
                  <div className="truncate text-xs text-gray-500 dark:text-gray-400">{row.endCustomerName} · {row.pickup} → {row.dropOff}</div>
                </div>
                <div className="text-green-700 dark:text-green-400 font-semibold">{formatCurrency(row.tripPnL)}</div>
              </div>
            ))}
            {topProfitRows.filter(row => row.tripPnL > 0).length === 0 && (
              <div className="px-6 py-6 text-center text-sm text-gray-500">No profitable trips in this filter selection.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            Top 5 Loss-Making Trips
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {topLossRows.filter(row => row.tripPnL < 0).map(row => (
              <div key={`loss-${row.id}`} className="flex items-center justify-between px-6 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100">#{row.id} · {row.material}</div>
                  <div className="truncate text-xs text-gray-500 dark:text-gray-400">{row.endCustomerName} · {row.pickup} → {row.dropOff}</div>
                </div>
                <div className="text-rose-700 dark:text-rose-400 font-semibold">{formatCurrency(row.tripPnL)}</div>
              </div>
            ))}
            {topLossRows.filter(row => row.tripPnL < 0).length === 0 && (
              <div className="px-6 py-6 text-center text-sm text-gray-500">No loss-making trips in this filter selection.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Trip Profit / Loss Statement
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                Trips: {filteredRows.length} · Sell: {formatCurrency(kpis.totalSellAmount)} · Purchase: {formatCurrency(kpis.totalPurchaseAmount)} · Net: {formatCurrency(kpis.netPnL)}
              </span>
            </span>
            <div className="flex items-center gap-2 text-xs">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setColumnPickerOpen(prev => !prev)}
                  className="rounded-md border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Columns
                </button>
                {columnPickerOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Select Columns</div>
                      <button
                        type="button"
                        onClick={resetTripColumns}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1">
                      {TRIP_TABLE_COLUMNS.map(column => (
                        <label key={`trip-col-${column.key}`} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                          <input
                            type="checkbox"
                            checked={column.required || selectedColumnKeySet.has(column.key)}
                            disabled={column.required}
                            onChange={() => toggleTripColumn(column.key)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <span>{column.label}{column.required ? ' (Fixed)' : ''}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-md border border-primary px-3 py-1 text-primary transition hover:bg-primary hover:text-white"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={exportPdf}
                className="rounded-md border border-gray-300 px-3 py-1 text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Export PDF
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1900px] text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                {visibleTripColumns.map(column => (
                  <th key={`trip-header-${column.key}`} className={column.thClassName}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={`trip-overview-row-${row.id}`} className="border-b border-gray-100 align-top dark:border-gray-800">
                  {visibleTripColumns.map(column => renderTripColumnCell(column, row, index))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={visibleTripColumns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                    No trips found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                  {visibleTripColumns.map((column, visibleIndex) => (
                    <td
                      key={`trip-footer-${column.key}`}
                      className={`${column.tdClassName} ${column.key === 'profitLoss'
                        ? (kpis.netPnL >= 0 ? 'text-green-700 dark:text-green-400' : 'text-rose-700 dark:text-rose-400')
                        : ''}`}
                    >
                      {getTripFooterValue(column.key, visibleIndex)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default TripOverview;
