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
  key: 'transportOwner' | 'mineQuarry' | 'royaltyOwner' | 'allIn' | 'bundle' | 'combo';
  label: string;
  field?: keyof Trip;
};

const partyTabs: PartyTab[] = [
  { key: 'mineQuarry', label: 'Mine & Quarry', field: 'quarryName' },
  { key: 'royaltyOwner', label: 'Royalty Owner', field: 'royaltyOwnerName' },
  { key: 'transportOwner', label: 'Transport & Owner', field: 'transporterName' },
  { key: 'bundle', label: 'Rate Bundles' },
  { key: 'combo', label: 'Combo Rates' },
  { key: 'allIn', label: 'All-in Rate' },
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
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [pageIndex, setPageIndex] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<PartyTab['key']>('mineQuarry');
  const [selectedTrips, setSelectedTrips] = useState<Record<string, Set<number>>>({});
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkRateInputs, setBulkRateInputs] = useState<Record<string, string>>({});
  const [bulkModeActive, setBulkModeActive] = useState<Record<string, boolean>>({});
  const [optimisticRates, setOptimisticRates] = useState<MaterialRate[]>([]);
  const [optimisticTripUpdates, setOptimisticTripUpdates] = useState<Record<number, Partial<Trip>>>({});
  const [allInInputs, setAllInInputs] = useState<Record<number, { cost: string; customer: string }>>({});
  const [bundleInputs, setBundleInputs] = useState<Record<number, { mine: string; royalty: string; transport: string }>>({});
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

  const handleFilterChange = (nextFilters: Filters) => {
    setFilters(nextFilters);
  };

  const handleInput = (tabKey: string, tripId: number, value: string) => {
    const mapKey = `${tabKey}-${tripId}`;
    setRateInputs(prev => ({ ...prev, [mapKey]: value }));
  };

  const applyRateForTrip = async (tabKey: PartyTab['key'], trip: Trip, rateValue: string) => {
    if (tabKey === 'allIn') return undefined;
    const partyName = getRatePartyName(trip, tabKey);
    if (!partyName) {
      await alert('Missing Rate Party', 'This trip does not have a rate party name for this tab. Please update the trip first.');
      return undefined;
    }
    const rateNumber = Number(rateValue) || 0;
    const tripDate = String(trip.date || '').split('T')[0];
    const effectiveFrom = tripDate;
    const partyTypeMap: Record<Exclude<PartyTab['key'], 'allIn'>, RatePartyType> = {
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

  const applyComboForTrip = async (trip: Trip) => {
    const input = getComboInput(trip);
    const rateValue = input.rate.trim();
    if (!rateValue) {
      await alert('Missing Rate', 'Enter a rate to apply the selected combination.');
      return;
    }
    const tasks: Promise<MaterialRate | undefined>[] = [];
    if (input.mine && trip.quarryName) tasks.push(applyRateForTrip('mineQuarry', trip, rateValue));
    if (input.royalty && trip.royaltyOwnerName) tasks.push(applyRateForTrip('royaltyOwner', trip, rateValue));
    if (input.transport && trip.transporterName) tasks.push(applyRateForTrip('transportOwner', trip, rateValue));
    if (tasks.length === 0) {
      await alert('No Components Selected', 'Select at least one component (Mine, Royalty, Transport) to apply the rate.');
      return;
    }
    await Promise.all(tasks);
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

  const displayTrips = useMemo(() => {
    if (Object.keys(optimisticTripUpdates).length === 0) return trips;
    return trips.map(trip => ({ ...trip, ...optimisticTripUpdates[trip.id] }));
  }, [trips, optimisticTripUpdates]);

  const filteredTrips = useMemo(() => {
    return displayTrips.filter(trip => {
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
  }, [displayTrips, filters]);

  const partyTypeByTab: Record<string, RatePartyType> = {
    transportOwner: 'transport-owner',
    mineQuarry: 'mine-quarry',
    royaltyOwner: 'royalty-owner',
  };

  const combinedRates = useMemo(() => {
    if (optimisticRates.length === 0) return materialRates;
    return [...optimisticRates, ...materialRates];
  }, [materialRates, optimisticRates]);

  const getApplicableRate = (trip: Trip, tabKey: PartyTab['key']) => {
    const partyType = partyTypeByTab[tabKey];
    if (!partyType) return undefined;
    const tripSpecific = combinedRates.find(rate => rate.tripId === trip.id && rate.ratePartyType === partyType);
    return tripSpecific;
  };

  const bundleAwaitingTrips = useMemo(() => {
    return filteredTrips.filter(trip => {
      const hasMine = Boolean(trip.quarryName);
      const hasRoyalty = Boolean(trip.royaltyOwnerName);
      const hasTransport = Boolean(trip.transporterName);
      if (!hasMine && !hasRoyalty && !hasTransport) return false;
      const mineRate = getApplicableRate(trip, 'mineQuarry');
      const royaltyRate = getApplicableRate(trip, 'royaltyOwner');
      const transportRate = getApplicableRate(trip, 'transportOwner');
      return (hasMine && !mineRate) || (hasRoyalty && !royaltyRate) || (hasTransport && !transportRate);
    });
  }, [filteredTrips, combinedRates]);

  const bundleAppliedTrips = useMemo(() => {
    return filteredTrips.filter(trip => {
      const hasMine = Boolean(trip.quarryName);
      const hasRoyalty = Boolean(trip.royaltyOwnerName);
      const hasTransport = Boolean(trip.transporterName);
      if (!hasMine && !hasRoyalty && !hasTransport) return false;
      const mineRate = getApplicableRate(trip, 'mineQuarry');
      const royaltyRate = getApplicableRate(trip, 'royaltyOwner');
      const transportRate = getApplicableRate(trip, 'transportOwner');
      return (!hasMine || mineRate) && (!hasRoyalty || royaltyRate) && (!hasTransport || transportRate);
    });
  }, [filteredTrips, combinedRates]);

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
      const mineRate = getApplicableRate(trip, 'mineQuarry');
      const royaltyRate = getApplicableRate(trip, 'royaltyOwner');
      const transportRate = getApplicableRate(trip, 'transportOwner');
      return (hasMine && !mineRate) || (hasRoyalty && !royaltyRate) || (hasTransport && !transportRate);
    });
  }, [comboEligibleTrips, combinedRates]);

  const comboAppliedTrips = useMemo(() => {
    return comboEligibleTrips.filter(trip => {
      const hasMine = Boolean(trip.quarryName);
      const hasRoyalty = Boolean(trip.royaltyOwnerName);
      const hasTransport = Boolean(trip.transporterName);
      const mineRate = getApplicableRate(trip, 'mineQuarry');
      const royaltyRate = getApplicableRate(trip, 'royaltyOwner');
      const transportRate = getApplicableRate(trip, 'transportOwner');
      return (!hasMine || mineRate) && (!hasRoyalty || royaltyRate) && (!hasTransport || transportRate);
    });
  }, [comboEligibleTrips, combinedRates]);

  return (
    <div>
      <PageHeader
        title="Trip Rate Ledger"
        filters={filters}
        onFilterChange={handleFilterChange}
        filterData={filterData}
        showFilters={['singleDate', 'vehicle', 'vendor', 'mine', 'material', 'transportOwner', 'royalty']}
        showAddAction={false}
      />
      <div className="space-y-6">
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow-md px-4 py-3 flex flex-wrap gap-2">
          {partyTabs.map(tab => {
            const awaitingCount = tab.key === 'allIn'
              ? filteredTrips.filter(trip => {
                  const mode = trip.rateMode || 'activity';
                  const hasRates = Number(trip.allInCostPerTon || 0) > 0 && Number(trip.customerRatePerTon || 0) > 0;
                  return mode !== 'all_in' || !hasRates;
                }).length
              : tab.key === 'combo'
                ? comboAwaitingTrips.length
                : tab.key === 'bundle'
                  ? bundleAwaitingTrips.length
                  : filteredTrips.filter(trip => !getApplicableRate(trip, tab.key)).length;
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
            const awaitingPage = pageIndex[awaitingKey] || 1;
            const appliedPage = pageIndex[appliedKey] || 1;
            const awaitingSlice = comboAwaitingTrips.slice((awaitingPage - 1) * PAGE_SIZE, awaitingPage * PAGE_SIZE);
            const appliedSlice = comboAppliedTrips.slice((appliedPage - 1) * PAGE_SIZE, appliedPage * PAGE_SIZE);
            const awaitingTotal = comboAwaitingTrips.length;
            const appliedTotal = comboAppliedTrips.length;
            const awaitingStart = awaitingTotal === 0 ? 0 : (awaitingPage - 1) * PAGE_SIZE + 1;
            const awaitingEnd = Math.min(awaitingPage * PAGE_SIZE, awaitingTotal);
            const appliedStart = appliedTotal === 0 ? 0 : (appliedPage - 1) * PAGE_SIZE + 1;
            const appliedEnd = Math.min(appliedPage * PAGE_SIZE, appliedTotal);

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
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Showing {awaitingStart}–{awaitingEnd} of {awaitingTotal}
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
                                      onChange={event => updateComboInput(trip.id, 'rate', event.target.value, input)}
                                      className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                      placeholder="Rate"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      type="button"
                                      onClick={() => applyComboForTrip(trip)}
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
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Showing {appliedStart}–{appliedEnd} of {appliedTotal}
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
                            </tr>
                          </thead>
                          <tbody>
                            {appliedSlice.map((trip, idx) => {
                              const mineRate = getApplicableRate(trip, 'mineQuarry');
                              const royaltyRate = getApplicableRate(trip, 'royaltyOwner');
                              const transportRate = getApplicableRate(trip, 'transportOwner');
                              return (
                                <tr key={trip.id} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="px-3 py-2">{(appliedPage - 1) * PAGE_SIZE + idx + 1}</td>
                                  <td className="px-3 py-2">#{trip.id}</td>
                                  <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                                  <td className="px-3 py-2">{mineRate?.ratePerTon?.toFixed(2) || '-'}</td>
                                  <td className="px-3 py-2">{royaltyRate?.ratePerTon?.toFixed(2) || '-'}</td>
                                  <td className="px-3 py-2">{transportRate?.ratePerTon?.toFixed(2) || '-'}</td>
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
          if (tab.key === 'allIn') {
            const awaitingKey = `${tab.key}-awaiting`;
            const appliedKey = `${tab.key}-applied`;
            const awaitingTrips = filteredTrips.filter(trip => {
              const mode = trip.rateMode || 'activity';
              const hasRates = Number(trip.allInCostPerTon || 0) > 0 && Number(trip.customerRatePerTon || 0) > 0;
              return mode !== 'all_in' || !hasRates;
            });
            const appliedTrips = filteredTrips.filter(trip => {
              const mode = trip.rateMode || 'activity';
              const hasRates = Number(trip.allInCostPerTon || 0) > 0 && Number(trip.customerRatePerTon || 0) > 0;
              return mode === 'all_in' && hasRates;
            });
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

            const handleAllInInput = (tripId: number, field: 'cost' | 'customer', value: string) => {
              setAllInInputs(prev => ({
                ...prev,
                [tripId]: {
                  cost: prev[tripId]?.cost || '',
                  customer: prev[tripId]?.customer || '',
                  [field]: value,
                },
              }));
            };

            const handleAllInApply = async (trip: Trip) => {
              const values = allInInputs[trip.id] || { cost: '', customer: '' };
              const costValue = Number(values.cost || 0);
              const customerValue = Number(values.customer || 0);
              if (!costValue || !customerValue) return;
              const updatedTrip = await tripRateApi.applyAllIn({
                tripId: trip.id,
                allInCostPerTon: costValue,
                customerRatePerTon: customerValue,
              });
              setOptimisticTripUpdates(prev => ({ ...prev, [trip.id]: updatedTrip }));
            };

            return (
              <div key={tab.key} className="space-y-6">
                <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Trips Awaiting All-in Rates
                      <span className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${awaitingTotal > 0 ? 'bg-primary text-white animate-pulse' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                        {awaitingTotal}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
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
                      <div className="px-4 py-12 text-center text-sm text-gray-500">No trips pending all-in rates.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto border-collapse text-sm">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="w-12 px-3 py-2">S.No.</th>
                              <th className="px-3 py-2">Trip #</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Invoice/DC</th>
                              <th className="px-3 py-2">Customer</th>
                              <th className="px-3 py-2">Net Qty</th>
                              <th className="px-3 py-2 w-36">All-in Cost/Ton</th>
                              <th className="px-3 py-2 w-36">Customer Rate/Ton</th>
                              <th className="px-3 py-2">Total Cost</th>
                              <th className="px-3 py-2">Revenue</th>
                              <th className="px-3 py-2">Profit</th>
                              <th className="px-3 py-2">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {awaitingSlice.map((trip, idx) => {
                              const inputs = allInInputs[trip.id] || { cost: '', customer: '' };
                              const netQty = Number(trip.netWeight || 0);
                              const costPerTon = Number(inputs.cost || 0);
                              const customerPerTon = Number(inputs.customer || 0);
                              const totalCost = netQty * costPerTon;
                              const revenue = netQty * customerPerTon;
                              const profit = revenue - totalCost;
                              return (
                                <tr key={trip.id} className="border-b border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                                  <td className="px-3 py-2">{(awaitingPage - 1) * PAGE_SIZE + idx + 1}</td>
                                  <td className="px-3 py-2">#{trip.id}</td>
                                  <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                                  <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                                  <td className="px-3 py-2">{trip.customer || '-'}</td>
                                  <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={inputs.cost}
                                      placeholder="Cost"
                                      onChange={event => handleAllInInput(trip.id, 'cost', event.target.value)}
                                      className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={inputs.customer}
                                      placeholder="Rate"
                                      onChange={event => handleAllInInput(trip.id, 'customer', event.target.value)}
                                      className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                    />
                                  </td>
                                  <td className="px-3 py-2">{totalCost.toFixed(2)}</td>
                                  <td className="px-3 py-2">{revenue.toFixed(2)}</td>
                                  <td className="px-3 py-2">{profit.toFixed(2)}</td>
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={() => handleAllInApply(trip)}
                                      disabled={!costPerTon || !customerPerTon}
                                      className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
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
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">All-in Rates Applied</div>
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
                      <div className="px-4 py-12 text-center text-sm text-gray-500">No all-in rates recorded yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto border-collapse text-sm">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="w-12 px-3 py-2">S.No.</th>
                              <th className="px-3 py-2">Trip #</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Invoice/DC</th>
                              <th className="px-3 py-2">Customer</th>
                              <th className="px-3 py-2">Net Qty</th>
                              <th className="px-3 py-2">All-in Cost/Ton</th>
                              <th className="px-3 py-2">Customer Rate/Ton</th>
                              <th className="px-3 py-2">Total Cost</th>
                              <th className="px-3 py-2">Revenue</th>
                              <th className="px-3 py-2">Profit</th>
                              <th className="px-3 py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {appliedSlice.map((trip, idx) => {
                              const netQty = Number(trip.netWeight || 0);
                              const costPerTon = Number(trip.allInCostPerTon || 0);
                              const customerPerTon = Number(trip.customerRatePerTon || 0);
                              const totalCost = Number(trip.allInCost || 0) || netQty * costPerTon;
                              const revenue = Number(trip.revenue || 0) || netQty * customerPerTon;
                              const profit = revenue - totalCost;
                              return (
                                <tr key={trip.id} className="border-b border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                                  <td className="px-3 py-2">{(appliedPage - 1) * PAGE_SIZE + idx + 1}</td>
                                  <td className="px-3 py-2">#{trip.id}</td>
                                  <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                                  <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                                  <td className="px-3 py-2">{trip.customer || '-'}</td>
                                  <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                                  <td className="px-3 py-2">{costPerTon.toFixed(2)}</td>
                                  <td className="px-3 py-2">{customerPerTon.toFixed(2)}</td>
                                  <td className="px-3 py-2">{totalCost.toFixed(2)}</td>
                                  <td className="px-3 py-2">{revenue.toFixed(2)}</td>
                                  <td className="px-3 py-2">{profit.toFixed(2)}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openModal(`View Trip #${trip.id}`, <SupervisorTripForm mode="view" trip={trip} onClose={closeModal} />)}
                                        className="rounded-md bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                      >
                                        View
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openModal(`Edit Trip #${trip.id}`, <SupervisorTripForm mode="edit" trip={trip} onClose={closeModal} />)}
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
          const activityTrips = filteredTrips.filter(trip => (trip.rateMode || 'activity') !== 'all_in');
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
