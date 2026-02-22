import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { computeTripGstAmount, formatCurrency, formatDateDisplay, getCombinedRatePerTon, getComboPartyTypes, isComboRate, resolveTripRate } from '../utils';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import { Trip, DailyExpense, Payment, Role, Notification, MaterialRate, RatePartyType } from '../types';
import SupervisorTripForm from '../components/SupervisorTripForm';
import TripHistoryDialog from '../components/TripHistoryDialog';
import ReceiveTripForm from '../components/ReceiveTripForm';
import RequestDialog from '../components/RequestDialog';
import AlertDialog from '../components/AlertDialog';
import DailyExpenseForm from '../components/DailyExpenseForm';
import PaymentForm from '../components/PaymentForm';
import { tripApi } from '../services/tripApi';
import { notificationApi } from '../services/notificationApi';
import { tripRateApi } from '../services/tripRateApi';
import { billsApi } from '../services/billsApi';

type ReportType = 'trips' | 'payments' | 'expenses' | 'trip-rates' | 'gst-trip-rates' | 'bills';
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

type TripRateDialogValues = {
    combinedRate?: string;
    mineRate?: string;
    transportRate?: string;
    royaltyRate?: string;
};

const getComboLabel = (comboTypes: RatePartyType[]): string => {
    const hasMine = comboTypes.includes('mine-quarry');
    const hasTransport = comboTypes.includes('transport-owner');
    const hasRoyalty = comboTypes.includes('royalty-owner');
    if (hasMine && hasTransport && hasRoyalty) return 'Mine_Royalty_Transport';
    if (hasMine && hasTransport) return 'Mine_Transport';
    if (hasMine && hasRoyalty) return 'Mine_Royalty';
    if (hasTransport && hasRoyalty) return 'Royalty_Transport';
    return 'Individual';
};

const getRateModeLabel = (trip: Trip, comboTypes: RatePartyType[]): string => {
    const uniqueComboTypes = Array.from(new Set(comboTypes));
    if (uniqueComboTypes.length === 3) return 'Mine_Royalty_Transport';
    if (uniqueComboTypes.length === 2) {
        const comboLabel = getComboLabel(uniqueComboTypes);
        const presentTypes: RatePartyType[] = [];
        if (trip.quarryName) presentTypes.push('mine-quarry');
        if (trip.transporterName) presentTypes.push('transport-owner');
        if (trip.royaltyOwnerName) presentTypes.push('royalty-owner');
        const missingType = presentTypes.find(type => !uniqueComboTypes.includes(type));
        if (!missingType) return comboLabel;
        const missingLabel = missingType === 'mine-quarry'
            ? 'Mine'
            : (missingType === 'transport-owner' ? 'Transport' : 'Royalty');
        return `${comboLabel} + ${missingLabel}`;
    }
    return 'Individual';
};

