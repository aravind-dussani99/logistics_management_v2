import React, { useState, useMemo, useEffect } from 'react';
import { Trip, Role } from '../types';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import ReceiveTripForm from '../components/ReceiveTripForm';
import SupervisorTripForm from '../components/SupervisorTripForm';
import RequestDialog from '../components/RequestDialog';
import AlertDialog from '../components/AlertDialog';
import { tripApi } from '../services/tripApi';
import { notificationApi } from '../services/notificationApi';
import { formatDateDisplay } from '../utils';
import { Navigate } from 'react-router-dom';

const ITEMS_PER_PAGE = 10;

const ReceivedTrips: React.FC = () => {
    const { trips, refreshKey, updateTrip, deleteTrip, loadTrips } = useData();
    const { currentUser } = useAuth();
    const { openModal, closeModal } = useUI();
    const canManageTrips = currentUser?.role === Role.ADMIN || currentUser?.role === Role.MANAGER || currentUser?.role === Role.ACCOUNTANT;
    const [inTransitTrips, setInTransitTrips] = useState<Trip[]>([]);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadTrips();
    }, [loadTrips, refreshKey]);

    useEffect(() => {
        const filtered = trips.filter(t => {
            const status = (t.status || '').toLowerCase();
            if (!['in transit', 'pending validation', 'completed'].includes(status)) return false;
            if (!currentUser?.dropOffLocationName) return true;
            const tripLocation = t.dropOffPlace || t.place;
            return tripLocation === currentUser.dropOffLocationName;
        })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setInTransitTrips(filtered);
    }, [trips, refreshKey, currentUser]);
    
    const delayedTripsCount = useMemo(() => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        return inTransitTrips.filter(t => new Date(t.date) < twoDaysAgo).length;
    }, [inTransitTrips]);

    const handleReceive = (trip: Trip) => {
        openModal(`Receive Trip #${trip.id}`, <ReceiveTripForm trip={trip} onClose={closeModal} />);
    };

    const handleRaiseIssue = (trip: Trip) => {
        if (!currentUser) return;
        openModal('Raise Issue', (
            <RequestDialog
                title={`Raise issue for Trip #${trip.id}`}
                label="Raise Issue Comments"
                confirmLabel="Submit Issue"
                onCancel={closeModal}
                onConfirm={async (reason) => {
                    await tripApi.raiseIssue(trip.id, { requestedBy: currentUser.name, requestedByRole: currentUser.role, reason });
                    closeModal();
                }}
            />
        ));
    };

    const handleValidate = (trip: Trip) => {
        openModal('Validate Trip', (
            <RequestDialog
                title={`Validate Trip #${trip.id}`}
                label="Validation comments"
                confirmLabel="Validate"
                onCancel={closeModal}
                onConfirm={async (message) => {
                    await updateTrip(trip.id, {
                        status: 'completed',
                        validationComments: message || '',
                        validatedBy: currentUser?.name || currentUser?.username || '',
                        validatedAt: new Date().toISOString(),
                        pendingRequestType: null,
                        pendingRequestMessage: null,
                        pendingRequestBy: null,
                        pendingRequestRole: null,
                        pendingRequestAt: null,
                    });
                    await notificationApi.create({
                        message: `Trip #${trip.id} validated. ${message || ''}`.trim(),
                        type: 'info',
                        targetRole: Role.ADMIN,
                        targetUser: null,
                        tripId: trip.id,
                        requestType: 'validated',
                        requesterName: currentUser?.name || 'Admin',
                        requesterRole: currentUser?.role || Role.ADMIN,
                        requestMessage: message || '',
                    });
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
                    });
                    closeModal();
                }}
            />
        ));
    };
    
    const paginatedTrips = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return inTransitTrips.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [inTransitTrips, currentPage]);

    const totalPages = Math.ceil(inTransitTrips.length / ITEMS_PER_PAGE);

    const getDelay = (dateStr: string) => {
        const startDate = new Date(dateStr);
        const diffTime = Math.abs(new Date().getTime() - startDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return '1 day ago';
        return `${diffDays} days ago`;
    };

    const headers = ['S. No.', 'Date', 'Invoice & DC Number', 'Vendor & Customer Name', 'Transport & Owner Name', 'Vehicle Number', 'Mine & Quarry Name', 'Material Type', 'Royalty Owner Name', 'Net Weight (Tons)', 'Pickup Place', 'Drop-off Place', 'Status', 'Actions'];

    if (canManageTrips) {
        return <Navigate to="/trips" replace />;
    }

    return (
        <div className="relative">
            <PageHeader
                title="Trips In Transit"
                subtitle={`${inTransitTrips.length} trips available. ${delayedTripsCount > 0 ? `⚠️ ${delayedTripsCount} are delayed (>48h).` : ''}`}
                filters={{}}
                onFilterChange={() => {}}
                filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
                showAddAction={false}
            />
            <main className="pt-6">
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                     <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Received Trips</h2>
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                    <DataTable
                        title=""
                        headers={headers}
                        data={paginatedTrips}
                        renderRow={(trip: Trip, index: number) => (
                            <tr key={trip.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(trip.date)} ({getDelay(trip.date)})</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.invoiceDCNumber || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.customer || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.transporterName || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{trip.vehicleNumber || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.quarryName || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.material || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.royaltyOwnerName || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.netWeight ?? '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.pickupPlace || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{trip.dropOffPlace || trip.place || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {(() => {
                                        const status = (trip.status || '').toLowerCase();
                                        if (status === 'completed') {
                                            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
                                        }
                                        if (status === 'pending validation') {
                                            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">Pending Validation</span>;
                                        }
                                        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">In Transit</span>;
                                    })()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                                    <button onClick={() => openModal(`View Trip #${trip.id}`, <SupervisorTripForm mode="view" trip={trip} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                    {(currentUser?.role === Role.DROPOFF_SUPERVISOR) && (trip.status || '').toLowerCase() === 'in transit' && (
                                        <>
                                            <button onClick={() => handleReceive(trip)} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Receive</button>
                                            <button
                                                onClick={() => {
                                                    openModal('Request Update', (
                                                        <RequestDialog
                                                            title={`Request update for Trip #${trip.id}`}
                                                            confirmLabel="Send Request"
                                                            onCancel={closeModal}
                                                            onConfirm={async (reason) => {
                                                                await tripApi.requestUpdate(trip.id, { requestedBy: currentUser.name, requestedByRole: currentUser.role, reason });
                                                                closeModal();
                                                            }}
                                                        />
                                                    ));
                                                }}
                                                className={`px-3 py-2 text-sm font-medium rounded-md ${trip.pendingRequestType === 'update' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-amber-900 bg-amber-200 hover:bg-amber-300'}`}
                                                disabled={trip.pendingRequestType === 'update'}
                                            >
                                                {trip.pendingRequestType === 'update' ? 'Update Requested' : 'Request Update'}
                                            </button>
                                        </>
                                    )}
                                    {(currentUser?.role === Role.DROPOFF_SUPERVISOR) && (trip.status || '').toLowerCase() !== 'in transit' && (trip.status || '').toLowerCase() !== 'completed' && (
                                        <button
                                            onClick={() => {
                                                openModal('Request Update', (
                                                    <RequestDialog
                                                        title={`Request update for Trip #${trip.id}`}
                                                        confirmLabel="Send Request"
                                                        onCancel={closeModal}
                                                        onConfirm={async (reason) => {
                                                            await tripApi.requestUpdate(trip.id, { requestedBy: currentUser.name, requestedByRole: currentUser.role, reason });
                                                            closeModal();
                                                        }}
                                                    />
                                                ));
                                            }}
                                            className={`px-3 py-2 text-sm font-medium rounded-md ${trip.pendingRequestType === 'update' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-amber-900 bg-amber-200 hover:bg-amber-300'}`}
                                            disabled={trip.pendingRequestType === 'update'}
                                        >
                                            {trip.pendingRequestType === 'update' ? 'Update Requested' : 'Request Update'}
                                        </button>
                                    )}
                                    {(currentUser?.role === Role.DROPOFF_SUPERVISOR) && (trip.status || '').toLowerCase() === 'completed' && (
                                        <button
                                            onClick={() => handleRaiseIssue(trip)}
                                            className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300"
                                        >
                                            Raise Issue
                                        </button>
                                    )}
                                    {canManageTrips && (
                                        <>
                                            <button onClick={() => openModal(`Edit Trip #${trip.id}`, <SupervisorTripForm mode="edit" trip={trip} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
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
                                        </>
                                    )}
                                </td>
                            </tr>
                        )}
                    />
                 </div>
            </main>
        </div>
    );
};
export default ReceivedTrips;
