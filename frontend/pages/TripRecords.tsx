import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import AlertDialog from '../components/AlertDialog';
import { Filters } from '../components/FilterPanel';
import { Trip } from '../types';
import { formatDateDisplay } from '../utils';

const ITEMS_PER_PAGE = 10;

const getDefaultDateRange = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return {
    dateFrom: formatDate(startOfMonth),
    dateTo: formatDate(today),
  };
};

const TripRecords: React.FC = () => {
  const { trips, loadTrips, deleteTrip, refreshKey } = useData();
  const { openModal, closeModal } = useUI();
  const [filters, setFilters] = useState<Filters>(getDefaultDateRange());
  const [draftFilters, setDraftFilters] = useState<Filters>(getDefaultDateRange());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTripIds, setSelectedTripIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadTrips();
  }, [loadTrips, refreshKey]);

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
        // Ignore non-gesture errors.
      }
    }
  };

  const updateDraft = (key: keyof Filters, value: string) => {
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyDraftFilters = () => {
    setFilters(draftFilters);
    setCurrentPage(1);
  };

  const resetDraftFilters = () => {
    const resetRange = getDefaultDateRange();
    setDraftFilters(resetRange);
    setFilters(resetRange);
    setCurrentPage(1);
  };

  const uniqueVendors = useMemo(() => {
    const names = trips.map(item => item.actualVendorCustomerName || item.customer || item.vendorName || '').filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [trips]);
  const uniqueVehicles = useMemo(() => {
    const names = trips.map(item => item.vehicleNumber || '').filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [trips]);
  const uniqueMaterials = useMemo(() => {
    const names = trips.map(item => item.material || '').filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [trips]);
  const uniqueMines = useMemo(() => {
    const names = trips.map(item => item.quarryName || '').filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [trips]);
  const uniqueTransportOwners = useMemo(() => {
    const names = trips.map(item => item.transporterName || '').filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [trips]);

  const filteredTrips = useMemo(() => {
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
    return trips.filter((trip) => {
      const tripDate = trip.date ? new Date(trip.date) : null;
      if (fromDate && tripDate && tripDate < fromDate) return false;
      if (toDate && tripDate && tripDate > toDate) return false;
      if (filters.vehicle && trip.vehicleNumber !== filters.vehicle) return false;
      if (filters.material && trip.material !== filters.material) return false;
      if (filters.mine && trip.quarryName !== filters.mine) return false;
      if (filters.transportOwner && trip.transporterName !== filters.transportOwner) return false;
      if (filters.vendor) {
        const vendorName = trip.actualVendorCustomerName || trip.customer || trip.vendorName || '';
        if (vendorName !== filters.vendor) return false;
      }
      return true;
    });
  }, [trips, filters]);

  useEffect(() => {
    setSelectedTripIds(prev => {
      if (prev.size === 0) return prev;
      const availableIds = new Set(filteredTrips.map(trip => trip.id));
      const next = new Set<number>();
      prev.forEach(id => {
        if (availableIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [filteredTrips]);

  const totalPages = Math.ceil(filteredTrips.length / ITEMS_PER_PAGE) || 1;
  const paginatedTrips = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTrips.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredTrips]);

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredTrips.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredTrips, currentPage]);

  const toggleTripSelection = (tripId: number) => {
    setSelectedTripIds(prev => {
      const next = new Set(prev);
      if (next.has(tripId)) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      return next;
    });
  };

  const toggleSelectPage = () => {
    setSelectedTripIds(prev => {
      const next = new Set(prev);
      const pageTripIds = paginatedTrips.map(trip => trip.id);
      const allSelected = pageTripIds.every(id => next.has(id));
      if (allSelected) {
        pageTripIds.forEach(id => next.delete(id));
      } else {
        pageTripIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleDelete = async (tripId: number) => {
    openModal('Delete Trip', (
      <AlertDialog
        message="Delete this trip record? This action cannot be undone."
        onConfirm={async () => {
          await deleteTrip(tripId);
          setSelectedTripIds(prev => {
            const next = new Set(prev);
            next.delete(tripId);
            return next;
          });
          closeModal();
        }}
      />
    ));
  };

  const handleBulkDelete = () => {
    if (selectedTripIds.size === 0) return;
    openModal('Delete Selected Trips', (
      <AlertDialog
        message={`Delete ${selectedTripIds.size} selected trip records? This action cannot be undone.`}
        onConfirm={async () => {
          for (const id of selectedTripIds) {
            await deleteTrip(id);
          }
          setSelectedTripIds(new Set());
          closeModal();
        }}
      />
    ));
  };

  const handleDeleteFiltered = () => {
    if (filteredTrips.length === 0) return;
    openModal('Delete Filtered Trips', (
      <AlertDialog
        message={`Delete all ${filteredTrips.length} filtered trip records? This action cannot be undone.`}
        onConfirm={async () => {
          for (const trip of filteredTrips) {
            await deleteTrip(trip.id);
          }
          setSelectedTripIds(new Set());
          closeModal();
        }}
      />
    ));
  };

  const allSelectedOnPage = paginatedTrips.length > 0 && paginatedTrips.every(trip => selectedTripIds.has(trip.id));

  return (
    <div className="relative">
      <PageHeader
        title="Trip Records"
        subtitle="Admin-only data cleanup view for trips."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showAddAction={false}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
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
                    className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
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
                    className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    value={draftFilters.dateTo || ''}
                    onChange={e => updateDraft('dateTo', e.target.value)}
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
                      <option key={`trip-records-vehicle-${vehicle}`} value={vehicle}>
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
                      <option key={`trip-records-vendor-${vendor}`} value={vendor}>
                        {vendor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 items-end">
                <div>
                  <label className="text-[11px] text-gray-500 dark:text-gray-400">Material</label>
                  <select
                    className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    value={draftFilters.material || ''}
                    onChange={e => updateDraft('material', e.target.value)}
                  >
                    <option value="">All Materials</option>
                    {uniqueMaterials.map(material => (
                      <option key={`trip-records-material-${material}`} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 dark:text-gray-400">Mine & Quarry</label>
                  <select
                    className="w-full h-8 text-xs px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    value={draftFilters.mine || ''}
                    onChange={e => updateDraft('mine', e.target.value)}
                  >
                    <option value="">All Mines/Quarries</option>
                    {uniqueMines.map(mine => (
                      <option key={`trip-records-mine-${mine}`} value={mine}>
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
                      <option key={`trip-records-transport-${owner}`} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-3 items-end">
          <button
            onClick={handleBulkDelete}
            disabled={selectedTripIds.size === 0}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Selected ({selectedTripIds.size})
          </button>
          <button
            onClick={handleDeleteFiltered}
            disabled={filteredTrips.length === 0}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Filtered ({filteredTrips.length})
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Trip Records</h2>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredTrips.length}
              pageSize={ITEMS_PER_PAGE}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={toggleSelectPage}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  {['Trip #', 'Date', 'Invoice/DC', 'Customer', 'Vehicle', 'Material', 'Quarry', 'Status', 'Actions'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedTrips.map((trip: Trip) => (
                  <tr key={trip.id}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTripIds.has(trip.id)}
                        onChange={() => toggleTripSelection(trip.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">#{trip.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{formatDateDisplay(trip.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{trip.invoiceDCNumber || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{trip.customer || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{trip.vehicleNumber || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{trip.material || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{trip.quarryName || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{trip.status || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDelete(trip.id)}
                        className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedTrips.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No trip records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TripRecords;
