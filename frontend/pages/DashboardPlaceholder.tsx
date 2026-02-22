import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useData } from '../contexts/DataContext';
import { Filters } from '../components/FilterPanel';
import { MaterialRate, RatePartyType, Trip } from '../types';
import { formatDateDisplay, isComboRate, resolveTripRate } from '../utils';

const getDefaultDateRange = (): Filters & {
  endCustomer?: string;
  pickup?: string;
  dropOff?: string;
  activityMode?: '' | 'individual' | 'two-plus-one' | 'two-activities' | 'all-activities';
  billedView?: 'all' | 'only-billed' | 'only-unbilled';
  statusFilter?: string;
} => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return {
    dateFrom: formatDate(startOfMonth),
    dateTo: formatDate(today),
    endCustomer: '',
    pickup: '',
    dropOff: '',
    activityMode: '',
    billedView: 'all',
    statusFilter: '',
  };
};

type DashboardFilters = ReturnType<typeof getDefaultDateRange>;

type OverviewRow = {
  id: number;
  date: string;
  invoice: string;
  material: string;
  vehicleNumber: string;
  pickup: string;
  dropOff: string;
  customerName: string;
  mineName: string;
  transportName: string;
  royaltyName: string;
  netWeight: number;
  activityMode: string;
  activityModeKey: NonNullable<DashboardFilters['activityMode']>;
  status: string;
  isBilled: boolean;
  hasWeightDifference: boolean;
  routeKey: string;
};

const normalize = (value?: string) => (value || '').trim().toLowerCase();

const getActivityMode = (trip: Trip, materialRates: MaterialRate[]): { label: string; key: OverviewRow['activityModeKey'] } => {
  const comboTypes = new Set<RatePartyType>();
  const mineRate = resolveTripRate(materialRates, trip.id, 'mine-quarry');
  const transportRate = resolveTripRate(materialRates, trip.id, 'transport-owner');
  const royaltyRate = resolveTripRate(materialRates, trip.id, 'royalty-owner');
  if (mineRate && isComboRate(mineRate)) comboTypes.add('mine-quarry');
  if (transportRate && isComboRate(transportRate)) comboTypes.add('transport-owner');
  if (royaltyRate && isComboRate(royaltyRate)) comboTypes.add('royalty-owner');

  const present: RatePartyType[] = [];
  if (trip.quarryName) present.push('mine-quarry');
  if (trip.transporterName) present.push('transport-owner');
  if (trip.royaltyOwnerName) present.push('royalty-owner');

  if (comboTypes.size === 3) return { label: 'All Activities', key: 'all-activities' };
  if (comboTypes.size === 2) {
    const hasRemainingIndividual = present.some(type => !comboTypes.has(type));
    if (hasRemainingIndividual) return { label: '2+1 Activity', key: 'two-plus-one' };
    return { label: '2 Activities', key: 'two-activities' };
  }
  return { label: 'Individual', key: 'individual' };
};

