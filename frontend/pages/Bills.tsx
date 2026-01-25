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
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const dateValue = formatDate(today);
  return {
    dateFrom: dateValue,
    dateTo: dateValue,
  };
};

type BillDialogProps = {
  trip: Trip;
  mode: 'view' | 'edit';
  onSave: (nameValue: string, rateValue: string) => Promise<void>;
  onClose: () => void;
};

const BillDialog: React.FC<BillDialogProps> = ({ trip, mode, onSave, onClose }) => {
  const [nameValue, setNameValue] = useState(trip.actualVendorCustomerName || '');
  const [rateValue, setRateValue] = useState(trip.vendorCustomerRatePerTon ? String(trip.vendorCustomerRatePerTon) : '');
  const netQty = Number(trip.netWeight || 0);
  const numericRate = Number(rateValue || 0);
  const tripAmount = netQty * (Number.isFinite(numericRate) ? numericRate : 0);

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
            <div className="text-xs text-gray-500 dark:text-gray-400">Trip Amount</div>
            <div className="text-base font-semibold">{tripAmount.toFixed(2)}</div>
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
            onClick={() => onSave(nameValue, rateValue)}
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
  const [selectedTrips, setSelectedTrips] = useState<Set<number>>(new Set());
  const [bulkRateInput, setBulkRateInput] = useState('');
  const [bulkNameInput, setBulkNameInput] = useState('');
  const [billInputs, setBillInputs] = useState<Record<number, { name: string; rate: string }>>({});
  const [optimisticTripUpdates, setOptimisticTripUpdates] = useState<Record<number, Partial<Trip>>>({});
  const [pageIndex, setPageIndex] = useState({ awaiting: 1, applied: 1 });
  const [bulkApplying, setBulkApplying] = useState(false);

  useEffect(() => {
    loadTrips();
    loadVendorCustomers();
    loadVehicleMasters();
  }, [loadTrips, loadVendorCustomers, loadVehicleMasters, refreshKey]);

  const handleFilterChange = (nextFilters: Filters) => {
    setFilters(nextFilters);
  };

  const displayTrips = useMemo(() => {
    if (Object.keys(optimisticTripUpdates).length === 0) return trips;
    return trips.map(trip => ({ ...trip, ...optimisticTripUpdates[trip.id] }));
  }, [trips, optimisticTripUpdates]);

  const filteredTrips = useMemo(() => {
    return displayTrips.filter(trip => {
      const tripDate = (trip.date || '').split('T')[0];
      if (filters.dateFrom && tripDate !== filters.dateFrom) return false;
      if (filters.vendor) {
        const customerName = trip.actualVendorCustomerName || trip.customer || '';
        if (customerName !== filters.vendor) return false;
      }
      return true;
    });
  }, [displayTrips, filters]);

  const awaitingTrips = useMemo(() => filteredTrips.filter(trip => {
    const hasRate = Number(trip.vendorCustomerRatePerTon || 0) > 0;
    const hasName = Boolean((trip.actualVendorCustomerName || '').trim());
    return !hasRate || !hasName;
  }), [filteredTrips]);

  const appliedTrips = useMemo(() => filteredTrips.filter(trip => {
    const hasRate = Number(trip.vendorCustomerRatePerTon || 0) > 0;
    const hasName = Boolean((trip.actualVendorCustomerName || '').trim());
    return hasRate && hasName;
  }), [filteredTrips]);

  const awaitingTotal = awaitingTrips.length;
  const appliedTotal = appliedTrips.length;
  const awaitingPage = pageIndex.awaiting;
  const appliedPage = pageIndex.applied;
  const awaitingSlice = awaitingTrips.slice((awaitingPage - 1) * PAGE_SIZE, awaitingPage * PAGE_SIZE);
  const appliedSlice = appliedTrips.slice((appliedPage - 1) * PAGE_SIZE, appliedPage * PAGE_SIZE);
  const awaitingStart = awaitingTotal === 0 ? 0 : (awaitingPage - 1) * PAGE_SIZE + 1;
  const awaitingEnd = Math.min(awaitingPage * PAGE_SIZE, awaitingTotal);
  const appliedStart = appliedTotal === 0 ? 0 : (appliedPage - 1) * PAGE_SIZE + 1;
  const appliedEnd = Math.min(appliedPage * PAGE_SIZE, appliedTotal);

  const updateBillInput = (tripId: number, field: 'name' | 'rate', value: string) => {
    setBillInputs(prev => ({
      ...prev,
      [tripId]: {
        name: prev[tripId]?.name || '',
        rate: prev[tripId]?.rate || '',
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
    };
  };

  const applyBillForTrip = async (trip: Trip, nameValue: string, rateValue: string) => {
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
    const updatedTrip = await billsApi.apply({
      tripId: trip.id,
      actualVendorCustomerName: trimmedName,
      vendorCustomerRatePerTon: rateNumber,
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
        const existing = next[tripId] || { name: '', rate: '' };
        next[tripId] = {
          name: bulkNameInput || existing.name,
          rate: bulkRateInput || existing.rate,
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
        const { name, rate } = getBillInput(trip);
        await applyBillForTrip(trip, name, rate);
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
        showFilters={['singleDate', 'vehicle', 'vendor', 'material']}
        showAddAction={false}
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
                list="bill-vendor-options"
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
                      <th className="px-3 py-2">Trip Amount</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awaitingSlice.map((trip, idx) => {
                      const { name, rate } = getBillInput(trip);
                      const netQty = Number(trip.netWeight || 0);
                      const rateNumber = Number(rate || 0);
                      const tripAmount = netQty * rateNumber;
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
                              list="bill-vendor-options"
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
                          <td className="px-3 py-2">{tripAmount.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => applyBillForTrip(trip, name, rate)}
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

        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bills / Invoices Applied</div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Showing {appliedStart}–{appliedEnd} of {appliedTotal}
              </div>
              <Pagination
                currentPage={appliedPage}
                totalPages={Math.max(1, Math.ceil(appliedTotal / PAGE_SIZE))}
                onPageChange={page => setPageIndex(prev => ({ ...prev, applied: page }))}
                totalItems={appliedTotal}
                pageSize={PAGE_SIZE}
              />
            </div>
          </div>
          <div className="px-6 py-4">
            {appliedSlice.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">No bills applied yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="w-12 px-3 py-2">S.No.</th>
                      <th className="px-3 py-2">Trip #</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Invoice/DC</th>
                      <th className="px-3 py-2">Actual Vendor & Customer Name</th>
                      <th className="px-3 py-2">Vendor & Customer Rate</th>
                      <th className="px-3 py-2">Net Qty</th>
                      <th className="px-3 py-2">Trip Amount</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appliedSlice.map((trip, idx) => {
                      const netQty = Number(trip.netWeight || 0);
                      const rate = Number(trip.vendorCustomerRatePerTon || 0);
                      const tripAmount = netQty * rate;
                      return (
                        <tr key={trip.id} className="border-b border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                          <td className="px-3 py-2">{(appliedPage - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="px-3 py-2">#{trip.id}</td>
                          <td className="px-3 py-2">{formatDateDisplay(trip.date)}</td>
                          <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                          <td className="px-3 py-2">{trip.actualVendorCustomerName || '-'}</td>
                          <td className="px-3 py-2">{rate.toFixed(2)}</td>
                          <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                          <td className="px-3 py-2">{tripAmount.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => openModal(
                                `View Bill #${trip.id}`,
                                <BillDialog
                                  trip={trip}
                                  mode="view"
                                  onClose={closeModal}
                                  onSave={async () => undefined}
                                />
                              )}
                              className="rounded-md bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                            >
                              View
                            </button>
                            <button
                              onClick={() => openModal(
                                `Edit Bill #${trip.id}`,
                                <BillDialog
                                  trip={trip}
                                  mode="edit"
                                  onClose={closeModal}
                                  onSave={async (nameValue, rateValue) => {
                                    await applyBillForTrip(trip, nameValue, rateValue);
                                    closeModal();
                                  }}
                                />
                              )}
                              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
                            >
                              Edit
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
      </div>
    </div>
  );
};

export default Bills;
