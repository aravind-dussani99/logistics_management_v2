

import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import { safeToFixed } from '../utils';

const RoyaltyStockPage: React.FC = () => {
    const { trips, royaltyOwnerProfiles, loadTrips, loadRoyaltyOwnerProfiles, refreshKey } = useData();
    const [filters, setFilters] = useState<Filters>({});

    useEffect(() => {
        loadTrips();
        loadRoyaltyOwnerProfiles();
    }, [loadTrips, loadRoyaltyOwnerProfiles, refreshKey]);

    const totalUsed = useMemo(() => trips.reduce((acc, trip) => acc + Number(trip.royaltyM3 || 0), 0), [trips]);
    const usageByOwner = useMemo(() => {
        const map = new Map<string, { name: string; trips: number; m3: number; tons: number }>();
        royaltyOwnerProfiles.forEach(owner => {
            map.set(owner.name, { name: owner.name, trips: 0, m3: 0, tons: 0 });
        });
        trips.forEach(trip => {
            if (!trip.royaltyOwnerName) return;
            const key = trip.royaltyOwnerName;
            if (!map.has(key)) {
                map.set(key, { name: key, trips: 0, m3: 0, tons: 0 });
            }
            const entry = map.get(key)!;
            entry.trips += 1;
            entry.m3 += Number(trip.royaltyM3 || 0);
            entry.tons += Number(trip.royaltyTons || 0);
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [royaltyOwnerProfiles, trips]);

    return (
        <div className="relative">
            <PageHeader
                title="Royalty Stock"
                subtitle={`Total Royalty Used: ${safeToFixed(totalUsed)} m³`}
                filters={filters}
                onFilterChange={setFilters}
                filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
            />

            <main className="pt-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="p-4 border-b dark:border-gray-700">
                        <h2 className="text-xl font-semibold">Royalty Usage</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    {['Royalty Owner', 'Trips', 'Royalty Used (m³)', 'Royalty Tons'].map(h => (
                                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {usageByOwner.map(item => (
                                    <tr key={item.name}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{item.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{item.trips}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{safeToFixed(item.m3)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{safeToFixed(item.tons)}</td>
                                    </tr>
                                ))}
                                {usageByOwner.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-6 text-center text-sm text-gray-500">
                                            No royalty usage recorded yet.
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
}

export default RoyaltyStockPage;