const DashboardPlaceholder: React.FC = () => {
  const { trips, materialRates, loadTrips, loadMaterialRates, refreshKey } = useData();
  const [filters, setFilters] = useState<DashboardFilters>(getDefaultDateRange());
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(getDefaultDateRange());
  const [filtersOpen, setFiltersOpen] = useState(true);

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
        // no-op
      }
    }
  };

  const updateDraft = (key: keyof DashboardFilters, value: string) => {
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

  const rows = useMemo<OverviewRow[]>(() => {
    return trips.map(trip => {
      const mode = getActivityMode(trip, materialRates);
      const netWeight = Number(trip.netWeight || 0);
      const endCustomer = (trip.actualVendorCustomerName || '').trim() || trip.customer || trip.vendorName || '-';
      const isBilled = Boolean((trip.actualVendorCustomerName || '').trim()) && Number(trip.vendorCustomerRatePerTon || 0) > 0;
      const endNetWeight = Number(trip.endNetWeight ?? 0);
      const hasWeightDifference = endNetWeight > 0 && Math.abs(endNetWeight - netWeight) > 0.001;
      const pickup = trip.pickupPlace || trip.place || '-';
      const dropOff = trip.dropOffPlace || '-';
      return {
        id: trip.id,
        date: trip.date,
        invoice: trip.invoiceDCNumber || '-',
        material: trip.material || '-',
        vehicleNumber: trip.vehicleNumber || '-',
        pickup,
        dropOff,
        customerName: endCustomer,
        mineName: trip.quarryName || '-',
        transportName: trip.transporterName || '-',
        royaltyName: trip.royaltyOwnerName || '-',
        netWeight,
        activityMode: mode.label,
        activityModeKey: mode.key,
        status: trip.status || '-',
        isBilled,
        hasWeightDifference,
        routeKey: `${pickup} -> ${dropOff}`,
      };
    }).sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return a.id - b.id;
    });
  }, [trips, materialRates]);

  const filteredRows = useMemo(() => {
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
    return rows.filter(row => {
      const rowDate = row.date ? new Date(row.date) : null;
      if (fromDate && rowDate && rowDate < fromDate) return false;
      if (toDate && rowDate && rowDate > toDate) return false;
      if (filters.material && row.material !== filters.material) return false;
      if (filters.pickup && normalize(row.pickup) !== normalize(filters.pickup)) return false;
      if (filters.dropOff && normalize(row.dropOff) !== normalize(filters.dropOff)) return false;
      if (filters.endCustomer && !normalize(row.customerName).includes(normalize(filters.endCustomer))) return false;
      if (filters.activityMode && row.activityModeKey !== filters.activityMode) return false;
      if (filters.statusFilter && normalize(row.status) !== normalize(filters.statusFilter)) return false;
      if ((filters.billedView || 'all') === 'only-billed' && !row.isBilled) return false;
      if ((filters.billedView || 'all') === 'only-unbilled' && row.isBilled) return false;
      if (filters.vehicle && row.vehicleNumber !== filters.vehicle) return false;
      return true;
    });
  }, [rows, filters]);

  const kpis = useMemo(() => {
    const totalTrips = filteredRows.length;
    const totalTonnage = filteredRows.reduce((sum, row) => sum + row.netWeight, 0);
    const avgTonnage = totalTrips > 0 ? totalTonnage / totalTrips : 0;
    const billedTrips = filteredRows.filter(row => row.isBilled).length;
    const unbilledTrips = totalTrips - billedTrips;
    const completedTrips = filteredRows.filter(row => normalize(row.status) === 'completed').length;
    const inTransitTrips = filteredRows.filter(row => normalize(row.status) === 'in transit').length;
    const pendingValidationTrips = filteredRows.filter(row => normalize(row.status).includes('validation')).length;
    const uniqueVehicles = new Set(filteredRows.map(row => row.vehicleNumber).filter(Boolean)).size;
    const uniqueRoutes = new Set(filteredRows.map(row => row.routeKey).filter(Boolean)).size;
    return {
      totalTrips,
      totalTonnage,
      avgTonnage,
      billedTrips,
      unbilledTrips,
      completedTrips,
      inTransitTrips,
      pendingValidationTrips,
      uniqueVehicles,
      uniqueRoutes,
    };
  }, [filteredRows]);

  const statusSummary = useMemo(() => {
    const map = new Map<string, { status: string; trips: number; qty: number }>();
    filteredRows.forEach(row => {
      const key = row.status || '-';
      const entry = map.get(key) || { status: key, trips: 0, qty: 0 };
      entry.trips += 1;
      entry.qty += row.netWeight;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.trips - a.trips);
  }, [filteredRows]);

  const materialSummary = useMemo(() => {
    const map = new Map<string, { material: string; trips: number; qty: number; avgQty: number }>();
    filteredRows.forEach(row => {
      const key = row.material || '-';
      const entry = map.get(key) || { material: key, trips: 0, qty: 0, avgQty: 0 };
      entry.trips += 1;
      entry.qty += row.netWeight;
      map.set(key, entry);
    });
    return Array.from(map.values())
      .map(item => ({ ...item, avgQty: item.trips > 0 ? item.qty / item.trips : 0 }))
      .sort((a, b) => b.trips - a.trips);
  }, [filteredRows]);

  const routeSummary = useMemo(() => {
    const map = new Map<string, { route: string; trips: number; qty: number; avgQty: number; lastTripDate: string; billedTrips: number }>();
    filteredRows.forEach(row => {
      const key = row.routeKey;
      const entry = map.get(key) || { route: key, trips: 0, qty: 0, avgQty: 0, lastTripDate: row.date, billedTrips: 0 };
      entry.trips += 1;
      entry.qty += row.netWeight;
      if (row.isBilled) entry.billedTrips += 1;
      if (new Date(row.date).getTime() > new Date(entry.lastTripDate).getTime()) entry.lastTripDate = row.date;
      map.set(key, entry);
    });
    return Array.from(map.values())
      .map(item => ({ ...item, avgQty: item.trips > 0 ? item.qty / item.trips : 0 }))
      .sort((a, b) => b.trips - a.trips);
  }, [filteredRows]);

  const partySummary = useMemo(() => {
    const build = (label: string, selector: (row: OverviewRow) => string) => {
      const map = new Map<string, { name: string; trips: number; qty: number }>();
      filteredRows.forEach(row => {
        const name = selector(row) || '-';
        const entry = map.get(name) || { name, trips: 0, qty: 0 };
        entry.trips += 1;
        entry.qty += row.netWeight;
        map.set(name, entry);
      });
      return {
        label,
        rows: Array.from(map.values()).sort((a, b) => b.trips - a.trips).slice(0, 10),
      };
    };
    return [
      build('End Customers', row => row.customerName),
      build('Mines / Quarries', row => row.mineName),
      build('Transport Owners', row => row.transportName),
      build('Royalty Owners', row => row.royaltyName),
    ];
  }, [filteredRows]);

  const alerts = useMemo(() => {
    const items: Array<{ type: string; pattern: string; count: number; qty: number; note: string }> = [];

    const repeatedLossLike = <T extends string>(label: string, keyGetter: (row: OverviewRow) => T, predicate: (row: OverviewRow) => boolean, note: string) => {
      const map = new Map<string, { count: number; qty: number }>();
      filteredRows.filter(predicate).forEach(row => {
        const key = keyGetter(row);
        if (!key || key === '-') return;
        const entry = map.get(key) || { count: 0, qty: 0 };
        entry.count += 1;
        entry.qty += row.netWeight;
        map.set(key, entry);
      });
      Array.from(map.entries())
        .filter(([, v]) => v.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 4)
        .forEach(([pattern, value]) => {
          items.push({ type: label, pattern, count: value.count, qty: value.qty, note });
        });
    };

    repeatedLossLike('Unbilled Trips', row => row.customerName, row => !row.isBilled, 'Repeated trips without bill details');
    repeatedLossLike('Status Delay', row => row.routeKey, row => {
      const s = normalize(row.status);
      return s !== 'completed';
    }, 'Repeated non-completed trips on route');
    repeatedLossLike('Weight Difference', row => row.material, row => row.hasWeightDifference, 'Repeated end-weight differences');
    repeatedLossLike('Pending Validation', row => row.transportName, row => normalize(row.status).includes('validation'), 'Trips pending validation by transporter');

    return items.sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredRows]);

  const recentTrips = useMemo(() => [...filteredRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 25), [filteredRows]);

  const optionValues = useMemo(() => {
    const materials = Array.from(new Set(rows.map(r => r.material).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const endCustomers = Array.from(new Set(rows.map(r => r.customerName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const pickups = Array.from(new Set(rows.map(r => r.pickup).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const dropOffs = Array.from(new Set(rows.map(r => r.dropOff).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const statuses = Array.from(new Set(rows.map(r => r.status).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return { materials, endCustomers, pickups, dropOffs, statuses };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Operational trip overview (non-financial) for site and management visibility."
        filters={filters}
        onFilterChange={next => setFilters(next as DashboardFilters)}
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
                    <input type="date" value={draftFilters.dateFrom || ''} onChange={e => updateDraft('dateFrom', e.target.value)} onKeyDown={allowDateTyping} onClick={openDatePicker} className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Date To</label>
                    <input type="date" value={draftFilters.dateTo || ''} onChange={e => updateDraft('dateTo', e.target.value)} onKeyDown={allowDateTyping} onClick={openDatePicker} className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">End Customer</label>
                    <input type="text" value={draftFilters.endCustomer || ''} onChange={e => updateDraft('endCustomer', e.target.value)} list="ops-end-customer-list" placeholder="All" className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Material</label>
                    <input type="text" value={draftFilters.material || ''} onChange={e => updateDraft('material', e.target.value)} list="ops-material-list" placeholder="All" className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Status</label>
                    <input type="text" value={draftFilters.statusFilter || ''} onChange={e => updateDraft('statusFilter', e.target.value)} list="ops-status-list" placeholder="All" className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Activity Mode</label>
                    <select value={draftFilters.activityMode || ''} onChange={e => updateDraft('activityMode', e.target.value)} className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900">
                      <option value="">All</option>
                      <option value="individual">Individual</option>
                      <option value="two-plus-one">2+1 Activity</option>
                      <option value="two-activities">2 Activities</option>
                      <option value="all-activities">All Activities</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Billed View</label>
                    <select value={draftFilters.billedView || 'all'} onChange={e => updateDraft('billedView', e.target.value)} className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900">
                      <option value="all">All Trips</option>
                      <option value="only-billed">Only Billed</option>
                      <option value="only-unbilled">Only Unbilled</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Pickup</label>
                    <input type="text" value={draftFilters.pickup || ''} onChange={e => updateDraft('pickup', e.target.value)} list="ops-pickup-list" placeholder="All" className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Drop-off</label>
                    <input type="text" value={draftFilters.dropOff || ''} onChange={e => updateDraft('dropOff', e.target.value)} list="ops-dropoff-list" placeholder="All" className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Vehicle</label>
                    <input type="text" value={draftFilters.vehicle || ''} onChange={e => updateDraft('vehicle', e.target.value)} placeholder="All" className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900" />
                  </div>
                </div>
                <datalist id="ops-end-customer-list">{optionValues.endCustomers.map(v => <option key={v} value={v} />)}</datalist>
                <datalist id="ops-material-list">{optionValues.materials.map(v => <option key={v} value={v} />)}</datalist>
                <datalist id="ops-status-list">{optionValues.statuses.map(v => <option key={v} value={v} />)}</datalist>
                <datalist id="ops-pickup-list">{optionValues.pickups.map(v => <option key={v} value={v} />)}</datalist>
                <datalist id="ops-dropoff-list">{optionValues.dropOffs.map(v => <option key={v} value={v} />)}</datalist>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={applyDraftFilters} className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-white hover:bg-primary-dark">Apply</button>
                  <button type="button" onClick={resetDraftFilters} className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">Reset</button>
                  <button type="button" onClick={() => setFiltersOpen(false)} className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">Hide</button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                  <ion-icon name="funnel-outline"></ion-icon><span>Show Filters</span>
                </button>
              </div>
            )}
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">Total Trips</div><div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.totalTrips}</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">Total Tonnage</div><div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.totalTonnage.toFixed(2)}</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">Avg Tons / Trip</div><div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.avgTonnage.toFixed(2)}</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">Unique Vehicles</div><div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.uniqueVehicles}</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">Unique Routes</div><div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{kpis.uniqueRoutes}</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">Completed Trips</div><div className="mt-1 text-2xl font-semibold text-green-700 dark:text-green-400">{kpis.completedTrips}</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">In Transit</div><div className="mt-1 text-2xl font-semibold text-blue-700 dark:text-blue-400">{kpis.inTransitTrips}</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">Pending Validation</div><div className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-400">{kpis.pendingValidationTrips}</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">Billed Trips</div><div className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{kpis.billedTrips}</div></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="text-xs text-gray-500 dark:text-gray-400">Unbilled Trips</div><div className="mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-400">{kpis.unbilledTrips}</div></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">Operational Alerts</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-amber-50 text-xs uppercase text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <tr><th className="px-4 py-3 text-left">Alert Type</th><th className="px-4 py-3 text-left">Pattern</th><th className="px-4 py-3 text-left">Count</th><th className="px-4 py-3 text-left">Qty</th><th className="px-4 py-3 text-left">Note</th></tr>
              </thead>
              <tbody>
                {alerts.map((item, idx) => (
                  <tr key={`alert-${idx}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">{item.type}</td>
                    <td className="px-4 py-3">{item.pattern}</td>
                    <td className="px-4 py-3 font-medium text-amber-700 dark:text-amber-400">{item.count}</td>
                    <td className="px-4 py-3">{item.qty.toFixed(2)}</td>
                    <td className="px-4 py-3">{item.note}</td>
                  </tr>
                ))}
                {alerts.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No repeated operational issues found for current filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">Status Summary</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300"><tr><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Trips</th><th className="px-4 py-3 text-left">Qty</th></tr></thead>
              <tbody>
                {statusSummary.map(item => <tr key={item.status} className="border-b border-gray-100 dark:border-gray-800"><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3">{item.trips}</td><td className="px-4 py-3">{item.qty.toFixed(2)}</td></tr>)}
                {statusSummary.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">No data for selected filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">Material Summary</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300"><tr><th className="px-4 py-3 text-left">Material</th><th className="px-4 py-3 text-left">Trips</th><th className="px-4 py-3 text-left">Qty</th><th className="px-4 py-3 text-left">Avg Qty</th></tr></thead>
              <tbody>
                {materialSummary.map(item => <tr key={item.material} className="border-b border-gray-100 dark:border-gray-800"><td className="px-4 py-3">{item.material}</td><td className="px-4 py-3">{item.trips}</td><td className="px-4 py-3">{item.qty.toFixed(2)}</td><td className="px-4 py-3">{item.avgQty.toFixed(2)}</td></tr>)}
                {materialSummary.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No material summary data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">Route Summary (Pickup → Drop-off)</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300"><tr><th className="px-4 py-3 text-left">Route</th><th className="px-4 py-3 text-left">Trips</th><th className="px-4 py-3 text-left">Qty</th><th className="px-4 py-3 text-left">Billed</th><th className="px-4 py-3 text-left">Last Trip</th></tr></thead>
              <tbody>
                {routeSummary.slice(0, 12).map(item => <tr key={item.route} className="border-b border-gray-100 dark:border-gray-800"><td className="px-4 py-3">{item.route}</td><td className="px-4 py-3">{item.trips}</td><td className="px-4 py-3">{item.qty.toFixed(2)}</td><td className="px-4 py-3">{item.billedTrips}</td><td className="px-4 py-3">{formatDateDisplay(item.lastTripDate)}</td></tr>)}
                {routeSummary.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No route summary data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {partySummary.map(section => (
          <div key={section.label} className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">{section.label}</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Trips</th><th className="px-4 py-3 text-left">Qty</th></tr></thead>
                <tbody>
                  {section.rows.map(row => <tr key={`${section.label}-${row.name}`} className="border-b border-gray-100 dark:border-gray-800"><td className="px-4 py-3">{row.name}</td><td className="px-4 py-3">{row.trips}</td><td className="px-4 py-3">{row.qty.toFixed(2)}</td></tr>)}
                  {section.rows.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">No data.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
          Recent Trips (Operational View)
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">Showing latest 25 trips in current filters. No financial columns displayed.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1400px] text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">S. No.</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Trip #</th>
                <th className="px-4 py-3 text-left">Invoice/DC</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Material</th>
                <th className="px-4 py-3 text-left">Qty</th>
                <th className="px-4 py-3 text-left">Activity Mode</th>
                <th className="px-4 py-3 text-left">End Customer</th>
                <th className="px-4 py-3 text-left">Mine</th>
                <th className="px-4 py-3 text-left">Transport</th>
                <th className="px-4 py-3 text-left">Royalty</th>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Pickup</th>
                <th className="px-4 py-3 text-left">Drop-off</th>
                <th className="px-4 py-3 text-left">Billed</th>
              </tr>
            </thead>
            <tbody>
              {recentTrips.map((row, index) => (
                <tr key={`ops-row-${row.id}`} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateDisplay(row.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">#{row.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.invoice}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.status}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.material}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.netWeight.toFixed(2)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.activityMode}</td>
                  <td className="px-4 py-3">{row.customerName}</td>
                  <td className="px-4 py-3">{row.mineName}</td>
                  <td className="px-4 py-3">{row.transportName}</td>
                  <td className="px-4 py-3">{row.royaltyName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.vehicleNumber}</td>
                  <td className="px-4 py-3">{row.pickup}</td>
                  <td className="px-4 py-3">{row.dropOff}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.isBilled ? 'Yes' : 'No'}</td>
                </tr>
              ))}
              {recentTrips.length === 0 && (
                <tr><td colSpan={16} className="px-4 py-8 text-center text-sm text-gray-500">No trips found for selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPlaceholder;
