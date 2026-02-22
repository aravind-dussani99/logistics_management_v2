import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { Filters } from '../components/FilterPanel';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { Trip } from '../types';
import { billsApi } from '../services/billsApi';
import { formatDateDisplay } from '../utils';

const PAGE_SIZE = 10;

const getDefaultDate = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return {
    dateFrom: formatDate(startOfMonth),
    dateTo: formatDate(today),
  };
};

type BillDialogProps = {
  trip: Trip;
  mode: 'view' | 'edit';
  onSave: (nameValue: string, rateValue: string, gstPercentValue: string) => Promise<void>;
  onClose: () => void;
};

const BillDialog: React.FC<BillDialogProps> = ({ trip, mode, onSave, onClose }) => {
  const [nameValue, setNameValue] = useState(trip.actualVendorCustomerName || '');
  const [rateValue, setRateValue] = useState(trip.vendorCustomerRatePerTon ? String(trip.vendorCustomerRatePerTon) : '');
  const [gstPercentValue, setGstPercentValue] = useState(
    trip.vendorCustomerGstPercentage !== undefined ? String(trip.vendorCustomerGstPercentage) : '18',
  );
  const netQty = Number(trip.netWeight || 0);
  const numericRate = Number(rateValue || 0);
  const baseAmount = netQty * (Number.isFinite(numericRate) ? numericRate : 0);
  const numericGstPercent = Number(gstPercentValue || 0);
  const gstAmount = baseAmount * ((Number.isFinite(numericGstPercent) ? numericGstPercent : 0) / 100);
  const totalAmount = baseAmount + gstAmount;

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
            <div className="text-xs text-gray-500 dark:text-gray-400">Net Quantity</div>
            <div className="text-base font-semibold">{netQty.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Base Amount</div>
            <div className="text-base font-semibold">{baseAmount.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">GST Amount</div>
            <div className="text-base font-semibold">{gstAmount.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Amount</div>
            <div className="text-base font-semibold">{totalAmount.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Actual Vendor & Customer Name</label>
        {mode === 'edit' ? (
          <input
            type="text"
            value={nameValue}
            onChange={event => setNameValue(event.target.value)}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
            placeholder="Enter actual vendor/customer"
          />
        ) : (
          <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{nameValue || '-'}</div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Vendor & Customer Rate</label>
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
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">GST %</label>
          {mode === 'edit' ? (
            <input
              type="text"
              inputMode="decimal"
              value={gstPercentValue}
              onChange={event => setGstPercentValue(event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
              placeholder="18"
            />
          ) : (
            <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {Number.isFinite(numericGstPercent) ? numericGstPercent.toFixed(2) : '18.00'}
            </div>
          )}
        </div>
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
            onClick={() => onSave(nameValue, rateValue, gstPercentValue)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
};

const Bills: React.FC = () => {
  const {
    trips,
    vendorCustomers,
    vehicleMasters,
    loadTrips,
    loadVendorCustomers,
    loadVehicleMasters,
    refreshKey,
  } = useData();
  const { openModal, closeModal, alert } = useUI();
  const [filters, setFilters] = useState<Filters>(getDefaultDate());
  const [draftFilters, setDraftFilters] = useState<Filters>(getDefaultDate());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedTrips, setSelectedTrips] = useState<Set<number>>(new Set());
  const [bulkRateInput, setBulkRateInput] = useState('');
  const [bulkNameInput, setBulkNameInput] = useState('');
  const [billInputs, setBillInputs] = useState<Record<number, { name: string; rate: string; gstPercent: string }>>({});
  const [optimisticTripUpdates, setOptimisticTripUpdates] = useState<Record<number, Partial<Trip>>>({});
  const [pageIndex, setPageIndex] = useState({ awaiting: 1 });
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    loadTrips();
    loadVendorCustomers();
    loadVehicleMasters();
  }, [loadTrips, loadVendorCustomers, loadVehicleMasters, refreshKey]);

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
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  };
  const applyDraftFilters = () => {
    const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
    if ((draftFilters.dateFrom && !isCompleteDate(draftFilters.dateFrom))
      || (draftFilters.dateTo && !isCompleteDate(draftFilters.dateTo))) {
      return;
    }
    const next = { ...draftFilters };
    if (next.dateFrom && next.dateTo && next.dateFrom > next.dateTo) {
      const swap = next.dateFrom;
      next.dateFrom = next.dateTo;
      next.dateTo = swap;
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

  const displayTrips = useMemo(() => {
    if (Object.keys(optimisticTripUpdates).length === 0) return trips;
    return trips.map(trip => ({ ...trip, ...optimisticTripUpdates[trip.id] }));
  }, [trips, optimisticTripUpdates]);

  const filteredTrips = useMemo(() => {
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
    return displayTrips.filter(trip => {
      const tripDate = trip.date ? new Date(trip.date) : null;
      if (fromDate && tripDate && tripDate < fromDate) return false;
      if (toDate && tripDate && tripDate > toDate) return false;
      if (filters.vendor) {
        const customerName = trip.actualVendorCustomerName || trip.customer || '';
        if (customerName !== filters.vendor) return false;
      }
      if (filters.vehicle && trip.vehicleNumber !== filters.vehicle) return false;
      if (filters.material && trip.material !== filters.material) return false;
      return true;
    });
  }, [displayTrips, filters]);

  const uniqueVendors = useMemo(
    () => Array.from(new Set(vendorCustomers.map(item => item.name))).filter(Boolean),
    [vendorCustomers],
  );
  const uniqueVehicles = useMemo(
    () => Array.from(new Set(vehicleMasters.map(item => item.vehicleNumber))).filter(Boolean),
    [vehicleMasters],
  );
  const uniqueMaterials = useMemo(
    () => Array.from(new Set(displayTrips.map(item => item.material || ''))).filter(Boolean),
    [displayTrips],
  );

  const sortedTrips = useMemo(() => {
    return [...filteredTrips].sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id - b.id;
    });
  }, [filteredTrips]);

  const awaitingTrips = useMemo(() => sortedTrips.filter(trip => {
    const hasRate = Number(trip.vendorCustomerRatePerTon || 0) > 0;
    const hasName = Boolean((trip.actualVendorCustomerName || '').trim());
    return !hasRate || !hasName;
  }), [sortedTrips]);

  const awaitingTotal = awaitingTrips.length;
  const awaitingPage = pageIndex.awaiting;
  const awaitingSlice = awaitingTrips.slice((awaitingPage - 1) * PAGE_SIZE, awaitingPage * PAGE_SIZE);
  const awaitingStart = awaitingTotal === 0 ? 0 : (awaitingPage - 1) * PAGE_SIZE + 1;
  const awaitingEnd = Math.min(awaitingPage * PAGE_SIZE, awaitingTotal);

  const updateBillInput = (tripId: number, field: 'name' | 'rate' | 'gstPercent', value: string) => {
    setBillInputs(prev => ({
      ...prev,
      [tripId]: {
        name: prev[tripId]?.name || '',
        rate: prev[tripId]?.rate || '',
        gstPercent: prev[tripId]?.gstPercent || '18',
        [field]: value,
      },
    }));
  };

  const getBillInput = (trip: Trip) => {
    const stored = billInputs[trip.id];
    if (stored) return stored;
    return {
      name: trip.actualVendorCustomerName || '',
      rate: trip.vendorCustomerRatePerTon ? String(trip.vendorCustomerRatePerTon) : '',
      gstPercent: trip.vendorCustomerGstPercentage !== undefined ? String(trip.vendorCustomerGstPercentage) : '18',
    };
  };

  const applyBillForTrip = async (trip: Trip, nameValue: string, rateValue: string, gstPercentValue: string) => {
    const trimmedName = (nameValue || '').trim();
    if (!trimmedName) {
      await alert('Missing Name', 'Please enter the actual vendor/customer name for this trip.');
      return undefined;
    }
    const rateNumber = Number(rateValue || 0);
    if (!rateNumber) {
      await alert('Missing Rate', 'Please enter the vendor/customer rate for this trip.');
      return undefined;
    }
    const gstPercentNumber = gstPercentValue.trim() === '' ? 18 : Number(gstPercentValue || 0);
    if (Number.isNaN(gstPercentNumber) || gstPercentNumber < 0) {
      await alert('Invalid GST %', 'Please enter a valid GST percentage (0 or greater).');
      return undefined;
    }
    const updatedTrip = await billsApi.apply({
      tripId: trip.id,
      actualVendorCustomerName: trimmedName,
      vendorCustomerRatePerTon: rateNumber,
      vendorCustomerGstPercentage: gstPercentNumber,
    });
    setOptimisticTripUpdates(prev => ({ ...prev, [trip.id]: updatedTrip }));
    setBillInputs(prev => {
      if (!prev[trip.id]) return prev;
      const next = { ...prev };
      delete next[trip.id];
      return next;
    });
    setSelectedTrips(prev => {
      const next = new Set(prev);
      next.delete(trip.id);
      return next;
    });
    return updatedTrip;
  };

  const handleFillSelected = async () => {
    if (selectedTrips.size === 0) {
      await alert('No Trips Selected', 'Select trips first before using Fill Selected.');
      return;
    }
    if (!bulkRateInput && !bulkNameInput) {
      await alert('Missing Bulk Values', 'Enter a bulk name or rate to fill selected trips.');
      return;
    }
    setBillInputs(prev => {
      const next = { ...prev };
      selectedTrips.forEach(tripId => {
        const existing = next[tripId] || { name: '', rate: '', gstPercent: '18' };
        next[tripId] = {
          name: bulkNameInput || existing.name,
          rate: bulkRateInput || existing.rate,
          gstPercent: existing.gstPercent || '18',
        };
      });
      return next;
    });
  };

  const handleBulkApply = async () => {
    if (selectedTrips.size === 0) {
      await alert('No Trips Selected', 'Select trips before applying rates.');
      return;
    }
    const missing = Array.from(selectedTrips).filter(tripId => {
      const trip = awaitingTrips.find(item => item.id === tripId);
      if (!trip) return false;
      const { name, rate } = getBillInput(trip);
      return !(name || '').trim() || Number(rate || 0) <= 0;
    });
    if (missing.length > 0) {
      await alert('Missing Details', `Fill the actual vendor/customer name and rate for ${missing.length} selected trip(s) before applying.`);
      return;
    }
    setBulkApplying(true);
    try {
      for (const tripId of selectedTrips) {
        const trip = awaitingTrips.find(item => item.id === tripId);
        if (!trip) continue;
        const { name, rate, gstPercent } = getBillInput(trip);
        await applyBillForTrip(trip, name, rate, gstPercent);
      }
      setBulkNameInput('');
      setBulkRateInput('');
      setSelectedTrips(new Set());
    } finally {
      setBulkApplying(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Bills / Invoices"
        filters={filters}
        onFilterChange={handleFilterChange}
        filterData={{
          vehicles: vehicleMasters,
          transportOwners: [],
          customers: vendorCustomers.map(item => ({ id: item.id, name: item.name })),
          quarries: [],
          royaltyOwners: [],
        }}
        showFilters={[]}
        showMoreFilters={[]}
        showAddAction={false}
        headerRight={(
          <div className="rounded-xl border border-gray-200/60 bg-white/90 dark:bg-gray-900/70 dark:border-gray-700/60 shadow-md px-3 py-2">
            {filtersOpen ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 items-end">
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Date From</label>
                    <input
                      type="date"
                      inputMode="numeric"
                      onKeyDown={allowDateTyping}
                      onClick={openDatePicker}
                      className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.dateFrom || ''}
                      onChange={e => updateDraft('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Date To</label>
                    <input
                      type="date"
                      inputMode="numeric"
                      onKeyDown={allowDateTyping}
                      onClick={openDatePicker}
                      className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.dateTo || ''}
                      onChange={e => updateDraft('dateTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Vehicle</label>
                    <select
                      className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.vehicle || ''}
                      onChange={e => updateDraft('vehicle', e.target.value)}
                    >
                      <option value="">All Vehicles</option>
                      {uniqueVehicles.map(vehicle => (
                        <option key={`bills-vehicle-${vehicle}`} value={vehicle}>
                          {vehicle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Vendor & Customer</label>
                    <select
                      className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.vendor || ''}
                      onChange={e => updateDraft('vendor', e.target.value)}
                    >
                      <option value="">All Vendors</option>
                      {uniqueVendors.map(vendor => (
                        <option key={`bills-vendor-${vendor}`} value={vendor}>
                          {vendor}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Material</label>
                    <select
                      className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.material || ''}
                      onChange={e => updateDraft('material', e.target.value)}
                    >
                      <option value="">All Materials</option>
                      {uniqueMaterials.map(material => (
                        <option key={`bills-material-${material}`} value={material}>
                          {material}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={applyDraftFilters}
                      className="h-7 px-3 rounded-md text-[11px] font-medium text-white bg-primary hover:bg-primary-dark"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={resetDraftFilters}
                      className="h-7 px-3 rounded-md text-[11px] font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="h-7 px-3 rounded-md text-[11px] font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
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
              Trips Awaiting Bills / Invoices
              <span className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${awaitingTotal > 0 ? 'bg-primary text-white animate-pulse' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                {awaitingTotal}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={bulkNameInput}
                onChange={event => setBulkNameInput(event.target.value)}
                placeholder="Bulk customer"
                list={bulkNameInput ? "bill-vendor-options" : undefined}
                className="w-40 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
              />
              <input
                type="text"
                inputMode="decimal"
                value={bulkRateInput}
                onChange={event => setBulkRateInput(event.target.value)}
                placeholder="Bulk rate"
                className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
              />
              <button
                type="button"
                onClick={handleFillSelected}
                className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
              >
                Fill Selected
              </button>
              <button
                type="button"
                onClick={handleBulkApply}
                disabled={bulkApplying}
                className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                Apply Selected
              </button>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Showing {awaitingStart}–{awaitingEnd} of {awaitingTotal}
              </div>
              <Pagination
                currentPage={awaitingPage}
                totalPages={Math.max(1, Math.ceil(awaitingTotal / PAGE_SIZE))}
                onPageChange={page => setPageIndex(prev => ({ ...prev, awaiting: page }))}
                totalItems={awaitingTotal}
                pageSize={PAGE_SIZE}
              />
            </div>
          </div>
          <div className="px-6 py-4">
            {awaitingSlice.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">No trips pending bills.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={awaitingSlice.length > 0 && awaitingSlice.every(trip => selectedTrips.has(trip.id))}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setSelectedTrips(prev => {
                              const next = new Set(prev);
                              awaitingSlice.forEach(trip => {
                                if (checked) {
                                  next.add(trip.id);
                                } else {
                                  next.delete(trip.id);
                                }
                              });
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th className="w-12 px-3 py-2">S.No.</th>
                      <th className="px-3 py-2">Trip #</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Invoice/DC</th>
                      <th className="px-3 py-2">Actual Vendor & Customer Name</th>
                      <th className="px-3 py-2">Vendor & Customer Rate</th>
                      <th className="px-3 py-2">Net Qty</th>
                      <th className="px-3 py-2">GST %</th>
                      <th className="px-3 py-2">GST Amount</th>
                      <th className="px-3 py-2">Base Amount</th>
                      <th className="px-3 py-2">Total Amount</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awaitingSlice.map((trip, idx) => {
                      const { name, rate, gstPercent } = getBillInput(trip);
                      const netQty = Number(trip.netWeight || 0);
                      const rateNumber = Number(rate || 0);
                      const gstPercentNumber = gstPercent.trim() === '' ? 18 : Number(gstPercent || 0);
                      const baseAmount = netQty * rateNumber;
                      const gstAmount = baseAmount * ((Number.isFinite(gstPercentNumber) ? gstPercentNumber : 0) / 100);
                      const totalAmount = baseAmount + gstAmount;
                      return (
                        <tr key={trip.id} className="border-b border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedTrips.has(trip.id)}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setSelectedTrips(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(trip.id);
                                  else next.delete(trip.id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">{(awaitingPage - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="px-3 py-2">#{trip.id}</td>
                          <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                          <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={name}
                              onChange={event => updateBillInput(trip.id, 'name', event.target.value)}
                              className="w-52 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                              list={name ? "bill-vendor-options" : undefined}
                              placeholder="Actual vendor/customer"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={rate}
                              onChange={event => updateBillInput(trip.id, 'rate', event.target.value)}
                              className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                              placeholder="Rate"
                            />
                          </td>
                          <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={gstPercent}
                              onChange={event => updateBillInput(trip.id, 'gstPercent', event.target.value)}
                              className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                              placeholder="18"
                            />
                          </td>
                          <td className="px-3 py-2">{gstAmount.toFixed(2)}</td>
                          <td className="px-3 py-2">{baseAmount.toFixed(2)}</td>
                          <td className="px-3 py-2">{totalAmount.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => applyBillForTrip(trip, name, rate, gstPercent)}
                              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
                            >
                              Apply Rate
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <datalist id="bill-vendor-options">
                  {vendorCustomers.map(item => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bills;
