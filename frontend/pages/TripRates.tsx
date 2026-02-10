import React, { useMemo, useState, useEffect } from 'react';
import { MaterialRate, RatePartyType, Trip } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { Filters } from '../components/FilterPanel';
import { tripRateApi } from '../services/tripRateApi';
import { formatDateDisplay } from '../utils';

const PAGE_SIZE = 10;

type PartyTab = {
  key: 'transportOwner' | 'mineQuarry' | 'royaltyOwner' | 'combo';
  label: string;
  field?: keyof Trip;
};

const partyTabs: PartyTab[] = [
  { key: 'mineQuarry', label: 'Mine & Quarry', field: 'quarryName' },
  { key: 'royaltyOwner', label: 'Royalty Owner', field: 'royaltyOwnerName' },
  { key: 'transportOwner', label: 'Transport & Owner', field: 'transporterName' },
  { key: 'combo', label: 'Combo Rates' },
];

const getRatePartyName = (trip: Trip, tabKey: PartyTab['key']) => {
  if (tabKey === 'transportOwner') return trip.transporterName;
  if (tabKey === 'mineQuarry') return trip.quarryName;
  if (tabKey === 'royaltyOwner') return trip.royaltyOwnerName;
  return '';
};

type RateDialogProps = {
  mode: 'view' | 'edit';
  tabKey: PartyTab['key'];
  trip: Trip;
  appliedRate: MaterialRate | undefined;
  showMaterialColumn: boolean;
  showLocationColumns: boolean;
  onSave: (rateValue: string) => Promise<void>;
  onClose: () => void;
};

type ComboRateDialogProps = {
  mode: 'view' | 'edit';
  trip: Trip;
  mineRate?: MaterialRate;
  royaltyRate?: MaterialRate;
  transportRate?: MaterialRate;
  onSave: (input: { rate: string; mine: boolean; royalty: boolean; transport: boolean }) => Promise<void>;
  onClose: () => void;
};

