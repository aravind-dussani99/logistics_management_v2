import React, { useEffect, useState, useMemo } from 'react';
import { Trip } from '../../types';
import { api } from '../../services/mockApi';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import PageHeader from '../../components/PageHeader';
import { useUI } from '../../contexts/UIContext';
import SupervisorTripForm from '../../components/SupervisorTripForm';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import { tripApi } from '../../services/tripApi';
import { formatDateDisplay } from '../../utils';
import RequestDialog from '../../components/RequestDialog';
import { useLocation } from 'react-router-dom';
import { notificationApi } from '../../services/notificationApi';
import { Notification } from '../../types';
import AlertDialog from '../../components/AlertDialog';

const SUPERVISOR_TRIPS_PER_PAGE = 10;

const getMtdRange = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return {
      dateFrom: formatDate(startOfMonth),
      dateTo: formatDate(today)
    };
};

const SupervisorTripReport: React.FC = () => {
    const { currentUser } = useAuth();
    const { trips, refreshKey, deleteTrip, loadTrips } = useData();
    const { openModal, closeModal } = useUI();
    const location = useLocation();
    const [myTrips, setMyTrips] = useState<Trip[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [filters, setFilters] = useState<{dateFrom?: string; dateTo?: string}>(getMtdRange());
    const [requestMessage, setRequestMessage] = useState('');
    const [activeNotification, setActiveNotification] = useState<Notification | null>(null);

    useEffect(() => {
        loadTrips();
    }, [loadTrips, refreshKey]);
    
    useEffect(() => {
        if (currentUser) {
            const supervisorTrips = trips.filter(trip => trip.createdBy === currentUser.name)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setMyTrips(supervisorTrips);
        }
    }, [trips, currentUser, refreshKey]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const notificationId = params.get('notificationId');
        if (!notificationId) return;
        notificationApi.getById(notificationId).then(note => {
            setActiveNotification(note);
            if (note.tripId) {
                const trip = trips.find(t => t.id === note.tripId);
                if (trip) {
                    openModal(`Trip #${trip.id}`, <SupervisorTripForm mode="view" trip={trip} onClose={closeModal} />);
                }
            }
        }).catch(error => {
            console.error('Failed to load notification', error);
        });
    }, [location.search, trips, openModal, closeModal]);
    
    const filteredTrips = useMemo(() => {
        const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
        const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
        return myTrips.filter(trip => {
            const tripDate = trip.date ? new Date(trip.date) : null;
            if (fromDate && tripDate && tripDate < fromDate) return false;
            if (toDate && tripDate && tripDate > toDate) return false;
            return true;
        });
    }, [myTrips, filters]);

    const paginatedTrips = useMemo(() => {
        const startIndex = (currentPage - 1) * SUPERVISOR_TRIPS_PER_PAGE;
        return filteredTrips.slice(startIndex, startIndex + SUPERVISOR_TRIPS_PER_PAGE);
    }, [filteredTrips, currentPage]);

    const totalPages = Math.ceil(filteredTrips.length / SUPERVISOR_TRIPS_PER_PAGE);

    const handleEnterTrip = () => {
        openModal('Enter New Trip', <SupervisorTripForm mode="enter" onClose={closeModal} />);
    };
    
    const handleUpload = (trip: Trip) => {
        openModal('Upload Trip Documents', <SupervisorTripForm mode="upload" trip={trip} onClose={closeModal} />);
    };
    
    const handleEdit = (trip: Trip) => {
        openModal('Edit Trip', <SupervisorTripForm mode="edit" trip={trip} onClose={closeModal} />);
    };
    
    const handleView = (trip: Trip) => {
        openModal('View Trip Details', <SupervisorTripForm mode="view" trip={trip} onClose={closeModal} />);
    };

    const handleDelete = async (tripId: number) => {
        openModal('Delete Trip', (
            <AlertDialog
                message="Delete this trip? This action cannot be undone."
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onCancel={closeModal}
                onConfirm={async () => {
                    await deleteTrip(tripId);
                    closeModal();
                }}
            />
        ));
    };

    const handleRequestUpdate = async (trip: Trip) => {
        if (!currentUser) return;
        openModal('Request Update', (
            <RequestDialog
                title={`Request update for Trip #${trip.id}`}
                confirmLabel="Send Request"
                onCancel={closeModal}
                onConfirm={async (reason) => {
                    try {
                        await tripApi.requestUpdate(trip.id, { requestedBy: currentUser.name, requestedByRole: currentUser.role, requestedByContact: currentUser.mobileNumber || '', reason });
                        setRequestMessage('Update request sent to admin for review.');
                        setTimeout(() => setRequestMessage(''), 4000);
                    } catch (error) {
                        console.error('Failed to request update', error);
                        setRequestMessage('Failed to send update request. Please try again.');
                        setTimeout(() => setRequestMessage(''), 4000);
                    } finally {
                        closeModal();
                    }
                }}
            />
        ));
    };

    const handleRaiseIssue = async (trip: Trip) => {
        if (!currentUser) return;
        openModal('Raise Issue', (
            <RequestDialog
                title={`Raise issue for Trip #${trip.id}`}
                label="Raise Issue Comments"
                confirmLabel="Submit Issue"
                onCancel={closeModal}
                onConfirm={async (reason) => {
                    try {
                        await tripApi.raiseIssue(trip.id, { requestedBy: currentUser.name, requestedByRole: currentUser.role, requestedByContact: currentUser.mobileNumber || '', reason });
                        setRequestMessage('Issue sent to admin for review.');
                        setTimeout(() => setRequestMessage(''), 4000);
                    } catch (error) {
                        console.error('Failed to raise issue', error);
                        setRequestMessage('Failed to raise issue. Please try again.');
                        setTimeout(() => setRequestMessage(''), 4000);
                    } finally {
                        closeModal();
                    }
                }}
            />
        ));
    };

    const getStatusBadge = (status: Trip['status']) => {
        switch(status) {
            case 'pending upload': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending Upload</span>;
            case 'in transit': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">In Transit</span>;
            case 'pending validation': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">Pending Validation</span>;
            case 'completed':
            case 'trip completed':
            case 'validated':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
            default: return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>
        }
    }
    
    const headers = ['S. No.', 'Trip #', 'Date', 'Invoice & DC Number', 'Vendor & Customer Name', 'Transport & Owner Name', 'Vehicle Number', 'Mine & Quarry Name', 'Material Type', 'Royalty Owner Name', 'Net Weight (Tons)', 'Pickup Place', 'Drop-off Place', 'Status', 'Actions'];

    return (
        <div className="relative">
            <PageHeader
                title="Enter Trips"
                subtitle={`You have entered ${myTrips.length} trips.`}
                filters={{}}
                onFilterChange={() => {}}
                filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
                pageAction={{ label: 'Enter Trip', action: handleEnterTrip }}
            />
            <main className="pt-6">
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                     <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-semibold">My Trip Entries</h2>
                            <div className="flex items-center gap-2">
                                <label className="text-sm">From:</label>
                                <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className="px-2 py-1 text-sm rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"/>
                                <label className="text-sm">To:</label>
                                <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} className="px-2 py-1 text-sm rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"/>
                            </div>
                        </div>
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                    {activeNotification && (
                        <div className="px-4 py-2 text-sm bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 border-b dark:border-gray-700">
                            <div className="font-semibold">
                                {activeNotification.requesterName || 'Request'}
                                {activeNotification.requesterContact ? ` • ${activeNotification.requesterContact}` : ''}
                            </div>
                            <div>{activeNotification.message}</div>
                        </div>
                    )}
                    {requestMessage && (
                        <div className="px-4 py-2 text-sm bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 border-b dark:border-gray-700">
                            {requestMessage}
                        </div>
                    )}
                    <DataTable
                        title=""
                        headers={headers}
                        data={paginatedTrips}
                        renderRow={(trip: Trip, index: number) => (
                            <tr key={trip.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * SUPERVISOR_TRIPS_PER_PAGE + index + 1}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">#{trip.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(trip.date)}</td>
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(trip.status)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                {trip.status === 'pending upload' ? (
                                    <>
                                        <button onClick={() => handleView(trip)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                        <button onClick={() => handleUpload(trip)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Upload</button>
                                        <button onClick={() => handleEdit(trip)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Edit</button>
                                        <button onClick={() => handleDelete(trip.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                                    </>
                                ) : trip.status === 'in transit' ? (
                                    <>
                                        <button onClick={() => handleView(trip)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                        <button
                                            onClick={() => handleRequestUpdate(trip)}
                                            className={`px-3 py-2 text-sm font-medium rounded-md ${trip.pendingRequestType === 'update' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-amber-900 bg-amber-200 hover:bg-amber-300'}`}
                                            disabled={trip.pendingRequestType === 'update'}
                                        >
                                            {trip.pendingRequestType === 'update' ? 'Update Requested' : 'Request Update'}
                                        </button>
                                    </>
                                ) : trip.status === 'pending validation' ? (
                                    <>
                                        <button onClick={() => handleView(trip)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                        <button
                                            onClick={() => handleRequestUpdate(trip)}
                                            className={`px-3 py-2 text-sm font-medium rounded-md ${trip.pendingRequestType === 'update' ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-amber-900 bg-amber-200 hover:bg-amber-300'}`}
                                            disabled={trip.pendingRequestType === 'update'}
                                        >
                                            {trip.pendingRequestType === 'update' ? 'Update Requested' : 'Request Update'}
                                        </button>
                                    </>
                                ) : ['completed', 'validated', 'trip completed'].includes(trip.status) ? (
                                    <>
                                        <button onClick={() => handleView(trip)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                        <button onClick={() => handleRaiseIssue(trip)} className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300">Raise Issue</button>
                                    </>
                                ) : (
                                     <button onClick={() => handleView(trip)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                )}
                                </td>
                            </tr>
                        )}
                    />
                 </div>
            </main>
        </div>
    );
}

export default SupervisorTripReport;
