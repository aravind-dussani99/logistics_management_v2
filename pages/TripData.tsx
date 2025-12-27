import React, { useEffect, useMemo, useState } from 'react';
import { Trip } from '../types';
import { useData } from '../contexts/DataContext';
import { formatDateDisplay } from '../utils';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

const TripDataPage: React.FC = () => {
  const { trips } = useData();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

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
        trip.createdBy,
        trip.status,
      ].some(value => (value || '').toLowerCase().includes(term))
    ));
  }, [trips, searchTerm]);

  const totalPages = Math.ceil(filteredTrips.length / ITEMS_PER_PAGE) || 1;
  const paginatedTrips = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTrips.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTrips, currentPage]);

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredTrips.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredTrips, currentPage]);

  return (
    <div className="relative">
      <PageHeader
        title="Trip Data"
        subtitle="All entered and received trips in one place."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
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
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Trip Data</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Date', 'Pickup', 'Drop-off', 'Customer', 'Material', 'Quarry', 'Vehicle', 'Net Weight', 'Status', 'Created By'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedTrips.map(trip => (
                  <tr key={trip.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(trip.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.pickupPlace || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.dropOffPlace || trip.place || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.customer || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.material || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.quarryName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.vehicleNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.netWeight ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.status || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.createdBy || '-'}</td>
                  </tr>
                ))}
                {paginatedTrips.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No trips match the current filters.
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

export default TripDataPage;
