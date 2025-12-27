import React, { useEffect, useState, useMemo } from 'react';
import DataTable from '../components/DataTable';
import { Trip, Role, QuarryOwner, VehicleOwner, CustomerRate, Notification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Filters } from '../components/FilterPanel';
import Pagination from '../components/Pagination';
import { useData } from '../contexts/DataContext';
import PageHeader from '../components/PageHeader';
import { formatDateDisplay, safeToFixed } from '../utils';
import { useLocation } from 'react-router-dom';
import { useUI } from '../contexts/UIContext';
import SupervisorTripForm from '../components/SupervisorTripForm';
import AlertDialog from '../components/AlertDialog';
import RequestDialog from '../components/RequestDialog';
import { notificationApi } from '../services/notificationApi';

const TRIPS_PER_PAGE = 20;

const getMtdRange = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return {
      dateFrom: formatDate(startOfMonth),
      dateTo: formatDate(today)
    };
};

const DailyTrips: React.FC = () => {
    const { currentUser } = useAuth();
    const { refreshKey, customers, trips, quarries, vehicles, updateTrip, deleteTrip } = useData();
    const { openModal, closeModal } = useUI();
    const location = useLocation();
    const [allTrips, setAllTrips] = useState<Trip[]>([]);
    const [allData, setAllData] = useState<{ quarries: QuarryOwner[]; vehicles: VehicleOwner[]; customers: CustomerRate[], royaltyOwners: string[] }>({ quarries: [], vehicles: [], customers: [], royaltyOwners: [] });
    const [activeRequest, setActiveRequest] = useState<Notification | null>(null);
    
    const [filters, setFilters] = useState<Filters>(getMtdRange());
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setAllTrips(trips);
        const uniqueRoyaltyOwners = Array.from(new Set(trips.map(t => t.royaltyOwnerName)));
        const customerRates = customers.map(c => ({ customer: c.name, id: c.id, material: '', rate: '', from: '', to: '', active: false, rejectionPercent: '', rejectionRemarks: '', locationFrom: '', locationTo: '' }));
        setAllData({ quarries, vehicles, customers: customerRates, royaltyOwners: uniqueRoyaltyOwners });
    }, [refreshKey, trips, customers, quarries, vehicles]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const notificationId = params.get('notificationId');
        if (!notificationId) return;
        notificationApi.getById(notificationId).then(note => {
            setActiveRequest(note);
            if (note.tripId) {
                const targetTrip = trips.find(t => t.id === note.tripId);
                if (targetTrip) {
                    openModal(`Trip #${targetTrip.id}`, <SupervisorTripForm mode="view" trip={targetTrip} onClose={closeModal} />);
                }
            }
        }).catch(error => {
            console.error('Failed to load notification', error);
        });
    }, [location.search, trips, openModal, closeModal]);

    const filteredTrips = useMemo(() => {
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
        const toDate = filters.dateTo ? new Date(filters.dateTo) : null;

        if (toDate) toDate.setHours(23, 59, 59, 999);
        
        const filtered = allTrips.filter(trip => {
            const tripDate = new Date(trip.date);
            
            if (fromDate && tripDate < fromDate) return false;
            if (toDate && tripDate > toDate) return false;
            if (filters.vehicle && trip.vehicleNumber !== filters.vehicle) return false;
            if (filters.transporter && trip.transporterName !== filters.transporter) return false;
            if (filters.customer && trip.customer !== filters.customer) return false;
            if (filters.quarry && trip.quarryName !== filters.quarry) return false;
            if (filters.royalty && trip.royaltyOwnerName !== filters.royalty) return false;
            return true;
        });

        if (currentPage !== 1) {
            setCurrentPage(1);
        }
        return filtered;
    }, [allTrips, filters]);

    const paginatedTrips = useMemo(() => {
        const startIndex = (currentPage - 1) * TRIPS_PER_PAGE;
        return filteredTrips.slice(startIndex, startIndex + TRIPS_PER_PAGE);
    }, [filteredTrips, currentPage]);

    const totalPages = Math.ceil(filteredTrips.length / TRIPS_PER_PAGE);

    const headers = ['S. No.', 'Date', 'Invoice & DC Number', 'Vendor & Customer Name', 'Transport & Owner Name', 'Vehicle Number', 'Mine & Quarry Name', 'Material Type', 'Royalty Owner Name', 'Royalty M3', 'Net Weight (Tons)', 'Pickup Place', 'Drop-off Place', 'Status', 'Actions'];

    const dateRangeSubtitle = useMemo(() => {
        if (!filters.dateFrom && !filters.dateTo) return "Showing all trips";
        const from = filters.dateFrom ? formatDateDisplay(filters.dateFrom) : 'the beginning';
        const to = filters.dateTo ? formatDateDisplay(filters.dateTo) : 'today';
        return `Showing data from ${from} to ${to}`;
    }, [filters.dateFrom, filters.dateTo]);

    return (
        <div className="relative">
            <PageHeader
                title="Daily Trips"
                subtitle={dateRangeSubtitle}
                filters={filters}
                onFilterChange={setFilters}
                filterData={allData}
                showFilters={['date', 'transporter', 'quarry']}
                showMoreFilters={['vehicle', 'customer', 'royalty']}
            />

            <main className="pt-6">
                {activeRequest && (
                    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <div className="font-semibold">Trip request from {activeRequest.requesterName || 'Supervisor'}</div>
                        <div className="mt-1">{activeRequest.message}</div>
                    </div>
                )}
                <DataTable
                    title="All Trips"
                    headers={headers}
                    data={paginatedTrips}
                    renderRow={(trip: Trip, index: number) => {
                        const isRequestedTrip = activeRequest?.tripId === trip.id;
                        return (
                        <tr key={trip.id} className={isRequestedTrip ? 'bg-amber-50 dark:bg-amber-900/20' : undefined}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * TRIPS_PER_PAGE + index + 1}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(trip.date)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.invoiceDCNumber || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.customer || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.transporterName || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{trip.vehicleNumber || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.quarryName || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.material || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.royaltyOwnerName || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.royaltyM3 ?? '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{safeToFixed(trip.netWeight)} T</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.pickupPlace || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.dropOffPlace || trip.place || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {trip.status}
                                {isRequestedTrip && (
                                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                                        Request
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                <button
                                    onClick={() => openModal(`View Trip #${trip.id}`, <SupervisorTripForm mode="view" trip={trip} onClose={closeModal} />)}
                                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                                >
                                    View
                                </button>
                                <button
                                    onClick={() => openModal(`Edit Trip #${trip.id}`, <SupervisorTripForm mode="edit" trip={trip} onClose={closeModal} />)}
                                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => {
                                        openModal('Delete Trip', (
                                            <AlertDialog
                                                message="Delete this trip? This action cannot be undone."
                                                confirmLabel="Delete"
                                                cancelLabel="Cancel"
                                                onCancel={closeModal}
                                                onConfirm={async () => {
                                                    await notificationApi.create({
                                                        message: `Trip #${trip.id} deleted by Admin.`,
                                                        type: 'info',
                                                        targetRole: 'Supervisor',
                                                        targetUser: trip.createdBy || null,
                                                        tripId: trip.id,
                                                        requestType: 'delete',
                                                        requesterName: currentUser?.name || 'Admin',
                                                        requesterRole: currentUser?.role || 'Admin',
                                                    });
                                                    await deleteTrip(trip.id);
                                                    closeModal();
                                                }}
                                            />
                                        ));
                                    }}
                                    className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => {
                                        openModal('Send Back to Enter Trips', (
                                            <RequestDialog
                                                title="Send back to Enter Trips"
                                                label="Message to supervisor"
                                                confirmLabel="Send Back"
                                                onCancel={closeModal}
                                                onConfirm={async (message) => {
                                                    await updateTrip(trip.id, {
                                                        status: 'pending upload',
                                                        pendingRequestType: null,
                                                        pendingRequestMessage: null,
                                                        pendingRequestBy: null,
                                                        pendingRequestRole: null,
                                                        pendingRequestAt: null,
                                                    });
                                                    await notificationApi.create({
                                                        message: `Trip #${trip.id} sent back to Enter Trips. ${message || ''}`.trim(),
                                                        type: 'info',
                                                        targetRole: 'Supervisor',
                                                        targetUser: trip.createdBy || null,
                                                        tripId: trip.id,
                                                        requestType: 'sent-back',
                                                        requesterName: currentUser?.name || 'Admin',
                                                        requesterRole: currentUser?.role || 'Admin',
                                                        requestMessage: message || '',
                                                    });
                                                    closeModal();
                                                }}
                                            />
                                        ));
                                    }}
                                    className={`px-3 py-2 text-sm font-medium rounded-md ${trip.pendingRequestType ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-amber-900 bg-amber-200 hover:bg-amber-300'}`}
                                    disabled={Boolean(trip.pendingRequestType)}
                                >
                                    {trip.pendingRequestType ? 'Request Pending' : 'Send Back'}
                                </button>
                            </td>
                        </tr>
                    )}}
                />
                <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </main>
        </div>
    );
};

export default DailyTrips;
