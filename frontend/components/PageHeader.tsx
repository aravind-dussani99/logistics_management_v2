import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useUI } from '../contexts/UIContext';
import FilterPanel, { Filters, FilterField, DEFAULT_MORE_FILTERS } from './FilterPanel';
import { Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import SupervisorTripForm from './SupervisorTripForm';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    headerContent?: React.ReactNode;
    headerRight?: React.ReactNode;
    showFilters?: ('date' | 'singleDate' | 'transporter' | 'quarry' | 'customer' | 'vehicle' | 'royalty' | 'vendor' | 'transportOwner' | 'mine' | 'material')[];
    showMoreFilters?: ('date' | 'singleDate' | 'transporter' | 'quarry' | 'customer' | 'vehicle' | 'royalty' | 'vendor' | 'transportOwner' | 'mine' | 'material')[];
    filters: Filters;
    onFilterChange: (filters: Filters) => void;
    filterData: {
        vehicles: { id?: string; vehicleNumber: string }[];
        transportOwners: { id?: string; name: string }[];
        customers: { id?: string; name: string }[];
        quarries: { id?: string; name: string }[];
        royaltyOwners: { id?: string; name: string }[];
        mineQuarries?: { id?: string; name: string }[];
        materials?: { id?: string; name: string }[];
    };
    pageAction?: {
        label: string;
        action: () => void;
    };
    secondaryAction?: {
        label: string;
        action: () => void;
    };
    showAddAction?: boolean;
    useDraftFilters?: boolean;
}

const adminActions = [
    { name: 'Add Trip', icon: 'bus-outline', action: 'addTrip' },
];

const supervisorActions = [
    { name: 'Enter Trip', icon: 'document-text-outline', action: 'enterTrip' },
];

