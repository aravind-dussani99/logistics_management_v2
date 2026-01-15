import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { formatDateDisplay } from '../utils';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import { Trip, Advance, DailyExpense, Role } from '../types';
import { formatCurrency } from '../utils';
import SupervisorTripForm from '../components/SupervisorTripForm';
import ReceiveTripForm from '../components/ReceiveTripForm';
import RequestDialog from '../components/RequestDialog';
import AlertDialog from '../components/AlertDialog';
import DailyExpenseForm from '../components/DailyExpenseForm';
import AdvanceForm from '../components/AdvanceForm';
import { tripApi } from '../services/tripApi';
import { notificationApi } from '../services/notificationApi';

type ReportType = 'trips' | 'received' | 'advances' | 'expenses' | 'site-expenses';
const ITEMS_PER_PAGE = 20;

const Reports: React.FC<{ mode?: 'reports' | 'dashboard' }> = ({ mode = 'reports' }) => {
    const location = useLocation();
    const { currentUser } = useAuth();
    const { openModal, closeModal } = useUI();
    const { trips, advances, getDailyExpenses, getSupervisorAccounts, refreshKey, loadTrips, loadAdvances, updateTrip, deleteTrip, deleteAdvance, updateDailyExpense, deleteDailyExpense } = useData();
    const canViewAll = currentUser?.role === Role.ADMIN || currentUser?.role === Role.MANAGER || currentUser?.role === Role.ACCOUNTANT;
    const isDropoffSupervisor = currentUser?.role === Role.DROPOFF_SUPERVISOR;
    const isPickupSupervisor = currentUser?.role === Role.PICKUP_SUPERVISOR;
    const [reportType, setReportType] = useState<ReportType>(isDropoffSupervisor ? 'received' : 'trips');
    const [filters, setFilters] = useState<Filters>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [allExpenses, setAllExpenses] = useState<DailyExpense[]>([]);
    const [isPrinting, setIsPrinting] = useState(false);
    useEffect(() => {
        const state = location.state as { reportType?: ReportType } | null;
        if (state?.reportType) {
            setReportType(state.reportType);
            return;
        }
        if (mode === 'dashboard') {
            setReportType(isDropoffSupervisor ? 'received' : 'trips');
        }
    }, [location.state, mode, isDropoffSupervisor]);

    useEffect(() => {
        if (reportType === 'trips' || reportType === 'received') {
            loadTrips();
        }
        if (reportType === 'advances') {
            loadAdvances();
        }
    }, [loadTrips, loadAdvances, refreshKey, reportType]);

    useEffect(() => {
        const fetchAllExpenses = async () => {
            if (!currentUser) return;
            if (reportType !== 'expenses' && reportType !== 'site-expenses') {
                setAllExpenses([]);
                return;
            }
            if (canViewAll) {
                const supervisors = await getSupervisorAccounts();
                const all = await Promise.all(
                    supervisors.map(name => getDailyExpenses(name).then(res => res.expenses))
                );
                setAllExpenses(all.flat());
            } else {
                const { expenses } = await getDailyExpenses(currentUser.name);
                setAllExpenses(expenses);
            }
        };
        fetchAllExpenses();
    }, [getDailyExpenses, getSupervisorAccounts, refreshKey, currentUser, canViewAll, reportType]);

    useEffect(() => {
        const beforePrint = () => setIsPrinting(true);
        const afterPrint = () => setIsPrinting(false);
        window.addEventListener('beforeprint', beforePrint);
        window.addEventListener('afterprint', afterPrint);
        return () => {
            window.removeEventListener('beforeprint', beforePrint);
            window.removeEventListener('afterprint', afterPrint);
        };
    }, []);

    const handleExport = () => {
        let headers: string[] = [];
        let rows: (string|number)[][] = [];
        let filename = `report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

        switch(reportType) {
            case 'trips':
            case 'received':
                headers = ["Date", "Invoice & DC Number", "Vendor & Customer Name", "Transport & Owner Name", "Vehicle Number", "Mine & Quarry Name", "Material Type", "Royalty Owner Name", "Net Weight", "Pickup Place", "Drop-off Place", "Status"];
                rows = filteredData.map(d => {
                    const t = d as Trip;
                    return [t.date, t.invoiceDCNumber, t.customer, t.transporterName, t.vehicleNumber, t.quarryName, t.material, t.royaltyOwnerName, t.netWeight, t.pickupPlace, t.dropOffPlace || t.place, t.status];
                });
                break;
            case 'advances':
                headers = ["Date", "From", "To", "Purpose", "Amount"];
                rows = filteredData.map(d => {
                    const a = d as Advance;
                    return [a.date, a.fromAccount, a.toAccount, `"${a.purpose.replace(/"/g, '""')}"`, a.amount];
                });
                break;
            case 'expenses':
            case 'site-expenses':
                headers = ["Date", "Supervisor", "To", "Amount", "Type"];
                 rows = filteredData.map(d => {
                    const e = d as DailyExpense;
                    return [e.date, e.from, e.to, e.amount, e.type];
                });
                break;
        }

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredData = useMemo(() => {
        let data: any[] = [];
        switch(reportType) {
            case 'trips': data = trips; break;
            case 'received': data = trips; break;
            case 'advances': data = advances; break;
            case 'expenses': data = allExpenses.filter(expense => !expense.siteExpense); break;
            case 'site-expenses': data = allExpenses.filter(expense => expense.siteExpense); break;
        }

        return (data || []).filter(item => {
            if (filters.dateFrom && item.date < filters.dateFrom) return false;
            if (filters.dateTo && item.date > filters.dateTo) return false;
            if (reportType === 'received') {
                const status = (item.status || '').toLowerCase();
                if (!['in transit', 'pending validation', 'completed', 'validated', 'trip completed'].includes(status)) return false;
            }
            return true;
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reportType, filters, trips, advances, allExpenses, currentUser]);

    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredData, currentPage]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [reportType]);

    const tableData = isPrinting ? filteredData : paginatedData;

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

    const handleRequestUpdate = (trip: Trip, label = 'Request Update') => {
        if (!currentUser) return;
        openModal(label, (
            <RequestDialog
                title={`${label} for Trip #${trip.id}`}
                confirmLabel="Send Request"
                onCancel={closeModal}
                onConfirm={async (reason) => {
                    await tripApi.requestUpdate(trip.id, { requestedBy: currentUser.name, requestedByRole: currentUser.role, reason });
                    closeModal();
                }}
            />
        ));
    };

    const handleSendBackToPickup = (trip: Trip) => {
        if (!currentUser) return;
        openModal('Send Back to Pick-up Supervisor', (
            <RequestDialog
                title={`Send back to Pick-up Supervisor`}
                label="Reason"
                confirmLabel="Send Back"
                onCancel={closeModal}
                onConfirm={async (message) => {
                    await updateTrip(trip.id, {
                        status: 'pending upload',
                        pendingRequestType: 'sent-back-dropoff',
                        pendingRequestMessage: message || '',
                        pendingRequestBy: currentUser.name,
                        pendingRequestRole: currentUser.role,
                        pendingRequestAt: new Date().toISOString(),
                    });
                    await notificationApi.create({
                        message: `Trip #${trip.id} sent back to Pick-up Supervisor. ${message || ''}`.trim(),
                        type: 'alert',
                        targetRole: Role.PICKUP_SUPERVISOR,
                        targetUser: trip.createdBy || null,
                        tripId: trip.id,
                        requestType: 'sent-back-dropoff',
                        requesterName: currentUser.name,
                        requesterRole: currentUser.role,
                        requestMessage: message || '',
                    });
                    await notificationApi.create({
                        message: `Trip #${trip.id} sent back to Pick-up Supervisor. ${message || ''}`.trim(),
                        type: 'alert',
                        targetRole: Role.ADMIN,
                        targetUser: null,
                        tripId: trip.id,
                        requestType: 'sent-back-dropoff',
                        requesterName: currentUser.name,
                        requesterRole: currentUser.role,
                        requestMessage: message || '',
                    });
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
                    });
                    closeModal();
                }}
            />
        ));
    };

    const openExpenseModal = (title: string, expense?: DailyExpense, isViewMode?: boolean) => {
        openModal(title, (
            <DailyExpenseForm
                onSave={async (data) => {
                    if (expense) {
                        await updateDailyExpense(expense.id, data);
                    }
                }}
                onClose={closeModal}
                initialData={expense}
                expenses={filteredData as DailyExpense[]}
                openingBalance={0}
                isViewMode={isViewMode}
            />
        ));
    };

    const renderTable = () => {
        const canManageTrips = currentUser?.role === Role.ADMIN || currentUser?.role === Role.MANAGER || currentUser?.role === Role.ACCOUNTANT;
        switch(reportType) {
            case 'trips':
            case 'received': {
                const headers = mode === 'dashboard'
                    ? ['S. No.', 'Date', 'Invoice & DC Number', 'Vendor & Customer Name', 'Transport & Owner Name', 'Vehicle Number', 'Mine & Quarry Name', 'Material Type', 'Royalty Owner Name', 'Net Weight (Tons)', 'Pickup Place', 'Drop-off Place', 'Status', 'Actions']
                    : ['Date', 'Vehicle', 'Customer', 'Material', 'Quarry', 'Net Weight', 'Status'];
                return <DataTable title="" headers={headers} data={tableData} renderRow={(t: Trip, index: number) => (
                    <tr key={t.id}>
                        {mode === 'dashboard' ? (
                            <>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{index + 1}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(t.date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.invoiceDCNumber || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.customer || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.transporterName || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.vehicleNumber || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.quarryName || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.material || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.royaltyOwnerName || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.netWeight ?? '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.pickupPlace || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.dropOffPlace || t.place || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.status}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 no-print">
                                    {(() => {
                                        const status = (t.status || '').toLowerCase();
                                        const isCompleted = ['completed', 'validated', 'trip completed'].includes(status);
                                        const isPendingUpload = status === 'pending upload' || status === 'pending';
                                        const isInTransit = status === 'in transit';
                                        const isPendingValidation = status === 'pending validation';
                                        if (isPickupSupervisor) {
                                            return (
                                                <>
                                                    <button onClick={() => openModal(`View Trip #${t.id}`, <SupervisorTripForm mode="view" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                                    {isPendingUpload && (
                                                        <>
                                                            <button onClick={() => openModal(`Upload Trip #${t.id}`, <SupervisorTripForm mode="upload" trip={t} onClose={closeModal} onSubmitSuccess={loadTrips} />)} className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Upload</button>
                                                            <button onClick={() => openModal(`Edit Trip #${t.id}`, <SupervisorTripForm mode="edit" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                                                            <button onClick={() => deleteTrip(t.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                                                        </>
                                                    )}
                                                    {!isPendingUpload && !isCompleted && (
                                                        <button
                                                            onClick={() => handleRequestUpdate(t)}
                                                            className={`px-3 py-2 text-sm font-medium rounded-md ${(t.pendingRequestType === 'update') ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-amber-900 bg-amber-200 hover:bg-amber-300'}`}
                                                            disabled={t.pendingRequestType === 'update'}
                                                        >
                                                            {t.pendingRequestType === 'update' ? 'Update Requested' : 'Request Update'}
                                                        </button>
                                                    )}
                                                    {isCompleted && (
                                                        <button onClick={() => handleRaiseIssue(t)} className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300">Raise Issue</button>
                                                    )}
                                                </>
                                            );
                                        }
                                        if (isDropoffSupervisor) {
                                            return (
                                                <>
                                                    <button onClick={() => openModal(`View Trip #${t.id}`, <SupervisorTripForm mode="view" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                                    {isInTransit && (
                                                        <>
                                                            <button onClick={() => handleReceive(t)} className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Receive</button>
                                                            <button
                                                                onClick={() => handleSendBackToPickup(t)}
                                                                className={`px-3 py-2 text-sm font-medium rounded-md ${(t.pendingRequestType === 'sent-back-dropoff') ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-amber-900 bg-amber-200 hover:bg-amber-300'}`}
                                                                disabled={t.pendingRequestType === 'sent-back-dropoff'}
                                                            >
                                                                {t.pendingRequestType === 'sent-back-dropoff' ? 'Sent Back' : 'Send Back to Update'}
                                                            </button>
                                                        </>
                                                    )}
                                                    {isPendingValidation && (
                                                        <button
                                                            onClick={() => handleRequestUpdate(t)}
                                                            className={`px-3 py-2 text-sm font-medium rounded-md ${(t.pendingRequestType === 'update') ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'text-amber-900 bg-amber-200 hover:bg-amber-300'}`}
                                                            disabled={t.pendingRequestType === 'update'}
                                                        >
                                                            {t.pendingRequestType === 'update' ? 'Update Requested' : 'Request Update'}
                                                        </button>
                                                    )}
                                                    {isCompleted && (
                                                        <button onClick={() => handleRaiseIssue(t)} className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300">Raise Issue</button>
                                                    )}
                                                </>
                                            );
                                        }
                                        return (
                                            <button onClick={() => openModal(`View Trip #${t.id}`, <SupervisorTripForm mode="view" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                        );
                                    })()}
                                    {canManageTrips && (
                                        <>
                                            <button onClick={() => openModal(`Edit Trip #${t.id}`, <SupervisorTripForm mode="edit" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
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
                                                                    message: `Trip #${t.id} deleted by Admin.`,
                                                                    type: 'info',
                                                                    targetRole: Role.PICKUP_SUPERVISOR,
                                                                    targetUser: t.createdBy || null,
                                                                    tripId: t.id,
                                                                    requestType: 'delete',
                                                                    requesterName: currentUser?.name || 'Admin',
                                                                    requesterRole: currentUser?.role || Role.ADMIN,
                                                                });
                                                                await deleteTrip(t.id);
                                                                closeModal();
                                                            }}
                                                        />
                                                    ));
                                                }}
                                                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                                            >
                                                Delete
                                            </button>
                                            {(t.status || '').toLowerCase() === 'pending validation' && (
                                                <>
                                                    <button onClick={() => handleValidate(t)} className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Validate</button>
                                                    <button onClick={() => handleSendBack(t, 'dropoff')} className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300">Send Back to Drop-off</button>
                                                    <button onClick={() => handleSendBack(t, 'pickup')} className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300">Send Back to Pick-up</button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </td>
                            </>
                        ) : (
                            <>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(t.date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{t.vehicleNumber}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.customer}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.material}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.quarryName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.netWeight} T</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{t.status}</td>
                            </>
                        )}
                    </tr>
                )} />;
            }
            case 'advances':
                 return <DataTable title="" headers={mode === 'dashboard' ? ["Date", "From", "To", "Purpose", "Amount", "Actions"] : ["Date", "From", "To", "Purpose", "Amount"]} data={tableData} renderRow={(a: Advance) => (
                    <tr key={a.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(a.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{a.fromAccount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{a.toAccount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{a.purpose}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-500">{formatCurrency(a.amount)}</td>
                        {mode === 'dashboard' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 no-print">
                                <button onClick={() => openModal('Edit Advance', <AdvanceForm advance={a} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                                <button onClick={() => deleteAdvance(a.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                            </td>
                        )}
                    </tr>
                )} />;
            case 'expenses':
            case 'site-expenses':
                 return <DataTable title="" headers={mode === 'dashboard' ? ["Date", "Supervisor", "To", "Amount", "Type", "Actions"] : ["Date", "Supervisor", "To", "Amount", "Type"]} data={tableData} renderRow={(e: DailyExpense) => (
                     <tr key={e.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(e.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{e.from}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{e.to}</td>
                         <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${e.type === 'DEBIT' ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(e.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{e.type}</td>
                        {mode === 'dashboard' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 no-print">
                                <button onClick={() => openExpenseModal('View Transaction', e, true)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                <button onClick={() => openExpenseModal('Edit Transaction', e)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                                <button onClick={() => deleteDailyExpense(e.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                            </td>
                        )}
                    </tr>
                )} />;
        }
    }

    return (
         <div className="relative">
            <PageHeader
                title={mode === 'dashboard' ? 'Dashboard' : 'Consolidated Reports'}
                filters={filters}
                onFilterChange={setFilters}
                filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }} // Simplified for now
                showFilters={['date']}
                showAddAction={false}
            />
            <main className="pt-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                     <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-semibold">Report Data</h2>
                            <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="px-2 py-1 text-sm rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary">
                                {mode === 'dashboard' && isDropoffSupervisor ? (
                                    <option value="received">Trips Received</option>
                                ) : (
                                    <option value="trips">Trips added</option>
                                )}
                                <option value="expenses">Daily Expenses</option>
                                <option value="site-expenses">Site Expenses</option>
                                <option value="advances">Advance</option>
                            </select>
                            <button onClick={handleExport} className="px-3 py-1 text-xs font-medium text-green-600 border border-green-600 rounded-md hover:bg-green-600 hover:text-white transition">
                                Export to Excel
                            </button>
                        </div>
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                    {renderTable()}
                </div>
            </main>
         </div>
    );
}

export default Reports;
