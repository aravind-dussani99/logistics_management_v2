import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useUI } from '../contexts/UIContext';
import FilterPanel, { Filters, FilterField, DEFAULT_MORE_FILTERS } from './FilterPanel';
import { Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import SupervisorTripForm from './SupervisorTripForm';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    showFilters?: ('date' | 'singleDate' | 'transporter' | 'quarry' | 'customer' | 'vehicle' | 'royalty')[];
    showMoreFilters?: ('date' | 'singleDate' | 'transporter' | 'quarry' | 'customer' | 'vehicle' | 'royalty')[];
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
    showFilters = [],
    showMoreFilters = [],
    filters,
    onFilterChange,
    filterData = { vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] },
    pageAction,
    secondaryAction,
    showAddAction = true,
}) => {
    const { openModal, closeModal, alert } = useUI();
    const { currentUser } = useAuth();
    const filterPopoverRef = useRef<HTMLDivElement>(null);
    const addMenuRef = useRef<HTMLDivElement>(null);
    const hasDateFilters = showFilters.includes('date') || showMoreFilters.includes('date') || showFilters.includes('singleDate') || showMoreFilters.includes('singleDate');
    const hasSingleDate = showFilters.includes('singleDate') || showMoreFilters.includes('singleDate');

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
    
    const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
    const handleFilterChangeInternal = (key: keyof Filters, value: string) => {
        if ((key === 'dateFrom' || key === 'dateTo') && (value === '' || !isCompleteDate(value))) {
            return;
        }
        if (hasSingleDate && key === 'dateFrom') {
            onFilterChange({ ...filters, dateFrom: value, dateTo: value });
            return;
        }
        onFilterChange({ ...filters, [key]: value });
    };

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
    
    const baseInputClass = "w-full text-sm px-2 py-1 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary";
    const FilterInput: React.FC<{label: string, children: React.ReactNode}> = ({label, children}) => (
        <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
            {children}
        </div>
    );
    const openDatePicker = (event: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
            (input as HTMLInputElement & { showPicker: () => void }).showPicker();
        }
    };
    const preventDateTyping = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Tab') return;
        event.preventDefault();
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

    const moreFilterFields = useMemo<FilterField[] | undefined>(() => {
        const visibleFields = new Set<FilterField>(showFilters as FilterField[]);
        if (showMoreFilters.length > 0) {
            return Array.from(new Set<FilterField>([...showMoreFilters, ...DEFAULT_MORE_FILTERS]))
                .filter(field => !visibleFields.has(field));
        }
        if (showFilters.length > 0) {
            return Array.from(new Set<FilterField>([...showFilters as FilterField[], ...DEFAULT_MORE_FILTERS]))
                .filter(field => !visibleFields.has(field));
        }
        return undefined;
    }, [showFilters, showMoreFilters]);

    const filterComponents = {
        date: (
            <>
                <FilterInput label="Date From">
                    <input
                        type="date"
                        inputMode="none"
                        onKeyDown={preventDateTyping}
                        onPaste={e => e.preventDefault()}
                        onDrop={e => e.preventDefault()}
                        onClick={openDatePicker}
                        onFocus={openDatePicker}
                        className={baseInputClass}
                        value={filters.dateFrom || ''}
                        onChange={e => handleFilterChangeInternal('dateFrom', e.target.value)}
                    />
                </FilterInput>
                <FilterInput label="Date To">
                    <input
                        type="date"
                        inputMode="none"
                        onKeyDown={preventDateTyping}
                        onPaste={e => e.preventDefault()}
                        onDrop={e => e.preventDefault()}
                        onClick={openDatePicker}
                        onFocus={openDatePicker}
                        className={baseInputClass}
                        value={filters.dateTo || ''}
                        onChange={e => handleFilterChangeInternal('dateTo', e.target.value)}
                    />
                </FilterInput>
            </>
        ),
        singleDate: (
            <FilterInput label="Date">
                <input
                    type="date"
                    inputMode="none"
                    onKeyDown={preventDateTyping}
                    onPaste={e => e.preventDefault()}
                    onDrop={e => e.preventDefault()}
                    onClick={openDatePicker}
                    onFocus={openDatePicker}
                    className={baseInputClass}
                    value={filters.dateFrom || ''}
                    onChange={e => handleFilterChangeInternal('dateFrom', e.target.value)}
                />
            </FilterInput>
        ),
        transporter: (
            <FilterInput label="Transporter">
                <select className={baseInputClass} value={filters.transporter || ''} onChange={e => handleFilterChangeInternal('transporter', e.target.value)}>
                    <option value="">All Transporters</option>
                    {uniqueTransporters.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </FilterInput>
        ),
        quarry: (
            <FilterInput label="Quarry">
                <select className={baseInputClass} value={filters.quarry || ''} onChange={e => handleFilterChangeInternal('quarry', e.target.value)}>
                    <option value="">All Quarries</option>
                    {safeFilterData.quarries.map(q => <option key={q.id || q.name} value={q.name}>{q.name}</option>)}
                </select>
            </FilterInput>
        ),
        vehicle: (
            <FilterInput label="Vehicle">
                <select className={baseInputClass} value={filters.vehicle || ''} onChange={e => handleFilterChangeInternal('vehicle', e.target.value)}>
                    <option value="">All Vehicles</option>
                    {safeFilterData.vehicles.map(v => <option key={v.id || v.vehicleNumber} value={v.vehicleNumber}>{v.vehicleNumber}</option>)}
                </select>
            </FilterInput>
        ),
        customer: (
            <FilterInput label="Customer">
                <select className={baseInputClass} value={filters.customer || ''} onChange={e => handleFilterChangeInternal('customer', e.target.value)}>
                    <option value="">All Customers</option>
                    {uniqueVendors.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </FilterInput>
        ),
        vendor: (
            <FilterInput label="Vendor & Customer">
                <select className={baseInputClass} value={filters.vendor || ''} onChange={e => handleFilterChangeInternal('vendor', e.target.value)}>
                    <option value="">All Vendors</option>
                    {uniqueVendors.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </FilterInput>
        ),
        transportOwner: (
            <FilterInput label="Transport & Owner">
                <select className={baseInputClass} value={filters.transportOwner || ''} onChange={e => handleFilterChangeInternal('transportOwner', e.target.value)}>
                    <option value="">All Transport Owners</option>
                    {safeFilterData.transportOwners.map(owner => <option key={owner.id || owner.name} value={owner.name}>{owner.name}</option>)}
                </select>
            </FilterInput>
        ),
        mine: (
            <FilterInput label="Mine & Quarry">
                <select className={baseInputClass} value={filters.mine || ''} onChange={e => handleFilterChangeInternal('mine', e.target.value)}>
                    <option value="">All Mines/Quarries</option>
                    {uniqueMines.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </FilterInput>
        ),
        material: (
            <FilterInput label="Material Type">
                <select className={baseInputClass} value={filters.material || ''} onChange={e => handleFilterChangeInternal('material', e.target.value)}>
                    <option value="">All Materials</option>
                    {uniqueMaterials.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </FilterInput>
        ),
        royalty: (
            <FilterInput label="Royalty Owner">
                <select className={baseInputClass} value={filters.royalty || ''} onChange={e => handleFilterChangeInternal('royalty', e.target.value)}>
                    <option value="">All Royalty</option>
                    {safeFilterData.royaltyOwners.map(owner => <option key={owner.id || owner.name} value={owner.name}>{owner.name}</option>)}
                </select>
            </FilterInput>
        ),
    };


    return (
        <header className="sticky top-0 bg-light dark:bg-dark py-2 z-10 border-b border-gray-200 dark:border-gray-700 -mx-6 px-6">
            <div className="flex justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-800 dark:text-white flex-shrink-0">{title}</h1>
                    {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
                </div>
                <div className="hidden lg:flex items-end gap-2 flex-grow min-w-0">
                    {showFilters.includes('date') && !showFilters.includes('singleDate') && filterComponents.date}
                    {showFilters.includes('singleDate') && filterComponents.singleDate}
                    {showFilters.includes('transporter') && filterComponents.transporter}
                    {showFilters.includes('quarry') && filterComponents.quarry}
                    {showFilters.includes('vehicle') && filterComponents.vehicle}
                    {showFilters.includes('customer') && filterComponents.customer}
                    {showFilters.includes('vendor') && filterComponents.vendor}
                    {showFilters.includes('transportOwner') && filterComponents.transportOwner}
                    {showFilters.includes('mine') && filterComponents.mine}
                    {showFilters.includes('material') && filterComponents.material}
                    {showFilters.includes('royalty') && filterComponents.royalty}
                </div>
                <div className="flex items-center space-x-3 flex-shrink-0">
                    {(showFilters.length > 0 || showMoreFilters.length > 0) &&
                        <div className="relative" ref={filterPopoverRef}>
                            <button onClick={() => setFilterPopoverOpen(!isFilterPopoverOpen)} className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <ion-icon name="filter-outline" className="text-lg"></ion-icon>
                                <span className="hidden lg:inline">{showFilters.length > 0 ? "More Filters" : "Filters"}</span>
                                <span className="lg:hidden">Filters</span>
                            </button>
                            {isFilterPopoverOpen && (
                                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-20 border dark:border-gray-600">
                                    <FilterPanel
                                        filters={filters}
                                        setFilters={onFilterChange}
                                        data={safeFilterData}
                                        visibleFields={moreFilterFields}
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
        </header>
    );
};

export default PageHeader;
