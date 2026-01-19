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
  key: 'vendorCustomer' | 'transportOwner' | 'mineQuarry' | 'royaltyOwner';
  label: string;
  field: keyof Trip;
};

const partyTabs: PartyTab[] = [
  { key: 'mineQuarry', label: 'Mine & Quarry Name', field: 'quarryName' },
  { key: 'royaltyOwner', label: 'Royalty Owner Name', field: 'royaltyOwnerName' },
  { key: 'transportOwner', label: 'Transport & Owner Name', field: 'transporterName' },
  { key: 'vendorCustomer', label: 'Vendor & Customer Name', field: 'customer' },
];

const getMtdRange = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return {
    dateFrom: formatDate(startOfMonth),
    dateTo: formatDate(today),
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
  const [filters, setFilters] = useState<Filters>(getMtdRange());
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [pageIndex, setPageIndex] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<PartyTab['key']>('vendorCustomer');
  const [rateScopes, setRateScopes] = useState<Record<string, 'trip' | 'range'>>({});
  const [rateDates, setRateDates] = useState<Record<string, { from: string; to: string }>>({});
  const [selectedTrips, setSelectedTrips] = useState<Record<string, Set<number>>>({});
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkRateInputs, setBulkRateInputs] = useState<Record<string, string>>({});
  const [bulkModeActive, setBulkModeActive] = useState<Record<string, boolean>>({});
  const [optimisticRates, setOptimisticRates] = useState<MaterialRate[]>([]);
  const { openModal, closeModal } = useUI();

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

  const handleInput = (tabKey: string, tripId: number, value: string) => {
    const mapKey = `${tabKey}-${tripId}`;
    setRateInputs(prev => ({ ...prev, [mapKey]: value }));
  };

  const applyRateForTrip = async (tabKey: PartyTab['key'], trip: Trip, rateValue: string) => {
    const mapKey = `${tabKey}-${trip.id}`;
    const rateNumber = Number(rateValue) || 0;
    const scope = rateScopes[mapKey] || 'trip';
    const tripDate = String(trip.date || '').split('T')[0];
    const dates = rateDates[mapKey] || { from: tripDate, to: tripDate };
    const effectiveFrom = dates.from || tripDate;
    const effectiveTo = scope === 'trip' ? (dates.from || tripDate) : (dates.to || undefined);
    const partyTypeMap: Record<PartyTab['key'], RatePartyType> = {
      vendorCustomer: 'vendor-customer',
      transportOwner: 'transport-owner',
      mineQuarry: 'mine-quarry',
      royaltyOwner: 'royalty-owner',
    };
    const createdRate = await tripRateApi.apply({
      tripId: trip.id,
      ratePartyType: partyTypeMap[tabKey],
      ratePerTon: rateNumber,
      applyScope: scope,
      effectiveFrom,
      effectiveTo,
    });
    setOptimisticRates(prev => [createdRate, ...prev]);
    return createdRate;
  };

  const handleApply = async (tabKey: PartyTab['key'], trip: Trip, rateValue: string) => {
    const mapKey = `${tabKey}-${trip.id}`;
    await applyRateForTrip(tabKey, trip, rateValue);
    setRateInputs(prev => ({ ...prev, [mapKey]: rateValue }));
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

  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      if (filters.dateFrom && trip.date < filters.dateFrom) return false;
      if (filters.dateTo && trip.date > filters.dateTo) return false;
      if (filters.vehicle && trip.vehicleNumber !== filters.vehicle) return false;
      if (filters.vendor && trip.customer !== filters.vendor) return false;
      if (filters.transportOwner && trip.transporterName !== filters.transportOwner) return false;
      if (filters.mine && trip.quarryName !== filters.mine) return false;
      if (filters.material && trip.material !== filters.material) return false;
      if (filters.royalty && trip.royaltyOwnerName !== filters.royalty) return false;
      return true;
    });
  }, [trips, filters]);

  const partyTypeByTab: Record<PartyTab['key'], RatePartyType> = {
    vendorCustomer: 'vendor-customer',
    transportOwner: 'transport-owner',
    mineQuarry: 'mine-quarry',
    royaltyOwner: 'royalty-owner',
  };

  const materialTypeByName = useMemo(() => {
    const map = new Map<string, string>();
    materialTypeDefinitions.forEach(item => map.set(item.name, item.id));
    return map;
  }, [materialTypeDefinitions]);

  const siteLocationByName = useMemo(() => {
    const map = new Map<string, string>();
    siteLocations.forEach(item => map.set(item.name, item.id));
    return map;
  }, [siteLocations]);

  const partyIdByType = useMemo(() => ({
    'vendor-customer': new Map(vendorCustomers.map(item => [item.name, item.id])),
    'mine-quarry': new Map(mineQuarries.map(item => [item.name, item.id])),
    'royalty-owner': new Map(royaltyOwnerProfiles.map(item => [item.name, item.id])),
    'transport-owner': new Map(transportOwnerProfiles.map(item => [item.name, item.id])),
  }), [vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles]);

  const combinedRates = useMemo(() => {
    if (optimisticRates.length === 0) return materialRates;
    return [...optimisticRates, ...materialRates];
  }, [materialRates, optimisticRates]);

  const getApplicableRate = (trip: Trip, tabKey: PartyTab['key']) => {
    const partyType = partyTypeByTab[tabKey];
    const partyName = tabKey === 'vendorCustomer'
      ? trip.customer
      : tabKey === 'transportOwner'
        ? trip.transporterName
        : tabKey === 'mineQuarry'
          ? trip.quarryName
          : trip.royaltyOwnerName;
    const partyId = partyIdByType[partyType].get(partyName || '') || '';
    const materialTypeId = materialTypeByName.get(trip.material || '') || '';
    const pickupLocationId = siteLocationByName.get(trip.pickupPlace || '') || '';
    const dropOffLocationId = siteLocationByName.get(trip.dropOffPlace || '') || '';
    const tripDate = new Date(trip.date);

    const tripSpecific = combinedRates.find(rate => rate.tripId === trip.id && rate.ratePartyType === partyType);
    if (tripSpecific) return tripSpecific;

    const candidates = combinedRates.filter(rate => {
      if (rate.ratePartyType !== partyType) return false;
      if (partyId && rate.ratePartyId !== partyId) return false;
      if (materialTypeId && rate.materialTypeId !== materialTypeId) return false;
      if (pickupLocationId && rate.pickupLocationId !== pickupLocationId) return false;
      if (dropOffLocationId && rate.dropOffLocationId !== dropOffLocationId) return false;
      const from = new Date(rate.effectiveFrom);
      const to = rate.effectiveTo ? new Date(rate.effectiveTo) : null;
      if (tripDate < from) return false;
      if (to && tripDate > to) return false;
      return true;
    });
    return candidates.sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0];
  };

  return (
    <div>
      <PageHeader
        title="Trip Rate Ledger"
        filters={filters}
        onFilterChange={setFilters}
        filterData={filterData}
        showFilters={['date']}
        showAddAction={false}
      />
      <div className="space-y-6">
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow-md px-4 py-3 flex flex-wrap gap-2">
          {partyTabs.map(tab => {
            const awaitingCount = filteredTrips.filter(trip => !getApplicableRate(trip, tab.key)).length;
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
          const awaitingKey = `${tab.key}-awaiting`;
          const appliedKey = `${tab.key}-applied`;
          const isApplied = (trip: Trip) => Boolean(getApplicableRate(trip, tab.key));
          const awaitingTrips = filteredTrips.filter(trip => !isApplied(trip));
          const appliedTrips = filteredTrips.filter(trip => isApplied(trip));
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
          const showRangeColumns = awaitingTrips.some(trip => (rateScopes[`${tab.key}-${trip.id}`] || 'trip') === 'range');
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
                        type="number"
                        min="0"
                        step="0.01"
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
                    <Pagination currentPage={awaitingPage} totalPages={Math.max(1, Math.ceil(awaitingTrips.length / PAGE_SIZE))} onPageChange={page => handlePageChange(awaitingKey, page)} />
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
                            <th className="px-3 py-2">Net Quantity</th>
                            <th className="px-3 py-2 w-32">Rate</th>
                            <th className="px-3 py-2 w-28">Applies</th>
                            {showRangeColumns && <th className="px-3 py-2">Valid From</th>}
                            {showRangeColumns && <th className="px-3 py-2">Valid To</th>}
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
                            const tripDate = String(trip.date || '').split('T')[0];
                            const scope = rateScopes[mapKey] || 'trip';
                            const dateRange = rateDates[mapKey] || { from: tripDate, to: tripDate };
                            const fromValue = dateRange.from || tripDate;
                            const toValue = scope === 'trip' ? fromValue : (dateRange.to || '');
                            return (
                              <tr key={trip.id} className="border-b border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                                <td className="px-3 py-2">
                                  <input type="checkbox" checked={selectedSet.has(trip.id)} onChange={() => toggleSelect(trip.id)} />
                                </td>
                                <td className="px-3 py-2">{(awaitingPage - 1) * PAGE_SIZE + idx + 1}</td>
                                <td className="px-3 py-2">#{trip.id}</td>
                                <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                                <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                                <td className="px-3 py-2">{trip[tab.field as keyof typeof trip] || '-'}</td>
                                <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={rateValue}
                                    placeholder="Rate"
                                    onChange={event => handleInput(tab.key, trip.id, event.target.value)}
                                    className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                    value={scope}
                                    onChange={event => {
                                      const nextScope = event.target.value as 'trip' | 'range';
                                      setRateScopes(prev => ({ ...prev, [mapKey]: nextScope }));
                                      setRateDates(prev => ({
                                        ...prev,
                                        [mapKey]: {
                                          from: prev[mapKey]?.from || tripDate,
                                          to: nextScope === 'trip' ? (prev[mapKey]?.from || tripDate) : (prev[mapKey]?.to || ''),
                                        },
                                      }));
                                    }}
                                  >
                                    <option value="trip">This trip</option>
                                    <option value="range">Date range</option>
                                  </select>
                                </td>
                                {showRangeColumns && (
                                  <>
                                    <td className="px-3 py-2">
                                      {scope === 'range' ? (
                                        <input
                                          type="date"
                                          value={fromValue}
                                          onChange={event => {
                                            const nextValue = event.target.value;
                                            setRateDates(prev => ({
                                              ...prev,
                                              [mapKey]: {
                                                from: nextValue,
                                                to: prev[mapKey]?.to || '',
                                              },
                                            }));
                                          }}
                                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                        />
                                      ) : (
                                        <span className="text-xs text-gray-400">—</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {scope === 'range' ? (
                                        <input
                                          type="date"
                                          value={toValue}
                                          onChange={event => {
                                            const nextValue = event.target.value;
                                            setRateDates(prev => ({
                                              ...prev,
                                              [mapKey]: {
                                                from: prev[mapKey]?.from || tripDate,
                                                to: nextValue,
                                              },
                                            }));
                                          }}
                                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                        />
                                      ) : (
                                        <span className="text-xs text-gray-400">—</span>
                                      )}
                                    </td>
                                  </>
                                )}
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
                    <Pagination currentPage={appliedPage} totalPages={Math.max(1, Math.ceil(appliedTrips.length / PAGE_SIZE))} onPageChange={page => handlePageChange(appliedKey, page)} />
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
                            <th className="px-3 py-2">Net Quantity</th>
                            <th className="px-3 py-2">Rate</th>
                            <th className="px-3 py-2">Trip Amount</th>
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
                                <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                                <td className="px-3 py-2">{rateValue.toFixed(2)}</td>
                                <td className="px-3 py-2">{amount.toFixed(2)}</td>
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
