import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { Filters } from '../components/FilterPanel';
import { formatDateDisplay } from '../utils';
import { Trip } from '../types';

const PAGE_SIZE = 10;

type GstInput = {
  rate: string;
  percent: string;
  amount: string;
  manualAmount: boolean;
};

const getDefaultDate = () => {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const dateValue = formatDate(today);
  return { dateFrom: dateValue, dateTo: dateValue };
};

const TripGstRates: React.FC = () => {
  const {
    trips,
    loadTrips,
    loadVehicleMasters,
    loadVendorCustomers,
    loadMineQuarries,
    loadTransportOwnerProfiles,
    loadRoyaltyOwnerProfiles,
    loadMaterialTypeDefinitions,
    loadSiteLocations,
    vehicleMasters,
    vendorCustomers,
    mineQuarries,
    transportOwnerProfiles,
    royaltyOwnerProfiles,
    materialTypeDefinitions,
    refreshKey,
    updateTrip,
  } = useData();
  const { alert } = useUI();
  const [filters, setFilters] = useState<Filters>(getDefaultDate());
  const [draftFilters, setDraftFilters] = useState<Filters>(getDefaultDate());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [gstInputs, setGstInputs] = useState<Record<number, GstInput>>({});
  const [pageIndex, setPageIndex] = useState<Record<string, number>>({});
  const [selectedTrips, setSelectedTrips] = useState<Set<number>>(new Set());
  const [bulkInputs, setBulkInputs] = useState<{ rate: string; percent: string; amount: string }>({ rate: '', percent: '', amount: '' });
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    loadTrips();
    loadVehicleMasters();
    loadVendorCustomers();
    loadMineQuarries();
    loadTransportOwnerProfiles();
    loadRoyaltyOwnerProfiles();
    loadMaterialTypeDefinitions();
    loadSiteLocations();
  }, [
    loadTrips,
    loadVehicleMasters,
    loadVendorCustomers,
    loadMineQuarries,
    loadTransportOwnerProfiles,
    loadRoyaltyOwnerProfiles,
    loadMaterialTypeDefinitions,
    loadSiteLocations,
    refreshKey,
  ]);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (filters.dateFrom && filters.dateTo) return;
    const next = getDefaultDate();
    setFilters(next);
    setDraftFilters(next);
  }, [filters.dateFrom, filters.dateTo]);

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
    setFilters(next);
  };

  const resetDraftFilters = () => {
    const next = getDefaultDate();
    setDraftFilters(next);
    setFilters(next);
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

  const awaitingTrips = useMemo(() => {
    return filteredTrips.filter(trip => {
      const amount = Number(trip.gstAmount || 0);
      const rate = Number(trip.gstRatePerTon || 0);
      const percent = Number(trip.gstPercentage || 0);
      return amount === 0 && rate === 0 && percent === 0;
    });
  }, [filteredTrips]);

  const appliedTrips = useMemo(() => {
    return filteredTrips.filter(trip => {
      const amount = Number(trip.gstAmount || 0);
      const rate = Number(trip.gstRatePerTon || 0);
      const percent = Number(trip.gstPercentage || 0);
      return amount > 0 || rate > 0 || percent > 0;
    });
  }, [filteredTrips]);

  const computeGstAmount = (trip: Trip, rateValue: string, percentValue: string) => {
    const rate = Number(rateValue || 0);
    const percent = Number(percentValue || 0);
    const netWeight = Number(trip.netWeight || 0);
    const amount = netWeight * rate * (percent / 100);
    return Number.isFinite(amount) ? amount.toFixed(2) : '';
  };

  const getInput = (trip: Trip): GstInput => {
    const existing = gstInputs[trip.id];
    if (existing) return existing;
    return {
      rate: trip.gstRatePerTon ? String(trip.gstRatePerTon) : '',
      percent: trip.gstPercentage ? String(trip.gstPercentage) : '',
      amount: trip.gstAmount ? String(trip.gstAmount) : '',
      manualAmount: Boolean(trip.gstAmount),
    };
  };

  const updateInput = (trip: Trip, field: keyof GstInput, value: string | boolean) => {
    setGstInputs(prev => {
      const current = getInput(trip);
      const next: GstInput = { ...current, ...(prev[trip.id] || {}) };
      if (field === 'manualAmount') {
        next.manualAmount = Boolean(value);
      } else if (field === 'amount') {
        next.amount = String(value);
        next.manualAmount = String(value).trim() !== '';
      } else {
        next[field] = String(value);
      }
      if ((field === 'rate' || field === 'percent') && !next.manualAmount) {
        next.amount = computeGstAmount(trip, next.rate, next.percent);
      }
      if (field === 'amount' && String(value).trim() === '') {
        next.manualAmount = false;
        next.amount = computeGstAmount(trip, next.rate, next.percent);
      }
      return { ...prev, [trip.id]: next };
    });
  };

  const applyGstForTrip = async (trip: Trip) => {
    const input = getInput(trip);
    const rateValue = Number(input.rate || 0);
    const percentValue = Number(input.percent || 0);
    const computedAmount = computeGstAmount(trip, input.rate, input.percent);
    const amountValue = input.amount.trim() !== '' ? Number(input.amount) : Number(computedAmount || 0);
    if (!amountValue && !rateValue && !percentValue) {
      await alert('Missing GST', 'Enter GST rate, percentage, or amount to apply.');
      return;
    }
    await updateTrip(trip.id, {
      gstRatePerTon: rateValue,
      gstPercentage: percentValue,
      gstAmount: amountValue,
    });
    setGstInputs(prev => {
      const next = { ...prev };
      delete next[trip.id];
      return next;
    });
  };

  const awaitingKey = 'gst-awaiting';
  const appliedKey = 'gst-applied';
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

  const allSelected = awaitingSlice.length > 0 && awaitingSlice.every(trip => selectedTrips.has(trip.id));
  const toggleSelectAll = () => {
    setSelectedTrips(prev => {
      const next = new Set(prev);
      if (allSelected) {
        awaitingSlice.forEach(trip => next.delete(trip.id));
      } else {
        awaitingSlice.forEach(trip => next.add(trip.id));
      }
      return next;
    });
  };
  const toggleSelect = (tripId: number) => {
    setSelectedTrips(prev => {
      const next = new Set(prev);
      if (next.has(tripId)) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      return next;
    });
  };

  const handleFillSelected = () => {
    if (!bulkInputs.rate && !bulkInputs.percent && !bulkInputs.amount) return;
    setGstInputs(prev => {
      const next = { ...prev };
      selectedTrips.forEach(id => {
        const trip = awaitingTrips.find(t => t.id === id);
        if (!trip) return;
        const input = getInput(trip);
        const updated: GstInput = {
          ...input,
          rate: bulkInputs.rate || input.rate,
          percent: bulkInputs.percent || input.percent,
          amount: bulkInputs.amount || input.amount,
          manualAmount: Boolean(bulkInputs.amount) || input.manualAmount,
        };
        if (!updated.manualAmount) {
          updated.amount = computeGstAmount(trip, updated.rate, updated.percent);
        }
        next[id] = updated;
      });
      return next;
    });
  };

  const handleBulkApply = async () => {
    const selectedTripsList = awaitingTrips.filter(trip => selectedTrips.has(trip.id));
    if (selectedTripsList.length === 0) return;
    if (!bulkInputs.rate && !bulkInputs.percent && !bulkInputs.amount) {
      await alert('Missing GST', 'Enter GST rate, percentage, or amount before applying.');
      return;
    }
    setBulkApplying(true);
    try {
      for (const trip of selectedTripsList) {
        const input = getInput(trip);
        const rateValue = Number((bulkInputs.rate || input.rate) || 0);
        const percentValue = Number((bulkInputs.percent || input.percent) || 0);
        const computedAmount = computeGstAmount(trip, String(rateValue), String(percentValue));
        const amountValue = bulkInputs.amount
          ? Number(bulkInputs.amount)
          : input.amount.trim() !== ''
            ? Number(input.amount)
            : Number(computedAmount || 0);
        await updateTrip(trip.id, {
          gstRatePerTon: rateValue,
          gstPercentage: percentValue,
          gstAmount: amountValue,
        });
      }
      setSelectedTrips(new Set());
      setBulkInputs({ rate: '', percent: '', amount: '' });
      setGstInputs(prev => {
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

  const uniqueVehicles = useMemo(() => Array.from(new Set(filterData.vehicles.map(item => item.vehicleNumber))).filter(Boolean), [filterData.vehicles]);
  const uniqueVendors = useMemo(() => Array.from(new Set(filterData.customers.map(item => item.name))).filter(Boolean), [filterData.customers]);
  const uniqueMaterials = useMemo(() => Array.from(new Set(filterData.materials.map(item => item.name))).filter(Boolean), [filterData.materials]);
  const uniqueQuarries = useMemo(() => Array.from(new Set(filterData.mineQuarries.map(item => item.name))).filter(Boolean), [filterData.mineQuarries]);
  const uniqueTransportOwners = useMemo(() => Array.from(new Set(filterData.transportOwners.map(item => item.name))).filter(Boolean), [filterData.transportOwners]);
  const uniqueRoyaltyOwners = useMemo(() => Array.from(new Set(filterData.royaltyOwners.map(item => item.name))).filter(Boolean), [filterData.royaltyOwners]);

  return (
    <div>
      <PageHeader
        title="GST Trip Rates"
        filters={filters}
        onFilterChange={setFilters}
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
                        <option key={`gst-vehicle-${vehicle}`} value={vehicle}>
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
                        <option key={`gst-vendor-${vendor}`} value={vendor}>
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
                        <option key={`gst-material-${material}`} value={material}>
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
                      {uniqueQuarries.map(mine => (
                        <option key={`gst-mine-${mine}`} value={mine}>
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
                        <option key={`gst-owner-${owner}`} value={owner}>
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
                      {uniqueRoyaltyOwners.map(owner => (
                        <option key={`gst-royalty-${owner}`} value={owner}>
                          {owner}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={applyDraftFilters}
                      className="h-8 px-3 rounded-md text-xs font-semibold text-white bg-primary hover:bg-primary-dark"
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
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Trips Awaiting GST
              <span className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${awaitingTotal > 0 ? 'bg-primary text-white animate-pulse' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                {awaitingTotal}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="GST Rate/Ton"
                value={bulkInputs.rate}
                onChange={event => setBulkInputs(prev => ({ ...prev, rate: event.target.value }))}
                className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="GST %"
                value={bulkInputs.percent}
                onChange={event => setBulkInputs(prev => ({ ...prev, percent: event.target.value }))}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="GST Amount"
                value={bulkInputs.amount}
                onChange={event => setBulkInputs(prev => ({ ...prev, amount: event.target.value }))}
                className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
              />
              <button
                type="button"
                onClick={handleFillSelected}
                disabled={selectedTrips.size === 0}
                className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                Fill Selected
              </button>
              <button
                type="button"
                onClick={handleBulkApply}
                disabled={selectedTrips.size === 0 || bulkApplying}
                className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {bulkApplying ? 'Applying...' : 'Apply Selected'}
              </button>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Showing {awaitingStart}–{awaitingEnd} of {awaitingTotal}
              </div>
              <Pagination
                currentPage={awaitingPage}
                totalPages={Math.max(1, Math.ceil(awaitingTotal / PAGE_SIZE))}
                onPageChange={page => setPageIndex(prev => ({ ...prev, [awaitingKey]: page }))}
                totalItems={awaitingTotal}
                pageSize={PAGE_SIZE}
              />
            </div>
          </div>
          <div className="px-6 py-4">
            {awaitingSlice.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">No trips pending GST.</div>
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
                      <th className="px-3 py-2">Net Qty</th>
                      <th className="px-3 py-2">Trip Rate for GST</th>
                      <th className="px-3 py-2">GST %</th>
                      <th className="px-3 py-2">GST Amount</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awaitingSlice.map((trip, idx) => {
                      const input = getInput(trip);
                      return (
                        <tr key={trip.id} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={selectedTrips.has(trip.id)} onChange={() => toggleSelect(trip.id)} />
                          </td>
                          <td className="px-3 py-2">{(awaitingPage - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="px-3 py-2">#{trip.id}</td>
                          <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                          <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                          <td className="px-3 py-2">{Number(trip.netWeight || 0).toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={input.rate}
                              placeholder="Rate/Ton"
                              onChange={event => updateInput(trip, 'rate', event.target.value)}
                              className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={input.percent}
                              placeholder="%"
                              onChange={event => updateInput(trip, 'percent', event.target.value)}
                              className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={input.amount}
                              placeholder="GST Amount"
                              onChange={event => updateInput(trip, 'amount', event.target.value)}
                              className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => applyGstForTrip(trip)}
                              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
                            >
                              Apply GST
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
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">GST Applied Trips</div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Showing {appliedStart}–{appliedEnd} of {appliedTotal}
              </div>
              <Pagination
                currentPage={appliedPage}
                totalPages={Math.max(1, Math.ceil(appliedTotal / PAGE_SIZE))}
                onPageChange={page => setPageIndex(prev => ({ ...prev, [appliedKey]: page }))}
                totalItems={appliedTotal}
                pageSize={PAGE_SIZE}
              />
            </div>
          </div>
          <div className="px-6 py-4">
            {appliedSlice.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">No GST entries recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="w-12 px-3 py-2">S.No.</th>
                      <th className="px-3 py-2">Trip #</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Invoice/DC</th>
                      <th className="px-3 py-2">Net Qty</th>
                      <th className="px-3 py-2">Trip Rate for GST</th>
                      <th className="px-3 py-2">GST %</th>
                      <th className="px-3 py-2">GST Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appliedSlice.map((trip, idx) => (
                      <tr key={trip.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2">{(appliedPage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="px-3 py-2">#{trip.id}</td>
                        <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                        <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                        <td className="px-3 py-2">{Number(trip.netWeight || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">{Number(trip.gstRatePerTon || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">{Number(trip.gstPercentage || 0).toFixed(2)}</td>
                        <td className="px-3 py-2">{Number(trip.gstAmount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripGstRates;
