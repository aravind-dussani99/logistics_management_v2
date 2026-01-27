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
import { Trip, DailyExpense, Payment, Role, Notification } from '../types';
import { formatCurrency } from '../utils';
import SupervisorTripForm from '../components/SupervisorTripForm';
import TripHistoryDialog from '../components/TripHistoryDialog';
import ReceiveTripForm from '../components/ReceiveTripForm';
import RequestDialog from '../components/RequestDialog';
import AlertDialog from '../components/AlertDialog';
import DailyExpenseForm from '../components/DailyExpenseForm';
import PaymentForm from '../components/PaymentForm';
import { tripApi } from '../services/tripApi';
import { notificationApi } from '../services/notificationApi';

type ReportType = 'trips' | 'payments' | 'expenses' | 'trip-rates' | 'bills';
const ITEMS_PER_PAGE = 10;

const Reports: React.FC<{ mode?: 'reports' | 'dashboard' }> = ({ mode = 'reports' }) => {
    const location = useLocation();
    const { currentUser } = useAuth();
    const { openModal, closeModal } = useUI();
    const { trips, payments, getDailyExpenses, getSupervisorAccounts, refreshKey, loadTrips, loadPayments, updateTrip, deleteTrip, updateDailyExpense, deleteDailyExpense, updatePayment, deletePayment } = useData();
    const canViewAll = currentUser?.role === Role.ADMIN || currentUser?.role === Role.MANAGER || currentUser?.role === Role.ACCOUNTANT;
    const isDropoffSupervisor = currentUser?.role === Role.DROPOFF_SUPERVISOR;
    const isPickupSupervisor = currentUser?.role === Role.PICKUP_SUPERVISOR;
    const isSiteManager = currentUser?.role === Role.SITE_MANAGER;
    const [reportType, setReportType] = useState<ReportType>('trips');
    const [filters, setFilters] = useState<Filters>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [allExpenses, setAllExpenses] = useState<DailyExpense[]>([]);
    const [isPrinting, setIsPrinting] = useState(false);
    const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
    useEffect(() => {
        const state = location.state as { reportType?: ReportType } | null;
        if (state?.reportType) {
            const mappedType = state.reportType === 'received' ? 'trips' : state.reportType;
            setReportType(mappedType as ReportType);
            return;
        }
        if (mode === 'dashboard') {
            setReportType('trips');
        }
    }, [location.state, mode, isDropoffSupervisor]);

    useEffect(() => {
        if (reportType === 'trips' || reportType === 'trip-rates' || reportType === 'bills') {
            loadTrips();
        }
        if (reportType === 'payments') {
            loadPayments();
        }
    }, [loadTrips, loadPayments, refreshKey, reportType]);

    useEffect(() => {
        const fetchAllExpenses = async () => {
            if (!currentUser) return;
            if (reportType !== 'expenses') {
                setAllExpenses([]);
                return;
            }
            if (canViewAll) {
                const supervisors = await getSupervisorAccounts();
                const all = await Promise.all(
                    supervisors.map(name => getDailyExpenses(name).then(res => res?.expenses ?? []))
                );
                setAllExpenses(all.flat());
            } else {
                const result = await getDailyExpenses(currentUser.name);
                setAllExpenses(Array.isArray(result?.expenses) ? result.expenses : []);
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

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const notificationId = params.get('notificationId');
        if (!notificationId) return;
        notificationApi.getById(notificationId).then(note => {
            setActiveNotification(note);
            if (note.tripId) {
                const trip = trips.find(t => t.id === note.tripId);
                if (trip) {
                    openModal(`Trip #${trip.id} History`, <TripHistoryDialog trip={trip} notification={note} onClose={closeModal} />);
                }
            }
        }).catch(error => {
            console.error('Failed to load notification', error);
        });
    }, [location.search, trips, openModal, closeModal]);

    const getBillStatus = (trip: Trip) => {
        const hasRate = Number(trip.vendorCustomerRatePerTon || 0) > 0;
        const hasName = Boolean((trip.actualVendorCustomerName || '').trim());
        return hasRate && hasName ? 'Applied' : 'Awaiting';
    };

    const getTripRateStatus = (trip: Trip) => {
        const mode = trip.rateMode || 'activity';
        if (mode === 'all_in') {
            const hasRates = Number(trip.allInCostPerTon || 0) > 0 && Number(trip.customerRatePerTon || 0) > 0;
            return hasRates ? 'Applied' : 'Awaiting';
        }
        const hasAnyRate = Number(trip.materialCost || 0) > 0
            || Number(trip.transportCost || 0) > 0
            || Number(trip.royaltyCost || 0) > 0
            || Number(trip.customerRatePerTon || 0) > 0
            || Number(trip.vendorCustomerRatePerTon || 0) > 0;
        return hasAnyRate ? 'Applied' : 'Awaiting';
    };

    const handleExport = () => {
        let headers: string[] = [];
        let rows: (string|number)[][] = [];
        let filename = `report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

        switch(reportType) {
            case 'trips':
                headers = ["Date", "Invoice & DC Number", "Vendor & Customer Name", "Transport & Owner Name", "Vehicle Number", "Mine & Quarry Name", "Material Type", "Royalty Owner Name", "Net Weight", "Pickup Place", "Drop-off Place", "Status"];
                rows = filteredData.map(d => {
                    const t = d as Trip;
                    return [t.date, t.invoiceDCNumber, t.customer, t.transporterName, t.vehicleNumber, t.quarryName, t.material, t.royaltyOwnerName, t.netWeight, t.pickupPlace, t.dropOffPlace || t.place, t.status];
                });
                break;
            case 'payments':
                headers = ["Date", "Transaction Type", "From Account", "To Name", "To Account", "Amount", "Remarks", "Head Account", "Via", "Trip ID", "Category", "Sub-Category"];
                rows = filteredData.map(d => {
                    const p = d as Payment;
                    return [p.date, p.type, p.fromAccount || '', p.ratePartyName || '', p.toAccount || '', p.amount, p.remarks || '', p.headAccount || '', p.via || '', p.tripId || '', p.category || '', p.subCategory || ''];
                });
                break;
            case 'expenses':
                headers = ["Date", "Supervisor", "To", "Amount", "Type"];
                 rows = filteredData.map(d => {
                    const e = d as DailyExpense;
                    return [e.date, e.from, e.to, e.amount, e.type];
                });
                break;
            case 'trip-rates':
                headers = ["Date", "Trip #", "Invoice/DC", "Customer", "Rate Mode", "Rate Status", "Customer Rate/Ton", "Material Cost", "Transport Cost", "Royalty Cost", "Total Cost"];
                rows = filteredData.map(d => {
                    const t = d as Trip;
                    const totalCost = Number(t.materialCost || 0) + Number(t.transportCost || 0) + Number(t.royaltyCost || 0);
                    const rateStatus = getTripRateStatus(t);
                    return [t.date, t.id, t.invoiceDCNumber, t.customer, t.rateMode || '-', rateStatus, t.vendorCustomerRatePerTon || t.customerRatePerTon || 0, t.materialCost || 0, t.transportCost || 0, t.royaltyCost || 0, totalCost];
                });
                break;
            case 'bills':
                headers = ["Date", "Trip #", "Invoice/DC", "Customer", "Actual Name", "Rate/Ton", "Net Tons", "Bill Amount", "Bill Status"];
                rows = filteredData.map(d => {
                    const t = d as Trip;
                    const rate = Number(t.vendorCustomerRatePerTon || 0);
                    const net = Number(t.netWeight || 0);
                    const billStatus = getBillStatus(t);
                    return [t.date, t.id, t.invoiceDCNumber, t.customer, t.actualVendorCustomerName || '', rate, net, (rate * net) || 0, billStatus];
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
            case 'payments': data = payments; break;
            case 'expenses': data = allExpenses; break;
            case 'trip-rates': data = trips; break;
            case 'bills': data = trips; break;
        }

        const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
        const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;

        const openingBalanceEntry = reportType === 'expenses'
            ? {
                id: 'opening',
                date: '---',
                from: 'System',
                to: 'Opening Balance',
                amount: 0,
                remarks: '',
                availableBalance: 0,
                closingBalance: 0,
                type: 'CREDIT',
                via: '',
                headAccount: '',
                category: '',
                subCategory: '',
                ratePartyName: '',
                siteExpense: false,
              }
            : null;

        const combinedData = openingBalanceEntry ? [openingBalanceEntry, ...data] : data;

        return (combinedData || []).filter(item => {
            if (item?.id === 'opening') return true;
            const itemDate = item?.date ? new Date(item.date) : null;
            if (fromDate && itemDate && itemDate < fromDate) return false;
            if (toDate && itemDate && itemDate > toDate) return false;
            return true;
        }).sort((a, b) => {
            if (a?.id === 'opening') return -1;
            if (b?.id === 'opening') return 1;
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            const aId = typeof a.id === 'number' ? a.id : 0;
            const bId = typeof b.id === 'number' ? b.id : 0;
            return aId - bId;
        });
    }, [reportType, filters, trips, payments, allExpenses, currentUser]);

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
                    await tripApi.raiseIssue(trip.id, { requestedBy: currentUser.name, requestedByRole: currentUser.role, requestedByContact: currentUser.mobileNumber || '', reason });
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
                    await tripApi.requestUpdate(trip.id, { requestedBy: currentUser.name, requestedByRole: currentUser.role, requestedByContact: currentUser.mobileNumber || '', reason });
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
                        requesterContact: currentUser.mobileNumber || '',
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
                        requesterContact: currentUser.mobileNumber || '',
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

    const openPaymentModal = (title: string, payment?: Payment, isViewMode?: boolean) => {
        openModal(title, (
            <PaymentForm
                initialData={payment}
                onSave={async (data) => {
                    if (payment) {
                        await updatePayment(payment.id, data);
                    }
                }}
                onClose={closeModal}
                isViewMode={isViewMode}
                hideSecondary={Boolean(isViewMode)}
            />
        ));
    };

    const renderTable = () => {
        const canManageTrips = currentUser?.role === Role.ADMIN || currentUser?.role === Role.MANAGER || currentUser?.role === Role.ACCOUNTANT;
        const showActions = mode === 'dashboard';
        switch(reportType) {
            case 'trips': {
                const headers = showActions
                    ? ['S. No.', 'Trip #', 'Date', 'Invoice & DC Number', 'Vendor & Customer Name', 'Transport & Owner Name', 'Vehicle Number', 'Mine & Quarry Name', 'Material Type', 'Royalty Owner Name', 'Net Weight (Tons)', 'Pickup Place', 'Drop-off Place', 'Status', 'Actions'] 
                    : ['Date', 'Vehicle', 'Customer', 'Material', 'Quarry', 'Net Weight', 'Status'];
                return <DataTable title="" headers={headers} data={tableData} renderRow={(t: Trip, index: number) => (
                    <tr key={t.id}>
                        {showActions ? (
                            <>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{index + 1}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">#{t.id}</td>
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
                                                    {(t.activityCount ?? 0) > 0 && (
                                                        <button onClick={() => openModal(`Trip #${t.id} History`, <TripHistoryDialog trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">History</button>
                                                    )}
                                                    {isPendingUpload && (
                                                        <>
                                                            <button onClick={() => openModal(`Upload Trip #${t.id}`, <SupervisorTripForm mode="upload" trip={t} onClose={closeModal} onSubmitSuccess={loadTrips} />)} className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Upload</button>
                                                            <button onClick={() => openModal(`Edit Trip #${t.id}`, <SupervisorTripForm mode="edit" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                                                            <button onClick={() => deleteTrip(t.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                                                        </>
                                                    )}
                                                    {!isPendingUpload && !isPendingValidation && !isCompleted && (
                                                        <button onClick={() => openModal(`Edit Trip #${t.id}`, <SupervisorTripForm mode="edit" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                                                    )}
                                                    {!isPendingUpload && !isCompleted && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleRequestUpdate(t)}
                                                                className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300"
                                                            >
                                                                Request Update
                                                            </button>
                                                            {t.pendingRequestType === 'update' && (
                                                                <span className="text-xxs font-semibold text-amber-300">Update requested</span>
                                                            )}
                                                        </div>
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
                                                    {(t.activityCount ?? 0) > 0 && (
                                                        <button onClick={() => openModal(`Trip #${t.id} History`, <TripHistoryDialog trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">History</button>
                                                    )}
                                                    {isInTransit && (
                                                        <>
                                                            <button onClick={() => handleReceive(t)} className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Receive</button>
                                                            <button
                                                                onClick={() => handleSendBackToPickup(t)}
                                                                className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300"
                                                            >
                                                                Send Back to Update
                                                            </button>
                                                        </>
                                                    )}
                                                    {isPendingValidation && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleRequestUpdate(t)}
                                                                className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300"
                                                            >
                                                                Request Update
                                                            </button>
                                                            {t.pendingRequestType === 'update' && (
                                                                <span className="text-xxs font-semibold text-amber-300">Update requested</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {isCompleted && (
                                                        <button onClick={() => handleRaiseIssue(t)} className="px-3 py-2 text-sm font-medium text-amber-900 bg-amber-200 rounded-md hover:bg-amber-300">Raise Issue</button>
                                                    )}
                                                </>
                                            );
                                        }
                                        if (isSiteManager) {
                                            return (
                                                <>
                                                    <button onClick={() => openModal(`View Trip #${t.id}`, <SupervisorTripForm mode="view" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                                    {(t.activityCount ?? 0) > 0 && (
                                                        <button onClick={() => openModal(`Trip #${t.id} History`, <TripHistoryDialog trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">History</button>
                                                    )}
                                                    {(t.status || '').toLowerCase() === 'pending upload' && (
                                                        <button onClick={() => openModal(`Upload Trip #${t.id}`, <SupervisorTripForm mode="upload" trip={t} onClose={closeModal} onSubmitSuccess={loadTrips} />)} className="px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Upload</button>
                                                    )}
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
                                                </>
                                            );
                                        }
                                        return (
                                            <>
                                                <button onClick={() => openModal(`View Trip #${t.id}`, <SupervisorTripForm mode="view" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                                {(t.activityCount ?? 0) > 0 && (
                                                    <button onClick={() => openModal(`Trip #${t.id} History`, <TripHistoryDialog trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">History</button>
                                                )}
                                            </>
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
                                                                    requesterContact: currentUser?.mobileNumber || '',
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
            case 'payments': {
                 const headers = showActions
                    ? ["Date", "Transaction Type", "From Account", "To Name", "To Account", "Amount", "Remarks", "Head Account", "Via", "Trip ID", "Category", "Sub-Category", "Actions"]
                    : ["Date", "Transaction Type", "From Account", "To Name", "To Account", "Amount", "Remarks", "Head Account", "Via", "Trip ID", "Category", "Sub-Category"];
                 return <DataTable title="" headers={headers} data={tableData} renderRow={(p: Payment) => (
                    <tr key={p.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(p.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.fromAccount || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.ratePartyName || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.toAccount || '-'}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${p.type === 'PAYMENT' ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(p.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.remarks || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.headAccount || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.via || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.tripId ? `#${p.tripId}` : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.category || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.subCategory || '-'}</td>
                        {showActions && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 no-print">
                                <button onClick={() => openPaymentModal('View Payment', p, true)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                                <button onClick={() => openPaymentModal('Edit Payment', p)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                                <button
                                    onClick={() => {
                                        openModal('Delete Payment', (
                                            <AlertDialog
                                                message="Delete this payment? This action cannot be undone."
                                                confirmLabel="Delete"
                                                cancelLabel="Cancel"
                                                onCancel={closeModal}
                                                onConfirm={async () => {
                                                    await deletePayment(p.id);
                                                    closeModal();
                                                }}
                                            />
                                        ));
                                    }}
                                    className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </td>
                        )}
                    </tr>
                )} />;
            }
            case 'trip-rates': {
                const headers = showActions
                  ? ['Date', 'Trip #', 'Invoice/DC', 'Customer', 'Rate Mode', 'Rate Status', 'Customer Rate/Ton', 'Material Cost', 'Transport Cost', 'Royalty Cost', 'Total Cost', 'Actions']
                  : ['Date', 'Trip #', 'Invoice/DC', 'Customer', 'Rate Mode', 'Rate Status', 'Customer Rate/Ton', 'Material Cost', 'Transport Cost', 'Royalty Cost', 'Total Cost'];
                return <DataTable title="" headers={headers} data={tableData} renderRow={(t: Trip) => {
                    const totalCost = Number(t.materialCost || 0) + Number(t.transportCost || 0) + Number(t.royaltyCost || 0);
                    const rateStatus = getTripRateStatus(t);
                    return (
                      <tr key={t.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(t.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">#{t.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.invoiceDCNumber || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.customer || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.rateMode || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{rateStatus}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(Number(t.vendorCustomerRatePerTon || t.customerRatePerTon || 0))}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(Number(t.materialCost || 0))}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(Number(t.transportCost || 0))}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(Number(t.royaltyCost || 0))}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(totalCost)}</td>
                        {showActions && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 no-print">
                            <button onClick={() => openModal(`View Trip #${t.id}`, <SupervisorTripForm mode="view" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
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
                          </td>
                        )}
                      </tr>
                    );
                }} />;
            }
            case 'bills': {
                const headers = showActions
                  ? ['Date', 'Trip #', 'Invoice/DC', 'Customer', 'Actual Name', 'Rate/Ton', 'Net Tons', 'Bill Amount', 'Bill Status', 'Actions']
                  : ['Date', 'Trip #', 'Invoice/DC', 'Customer', 'Actual Name', 'Rate/Ton', 'Net Tons', 'Bill Amount', 'Bill Status'];
                return <DataTable title="" headers={headers} data={tableData} renderRow={(t: Trip) => {
                    const rate = Number(t.vendorCustomerRatePerTon || 0);
                    const net = Number(t.netWeight || 0);
                    const billStatus = getBillStatus(t);
                    return (
                      <tr key={t.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(t.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">#{t.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.invoiceDCNumber || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.customer || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.actualVendorCustomerName || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(rate)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{net.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(rate * net)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{billStatus}</td>
                        {showActions && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 no-print">
                            <button onClick={() => openModal(`View Trip #${t.id}`, <SupervisorTripForm mode="view" trip={t} onClose={closeModal} />)} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
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
                          </td>
                        )}
                      </tr>
                    );
                }} />;
            }
            case 'expenses':
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
                title={mode === 'dashboard' ? 'Management Ledger' : 'Reports'}
                filters={filters}
                onFilterChange={setFilters}
                filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }} // Simplified for now
                showFilters={['singleDate', 'vehicle', 'vendor', 'material']}
                showAddAction={false}
            />
            <main className="pt-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                    <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-semibold">Records</h2>
                            <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="px-2 py-1 text-sm rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary">
                                <option value="trips">Trips</option>
                                <option value="payments">Payments</option>
                                <option value="expenses">Daily Expenses</option>
                                <option value="trip-rates">Trips Rate</option>
                                <option value="bills">Bills / Invoices</option>
                            </select>
                            <button onClick={handleExport} className="px-3 py-1 text-xs font-medium text-green-600 border border-green-600 rounded-md hover:bg-green-600 hover:text-white transition">
                                Export to Excel
                            </button>
                        </div>
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={filteredData.length}
                            pageSize={ITEMS_PER_PAGE}
                        />
                    </div>
                    {activeNotification && (
                        <div className="px-4 py-2 text-sm bg-amber-50 text-amber-900 border-b dark:border-gray-700">
                            <div className="font-semibold">
                                Trip request from {activeNotification.requesterName || 'Supervisor'}
                                {activeNotification.requesterContact ? ` - ${activeNotification.requesterContact}` : ''}
                            </div>
                            <div className="mt-1">{activeNotification.message}</div>
                        </div>
                    )}
                    {renderTable()}
                </div>
            </main>
         </div>
    );
}

export default Reports;
