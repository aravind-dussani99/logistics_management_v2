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
    const { refreshKey, trips, updateTrip, deleteTrip, loadTrips } = useData();
    const { openModal, closeModal } = useUI();
    const location = useLocation();
    const [allTrips, setAllTrips] = useState<Trip[]>([]);
    const [allData, setAllData] = useState<{ quarries: QuarryOwner[]; vehicles: VehicleOwner[]; customers: CustomerRate[], royaltyOwners: string[] }>({ quarries: [], vehicles: [], customers: [], royaltyOwners: [] });
    const [activeRequest, setActiveRequest] = useState<Notification | null>(null);
    
    const [filters, setFilters] = useState<Filters>(getMtdRange());
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<'all' | 'in transit' | 'pending validation' | 'completed' | 'trip completed'>('all');

    useEffect(() => {
        loadTrips();
    }, [loadTrips, refreshKey]);

    const handleValidate = (trip: Trip) => {
        openModal('Validate Trip', (
            <RequestDialog
                title={`Validate Trip #${trip.id}`}
                label="Validation comments"
                confirmLabel="Validate"
                onCancel={closeModal}
                onConfirm={async (message) => {
                    await updateTrip(trip.id, {
                        status: 'trip completed',
                        validationComments: message || '',
                        validatedBy: currentUser?.name || currentUser?.username || '',
                        validatedAt: new Date().toISOString(),
                        pendingRequestType: null,
                        pendingRequestMessage: null,
                        pendingRequestBy: null,
                        pendingRequestRole: null,
                        pendingRequestAt: null,
                    });
                    const notifications = [
                        {
                            targetRole: Role.PICKUP_SUPERVISOR,
                            targetUser: trip.createdBy || null,
                        },
                        {
                            targetRole: Role.DROPOFF_SUPERVISOR,
                            targetUser: trip.receivedBy || null,
                        },
                        {
                            targetRole: Role.ADMIN,
                            targetUser: null,
                        },
                    ];
                    await Promise.all(notifications.map(target => notificationApi.create({
                        message: `Trip #${trip.id} validated. ${message || ''}`.trim(),
                        type: 'info',
                        targetRole: target.targetRole,
                        targetUser: target.targetUser,
                        tripId: trip.id,
                        requestType: 'validated',
                        requesterName: currentUser?.name || 'Admin',
                        requesterRole: currentUser?.role || Role.ADMIN,
                        requestMessage: message || '',
                        requesterContact: currentUser?.mobileNumber || '',
                    })));
                    closeModal();
                }}
            />
        ));
    };

    const handleSendBack = (trip: Trip, target: 'pickup' | 'dropoff') => {
        const targetRole = target === 'pickup' ? Role.PICKUP_SUPERVISOR : Role.DROPOFF_SUPERVISOR;
        const targetUser = target === 'pickup' ? (trip.createdBy || null) : (trip.receivedBy || null);
        const newStatus = target === 'pickup' ? 'pending upload' : 'in transit';
        const requestType = target === 'pickup' ? 'sent-back-pickup' : 'sent-back-dropoff';
        openModal(`Send Back to ${target === 'pickup' ? 'Pick-up Supervisor' : 'Drop-off Supervisor'}`, (
            <RequestDialog
                title={`Send back to ${target === 'pickup' ? 'Pick-up Supervisor' : 'Drop-off Supervisor'}`}
                label="Reason"
                confirmLabel="Send Back"
                onCancel={closeModal}
                onConfirm={async (message) => {
                    await updateTrip(trip.id, {
                        status: newStatus,
                        pendingRequestType: requestType,
                        pendingRequestMessage: message || '',
                        pendingRequestBy: currentUser?.name || currentUser?.username || '',
                        pendingRequestRole: currentUser?.role || '',
                        pendingRequestAt: new Date().toISOString(),
                    });
                    await notificationApi.create({
                        message: `Trip #${trip.id} sent back to ${target === 'pickup' ? 'Pick-up' : 'Drop-off'} Supervisor. ${message || ''}`.trim(),
                        type: 'alert',
                        targetRole,
                        targetUser,
                        tripId: trip.id,
                        requestType,
                        requesterName: currentUser?.name || 'Admin',
                        requesterRole: currentUser?.role || Role.ADMIN,
                        requestMessage: message || '',
                        requesterContact: currentUser?.mobileNumber || '',
                    });
                    closeModal();
                }}
            />
        ));
    };

    useEffect(() => {
        setAllTrips(trips);
        const uniqueRoyaltyOwners = Array.from(new Set(trips.map(t => t.royaltyOwnerName).filter(Boolean)));
        const uniqueVehicles = Array.from(new Set(trips.map(t => t.vehicleNumber).filter(Boolean)));
        const uniqueQuarries = Array.from(new Set(trips.map(t => t.quarryName).filter(Boolean)));
        const uniqueCustomers = Array.from(new Set(trips.map(t => t.customer).filter(Boolean)));

        const vehicles = uniqueVehicles.map((vehicleNumber, index) => ({
            id: `vehicle-${index}-${vehicleNumber}`,
            ownerName: '',
            vehicleNumber,
            vehicleType: '',
            vehicleCapacity: 0,
            contactNumber: '',
            address: '',
            openingBalance: 0,
            rates: [],
        }));

        const quarries = uniqueQuarries.map((quarryName, index) => ({
            id: `quarry-${index}-${quarryName}`,
            ownerName: quarryName,
            quarryName,
            quarryArea: 0,
            contactNumber: '',
            address: '',
            openingBalance: 0,
            rates: [],
        }));

        const customerRates = uniqueCustomers.map((customer, index) => ({
            customer,
            id: `customer-${index}-${customer}`,
            material: '',
            rate: '',
            from: '',
            to: '',
            active: false,
            rejectionPercent: '',
            rejectionRemarks: '',
            locationFrom: '',
            locationTo: '',
        }));

        setAllData({ quarries, vehicles, customers: customerRates, royaltyOwners: uniqueRoyaltyOwners as string[] });
    }, [refreshKey, trips]);

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
        const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
        const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
        
        const filtered = allTrips.filter(trip => {
            const tripDate = new Date(trip.date);
            
            if (fromDate && tripDate < fromDate) return false;
            if (toDate && tripDate > toDate) return false;
            if (filters.vehicle && trip.vehicleNumber !== filters.vehicle) return false;
            if (filters.transporter && trip.transporterName !== filters.transporter) return false;
            if (filters.customer && trip.customer !== filters.customer) return false;
            if (filters.quarry && trip.quarryName !== filters.quarry) return false;
            if (filters.royalty && trip.royaltyOwnerName !== filters.royalty) return false;
            if (statusFilter !== 'all') {
                const status = (trip.status || '').toLowerCase();
                if (statusFilter === 'completed') {
                    if (!['completed', 'trip completed', 'validated'].includes(status)) return false;
                } else if (status !== statusFilter) {
                    return false;
                }
            }
            return true;
        });

        if (currentPage !== 1) {
            setCurrentPage(1);
        }
        return filtered;
    }, [allTrips, filters, statusFilter]);

    const paginatedTrips = useMemo(() => {
        const startIndex = (currentPage - 1) * TRIPS_PER_PAGE;
        return filteredTrips.slice(startIndex, startIndex + TRIPS_PER_PAGE);
    }, [filteredTrips, currentPage]);

    const totalPages = Math.ceil(filteredTrips.length / TRIPS_PER_PAGE);

    const headers = ['S. No.', 'Date', 'Invoice & DC Number', 'Vendor & Customer Name', 'Transport & Owner Name', 'Vehicle Number', 'Mine & Quarry Name', 'Material Type', 'Royalty Owner Name', 'Net Weight (Tons)', 'Pickup Place', 'Drop-off Place', 'Status', 'Actions'];

    const dateRangeSubtitle = useMemo(() => {
        if (!filters.dateFrom && !filters.dateTo) return "Showing all trips";
        const from = filters.dateFrom ? formatDateDisplay(filters.dateFrom) : 'the beginning';
        const to = filters.dateTo ? formatDateDisplay(filters.dateTo) : 'today';
        return `Showing data from ${from} to ${to}`;
    }, [filters.dateFrom, filters.dateTo]);

    const openTripEntry = () => {
        openModal('Enter New Trip', <SupervisorTripForm mode="enter" onClose={closeModal} />);
    };

    return (
        <div className="relative">
            <PageHeader
                title="Trip Management"
                subtitle={dateRangeSubtitle}
                filters={filters}
                onFilterChange={setFilters}
                filterData={allData}
                showFilters={['date', 'transporter', 'quarry']}
                showMoreFilters={['vehicle', 'customer', 'royalty']}
                pageAction={{ label: 'Enter Trip', action: openTripEntry }}
            />

            <main className="pt-6">
                <div className="mb-4 flex items-center gap-3">
                    <label className="text-sm text-gray-500 dark:text-gray-400">Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                        className="px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="all">All</option>
                        <option value="in transit">In Transit</option>
                        <option value="pending validation">Pending Validation</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                {activeRequest && (
                    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <div className="font-semibold">
                            Trip request from {activeRequest.requesterName || 'Supervisor'}
                            {activeRequest.requesterContact ? ` • ${activeRequest.requesterContact}` : ''}
                        </div>
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
                                                        targetRole: Role.PICKUP_SUPERVISOR,
                                                        targetUser: trip.createdBy || null,
                                                        tripId: trip.id,
                                                        requestType: 'delete',
                                                        requesterName: currentUser?.name || 'Admin',
                                                        requesterRole: currentUser?.role || Role.ADMIN,
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
                                {(trip.status || '').toLowerCase() === 'pending validation' && (
                                    <>
                                        <button
                                            onClick={() => handleValidate(trip)}
                                            className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                                        >
                                            Validate
                                        </button>
                                        <button
                                            onClick={() => handleSendBack(trip, 'dropoff')}
                                            className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300"
                                        >
                                            Send Back to Drop-off
                                        </button>
                                        <button
                                            onClick={() => handleSendBack(trip, 'pickup')}
                                            className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300"
                                        >
                                            Send Back to Pick-up
                                        </button>
                                    </>
                                )}
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