const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    headerContent,
    headerRight,
    showFilters = [],
    showMoreFilters = [],
    filters,
    onFilterChange,
    filterData = { vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] },
    pageAction,
    secondaryAction,
    showAddAction = true,
    useDraftFilters = false,
}) => {
    const { openModal, closeModal, alert } = useUI();
    const { currentUser } = useAuth();
    const filterPopoverRef = useRef<HTMLDivElement>(null);
    const addMenuRef = useRef<HTMLDivElement>(null);
    const hasDateFilters = showFilters.includes('date') || showMoreFilters.includes('date') || showFilters.includes('singleDate') || showMoreFilters.includes('singleDate');
    const hasSingleDate = showFilters.includes('singleDate') || showMoreFilters.includes('singleDate');
    const [draftFilters, setDraftFilters] = useState<Filters>(filters);

    const [isFilterPopoverOpen, setFilterPopoverOpen] = useState(false);
    const [isAddMenuOpen, setAddMenuOpen] = useState(false);

    const isSupervisor = currentUser?.role === Role.PICKUP_SUPERVISOR || currentUser?.role === Role.DROPOFF_SUPERVISOR;
    const addActions = isSupervisor ? supervisorActions : adminActions;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) setFilterPopoverOpen(false);
            if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) setAddMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setDraftFilters(filters);
    }, [filters]);

    useEffect(() => {
        if (!hasDateFilters) return;
        if (filters.dateFrom || filters.dateTo) return;
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const formatDate = (date: Date) => date.toISOString().split('T')[0];
        const todayValue = formatDate(today);
        onFilterChange(hasSingleDate ? {
            ...filters,
            dateFrom: todayValue,
            dateTo: todayValue,
        } : {
            ...filters,
            dateFrom: formatDate(startOfMonth),
            dateTo: todayValue,
        });
    }, [filters, hasDateFilters, onFilterChange]);
    
    const handleAddAction = (action: string) => {
        setAddMenuOpen(false);
        switch (action) {
            case 'enterTrip':
                openModal('Enter New Trip', <SupervisorTripForm mode="enter" onClose={closeModal} />);
                break;
            case 'addTrip':
                openModal('Enter New Trip', <SupervisorTripForm mode="enter" onClose={closeModal} />);
                break;
            default:
                alert('Not Implemented', `${action} form not implemented yet.`);
                break;
        }
    };
    
    const vehicles = filterData?.vehicles ?? [];
    const transportOwners = filterData?.transportOwners ?? [];
    const customers = filterData?.customers ?? [];
    const quarries = filterData?.quarries ?? [];
    const royaltyOwners = filterData?.royaltyOwners ?? [];

    const materials = filterData?.materials ?? [];
    const mineQuarries = filterData?.mineQuarries ?? [];
    const safeFilterData = {
        vehicles,
        transportOwners,
        customers,
        quarries,
        royaltyOwners,
        materials,
        mineQuarries,
    };

    const uniqueTransporters = useMemo(() => {
        const names = transportOwners.map(item => item?.name || '');
        return Array.from(new Set(names)).filter(Boolean);
    }, [transportOwners]);
    const uniqueVendors = useMemo(() => {
        const names = customers.map(item => item?.name || '');
        return Array.from(new Set(names)).filter(Boolean);
    }, [customers]);
    const uniqueMines = useMemo(() => {
        const names = mineQuarries.map(item => item?.name || '');
        return Array.from(new Set(names)).filter(Boolean);
    }, [mineQuarries]);
    const uniqueMaterials = useMemo(() => {
        const names = materials.map(item => item?.name || '');
        return Array.from(new Set(names)).filter(Boolean);
    }, [materials]);

    const visibleFilterFields = useMemo<FilterField[] | undefined>(() => {
        if (showFilters.length === 0 && showMoreFilters.length === 0) return undefined;
        return Array.from(new Set<FilterField>([...(showFilters as FilterField[]), ...(showMoreFilters as FilterField[]), ...DEFAULT_MORE_FILTERS]));
    }, [showFilters, showMoreFilters]);

    const baseInputClass = "w-full text-sm px-2 py-1 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary";
    const allowDateTyping = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.ctrlKey || event.metaKey) return;
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowed.includes(event.key)) return;
        if (/^[0-9-]$/.test(event.key)) return;
        event.preventDefault();
    };
    const openDatePicker = (event: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
            (input as HTMLInputElement & { showPicker: () => void }).showPicker();
        }
    };
    const updateDraft = (key: keyof Filters, value: string) => {
        if (hasSingleDate && key === 'dateFrom') {
            setDraftFilters(prev => ({ ...prev, dateFrom: value, dateTo: value }));
            return;
        }
        setDraftFilters(prev => ({ ...prev, [key]: value }));
    };
    const updateInlineFilter = (key: keyof Filters, value: string) => {
        if (useDraftFilters) {
            updateDraft(key, value);
        } else {
            onFilterChange({ ...filters, [key]: value });
        }
    };
    const applyDraftFilters = () => {
        if (!useDraftFilters) return;
        const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
        const nextFilters = { ...draftFilters };
        if ((nextFilters.dateFrom && !isCompleteDate(nextFilters.dateFrom))
          || (nextFilters.dateTo && !isCompleteDate(nextFilters.dateTo))) {
            return;
        }
        if (hasSingleDate && nextFilters.dateFrom) {
            nextFilters.dateTo = nextFilters.dateFrom;
        }
        onFilterChange(nextFilters);
    };
    const resetDraftFilters = () => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const formatDate = (date: Date) => date.toISOString().split('T')[0];
        const nextDate = formatDate(today);
        const nextFilters = hasSingleDate ? { dateFrom: nextDate, dateTo: nextDate } : { dateFrom: formatDate(startOfMonth), dateTo: nextDate };
        setDraftFilters(nextFilters);
        onFilterChange(nextFilters);
    };


    return (
        <header className="sticky top-0 bg-light dark:bg-dark py-2 z-10 border-b border-gray-200 dark:border-gray-700 -mx-6 px-6">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="min-w-0">
                    <h1 className="text-3xl font-semibold text-gray-800 dark:text-white flex-shrink-0">{title}</h1>
                    {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
                </div>
                {headerRight && (
                    <div className="w-full lg:w-auto lg:ml-auto">
                        {headerRight}
                    </div>
                )}
                {(showFilters.length > 0) && (
                    <div className="hidden lg:flex flex-wrap items-end gap-2 flex-grow min-w-0 justify-end">
                        {showFilters.includes('vehicle') && (
                            <div className="min-w-[160px] max-w-[220px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Vehicle</label>
                                <select
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).vehicle || ''}
                                    onChange={e => updateInlineFilter('vehicle', e.target.value)}
                                >
                                    <option value="">All Vehicles</option>
                                    {vehicles.map(vehicle => (
                                        <option key={`header-vehicle-${vehicle.id || vehicle.vehicleNumber}`} value={vehicle.vehicleNumber}>
                                            {vehicle.vehicleNumber}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showFilters.includes('vendor') && (
                            <div className="min-w-[180px] max-w-[260px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Vendor & Customer</label>
                                <select
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).vendor || ''}
                                    onChange={e => updateInlineFilter('vendor', e.target.value)}
                                >
                                    <option value="">All Vendors</option>
                                    {uniqueVendors.map(vendor => (
                                        <option key={`header-vendor-${vendor}`} value={vendor}>
                                            {vendor}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showFilters.includes('material') && (
                            <div className="min-w-[160px] max-w-[220px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Material</label>
                                <select
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).material || ''}
                                    onChange={e => updateInlineFilter('material', e.target.value)}
                                >
                                    <option value="">All Materials</option>
                                    {uniqueMaterials.map(material => (
                                        <option key={`header-material-${material}`} value={material}>
                                            {material}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showFilters.includes('transportOwner') && (
                            <div className="min-w-[180px] max-w-[260px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Transport & Owner</label>
                                <select
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).transportOwner || ''}
                                    onChange={e => updateInlineFilter('transportOwner', e.target.value)}
                                >
                                    <option value="">All Transport Owners</option>
                                    {transportOwners.map(owner => (
                                        <option key={`header-transport-${owner.id || owner.name}`} value={owner.name}>
                                            {owner.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showFilters.includes('mine') && (
                            <div className="min-w-[180px] max-w-[260px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Mine & Quarry</label>
                                <select
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).mine || ''}
                                    onChange={e => updateInlineFilter('mine', e.target.value)}
                                >
                                    <option value="">All Mines/Quarries</option>
                                    {uniqueMines.map(mine => (
                                        <option key={`header-mine-${mine}`} value={mine}>
                                            {mine}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showFilters.includes('royalty') && (
                            <div className="min-w-[160px] max-w-[220px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Royalty</label>
                                <select
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).royalty || ''}
                                    onChange={e => updateInlineFilter('royalty', e.target.value)}
                                >
                                    <option value="">All Royalty</option>
                                    {royaltyOwners.map(owner => (
                                        <option key={`header-royalty-${owner.id || owner.name}`} value={owner.name}>
                                            {owner.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showFilters.includes('transporter') && (
                            <div className="min-w-[180px] max-w-[260px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Transporter</label>
                                <select
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).transporter || ''}
                                    onChange={e => updateInlineFilter('transporter', e.target.value)}
                                >
                                    <option value="">All Transporters</option>
                                    {uniqueTransporters.map(transporter => (
                                        <option key={`header-transporter-${transporter}`} value={transporter}>
                                            {transporter}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showFilters.includes('customer') && (
                            <div className="min-w-[180px] max-w-[260px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Customer</label>
                                <select
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).customer || ''}
                                    onChange={e => updateInlineFilter('customer', e.target.value)}
                                >
                                    <option value="">All Customers</option>
                                    {uniqueVendors.map(customer => (
                                        <option key={`header-customer-${customer}`} value={customer}>
                                            {customer}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showFilters.includes('quarry') && (
                            <div className="min-w-[180px] max-w-[260px] flex-1">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Quarry</label>
                                <select
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).quarry || ''}
                                    onChange={e => updateInlineFilter('quarry', e.target.value)}
                                >
                                    <option value="">All Quarries</option>
                                    {quarries.map(quarry => (
                                        <option key={`header-quarry-${quarry.id || quarry.name}`} value={quarry.name}>
                                            {quarry.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {showFilters.includes('singleDate') && (
                            <div className="min-w-[150px] max-w-[200px]">
                                <label className="text-xs text-gray-500 dark:text-gray-400">Date</label>
                                <input
                                    type="date"
                                    inputMode="numeric"
                                    onKeyDown={allowDateTyping}
                                    onClick={openDatePicker}
                                    onFocus={openDatePicker}
                                    className={baseInputClass}
                                    value={(useDraftFilters ? draftFilters : filters).dateFrom || ''}
                                    onChange={e => useDraftFilters ? updateDraft('dateFrom', e.target.value) : onFilterChange({ ...filters, dateFrom: e.target.value, dateTo: e.target.value })}
                                />
                            </div>
                        )}
                        {showFilters.includes('date') && !showFilters.includes('singleDate') && (
                            <>
                                <div className="min-w-[150px] max-w-[200px]">
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Date From</label>
                                    <input
                                        type="date"
                                        inputMode="numeric"
                                        onKeyDown={allowDateTyping}
                                        onClick={openDatePicker}
                                        onFocus={openDatePicker}
                                        className={baseInputClass}
                                        value={(useDraftFilters ? draftFilters : filters).dateFrom || ''}
                                        onChange={e => useDraftFilters ? updateDraft('dateFrom', e.target.value) : onFilterChange({ ...filters, dateFrom: e.target.value })}
                                    />
                                </div>
                                <div className="min-w-[150px] max-w-[200px]">
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Date To</label>
                                    <input
                                        type="date"
                                        inputMode="numeric"
                                        onKeyDown={allowDateTyping}
                                        onClick={openDatePicker}
                                        onFocus={openDatePicker}
                                        className={baseInputClass}
                                        value={(useDraftFilters ? draftFilters : filters).dateTo || ''}
                                        onChange={e => useDraftFilters ? updateDraft('dateTo', e.target.value) : onFilterChange({ ...filters, dateTo: e.target.value })}
                                    />
                                </div>
                            </>
                        )}
                        {useDraftFilters && (
                            <>
                                <button onClick={applyDraftFilters} className="h-9 mt-4 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark">Apply Filters</button>
                                <button onClick={resetDraftFilters} className="h-9 mt-4 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">Reset</button>
                            </>
                        )}
                    </div>
                )}
                <div className="flex items-center space-x-3 flex-shrink-0">
                    {(showFilters.length > 0 || showMoreFilters.length > 0) &&
                        <div className="relative" ref={filterPopoverRef}>
                            <button onClick={() => setFilterPopoverOpen(!isFilterPopoverOpen)} className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <ion-icon name="filter-outline" className="text-lg"></ion-icon>
                                <span className="hidden lg:inline">{showFilters.length > 0 ? "More Filters" : "Filters"}</span>
                                <span className="lg:hidden">Filters</span>
                            </button>
                            {isFilterPopoverOpen && (
                                <div className="absolute right-0 mt-2 w-[min(92vw,960px)] bg-white dark:bg-gray-800 rounded-lg shadow-xl z-20 border dark:border-gray-600">
                                    <FilterPanel
                                        filters={filters}
                                        setFilters={onFilterChange}
                                        data={safeFilterData}
                                        visibleFields={visibleFilterFields}
                                        draftFilters={useDraftFilters ? draftFilters : undefined}
                                        onDraftChange={useDraftFilters ? setDraftFilters : undefined}
                                        onApply={useDraftFilters ? applyDraftFilters : undefined}
                                        showActions={!useDraftFilters}
                                    />
                                </div>
                            )}
                        </div>
                    }
                    {(pageAction || secondaryAction) ? (
                        <div className="flex items-center space-x-2">
                            {secondaryAction && (
                                <button onClick={secondaryAction.action} className="flex items-center space-x-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700">
                                    <span className="hidden md:inline">{secondaryAction.label}</span>
                                    <span className="md:hidden">{secondaryAction.label}</span>
                                </button>
                            )}
                            {pageAction && (
                                <button onClick={pageAction.action} className="flex items-center space-x-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark">
                                    <ion-icon name="add-outline" className="text-xl"></ion-icon>
                                    <span className="hidden md:inline">{pageAction.label}</span>
                                </button>
                            )}
                        </div>
                    ) : (showAddAction && (
                        <div className="relative" ref={addMenuRef}>
                            <button onClick={() => setAddMenuOpen(!isAddMenuOpen)} className="flex items-center space-x-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark">
                                <ion-icon name="add-outline" className="text-xl"></ion-icon>
                                <span className="hidden md:inline">Add</span>
                            </button>
                            {isAddMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-20 border dark:border-gray-600 overflow-hidden">
                            <ul>{(addActions || []).map(action => (<li key={action.action}><button onClick={() => handleAddAction(action.action)} className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                        <ion-icon name={action.icon} className="text-xl mr-3"></ion-icon><span>{action.name}</span></button></li>))}</ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {headerContent && (
                <div className="mt-3">
                    {headerContent}
                </div>
            )}
        </header>
    );
};

export default PageHeader;