const RateDialog: React.FC<RateDialogProps> = ({
  mode,
  tabKey,
  trip,
  appliedRate,
  showMaterialColumn,
  showLocationColumns,
  onSave,
  onClose,
}) => {
  const [rateValue, setRateValue] = useState(
    appliedRate ? String(appliedRate.ratePerTon ?? '') : ''
  );
  const netQty = Number(trip.netWeight || 0);
  const numericRate = Number(rateValue || 0);
  const tripAmount = netQty * (Number.isFinite(numericRate) ? numericRate : 0);
  const ratePartyName = getRatePartyName(trip, tabKey) || '-';

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Trip #</div>
            <div className="text-base font-semibold">#{trip.id}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Date</div>
            <div className="text-base font-semibold">{formatDateDisplay(trip.date)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Invoice/DC</div>
            <div className="text-base font-semibold">{trip.invoiceDCNumber || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Rate Party</div>
            <div className="text-base font-semibold">{ratePartyName}</div>
          </div>
          {showMaterialColumn && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Material Type</div>
              <div className="text-base font-semibold">{trip.material || '-'}</div>
            </div>
          )}
          {showLocationColumns && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Pickup Location</div>
              <div className="text-base font-semibold">{trip.pickupPlace || '-'}</div>
            </div>
          )}
          {showLocationColumns && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Drop-off Location</div>
              <div className="text-base font-semibold">{trip.dropOffPlace || '-'}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Net Quantity</div>
            <div className="text-base font-semibold">{netQty.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Trip Amount</div>
            <div className="text-base font-semibold">{tripAmount.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rate</label>
        {mode === 'edit' ? (
          <input
            type="text"
            inputMode="decimal"
            value={rateValue}
            onChange={event => setRateValue(event.target.value)}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
            placeholder="Enter rate"
          />
        ) : (
          <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {Number.isFinite(numericRate) ? numericRate.toFixed(2) : '0.00'}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          Close
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={() => onSave(rateValue)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
};

const ComboRateDialog: React.FC<ComboRateDialogProps> = ({
  mode,
  trip,
  mineRate,
  royaltyRate,
  transportRate,
  onSave,
  onClose,
}) => {
  const initialRate = mineRate?.ratePerTon ?? royaltyRate?.ratePerTon ?? transportRate?.ratePerTon ?? '';
  const [rateValue, setRateValue] = useState(String(initialRate));
  const [mineChecked, setMineChecked] = useState(Boolean(mineRate));
  const [royaltyChecked, setRoyaltyChecked] = useState(Boolean(royaltyRate));
  const [transportChecked, setTransportChecked] = useState(Boolean(transportRate));

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Trip #</div>
            <div className="text-base font-semibold">#{trip.id}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Date</div>
            <div className="text-base font-semibold">{formatDateDisplay(trip.date)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Invoice/DC</div>
            <div className="text-base font-semibold">{trip.invoiceDCNumber || '-'}</div>
          </div>
          {trip.quarryName && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Mine & Quarry</div>
              <div className="text-base font-semibold">{trip.quarryName}</div>
            </div>
          )}
          {trip.royaltyOwnerName && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Royalty Owner</div>
              <div className="text-base font-semibold">{trip.royaltyOwnerName}</div>
            </div>
          )}
          {trip.transporterName && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Transport Owner</div>
              <div className="text-base font-semibold">{trip.transporterName}</div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rate</label>
            {mode === 'edit' ? (
              <input
                type="text"
                inputMode="decimal"
                value={rateValue}
                onChange={event => setRateValue(event.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800"
              />
            ) : (
              <div className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                {Number(rateValue || 0).toFixed(2)}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-200">
            {trip.quarryName && (
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mineChecked}
                  onChange={event => setMineChecked(event.target.checked)}
                  disabled={mode === 'view'}
                />
                Mine
              </label>
            )}
            {trip.royaltyOwnerName && (
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={royaltyChecked}
                  onChange={event => setRoyaltyChecked(event.target.checked)}
                  disabled={mode === 'view'}
                />
                Royalty
              </label>
            )}
            {trip.transporterName && (
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={transportChecked}
                  onChange={event => setTransportChecked(event.target.checked)}
                  disabled={mode === 'view'}
                />
                Transport
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Close
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={() =>
              onSave({
                rate: rateValue,
                mine: Boolean(trip.quarryName) && mineChecked,
                royalty: Boolean(trip.royaltyOwnerName) && royaltyChecked,
                transport: Boolean(trip.transporterName) && transportChecked,
              })
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
};

const getDefaultDate = () => {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const dateValue = formatDate(today);
  return {
    dateFrom: dateValue,
    dateTo: dateValue,
  };
};

const TripRateLedger: React.FC = () => {
  const {
    trips,
    vehicleMasters,
    vendorCustomers,
    mineQuarries,
    transportOwnerProfiles,
    royaltyOwnerProfiles,
    materialTypeDefinitions,
    materialRates,
    siteLocations,
    loadTrips,
    loadVehicleMasters,
    loadVendorCustomers,
    loadMineQuarries,
    loadTransportOwnerProfiles,
    loadRoyaltyOwnerProfiles,
    loadMaterialTypeDefinitions,
    loadMaterialRates,
    loadSiteLocations,
    refreshKey,
  } = useData();
  const [filters, setFilters] = useState<Filters>(getDefaultDate());
  const [draftFilters, setDraftFilters] = useState<Filters>(getDefaultDate());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [pageIndex, setPageIndex] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<PartyTab['key']>('mineQuarry');
  const [selectedTrips, setSelectedTrips] = useState<Record<string, Set<number>>>({});
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkRateInputs, setBulkRateInputs] = useState<Record<string, string>>({});
  const [bulkModeActive, setBulkModeActive] = useState<Record<string, boolean>>({});
  const [optimisticRates, setOptimisticRates] = useState<MaterialRate[]>([]);
  const [comboInputs, setComboInputs] = useState<Record<number, { rate: string; mine: boolean; royalty: boolean; transport: boolean }>>({});
  const { openModal, closeModal, alert } = useUI();

  useEffect(() => {
    loadTrips();
    loadVehicleMasters();
    loadVendorCustomers();
    loadMineQuarries();
    loadTransportOwnerProfiles();
    loadRoyaltyOwnerProfiles();
    loadMaterialTypeDefinitions();
    loadMaterialRates();
    loadSiteLocations();
  }, [
    loadTrips,
    loadVehicleMasters,
    loadVendorCustomers,
    loadMineQuarries,
    loadTransportOwnerProfiles,
    loadRoyaltyOwnerProfiles,
    loadMaterialTypeDefinitions,
    loadMaterialRates,
    loadSiteLocations,
    refreshKey,
  ]);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (filters.dateFrom && filters.dateTo) return;
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const dateValue = formatDate(today);
    const next = { dateFrom: dateValue, dateTo: dateValue };
    setFilters(next);
    setDraftFilters(next);
  }, [filters.dateFrom, filters.dateTo]);

  const handleFilterChange = (nextFilters: Filters) => {
    setFilters(nextFilters);
  };

  const handleInput = (tabKey: string, tripId: number, value: string) => {
    const mapKey = `${tabKey}-${tripId}`;
    setRateInputs(prev => ({ ...prev, [mapKey]: value }));
  };

  const applyRateForTrip = async (
    tabKey: PartyTab['key'],
    trip: Trip,
    rateValue: string,
    rateSource?: 'combo',
  ) => {
    const partyName = getRatePartyName(trip, tabKey);
    if (!partyName) {
      await alert('Missing Rate Party', 'This trip does not have a rate party name for this tab. Please update the trip first.');
      return undefined;
    }
    const rateNumber = Number(rateValue) || 0;
    const tripDate = String(trip.date || '').split('T')[0];
    const effectiveFrom = tripDate;
    const partyTypeMap: Record<Exclude<PartyTab['key'], 'combo'>, RatePartyType> = {
      transportOwner: 'transport-owner',
      mineQuarry: 'mine-quarry',
      royaltyOwner: 'royalty-owner',
    };
    const createdRate = await tripRateApi.apply({
      tripId: trip.id,
      ratePartyType: partyTypeMap[tabKey],
      ratePerTon: rateNumber,
      effectiveFrom,
      applyScope: 'trip',
      rateSource,
    });
    setOptimisticRates(prev => [createdRate, ...prev]);
    return createdRate;
  };

  const handleApply = async (tabKey: PartyTab['key'], trip: Trip, rateValue: string) => {
    const mapKey = `${tabKey}-${trip.id}`;
    await applyRateForTrip(tabKey, trip, rateValue);
    setRateInputs(prev => {
      const next = { ...prev };
      delete next[mapKey];
      return next;
    });
  };

  const handleEditAppliedRate = async (tabKey: PartyTab['key'], trip: Trip, rateValue: string) => {
    await applyRateForTrip(tabKey, trip, rateValue);
  };

  const getComboInput = (trip: Trip) => {
    const existing = comboInputs[trip.id];
    if (existing) return existing;
    return {
      rate: '',
      mine: Boolean(trip.quarryName),
      royalty: Boolean(trip.royaltyOwnerName),
      transport: Boolean(trip.transporterName),
    };
  };

  const updateComboInput = (
    tripId: number,
    field: 'rate' | 'mine' | 'royalty' | 'transport',
    value: string | boolean,
    baseInput?: { rate: string; mine: boolean; royalty: boolean; transport: boolean },
  ) => {
    setComboInputs(prev => ({
      ...prev,
      [tripId]: {
        rate: '',
        mine: false,
        royalty: false,
        transport: false,
        ...(baseInput || {}),
        ...prev[tripId],
        [field]: value,
      },
    }));
  };

  const applyComboRates = async (
    trip: Trip,
    input: { rate: string; mine: boolean; royalty: boolean; transport: boolean },
  ) => {
    const rateValue = input.rate.trim();
    if (!rateValue) {
      await alert('Missing Rate', 'Enter a rate to apply the selected combination.');
      return false;
    }
    const tasks: Promise<MaterialRate | undefined>[] = [];
    if (input.mine && trip.quarryName) tasks.push(applyRateForTrip('mineQuarry', trip, rateValue, 'combo'));
    if (input.royalty && trip.royaltyOwnerName) tasks.push(applyRateForTrip('royaltyOwner', trip, rateValue, 'combo'));
    if (input.transport && trip.transporterName) tasks.push(applyRateForTrip('transportOwner', trip, rateValue, 'combo'));
    if (tasks.length === 0) {
      await alert('No Components Selected', 'Select at least one component (Mine, Royalty, Transport) to apply the rate.');
      return false;
    }
    await Promise.all(tasks);
    return true;
  };

  const applyComboForTrip = async (trip: Trip) => {
    const input = getComboInput(trip);
    const applied = await applyComboRates(trip, input);
    if (!applied) return;
    setComboInputs(prev => {
      const next = { ...prev };
      delete next[trip.id];
      return next;
    });
  };

  const handlePageChange = (tabSection: string, page: number) => {
    setPageIndex(prev => ({ ...prev, [tabSection]: page }));
  };

  const filterData = useMemo(() => ({
    vehicles: vehicleMasters.map(item => ({ id: item.id, vehicleNumber: item.vehicleNumber })),
    transportOwners: transportOwnerProfiles.map(item => ({ id: item.id, name: item.name })),
    customers: vendorCustomers.map(item => ({ id: item.id, name: item.name })),
    quarries: mineQuarries.map(item => ({ id: item.id, name: item.name })),
    royaltyOwners: royaltyOwnerProfiles.map(item => ({ id: item.id, name: item.name })),
    materials: materialTypeDefinitions.map(item => ({ id: item.id, name: item.name })),
    mineQuarries: mineQuarries.map(item => ({ id: item.id, name: item.name })),
  }), [
    vehicleMasters,
    transportOwnerProfiles,
    vendorCustomers,
    mineQuarries,
    royaltyOwnerProfiles,
    materialTypeDefinitions,
  ]);

  const uniqueVehicles = useMemo(
    () => Array.from(new Set(filterData.vehicles.map(item => item.vehicleNumber))).filter(Boolean),
    [filterData.vehicles],
  );
  const uniqueVendors = useMemo(
    () => Array.from(new Set(filterData.customers.map(item => item.name))).filter(Boolean),
    [filterData.customers],
  );
  const uniqueMines = useMemo(
    () => Array.from(new Set(filterData.mineQuarries.map(item => item.name))).filter(Boolean),
    [filterData.mineQuarries],
  );
  const uniqueMaterials = useMemo(
    () => Array.from(new Set(filterData.materials.map(item => item.name))).filter(Boolean),
    [filterData.materials],
  );
  const uniqueTransportOwners = useMemo(
    () => Array.from(new Set(filterData.transportOwners.map(item => item.name))).filter(Boolean),
    [filterData.transportOwners],
  );
  const uniqueRoyalties = useMemo(
    () => Array.from(new Set(filterData.royaltyOwners.map(item => item.name))).filter(Boolean),
    [filterData.royaltyOwners],
  );

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
        // Ignore non-gesture errors (Safari/Chrome constraint).
      }
    }
  };
  const updateDraft = (key: keyof Filters, value: string) => {
    if (key === 'dateFrom') {
      setDraftFilters(prev => ({ ...prev, dateFrom: value, dateTo: value }));
      return;
    }
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  };
  const applyDraftFilters = () => {
    const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
    if ((draftFilters.dateFrom && !isCompleteDate(draftFilters.dateFrom))
      || (draftFilters.dateTo && !isCompleteDate(draftFilters.dateTo))) {
      return;
    }
    const next = { ...draftFilters };
    if (next.dateFrom) {
      next.dateTo = next.dateFrom;
    }
    handleFilterChange(next);
  };
  const resetDraftFilters = () => {
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const nextDate = formatDate(today);
    const nextFilters = { dateFrom: nextDate, dateTo: nextDate };
    setDraftFilters(nextFilters);
    handleFilterChange(nextFilters);
  };

  const filteredTrips = useMemo(() => {
    const filtered = trips.filter(trip => {
      const tripDate = (trip.date || '').split('T')[0];
      if (filters.dateFrom && tripDate !== filters.dateFrom) return false;
      if (filters.vehicle && trip.vehicleNumber !== filters.vehicle) return false;
      if (filters.vendor && trip.customer !== filters.vendor) return false;
      if (filters.transportOwner && trip.transporterName !== filters.transportOwner) return false;
      if (filters.mine && trip.quarryName !== filters.mine) return false;
      if (filters.material && trip.material !== filters.material) return false;
      if (filters.royalty && trip.royaltyOwnerName !== filters.royalty) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id - b.id;
    });
  }, [trips, filters]);

  const partyTypeByTab: Record<string, RatePartyType> = {
    transportOwner: 'transport-owner',
    mineQuarry: 'mine-quarry',
    royaltyOwner: 'royalty-owner',
  };

  const combinedRates = useMemo(() => {
    if (optimisticRates.length === 0) return materialRates;
    return [...optimisticRates, ...materialRates];
  }, [materialRates, optimisticRates]);

  const isComboRate = (rate: MaterialRate) => {
    const remarks = String(rate.remarks || '').toLowerCase();
    return remarks.includes('combo rate');
  };

  const getApplicableRate = (trip: Trip, tabKey: PartyTab['key']) => {
    const partyType = partyTypeByTab[tabKey];
    if (!partyType) return undefined;
    const tripSpecific = combinedRates.find(rate => rate.tripId === trip.id && rate.ratePartyType === partyType);
    return tripSpecific;
  };

  const hasComboRateForTab = (trip: Trip, tabKey: PartyTab['key']) => {
    const partyType = partyTypeByTab[tabKey];
    if (!partyType) return false;
    return combinedRates.some(rate => rate.tripId === trip.id && rate.ratePartyType === partyType && isComboRate(rate));
  };

  const getComboRate = (trip: Trip, tabKey: PartyTab['key']) => {
    const partyType = partyTypeByTab[tabKey];
    if (!partyType) return undefined;
    return combinedRates.find(rate =>
      rate.tripId === trip.id && rate.ratePartyType === partyType && isComboRate(rate)
    );
  };


  const comboEligibleTrips = useMemo(() => {
    return filteredTrips.filter(trip => {
      return Boolean(trip.quarryName) || Boolean(trip.royaltyOwnerName) || Boolean(trip.transporterName);
    });
  }, [filteredTrips]);

  const comboAwaitingTrips = useMemo(() => {
    return comboEligibleTrips.filter(trip => {
      const hasMine = Boolean(trip.quarryName);
      const hasRoyalty = Boolean(trip.royaltyOwnerName);
      const hasTransport = Boolean(trip.transporterName);
      const hasCombo = hasComboRateForTab(trip, 'mineQuarry')
        || hasComboRateForTab(trip, 'royaltyOwner')
        || hasComboRateForTab(trip, 'transportOwner');
      if (hasCombo) return false;
      const hasAnyRate = (type: RatePartyType) =>
        combinedRates.some(rate => rate.tripId === trip.id && rate.ratePartyType === type);
      if (hasMine && hasAnyRate('mine-quarry')) return false;
      if (hasRoyalty && hasAnyRate('royalty-owner')) return false;
      if (hasTransport && hasAnyRate('transport-owner')) return false;
      return true;
    });
  }, [comboEligibleTrips, combinedRates]);

  const comboAppliedTrips = useMemo(() => {
    return comboEligibleTrips.filter(trip => {
      return hasComboRateForTab(trip, 'mineQuarry')
        || hasComboRateForTab(trip, 'royaltyOwner')
        || hasComboRateForTab(trip, 'transportOwner');
    });
  }, [comboEligibleTrips, combinedRates]);

  return (
    <div>
      <PageHeader
        title="Trip Rate Ledger"
        filters={filters}
        onFilterChange={handleFilterChange}
        filterData={filterData}
        showFilters={[]}
        showMoreFilters={[]}
        showAddAction={false}
        headerRight={(
          <div className="rounded-xl border border-gray-200/60 bg-white/90 dark:bg-gray-900/70 dark:border-gray-700/60 shadow-md px-3 py-2">
            {filtersOpen ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Date</label>
                    <input
                      type="date"
                      inputMode="numeric"
                      onKeyDown={allowDateTyping}
                      onClick={openDatePicker}
                      className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.dateFrom || ''}
                      onChange={e => updateDraft('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Vehicle</label>
                    <select
                      className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.vehicle || ''}
                      onChange={e => updateDraft('vehicle', e.target.value)}
                    >
                      <option value="">All Vehicles</option>
                      {uniqueVehicles.map(vehicle => (
                        <option key={`triprate-vehicle-${vehicle}`} value={vehicle}>
                          {vehicle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Vendor & Customer</label>
                    <select
                      className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.vendor || ''}
                      onChange={e => updateDraft('vendor', e.target.value)}
                    >
                      <option value="">All Vendors</option>
                      {uniqueVendors.map(vendor => (
                        <option key={`triprate-vendor-${vendor}`} value={vendor}>
                          {vendor}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Material</label>
                    <select
                      className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.material || ''}
                      onChange={e => updateDraft('material', e.target.value)}
                    >
                      <option value="">All Materials</option>
                      {uniqueMaterials.map(material => (
                        <option key={`triprate-material-${material}`} value={material}>
                          {material}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Mine & Quarry</label>
                    <select
                      className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.mine || ''}
                      onChange={e => updateDraft('mine', e.target.value)}
                    >
                      <option value="">All Mines/Quarries</option>
                      {uniqueMines.map(mine => (
                        <option key={`triprate-mine-${mine}`} value={mine}>
                          {mine}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Transport & Owner</label>
                    <select
                      className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.transportOwner || ''}
                      onChange={e => updateDraft('transportOwner', e.target.value)}
                    >
                      <option value="">All Transport Owners</option>
                      {uniqueTransportOwners.map(owner => (
                        <option key={`triprate-transport-${owner}`} value={owner}>
                          {owner}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Royalty</label>
                    <select
                      className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.royalty || ''}
                      onChange={e => updateDraft('royalty', e.target.value)}
                    >
                      <option value="">All Royalty</option>
                      {uniqueRoyalties.map(owner => (
                        <option key={`triprate-royalty-${owner}`} value={owner}>
                          {owner}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={applyDraftFilters}
                      className="h-8 px-3 rounded-md text-xs font-medium text-white bg-primary hover:bg-primary-dark"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={resetDraftFilters}
                      className="h-8 px-3 rounded-md text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="h-8 px-3 rounded-md text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Hide
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <ion-icon name="chevron-down-outline"></ion-icon>
                  Show Filters
                </button>
              </div>
            )}
          </div>
        )}
      />
      <div className="space-y-6">
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow-md px-4 py-3 flex flex-wrap gap-2 sticky top-20 z-30">
          {partyTabs.map(tab => {
            const awaitingCount = tab.key === 'combo'
                ? comboAwaitingTrips.length
              : filteredTrips.filter(trip => {
                  if ((trip.rateMode || 'activity') === 'all_in') return false;
                  if (hasComboRateForTab(trip, tab.key)) return false;
                  return !getApplicableRate(trip, tab.key);
                }).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${activeTab === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
              >
                <span>{tab.label}</span>
                <span className={`inline-flex items-center justify-center min-w-[20px] px-2 py-0.5 rounded-full text-xs font-semibold ${awaitingCount > 0 ? 'bg-white/20 text-white animate-pulse' : 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
                  }`}>
                  {awaitingCount}
                </span>
              </button>
            );
          })}
        </div>
        {partyTabs.filter(tab => tab.key === activeTab).map(tab => {
          if (tab.key === 'combo') {
            const awaitingKey = `${tab.key}-awaiting`;
            const appliedKey = `${tab.key}-applied`;
            const awaitingTrips = comboAwaitingTrips;
            const appliedTrips = comboAppliedTrips;
            const awaitingPage = pageIndex[awaitingKey] || 1;
            const appliedPage = pageIndex[appliedKey] || 1;
            const awaitingSlice = awaitingTrips.slice((awaitingPage - 1) * PAGE_SIZE, awaitingPage * PAGE_SIZE);
            const appliedSlice = appliedTrips.slice((appliedPage - 1) * PAGE_SIZE, appliedPage * PAGE_SIZE);
            const awaitingTotal = awaitingTrips.length;
            const appliedTotal = appliedTrips.length;
            const awaitingStart = awaitingTotal === 0 ? 0 : (awaitingPage - 1) * PAGE_SIZE + 1;
            const awaitingEnd = Math.min(awaitingPage * PAGE_SIZE, awaitingTotal);
            const appliedStart = appliedTotal === 0 ? 0 : (appliedPage - 1) * PAGE_SIZE + 1;
            const appliedEnd = Math.min(appliedPage * PAGE_SIZE, appliedTotal);
            const selectedSet = selectedTrips[tab.key] || new Set<number>();
            const allSelected = awaitingSlice.length > 0 && awaitingSlice.every(trip => selectedSet.has(trip.id));
            const toggleSelectAll = () => {
              setSelectedTrips(prev => {
                const next = new Set(prev[tab.key] || []);
                if (allSelected) {
                  awaitingSlice.forEach(trip => next.delete(trip.id));
                } else {
                  awaitingSlice.forEach(trip => next.add(trip.id));
                }
                return { ...prev, [tab.key]: next };
              });
            };
            const toggleSelect = (tripId: number) => {
              setSelectedTrips(prev => {
                const next = new Set(prev[tab.key] || []);
                if (next.has(tripId)) {
                  next.delete(tripId);
                } else {
                  next.add(tripId);
                }
                return { ...prev, [tab.key]: next };
              });
            };
            const bulkRateValue = bulkRateInputs[tab.key] || '';
            const handleComboFillSelected = () => {
              if (!bulkRateValue) return;
              const missingRates = awaitingSlice.filter(trip => {
                const input = getComboInput(trip);
                return !input.rate;
              });
              if (missingRates.length === 0) return;
              if (missingRates.length === awaitingSlice.length) {
                setComboInputs(prev => {
                  const next = { ...prev };
                  awaitingSlice.forEach(trip => {
                    const base = getComboInput(trip);
                    next[trip.id] = { ...base, rate: bulkRateValue };
                  });
                  return next;
                });
                return;
              }
              openModal('Fill missing rates', (
                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    {missingRates.length} selected trip(s) do not have a rate yet. Fill them with the bulk rate?
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setComboInputs(prev => {
                          const next = { ...prev };
                          missingRates.forEach(trip => {
                            const base = getComboInput(trip);
                            next[trip.id] = { ...base, rate: bulkRateValue };
                          });
                          return next;
                        });
                        closeModal();
                      }}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none"
                    >
                      Fill Missing With Bulk Rate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTrips(prev => {
                          const next = new Set(prev[tab.key] || []);
                          missingRates.forEach(trip => next.delete(trip.id));
                          return { ...prev, [tab.key]: next };
                        });
                        closeModal();
                      }}
                      className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                    >
                      Uncheck Missing
                    </button>
                  </div>
                </div>
              ));
            };
            const handleComboBulkApply = async () => {
              const selectedTripsList = awaitingTrips.filter(trip => selectedSet.has(trip.id));
              if (selectedTripsList.length === 0) return;
              if (!bulkRateValue.trim()) {
                await alert('Missing Rate', 'Enter a bulk rate before applying to selected trips.');
                return;
              }
              const missingRates = selectedTripsList.filter(trip => {
                const input = getComboInput(trip);
                return !input.rate.trim();
              });
              if (missingRates.length > 0) {
                openModal('Missing rates', (
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      {missingRates.length} selected trip(s) do not have a rate yet. Fill them with the bulk rate?
                    </p>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setComboInputs(prev => {
                            const next = { ...prev };
                            missingRates.forEach(trip => {
                              const base = getComboInput(trip);
                              next[trip.id] = { ...base, rate: bulkRateValue };
                            });
                            return next;
                          });
                          closeModal();
                        }}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none"
                      >
                        Fill Missing With Bulk Rate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTrips(prev => {
                            const next = new Set(prev[tab.key] || []);
                            missingRates.forEach(trip => next.delete(trip.id));
                            return { ...prev, [tab.key]: next };
                          });
                          closeModal();
                        }}
                        className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                      >
                        Uncheck Missing
                      </button>
                    </div>
                  </div>
                ));
                return;
              }
              const missingComponents = selectedTripsList.filter(trip => {
                const input = getComboInput(trip);
                return !(
                  (input.mine && trip.quarryName)
                  || (input.royalty && trip.royaltyOwnerName)
                  || (input.transport && trip.transporterName)
                );
              });
              if (missingComponents.length > 0) {
                openModal('Missing components', (
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      {missingComponents.length} selected trip(s) do not have any components selected. Select Mine, Royalty, or Transport before applying.
                    </p>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTrips(prev => {
                            const next = new Set(prev[tab.key] || []);
                            missingComponents.forEach(trip => next.delete(trip.id));
                            return { ...prev, [tab.key]: next };
                          });
                          closeModal();
                        }}
                        className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                      >
                        Uncheck Missing
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ));
                return;
              }
              setBulkApplying(true);
              try {
                await Promise.all(selectedTripsList.map(trip => {
                  const base = getComboInput(trip);
                  const input = { ...base, rate: base.rate.trim() || bulkRateValue.trim() };
                  return applyComboRates(trip, input);
                }));
                setSelectedTrips(prev => ({ ...prev, [tab.key]: new Set() }));
                setBulkModeActive(active => ({ ...active, [tab.key]: false }));
                setBulkRateInputs(prev => ({ ...prev, [tab.key]: '' }));
                setComboInputs(prev => {
                  const next = { ...prev };
                  selectedTripsList.forEach(trip => {
                    delete next[trip.id];
                  });
                  return next;
                });
              } finally {
                setBulkApplying(false);
              }
            };

            return (
              <div key={tab.key} className="space-y-6">
                <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Trips Awaiting Combo Rates
                      <span className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${awaitingTotal > 0 ? 'bg-primary text-white animate-pulse' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                        {awaitingTotal}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Bulk rate"
                          value={bulkRateValue}
                          onChange={event => setBulkRateInputs(prev => ({ ...prev, [tab.key]: event.target.value }))}
                          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                        />
                        <button
                          type="button"
                          onClick={handleComboFillSelected}
                          disabled={selectedSet.size === 0}
                          className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                        >
                          Fill Selected
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleComboBulkApply}
                        disabled={selectedSet.size === 0 || bulkApplying}
                        className={`rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50 ${bulkModeActive[tab.key] && selectedSet.size > 0 ? 'ring-2 ring-primary ring-offset-1 ring-offset-transparent' : ''}`}
                      >
                        {bulkApplying ? 'Applying...' : 'Apply Selected'}
                      </button>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Showing {awaitingStart}–{awaitingEnd} of {awaitingTotal}
                      </div>
                      <Pagination
                        currentPage={awaitingPage}
                        totalPages={Math.max(1, Math.ceil(awaitingTotal / PAGE_SIZE))}
                        onPageChange={page => handlePageChange(awaitingKey, page)}
                        totalItems={awaitingTotal}
                        pageSize={PAGE_SIZE}
                      />
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {awaitingSlice.length === 0 ? (
                      <div className="px-4 py-12 text-center text-sm text-gray-500">No trips pending combo rates.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto border-collapse text-sm">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="w-12 px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                                  <span>Select</span>
                                </div>
                              </th>
                              <th className="w-12 px-3 py-2">S.No.</th>
                              <th className="px-3 py-2">Trip #</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Rate Party</th>
                              <th className="px-3 py-2">Net Qty</th>
                              <th className="px-3 py-2">Apply To</th>
                              <th className="px-3 py-2">Rate</th>
                              <th className="px-3 py-2">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {awaitingSlice.map((trip, idx) => {
                              const input = getComboInput(trip);
                              const ratePartyName = trip.quarryName || trip.royaltyOwnerName || trip.transporterName || '-';
                              return (
                                <tr key={trip.id} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="px-3 py-2">
                                    <input type="checkbox" checked={selectedSet.has(trip.id)} onChange={() => toggleSelect(trip.id)} />
                                  </td>
                                  <td className="px-3 py-2">{(awaitingPage - 1) * PAGE_SIZE + idx + 1}</td>
                                  <td className="px-3 py-2">#{trip.id}</td>
                                  <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                                  <td className="px-3 py-2">{ratePartyName}</td>
                                  <td className="px-3 py-2">{Number(trip.netWeight || 0).toFixed(2)}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-2">
                                      {trip.quarryName && (
                                        <label className="inline-flex items-center gap-1 text-xs">
                                          <input
                                            type="checkbox"
                                            checked={input.mine}
                                            onChange={event => updateComboInput(trip.id, 'mine', event.target.checked, input)}
                                          />
                                          Mine
                                        </label>
                                      )}
                                      {trip.royaltyOwnerName && (
                                        <label className="inline-flex items-center gap-1 text-xs">
                                          <input
                                            type="checkbox"
                                            checked={input.royalty}
                                            onChange={event => updateComboInput(trip.id, 'royalty', event.target.checked, input)}
                                          />
                                          Royalty
                                        </label>
                                      )}
                                      {trip.transporterName && (
                                        <label className="inline-flex items-center gap-1 text-xs">
                                          <input
                                            type="checkbox"
                                            checked={input.transport}
                                            onChange={event => updateComboInput(trip.id, 'transport', event.target.checked, input)}
                                          />
                                          Transport
                                        </label>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={input.rate}
                                      placeholder="Rate"
                                      onChange={event => updateComboInput(trip.id, 'rate', event.target.value, input)}
                                      className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => applyComboForTrip(trip)}
                                      disabled={bulkModeActive[tab.key] && selectedSet.has(trip.id)}
                                      className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
                                    >
                                      Apply Combo
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Combo Rates Applied</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Showing {appliedStart}–{appliedEnd} of {appliedTotal}
                      </div>
                      <Pagination
                        currentPage={appliedPage}
                        totalPages={Math.max(1, Math.ceil(appliedTotal / PAGE_SIZE))}
                        onPageChange={page => handlePageChange(appliedKey, page)}
                        totalItems={appliedTotal}
                        pageSize={PAGE_SIZE}
                      />
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    {appliedSlice.length === 0 ? (
                      <div className="px-4 py-12 text-center text-sm text-gray-500">No combo rates applied yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto border-collapse text-sm">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="w-12 px-3 py-2">S.No.</th>
                              <th className="px-3 py-2">Trip #</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Mine Rate</th>
                              <th className="px-3 py-2">Royalty Rate</th>
                              <th className="px-3 py-2">Transport Rate</th>
                              <th className="px-3 py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {appliedSlice.map((trip, idx) => {
                              const mineRate = getComboRate(trip, 'mineQuarry');
                              const royaltyRate = getComboRate(trip, 'royaltyOwner');
                              const transportRate = getComboRate(trip, 'transportOwner');
                              return (
                                <tr key={trip.id} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="px-3 py-2">{(appliedPage - 1) * PAGE_SIZE + idx + 1}</td>
                                  <td className="px-3 py-2">#{trip.id}</td>
                                  <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                                  <td className="px-3 py-2">{mineRate?.ratePerTon?.toFixed(2) || '-'}</td>
                                  <td className="px-3 py-2">{royaltyRate?.ratePerTon?.toFixed(2) || '-'}</td>
                                  <td className="px-3 py-2">{transportRate?.ratePerTon?.toFixed(2) || '-'}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openModal(
                                            `Combo Rate Details #${trip.id}`,
                                            <ComboRateDialog
                                              mode="view"
                                              trip={trip}
                                              mineRate={mineRate}
                                              royaltyRate={royaltyRate}
                                              transportRate={transportRate}
                                              onSave={async () => {}}
                                              onClose={closeModal}
                                            />
                                          )
                                        }
                                        className="rounded-md bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                      >
                                        View
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openModal(
                                            `Edit Combo Rate #${trip.id}`,
                                            <ComboRateDialog
                                              mode="edit"
                                              trip={trip}
                                              mineRate={mineRate}
                                              royaltyRate={royaltyRate}
                                              transportRate={transportRate}
                                              onSave={async (input) => {
                                                await applyComboRates(trip, input);
                                                closeModal();
                                              }}
                                              onClose={closeModal}
                                            />
                                          )
                                        }
                                        className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }
          const awaitingKey = `${tab.key}-awaiting`;
          const appliedKey = `${tab.key}-applied`;
          const activityTrips = filteredTrips.filter(trip => {
            if ((trip.rateMode || 'activity') === 'all_in') return false;
            return !hasComboRateForTab(trip, tab.key);
          });
          const isApplied = (trip: Trip) => Boolean(getApplicableRate(trip, tab.key));
          const awaitingTrips = activityTrips.filter(trip => !isApplied(trip));
          const appliedTrips = activityTrips.filter(trip => isApplied(trip));
          const awaitingPage = pageIndex[awaitingKey] || 1;
          const appliedPage = pageIndex[appliedKey] || 1;
          const awaitingSlice = awaitingTrips.slice((awaitingPage - 1) * PAGE_SIZE, awaitingPage * PAGE_SIZE);
          const appliedSlice = appliedTrips.slice((appliedPage - 1) * PAGE_SIZE, appliedPage * PAGE_SIZE);
          const awaitingCount = awaitingTrips.length;
          const awaitingTotal = awaitingTrips.length;
          const appliedTotal = appliedTrips.length;
          const awaitingStart = awaitingTotal === 0 ? 0 : (awaitingPage - 1) * PAGE_SIZE + 1;
          const awaitingEnd = Math.min(awaitingPage * PAGE_SIZE, awaitingTotal);
          const appliedStart = appliedTotal === 0 ? 0 : (appliedPage - 1) * PAGE_SIZE + 1;
          const appliedEnd = Math.min(appliedPage * PAGE_SIZE, appliedTotal);
          const showMaterialColumn = tab.key === 'mineQuarry';
          const showLocationColumns = tab.key === 'transportOwner';
          const selectedSet = selectedTrips[tab.key] || new Set<number>();
          const bulkRateValue = bulkRateInputs[tab.key] || '';
          const allSelected = awaitingSlice.length > 0 && awaitingSlice.every(trip => selectedSet.has(trip.id));

          const toggleSelect = (tripId: number) => {
            setSelectedTrips(prev => {
              const next = new Set(prev[tab.key] || []);
              if (next.has(tripId)) {
                next.delete(tripId);
              } else {
                next.add(tripId);
              }
              if (next.size === 0) {
                setBulkModeActive(active => ({ ...active, [tab.key]: false }));
              }
              return { ...prev, [tab.key]: next };
            });
          };

          const toggleSelectAll = () => {
            setSelectedTrips(prev => {
              const next = new Set(prev[tab.key] || []);
              if (allSelected) {
                awaitingSlice.forEach(trip => next.delete(trip.id));
              } else {
                awaitingSlice.forEach(trip => next.add(trip.id));
              }
              if (next.size === 0) {
                setBulkModeActive(active => ({ ...active, [tab.key]: false }));
              }
              return { ...prev, [tab.key]: next };
            });
          };

          const handleBulkApply = async () => {
            if (bulkApplying) return;
            const selectedTripsList = awaitingTrips.filter(trip => selectedSet.has(trip.id));
            if (selectedTripsList.length === 0) return;
            const missingRates = selectedTripsList.filter(trip => {
              const mapKey = `${tab.key}-${trip.id}`;
              return !rateInputs[mapKey] || rateInputs[mapKey].trim() === '';
            });
            if (missingRates.length > 0) {
              openModal('Missing rates', (
                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    {missingRates.length} selected trip(s) do not have a rate yet. You can fill them with the bulk rate or uncheck them.
                  </p>
                  <div className="flex justify-end gap-3">
                    {bulkRateValue.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setRateInputs(prev => {
                            const next = { ...prev };
                            missingRates.forEach(trip => {
                              next[`${tab.key}-${trip.id}`] = bulkRateValue;
                            });
                            return next;
                          });
                          closeModal();
                        }}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none"
                      >
                        Fill Missing With Bulk Rate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTrips(prev => {
                          const next = new Set(prev[tab.key] || []);
                          missingRates.forEach(trip => next.delete(trip.id));
                          return { ...prev, [tab.key]: next };
                        });
                        closeModal();
                      }}
                      className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                    >
                      Uncheck Missing
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ));
              return;
            }
            setBulkApplying(true);
            try {
              await Promise.all(selectedTripsList.map(trip => applyRateForTrip(tab.key, trip, rateInputs[`${tab.key}-${trip.id}`])));
              setSelectedTrips(prev => ({ ...prev, [tab.key]: new Set() }));
              setBulkModeActive(active => ({ ...active, [tab.key]: false }));
              setBulkRateInputs(prev => ({ ...prev, [tab.key]: '' }));
              setRateInputs(prev => {
                const next = { ...prev };
                selectedTripsList.forEach(trip => {
                  delete next[`${tab.key}-${trip.id}`];
                });
                return next;
              });
            } finally {
              setBulkApplying(false);
            }
          };

          const handleFillSelected = () => {
            if (!bulkRateValue.trim()) {
              openModal('Bulk rate missing', (
                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-700 dark:text-gray-200">Enter a bulk rate before filling selected trips.</p>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none"
                    >
                      Okay
                    </button>
                  </div>
                </div>
              ));
              return;
            }
            setRateInputs(prev => {
              const next = { ...prev };
              selectedSet.forEach(tripId => {
                next[`${tab.key}-${tripId}`] = bulkRateValue;
              });
              return next;
            });
            setBulkModeActive(active => ({ ...active, [tab.key]: true }));
          };

          return (
            <div key={tab.key} className="space-y-6">
              <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Trips Awaiting Rates
                    <span className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${awaitingCount > 0 ? 'bg-primary text-white animate-pulse' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                      {awaitingCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Bulk rate"
                        value={bulkRateValue}
                        onChange={event => setBulkRateInputs(prev => ({ ...prev, [tab.key]: event.target.value }))}
                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                      />
                      <button
                        type="button"
                        onClick={handleFillSelected}
                        disabled={selectedSet.size === 0}
                        className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                      >
                        Fill Selected
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleBulkApply}
                      disabled={selectedSet.size === 0 || bulkApplying}
                      className={`rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50 ${bulkModeActive[tab.key] && selectedSet.size > 0 ? 'ring-2 ring-primary ring-offset-1 ring-offset-transparent' : ''}`}
                    >
                      {bulkApplying ? 'Applying...' : 'Apply Selected'}
                    </button>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Showing {awaitingStart}–{awaitingEnd} of {awaitingTotal}
                    </div>
                    <Pagination
                      currentPage={awaitingPage}
                      totalPages={Math.max(1, Math.ceil(awaitingTrips.length / PAGE_SIZE))}
                      onPageChange={page => handlePageChange(awaitingKey, page)}
                      totalItems={awaitingTrips.length}
                      pageSize={PAGE_SIZE}
                    />
                  </div>
                </div>
                <div className="px-6 py-4">
                  {awaitingSlice.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-gray-500">No trips pending rate entry.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto border-collapse text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="w-12 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                                <span>Select</span>
                              </div>
                            </th>
                            <th className="w-12 px-3 py-2">S.No.</th>
                            <th className="px-3 py-2">Trip #</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Invoice/DC</th>
                            <th className="px-3 py-2">Rate Party Name</th>
                            {showMaterialColumn && <th className="px-3 py-2">Material Type</th>}
                            {showLocationColumns && <th className="px-3 py-2">Pickup Location</th>}
                            {showLocationColumns && <th className="px-3 py-2">Drop-off Location</th>}
                            <th className="px-3 py-2">Net Quantity</th>
                            <th className="px-3 py-2 w-32">Rate</th>
                            <th className="px-3 py-2">Trip Amount</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {awaitingSlice.map((trip, idx) => {
                            const mapKey = `${tab.key}-${trip.id}`;
                            const rateValue = rateInputs[mapKey] || '';
                            const netQty = Number(trip.netWeight || 0);
                            const amount = netQty * (Number(rateValue) || 0);
                            return (
                              <tr key={trip.id} className="border-b border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                                <td className="px-3 py-2">
                                  <input type="checkbox" checked={selectedSet.has(trip.id)} onChange={() => toggleSelect(trip.id)} />
                                </td>
                                <td className="px-3 py-2">{(awaitingPage - 1) * PAGE_SIZE + idx + 1}</td>
                                <td className="px-3 py-2">#{trip.id}</td>
                                <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                                <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                                <td className="px-3 py-2">{getRatePartyName(trip, tab.key) || '-'}</td>
                                {showMaterialColumn && <td className="px-3 py-2">{trip.material || '-'}</td>}
                                {showLocationColumns && <td className="px-3 py-2">{trip.pickupPlace || '-'}</td>}
                                {showLocationColumns && <td className="px-3 py-2">{trip.dropOffPlace || '-'}</td>}
                                <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={rateValue}
                                    placeholder="Rate"
                                    onChange={event => handleInput(tab.key, trip.id, event.target.value)}
                                    className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                  />
                                </td>
                                <td className="px-3 py-2">{amount.toFixed(2)}</td>
                                <td className="px-3 py-2">
                                  <button
                                    onClick={() => handleApply(tab.key, trip, rateValue)}
                                    className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                                    disabled={rateValue.trim() === '' || (bulkModeActive[tab.key] && selectedSet.has(trip.id))}
                                  >
                                    Apply Rate
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rates Applied</div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Showing {appliedStart}–{appliedEnd} of {appliedTotal}
                    </div>
                    <Pagination
                      currentPage={appliedPage}
                      totalPages={Math.max(1, Math.ceil(appliedTrips.length / PAGE_SIZE))}
                      onPageChange={page => handlePageChange(appliedKey, page)}
                      totalItems={appliedTrips.length}
                      pageSize={PAGE_SIZE}
                    />
                  </div>
                </div>
                <div className="px-6 py-4">
                  {appliedSlice.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-gray-500">No rates recorded yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed border-collapse text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="w-12 px-3 py-2">S.No.</th>
                            <th className="px-3 py-2">Trip #</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Invoice/DC</th>
                            <th className="px-3 py-2">Rate Party Name</th>
                            {showMaterialColumn && <th className="px-3 py-2">Material Type</th>}
                            {showLocationColumns && <th className="px-3 py-2">Pickup Location</th>}
                            {showLocationColumns && <th className="px-3 py-2">Drop-off Location</th>}
                            <th className="px-3 py-2">Net Quantity</th>
                            <th className="px-3 py-2">Rate</th>
                            <th className="px-3 py-2">Trip Amount</th>
                            <th className="px-3 py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appliedSlice.map((trip, idx) => {
                            const appliedRate = getApplicableRate(trip, tab.key);
                            const rateValue = appliedRate ? Number(appliedRate.ratePerTon || 0) : 0;
                            const netQty = Number(trip.netWeight || 0);
                            const amount = netQty * rateValue;
                            return (
                              <tr key={trip.id} className="border-b border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                                <td className="px-3 py-2">{(appliedPage - 1) * PAGE_SIZE + idx + 1}</td>
                                <td className="px-3 py-2">#{trip.id}</td>
                                <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                                <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                                <td className="px-3 py-2">{trip[tab.field as keyof typeof trip] || '-'}</td>
                                {showMaterialColumn && <td className="px-3 py-2">{trip.material || '-'}</td>}
                                {showLocationColumns && <td className="px-3 py-2">{trip.pickupPlace || '-'}</td>}
                                {showLocationColumns && <td className="px-3 py-2">{trip.dropOffPlace || '-'}</td>}
                                <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                                <td className="px-3 py-2">{rateValue.toFixed(2)}</td>
                                <td className="px-3 py-2">{amount.toFixed(2)}</td>
                                <td className="px-3 py-2">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openModal(
                                        `Rate Details #${trip.id}`,
                                        <RateDialog
                                          mode="view"
                                          tabKey={tab.key}
                                          trip={trip}
                                          appliedRate={appliedRate}
                                          showMaterialColumn={showMaterialColumn}
                                          showLocationColumns={showLocationColumns}
                                          onSave={async () => {}}
                                          onClose={closeModal}
                                        />
                                      )}
                                      className="rounded-md bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                    >
                                      View
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openModal(
                                        `Edit Rate #${trip.id}`,
                                        <RateDialog
                                          mode="edit"
                                          tabKey={tab.key}
                                          trip={trip}
                                          appliedRate={appliedRate}
                                          showMaterialColumn={showMaterialColumn}
                                          showLocationColumns={showLocationColumns}
                                          onSave={async (rateValue) => {
                                            await handleEditAppliedRate(tab.key, trip, rateValue);
                                            closeModal();
                                          }}
                                          onClose={closeModal}
                                        />
                                      )}
                                      className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TripRateLedger;