const TripRateDialog: React.FC<{
    mode: 'view' | 'edit';
    trip: Trip;
    comboTypes: RatePartyType[];
    initialValues: TripRateDialogValues;
    onSave: (values: TripRateDialogValues) => Promise<void>;
    onClose: () => void;
}> = ({ mode, trip, comboTypes, initialValues, onSave, onClose }) => {
    const [values, setValues] = useState<TripRateDialogValues>(initialValues);
    const netQty = Number(trip.netWeight || 0);
    const numeric = (value?: string) => Number(value || 0);
    const combinedAmount = numeric(values.combinedRate) * netQty;
    const mineAmount = numeric(values.mineRate) * netQty;
    const transportAmount = numeric(values.transportRate) * netQty;
    const royaltyAmount = numeric(values.royaltyRate) * netQty;
    const totalAmount = combinedAmount + mineAmount + transportAmount + royaltyAmount;

    const renderRateField = (label: string, key: keyof TripRateDialogValues) => (
        <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
            {mode === 'edit' ? (
                <input
                    type="text"
                    inputMode="decimal"
                    value={values[key] ?? ''}
                    onChange={event => setValues(prev => ({ ...prev, [key]: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                />
            ) : (
                <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {numeric(values[key]).toFixed(2)}
                </div>
            )}
        </div>
    );

    const comboLabel = getComboLabel(comboTypes);

    return (
        <div className="space-y-6 max-w-3xl w-full">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Trip #</div>
                        <div className="text-base font-semibold">#{trip.id}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Date</div>
                        <div className="text-base font-semibold">{formatDateDisplay(trip.date)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Invoice/DC</div>
                        <div className="text-base font-semibold">{trip.invoiceDCNumber || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Mine & Quarry</div>
                        <div className="text-base font-semibold">{trip.quarryName || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Transport & Owner</div>
                        <div className="text-base font-semibold">{trip.transporterName || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Royalty Owner</div>
                        <div className="text-base font-semibold">{trip.royaltyOwnerName || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Net Qty</div>
                        <div className="text-base font-semibold">{netQty.toFixed(2)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Amount</div>
                        <div className="text-base font-semibold">{totalAmount.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {comboTypes.length > 1 && renderRateField(`${comboLabel} Rate/Ton`, 'combinedRate')}
                {initialValues.mineRate !== undefined && renderRateField('Mine & Quarry Rate', 'mineRate')}
                {initialValues.transportRate !== undefined && renderRateField('Transport & Owner Rate', 'transportRate')}
                {initialValues.royaltyRate !== undefined && renderRateField('Royalty Rate', 'royaltyRate')}
            </div>

            {mode === 'edit' ? (
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave(values)}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                    >
                        Save
                    </button>
                </div>
            ) : (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};

const GstRateDialog: React.FC<{
    mode: 'view' | 'edit';
    trip: Trip;
    onSave: (values: { rate: string; percent: string; amount: string }) => Promise<void>;
    onClose: () => void;
}> = ({ mode, trip, onSave, onClose }) => {
    const initialRate = trip.gstRatePerTon ? String(trip.gstRatePerTon) : '';
    const initialPercent = trip.gstPercentage ? String(trip.gstPercentage) : '';
    const netQty = Number(trip.netWeight || 0);
    const computedAmount = (Number(initialRate || 0) > 0 && Number(initialPercent || 0) > 0)
      ? netQty * Number(initialRate || 0) * (Number(initialPercent || 0) / 100)
      : Number(trip.gstAmount || 0);
    const [rate, setRate] = useState(initialRate);
    const [percent, setPercent] = useState(initialPercent);
    const [amount, setAmount] = useState(trip.gstAmount ? String(trip.gstAmount) : (computedAmount ? String(computedAmount) : ''));

    return (
        <div className="space-y-6 max-w-3xl w-full">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Trip #</div>
                        <div className="text-base font-semibold">#{trip.id}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Date</div>
                        <div className="text-base font-semibold">{formatDateDisplay(trip.date)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Invoice/DC</div>
                        <div className="text-base font-semibold">{trip.invoiceDCNumber || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Material Owner</div>
                        <div className="text-base font-semibold">{trip.quarryName || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Vehicle</div>
                        <div className="text-base font-semibold">{trip.vehicleNumber || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Net Tons</div>
                        <div className="text-base font-semibold">{netQty.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Trip Rate for GST</label>
                    {mode === 'edit' ? (
                        <input
                            type="text"
                            inputMode="decimal"
                            value={rate}
                            onChange={event => setRate(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                        />
                    ) : (
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{Number(rate || 0).toFixed(2)}</div>
                    )}
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">GST %</label>
                    {mode === 'edit' ? (
                        <input
                            type="text"
                            inputMode="decimal"
                            value={percent}
                            onChange={event => setPercent(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                        />
                    ) : (
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{Number(percent || 0).toFixed(2)}</div>
                    )}
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">GST Amount</label>
                    {mode === 'edit' ? (
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={event => setAmount(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                        />
                    ) : (
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{Number(amount || 0).toFixed(2)}</div>
                    )}
                </div>
            </div>

            {mode === 'edit' ? (
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave({ rate, percent, amount })}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                    >
                        Save
                    </button>
                </div>
            ) : (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};

const BillRateDialog: React.FC<{
    mode: 'view' | 'edit';
    trip: Trip;
    onSave: (values: { name: string; rate: string; gstPercent: string }) => Promise<void>;
    onClose: () => void;
}> = ({ mode, trip, onSave, onClose }) => {
    const [name, setName] = useState(trip.actualVendorCustomerName || '');
    const [rate, setRate] = useState(trip.vendorCustomerRatePerTon ? String(trip.vendorCustomerRatePerTon) : '');
    const [gstPercent, setGstPercent] = useState(trip.vendorCustomerGstPercentage !== undefined ? String(trip.vendorCustomerGstPercentage) : '18');
    const netQty = Number(trip.netWeight || 0);
    const baseAmount = Number(rate || 0) * netQty;
    const gstAmount = baseAmount * (Number(gstPercent || 0) / 100);
    const totalAmount = baseAmount + gstAmount;

    return (
        <div className="space-y-6 max-w-3xl w-full">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Trip #</div>
                        <div className="text-base font-semibold">#{trip.id}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Date</div>
                        <div className="text-base font-semibold">{formatDateDisplay(trip.date)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Invoice/DC</div>
                        <div className="text-base font-semibold">{trip.invoiceDCNumber || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Net Tons</div>
                        <div className="text-base font-semibold">{netQty.toFixed(2)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Base Amount</div>
                        <div className="text-base font-semibold">{baseAmount.toFixed(2)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">GST Amount</div>
                        <div className="text-base font-semibold">{gstAmount.toFixed(2)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Total Amount</div>
                        <div className="text-base font-semibold">{totalAmount.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Actual Name</label>
                    {mode === 'edit' ? (
                        <input
                            type="text"
                            value={name}
                            onChange={event => setName(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                        />
                    ) : (
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{name || '-'}</div>
                    )}
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Rate/Ton</label>
                    {mode === 'edit' ? (
                        <input
                            type="text"
                            inputMode="decimal"
                            value={rate}
                            onChange={event => setRate(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                        />
                    ) : (
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{Number(rate || 0).toFixed(2)}</div>
                    )}
                </div>
                <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">GST %</label>
                    {mode === 'edit' ? (
                        <input
                            type="text"
                            inputMode="decimal"
                            value={gstPercent}
                            onChange={event => setGstPercent(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                        />
                    ) : (
                        <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{Number(gstPercent || 0).toFixed(2)}</div>
                    )}
                </div>
            </div>

            {mode === 'edit' ? (
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave({ name, rate, gstPercent })}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                    >
                        Save
                    </button>
                </div>
            ) : (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};

const Reports: React.FC<{ mode?: 'reports' | 'dashboard' }> = ({ mode = 'reports' }) => {
    const location = useLocation();
    const { currentUser } = useAuth();
    const { openModal, closeModal } = useUI();
    const { trips, payments, materialRates, loadMaterialRates, getDailyExpenses, getSupervisorAccounts, refreshKey, loadTrips, loadPayments, updateTrip, deleteTrip, updateDailyExpense, deleteDailyExpense, updatePayment, deletePayment } = useData();
    const canViewAll = currentUser?.role === Role.ADMIN || currentUser?.role === Role.MANAGER || currentUser?.role === Role.ACCOUNTANT;
    const isDropoffSupervisor = currentUser?.role === Role.DROPOFF_SUPERVISOR;
    const isPickupSupervisor = currentUser?.role === Role.PICKUP_SUPERVISOR;
    const isSiteManager = currentUser?.role === Role.SITE_MANAGER;
    const [reportType, setReportType] = useState<ReportType>('trips');
    const [filters, setFilters] = useState<Filters>(getDefaultDateRange());
    const [draftFilters, setDraftFilters] = useState<Filters>(getDefaultDateRange());
    const [filtersOpen, setFiltersOpen] = useState(true);
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
        if (reportType === 'trips' || reportType === 'trip-rates' || reportType === 'gst-trip-rates' || reportType === 'bills') {
            loadTrips();
        }
        if (reportType === 'trip-rates') {
            loadMaterialRates();
        }
        if (reportType === 'payments') {
            loadPayments();
        }
    }, [loadTrips, loadMaterialRates, loadPayments, refreshKey, reportType]);

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
                // Ignore non-gesture errors (Safari/Chrome constraint).
            }
        }
    };
    const getRateForTrip = (trip: Trip, partyType: RatePartyType, comboOnly?: boolean) =>
        resolveTripRate(materialRates, trip.id, partyType, { comboOnly });
    const getExplicitComboTypes = (trip: Trip): RatePartyType[] =>
        Array.from(getComboPartyTypes(materialRates, trip.id));
    const getExplicitComboRateValue = (trip: Trip): number =>
        getCombinedRatePerTon(materialRates, trip.id);
    const getCombinedRateValue = (trip: Trip) => getCombinedRatePerTon(materialRates, trip.id);
    const getTripRateStatus = (trip: Trip) => {
        const hasCombo = getCombinedRateValue(trip) > 0;
        const hasMine = Boolean(getRateForTrip(trip, 'mine-quarry', false));
        const hasTransport = Boolean(getRateForTrip(trip, 'transport-owner', false));
        const hasRoyalty = Boolean(getRateForTrip(trip, 'royalty-owner', false));
        return hasCombo || hasMine || hasTransport || hasRoyalty ? 'Applied' : 'Awaiting';
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
                headers = ["S. No.", "Payment #", "Date", "Transaction Type", "From Account", "Via", "To Name", "Amount", "Remarks", "To Account", "Head Account", "Category", "Sub-Category", "Trip ID"];
                rows = filteredData.map((d, index) => {
                    const p = d as Payment;
                    return [index + 1, p.paymentNumber || '', p.date, p.type, p.fromAccount || '', p.via || '', p.ratePartyName || '', p.amount, p.remarks || '', p.toAccount || '', p.headAccount || '', p.category || '', p.subCategory || '', p.tripId || ''];
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
                headers = [
                    "Date",
                    "Trip #",
                    "Invoice/DC",
                    "Rate Mode",
                    "Rate Status",
                    "Mine Rate/Ton",
                    "Mine Amount",
                    "Transport Rate/Ton",
                    "Transport Amount",
                    "Royalty Rate/Ton",
                    "Royalty Amount",
                    "Pair/All-Activity Rate/Ton",
                    "Pair/All-Activity Amount",
                    "Total Amount",
                ];
                rows = filteredData.map(d => {
                    const t = d as Trip;
                    const mineRate = getRateForTrip(t, 'mine-quarry', false);
                    const transportRate = getRateForTrip(t, 'transport-owner', false);
                    const royaltyRate = getRateForTrip(t, 'royalty-owner', false);
                    const combinedRate = getExplicitComboRateValue(t);
                    const netQty = Number(t.netWeight || 0);
                    const mineAmount = Number(mineRate?.ratePerTon || 0) * netQty;
                    const transportAmount = Number(transportRate?.ratePerTon || 0) * netQty;
                    const royaltyAmount = Number(royaltyRate?.ratePerTon || 0) * netQty;
                    const combinedAmount = combinedRate * netQty;
                    const totalAmount = combinedAmount + mineAmount + transportAmount + royaltyAmount;
                    const rateStatus = getTripRateStatus(t);
                    const comboTypes = getExplicitComboTypes(t);
                    const rateMode = getRateModeLabel(t, comboTypes);
                    return [
                        t.date,
                        t.id,
                        t.invoiceDCNumber,
                        rateMode,
                        rateStatus,
                        mineRate?.ratePerTon || '',
                        mineAmount || '',
                        transportRate?.ratePerTon || '',
                        transportAmount || '',
                        royaltyRate?.ratePerTon || '',
                        royaltyAmount || '',
                        combinedRate || '',
                        combinedAmount || '',
                        totalAmount || '',
                    ];
                });
                break;
            case 'gst-trip-rates':
                headers = ["Date", "Trip #", "Invoice/DC", "Material Owner", "Vehicle Number", "Net Tons", "GST Rate/Ton", "GST %", "GST Amount"];
                rows = filteredData.map(d => {
                    const t = d as Trip;
                    const gstAmount = computeTripGstAmount(t);
                    return [t.date, t.id, t.invoiceDCNumber, t.quarryName || '', t.vehicleNumber || '', t.netWeight || 0, t.gstRatePerTon || 0, t.gstPercentage || 0, gstAmount];
                });
                break;
            case 'bills':
                headers = ["Date", "Trip #", "Invoice/DC", "Actual Name", "Rate/Ton", "GST %", "Net Tons", "Base Amount", "GST Amount", "Total Amount", "Bill Status"];
                rows = filteredData.map(d => {
                    const t = d as Trip;
                    const rate = Number(t.vendorCustomerRatePerTon || 0);
                    const net = Number(t.netWeight || 0);
                    const gstPercent = Number(t.vendorCustomerGstPercentage ?? 18);
                    const baseAmount = (rate * net) || 0;
                    const gstAmount = t.vendorCustomerGstAmount !== undefined
                        ? Number(t.vendorCustomerGstAmount || 0)
                        : (baseAmount * (gstPercent / 100));
                    const billStatus = getBillStatus(t);
                    return [t.date, t.id, t.invoiceDCNumber, t.actualVendorCustomerName || '', rate, gstPercent, net, baseAmount, gstAmount, baseAmount + gstAmount, billStatus];
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
            case 'gst-trip-rates': data = trips; break;
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
            if (reportType === 'trips' || reportType === 'trip-rates' || reportType === 'gst-trip-rates' || reportType === 'bills') {
                if (filters.vehicle && item.vehicleNumber !== filters.vehicle) return false;
                if (filters.material && item.material !== filters.material) return false;
                if (filters.mine && item.quarryName !== filters.mine) return false;
                if (filters.transportOwner && item.transporterName !== filters.transportOwner) return false;
                if (filters.vendor) {
                    const vendorName = item.actualVendorCustomerName || item.customer || '';
                    if (vendorName !== filters.vendor) return false;
                }
            }
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

    const uniqueVendors = useMemo(() => {
        const names = trips.map(item => item.actualVendorCustomerName || item.customer || '').filter(Boolean);
        return Array.from(new Set(names));
    }, [trips]);
    const uniqueVehicles = useMemo(() => {
        const names = trips.map(item => item.vehicleNumber || '').filter(Boolean);
        return Array.from(new Set(names));
    }, [trips]);
    const uniqueMaterials = useMemo(() => {
        const names = trips.map(item => item.material || '').filter(Boolean);
        return Array.from(new Set(names));
    }, [trips]);
    const uniqueMines = useMemo(() => {
        const names = trips.map(item => item.quarryName || '').filter(Boolean);
        return Array.from(new Set(names));
    }, [trips]);
    const uniqueTransportOwners = useMemo(() => {
        const names = trips.map(item => item.transporterName || '').filter(Boolean);
        return Array.from(new Set(names));
    }, [trips]);

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

    const openTripRateModal = (title: string, trip: Trip, mode: 'view' | 'edit') => {
        const hasMine = Boolean(trip.quarryName);
        const hasTransport = Boolean(trip.transporterName);
        const hasRoyalty = Boolean(trip.royaltyOwnerName);
        const existingComboTypes: RatePartyType[] = getExplicitComboTypes(trip);
        const hasComboApplied = existingComboTypes.length > 0;
        const comboTypes: RatePartyType[] = hasComboApplied ? existingComboTypes : [];
        const mineRate = getRateForTrip(trip, 'mine-quarry', false);
        const transportRate = getRateForTrip(trip, 'transport-owner', false);
        const royaltyRate = getRateForTrip(trip, 'royalty-owner', false);
        const showMineRate = hasMine && !comboTypes.includes('mine-quarry');
        const showTransportRate = hasTransport && !comboTypes.includes('transport-owner');
        const showRoyaltyRate = hasRoyalty && !comboTypes.includes('royalty-owner');
        const initialValues: TripRateDialogValues = {
            combinedRate: hasComboApplied ? String(getExplicitComboRateValue(trip) || '') : undefined,
            mineRate: showMineRate ? String(mineRate?.ratePerTon || '') : undefined,
            transportRate: showTransportRate ? String(transportRate?.ratePerTon || '') : undefined,
            royaltyRate: showRoyaltyRate ? String(royaltyRate?.ratePerTon || '') : undefined,
        };
        const showCombined = hasComboApplied;
        openModal(title, (
            <TripRateDialog
                mode={mode}
                trip={trip}
                comboTypes={comboTypes}
                initialValues={initialValues}
                onSave={async values => {
                    if (mode !== 'edit') return;
                    try {
                        const tasks: Promise<unknown>[] = [];
                        if (showCombined && values.combinedRate !== undefined && String(values.combinedRate).trim() !== '') {
                            const comboRateValue = Number(values.combinedRate || 0);
                            comboTypes.forEach(type => {
                                tasks.push(tripRateApi.apply({
                                    tripId: trip.id,
                                    ratePartyType: type,
                                    ratePerTon: comboRateValue,
                                    applyScope: 'trip',
                                    rateSource: 'combo',
                                }));
                            });
                        }
                        if (hasMine && values.mineRate !== undefined && String(values.mineRate).trim() !== '') {
                            tasks.push(tripRateApi.apply({
                                tripId: trip.id,
                                ratePartyType: 'mine-quarry',
                                ratePerTon: Number(values.mineRate || 0),
                                applyScope: 'trip',
                            }));
                        }
                        if (hasTransport && values.transportRate !== undefined && String(values.transportRate).trim() !== '') {
                            tasks.push(tripRateApi.apply({
                                tripId: trip.id,
                                ratePartyType: 'transport-owner',
                                ratePerTon: Number(values.transportRate || 0),
                                applyScope: 'trip',
                            }));
                        }
                        if (hasRoyalty && values.royaltyRate !== undefined && String(values.royaltyRate).trim() !== '') {
                            tasks.push(tripRateApi.apply({
                                tripId: trip.id,
                                ratePartyType: 'royalty-owner',
                                ratePerTon: Number(values.royaltyRate || 0),
                                applyScope: 'trip',
                            }));
                        }
                        if (tasks.length > 0) {
                            await Promise.all(tasks);
                            await loadMaterialRates(true);
                        }
                        closeModal();
                        openModal('Rate Update', (
                            <AlertDialog
                                message="Trip rate updated successfully."
                                onConfirm={closeModal}
                            />
                        ));
                    } catch (error) {
                        console.error('Failed to update trip rate', error);
                        closeModal();
                        openModal('Rate Update Failed', (
                            <AlertDialog
                                message="Unable to update trip rate. Please try again."
                                onConfirm={closeModal}
                            />
                        ));
                    }
                }}
                onClose={closeModal}
            />
        ));
    };

    const openGstRateModal = (title: string, trip: Trip, mode: 'view' | 'edit') => {
        openModal(title, (
            <GstRateDialog
                mode={mode}
                trip={trip}
                onSave={async values => {
                    if (mode !== 'edit') return;
                    const netQty = Number(trip.netWeight || 0);
                    const rateValue = Number(values.rate || 0);
                    const percentValue = Number(values.percent || 0);
                    const computedAmount = netQty * rateValue * (percentValue / 100);
                    const amountValue = values.amount.trim() !== ''
                      ? Number(values.amount)
                      : (rateValue > 0 && percentValue > 0 ? computedAmount : 0);
                    await updateTrip(trip.id, {
                        gstRatePerTon: rateValue,
                        gstPercentage: percentValue,
                        gstAmount: amountValue,
                    });
                    closeModal();
                }}
                onClose={closeModal}
            />
        ));
    };

    const openBillRateModal = (title: string, trip: Trip, mode: 'view' | 'edit') => {
        openModal(title, (
            <BillRateDialog
                mode={mode}
                trip={trip}
                onSave={async values => {
                    if (mode !== 'edit') return;
                    await billsApi.apply({
                        tripId: trip.id,
                        actualVendorCustomerName: (values.name || '').trim(),
                        vendorCustomerRatePerTon: Number(values.rate || 0),
                        vendorCustomerGstPercentage: values.gstPercent.trim() === '' ? 18 : Number(values.gstPercent || 0),
                    });
                    closeModal();
                }}
                onClose={closeModal}
            />
        ));
    };

    const handleDeleteTripRates = async (trip: Trip) => {
        const tripRates = materialRates.filter(rate => rate.tripId === trip.id);
        const rateTypes = Array.from(new Set(tripRates.map(rate => rate.ratePartyType)));
        const tasks = rateTypes.map(type => tripRateApi.apply({
            tripId: trip.id,
            ratePartyType: type,
            ratePerTon: 0,
            applyScope: 'trip',
            rateSource: tripRates.some(rate => rate.ratePartyType === type && isComboRate(rate)) ? 'combo' : undefined,
        }));
        await Promise.all(tasks);
        await loadMaterialRates(true);
    };

    const handleDeleteGst = async (trip: Trip) => {
        await updateTrip(trip.id, {
            gstRatePerTon: 0,
            gstPercentage: 0,
            gstAmount: 0,
        });
    };

    const handleDeleteBill = async (trip: Trip) => {
        await updateTrip(trip.id, {
            actualVendorCustomerName: '',
            vendorCustomerRatePerTon: 0,
            vendorCustomerGstPercentage: 18,
            vendorCustomerGstAmount: 0,
        });
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
                    ? ["S. No.", "Payment #", "Date", "Transaction Type", "From Account", "Via", "To Name", "Amount", "Remarks", "To Account", "Head Account", "Category", "Sub-Category", "Trip ID", "Actions"]
                    : ["S. No.", "Payment #", "Date", "Transaction Type", "From Account", "Via", "To Name", "Amount", "Remarks", "To Account", "Head Account", "Category", "Sub-Category", "Trip ID"];
                 return <DataTable title="" headers={headers} data={tableData} renderRow={(p: Payment, index: number) => (
                    <tr key={p.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.paymentNumber || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(p.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.fromAccount || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.via || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.ratePartyName || '-'}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${p.type === 'PAYMENT' ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(p.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.remarks || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.toAccount || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.headAccount || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.category || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.subCategory || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.tripId ? `#${p.tripId}` : '-'}</td>
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
                const tripRows = filteredData as Trip[];
                const showMineRate = tripRows.some(trip => Boolean(getRateForTrip(trip, 'mine-quarry', false)));
                const showTransportRate = tripRows.some(trip => Boolean(getRateForTrip(trip, 'transport-owner', false)));
                const showRoyaltyRate = tripRows.some(trip => Boolean(getRateForTrip(trip, 'royalty-owner', false)));
                const showCombinedRate = tripRows.some(trip => getCombinedRateValue(trip) > 0);
                const headers = [
                    'Date',
                    'Trip #',
                    'Invoice/DC',
                    'Rate Mode',
                    'Rate Status',
                    ...(showMineRate ? ['Mine Rate/Ton', 'Mine Amount'] : []),
                    ...(showTransportRate ? ['Transport Rate/Ton', 'Transport Amount'] : []),
                    ...(showRoyaltyRate ? ['Royalty Rate/Ton', 'Royalty Amount'] : []),
                    ...(showCombinedRate ? ['Pair/All-Activity Rate/Ton', 'Pair/All-Activity Amount'] : []),
                    'Total Amount',
                    ...(showActions ? ['Actions'] : []),
                ];
                return <DataTable title="" headers={headers} data={tableData} renderRow={(t: Trip) => {
                    const netQty = Number(t.netWeight || 0);
                    const mineRate = getRateForTrip(t, 'mine-quarry', false);
                    const transportRate = getRateForTrip(t, 'transport-owner', false);
                    const royaltyRate = getRateForTrip(t, 'royalty-owner', false);
                    const combinedRate = getCombinedRateValue(t);
                    const comboTypes = Array.from(getComboPartyTypes(materialRates, t.id));
                    const mineAmount = comboTypes.includes('mine-quarry') ? 0 : Number(mineRate?.ratePerTon || 0) * netQty;
                    const transportAmount = comboTypes.includes('transport-owner') ? 0 : Number(transportRate?.ratePerTon || 0) * netQty;
                    const royaltyAmount = comboTypes.includes('royalty-owner') ? 0 : Number(royaltyRate?.ratePerTon || 0) * netQty;
                    const combinedAmount = combinedRate * netQty;
                    const totalAmount = combinedAmount + mineAmount + transportAmount + royaltyAmount;
                    const rateStatus = getTripRateStatus(t);
                    const rateMode = getRateModeLabel(t, comboTypes);
                    return (
                      <tr key={t.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(t.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">#{t.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.invoiceDCNumber || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{rateMode}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{rateStatus}</td>
                        {showMineRate && (
                            <>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(Number(mineRate?.ratePerTon || 0))}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(mineAmount)}</td>
                            </>
                        )}
                        {showTransportRate && (
                            <>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(Number(transportRate?.ratePerTon || 0))}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(transportAmount)}</td>
                            </>
                        )}
                        {showRoyaltyRate && (
                            <>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(Number(royaltyRate?.ratePerTon || 0))}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(royaltyAmount)}</td>
                            </>
                        )}
                        {showCombinedRate && (
                            <>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{combinedRate ? formatCurrency(combinedRate) : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{combinedRate ? formatCurrency(combinedAmount) : '-'}</td>
                            </>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(totalAmount)}</td>
                        {showActions && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 no-print">
                            <button onClick={() => openTripRateModal(`View Trip Rates #${t.id}`, t, 'view')} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                            <button onClick={() => openTripRateModal(`Edit Trip Rates #${t.id}`, t, 'edit')} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                          </td>
                        )}
                      </tr>
                    );
                }} />;
            }
            case 'gst-trip-rates': {
                const headers = showActions
                  ? ['Date', 'Trip #', 'Invoice/DC', 'Material Owner', 'Vehicle', 'Net Tons', 'GST Rate/Ton', 'GST %', 'GST Amount', 'Actions']
                  : ['Date', 'Trip #', 'Invoice/DC', 'Material Owner', 'Vehicle', 'Net Tons', 'GST Rate/Ton', 'GST %', 'GST Amount'];
                return <DataTable title="" headers={headers} data={tableData} renderRow={(t: Trip) => (
                  <tr key={t.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(t.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">#{t.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{t.invoiceDCNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{t.quarryName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{t.vehicleNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{Number(t.netWeight || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(Number(t.gstRatePerTon || 0))}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{Number(t.gstPercentage || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const netQty = Number(t.netWeight || 0);
                        return formatCurrency(computeTripGstAmount(t));
                      })()}
                    </td>
                    {showActions && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 no-print">
                        <button onClick={() => openGstRateModal(`View GST #${t.id}`, t, 'view')} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                        <button onClick={() => openGstRateModal(`Edit GST #${t.id}`, t, 'edit')} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                        <button
                          onClick={() => {
                            openModal('Delete GST', (
                              <AlertDialog
                                message="Delete GST values for this trip? This will move it back to awaiting GST."
                                confirmLabel="Delete"
                                cancelLabel="Cancel"
                                onCancel={closeModal}
                                onConfirm={async () => {
                                  await handleDeleteGst(t);
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
            case 'bills': {
                const headers = showActions
                  ? ['Date', 'Trip #', 'Invoice/DC', 'Actual Name', 'Rate/Ton', 'GST %', 'Net Tons', 'Base Amount', 'GST Amount', 'Total Amount', 'Bill Status', 'Actions']
                  : ['Date', 'Trip #', 'Invoice/DC', 'Actual Name', 'Rate/Ton', 'GST %', 'Net Tons', 'Base Amount', 'GST Amount', 'Total Amount', 'Bill Status'];
                return <DataTable title="" headers={headers} data={tableData} renderRow={(t: Trip) => {
                    const rate = Number(t.vendorCustomerRatePerTon || 0);
                    const net = Number(t.netWeight || 0);
                    const gstPercent = Number(t.vendorCustomerGstPercentage ?? 18);
                    const baseAmount = rate * net;
                    const gstAmount = t.vendorCustomerGstAmount !== undefined
                      ? Number(t.vendorCustomerGstAmount || 0)
                      : (baseAmount * (gstPercent / 100));
                    const billStatus = getBillStatus(t);
                    return (
                      <tr key={t.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDateDisplay(t.date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">#{t.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.invoiceDCNumber || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{t.actualVendorCustomerName || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(rate)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{gstPercent.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{net.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(baseAmount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(gstAmount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(baseAmount + gstAmount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{billStatus}</td>
                        {showActions && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 no-print">
                            <button onClick={() => openBillRateModal(`View Bill #${t.id}`, t, 'view')} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">View</button>
                            <button onClick={() => openBillRateModal(`Edit Bill #${t.id}`, t, 'edit')} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                            <button
                              onClick={() => {
                                openModal('Delete Bill', (
                                  <AlertDialog
                                    message="Delete bill details for this trip? This will move it back to awaiting bills."
                                    confirmLabel="Delete"
                                    cancelLabel="Cancel"
                                    onCancel={closeModal}
                                    onConfirm={async () => {
                                      await handleDeleteBill(t);
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
                showFilters={[]}
                showMoreFilters={[]}
                showAddAction={false}
                headerRight={(
                    <div className="rounded-xl border border-gray-200/60 bg-white/90 dark:bg-gray-900/70 dark:border-gray-700/60 shadow-md px-3 py-2">
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
                                            className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
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
                                            className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                            value={draftFilters.dateTo || ''}
                                            onChange={e => updateDraft('dateTo', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-gray-500 dark:text-gray-400">Vehicle</label>
                                        <select
                                            className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                            value={draftFilters.vehicle || ''}
                                            onChange={e => updateDraft('vehicle', e.target.value)}
                                        >
                                            <option value="">All Vehicles</option>
                                            {uniqueVehicles.map(vehicle => (
                                                <option key={`reports-vehicle-${vehicle}`} value={vehicle}>
                                                    {vehicle}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-gray-500 dark:text-gray-400">Vendor & Customer</label>
                                        <select
                                            className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                            value={draftFilters.vendor || ''}
                                            onChange={e => updateDraft('vendor', e.target.value)}
                                        >
                                            <option value="">All Vendors</option>
                                            {uniqueVendors.map(vendor => (
                                                <option key={`reports-vendor-${vendor}`} value={vendor}>
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
                                            className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                            value={draftFilters.material || ''}
                                            onChange={e => updateDraft('material', e.target.value)}
                                        >
                                            <option value="">All Materials</option>
                                            {uniqueMaterials.map(material => (
                                                <option key={`reports-material-${material}`} value={material}>
                                                    {material}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-gray-500 dark:text-gray-400">Mine & Quarry</label>
                                        <select
                                            className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                            value={draftFilters.mine || ''}
                                            onChange={e => updateDraft('mine', e.target.value)}
                                        >
                                            <option value="">All Mines/Quarries</option>
                                            {uniqueMines.map(mine => (
                                                <option key={`reports-mine-${mine}`} value={mine}>
                                                    {mine}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-gray-500 dark:text-gray-400">Transport & Owner</label>
                                        <select
                                            className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                            value={draftFilters.transportOwner || ''}
                                            onChange={e => updateDraft('transportOwner', e.target.value)}
                                        >
                                            <option value="">All Transport Owners</option>
                                            {uniqueTransportOwners.map(owner => (
                                                <option key={`reports-transport-${owner}`} value={owner}>
                                                    {owner}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2 lg:col-span-1">
                                        <button
                                            type="button"
                                            onClick={applyDraftFilters}
                                            className="h-7 px-3 rounded-md text-[11px] font-medium text-white bg-primary hover:bg-primary-dark"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetDraftFilters}
                                            className="h-7 px-3 rounded-md text-[11px] font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                                        >
                                            Reset
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFiltersOpen(false)}
                                            className="h-7 px-3 rounded-md text-[11px] font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
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
                )}
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
                                <option value="gst-trip-rates">GST Trip Rates</option>
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
