import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import AlertDialog from '../components/AlertDialog';
import { Trip } from '../types';
import { formatDateDisplay } from '../utils';

const ITEMS_PER_PAGE = 10;

const TripRecords: React.FC = () => {
  const { trips, loadTrips, deleteTrip, refreshKey } = useData();
  const { openModal, closeModal } = useUI();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTripIds, setSelectedTripIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadTrips();
  }, [loadTrips, refreshKey]);

  const filteredTrips = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return trips;
    return trips.filter(trip => (
      [
        trip.customer,
        trip.vehicleNumber,
        trip.material,
        trip.quarryName,
        trip.pickupPlace,
        trip.dropOffPlace,
        trip.invoiceDCNumber,
        trip.createdBy,
        trip.status,
      ].some(value => (value || '').toLowerCase().includes(term))
    ));
  }, [searchTerm, trips]);

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
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={closeModal}
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
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={closeModal}
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Customer, vehicle, material, status"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
          <button
            onClick={handleBulkDelete}
            disabled={selectedTripIds.size === 0}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Selected
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
