import React, { useMemo, useState, useEffect } from 'react';

export interface Filters {
    dateFrom?: string;
    dateTo?: string;
    vehicle?: string;
    transporter?: string;
    customer?: string;
    quarry?: string;
    royalty?: string;
    vendor?: string;
    transportOwner?: string;
    mine?: string;
    material?: string;
}

export type FilterField = 'date' | 'singleDate' | 'transporter' | 'quarry' | 'customer' | 'vehicle' | 'royalty' | 'vendor' | 'transportOwner' | 'mine' | 'material';

export const DEFAULT_MORE_FILTERS: FilterField[] = ['vehicle', 'vendor', 'transportOwner', 'mine', 'material', 'royalty'];

interface FilterPanelProps {
    filters: Filters;
    setFilters: React.Dispatch<React.SetStateAction<Filters>>;
    data: {
        vehicles: { id?: string; vehicleNumber: string }[];
        transportOwners: { id?: string; name: string }[];
        customers: { id?: string; name: string }[];
        quarries: { id?: string; name: string }[];
        royaltyOwners: { id?: string; name: string }[];
        mineQuarries?: { id?: string; name: string }[];
        materials?: { id?: string; name: string }[];
    };
    visibleFields?: FilterField[];
}

const defaultVisibleFields: FilterField[] = ['date', 'vehicle', 'transporter', 'customer', 'quarry', 'royalty'];

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, setFilters, data, visibleFields = defaultVisibleFields }) => {
    const { vehicles, transportOwners, customers, quarries, royaltyOwners, mineQuarries = [], materials = [] } = data;
    const uniqueTransporters = Array.from(new Set((transportOwners || []).map(item => item.name))).filter(Boolean);
    const uniqueVendors = Array.from(new Set(customers.map(item => item.name))).filter(Boolean);
    const uniqueMines = Array.from(new Set(mineQuarries.map(item => item.name))).filter(Boolean);
    const uniqueMaterials = Array.from(new Set(materials.map(item => item.name))).filter(Boolean);

    const [draftFilters, setDraftFilters] = useState<Filters>(filters);

    useEffect(() => {
        setDraftFilters(filters);
    }, [filters]);

    const isCompleteDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
    const handleFilterChange = (key: keyof Filters, value: string) => {
        if (hasSingleDate && key === 'dateFrom') {
            setDraftFilters(prev => ({ ...prev, dateFrom: value, dateTo: value }));
            return;
        }
        setDraftFilters(prev => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const formatDate = (date: Date) => date.toISOString().split('T')[0];
        const nextDate = formatDate(today);
        const nextFilters = hasSingleDate ? { dateFrom: nextDate, dateTo: nextDate } : { dateFrom: formatDate(startOfMonth), dateTo: nextDate };
        setDraftFilters(nextFilters);
        setFilters(nextFilters);
    };

    const applyFilters = () => {
        const nextFilters = { ...draftFilters };
        if ((nextFilters.dateFrom && !isCompleteDate(nextFilters.dateFrom))
          || (nextFilters.dateTo && !isCompleteDate(nextFilters.dateTo))) {
            return;
        }
        if (hasSingleDate && nextFilters.dateFrom) {
            nextFilters.dateTo = nextFilters.dateFrom;
        }
        setFilters(nextFilters);
    };

    const baseInputClass = "mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm";
    const dateInputClass = `${baseInputClass} pr-8`;
    const fields = useMemo(() => new Set<FilterField>(visibleFields.length ? visibleFields : defaultVisibleFields), [visibleFields]);
    const hasSingleDate = useMemo(() => fields.has('singleDate'), [fields]);
    const openDatePicker = (event: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
            (input as HTMLInputElement & { showPicker: () => void }).showPicker();
        }
    };
    const allowDateTyping = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.ctrlKey || event.metaKey) return;
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowed.includes(event.key)) return;
        if (/^[0-9-]$/.test(event.key)) return;
        event.preventDefault();
    };

    return (
         <div className="p-4 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 dark:border-gray-600">Filters</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-[60vh] overflow-y-auto pr-1">
            {fields.has('singleDate') && (
                <div className="min-w-0">
                    <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                    <div className="relative">
                        <input
                            type="date"
                            id="dateFrom"
                            inputMode="numeric"
                            onKeyDown={allowDateTyping}
                            onClick={openDatePicker}
                            onFocus={openDatePicker}
                            className={dateInputClass}
                            value={draftFilters.dateFrom || ''}
                            onChange={e => handleFilterChange('dateFrom', e.target.value)}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <ion-icon name="calendar-outline" className="text-gray-400"></ion-icon>
                        </div>
                    </div>
                </div>
            )}

            {fields.has('date') && !fields.has('singleDate') && (
                <>
                    <div className="min-w-0">
                        <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date From</label>
                        <div className="relative">
                            <input
                            type="date"
                            id="dateFrom"
                            inputMode="numeric"
                            onKeyDown={allowDateTyping}
                            onClick={openDatePicker}
                            onFocus={openDatePicker}
                            className={dateInputClass}
                            value={draftFilters.dateFrom || ''}
                            onChange={e => handleFilterChange('dateFrom', e.target.value)}
                        />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <ion-icon name="calendar-outline" className="text-gray-400"></ion-icon>
                            </div>
                        </div>
                    </div>
                    <div className="min-w-0">
                        <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date To</label>
                        <div className="relative">
                            <input
                            type="date"
                            id="dateTo"
                            inputMode="numeric"
                            onKeyDown={allowDateTyping}
                            onClick={openDatePicker}
                            onFocus={openDatePicker}
                            className={dateInputClass}
                            value={draftFilters.dateTo || ''}
                            onChange={e => handleFilterChange('dateTo', e.target.value)}
                        />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <ion-icon name="calendar-outline" className="text-gray-400"></ion-icon>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {fields.has('vehicle') && (
                <div className="min-w-0">
                    <label htmlFor="vehicle" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vehicle</label>
                    <select id="vehicle" className={baseInputClass} value={draftFilters.vehicle || ''} onChange={e => handleFilterChange('vehicle', e.target.value)}>
                        <option value="">All Vehicles</option>
                        {vehicles.map(v => <option key={`vehicle-${v.id || v.vehicleNumber}`} value={v.vehicleNumber}>{v.vehicleNumber}</option>)}
                    </select>
                </div>
            )}
            {fields.has('transporter') && (
                <div className="min-w-0">
                    <label htmlFor="transporter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transporter</label>
                    <select id="transporter" className={baseInputClass} value={draftFilters.transporter || ''} onChange={e => handleFilterChange('transporter', e.target.value)}>
                        <option value="">All Transporters</option>
                        {uniqueTransporters.map(t => <option key={`transporter-${t}`} value={t}>{t}</option>)}
                    </select>
                </div>
            )}
            {fields.has('customer') && (
                <div className="min-w-0">
                    <label htmlFor="customer" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
                    <select id="customer" className={baseInputClass} value={draftFilters.customer || ''} onChange={e => handleFilterChange('customer', e.target.value)}>
                        <option value="">All Customers</option>
                        {uniqueVendors.map(c => <option key={`customer-${c}`} value={c}>{c}</option>)}
                    </select>
                </div>
            )}
            {fields.has('quarry') && (
                <div className="min-w-0">
                    <label htmlFor="quarry" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quarry</label>
                    <select id="quarry" className={baseInputClass} value={draftFilters.quarry || ''} onChange={e => handleFilterChange('quarry', e.target.value)}>
                        <option value="">All Quarries</option>
                        {quarries.map(q => <option key={`quarry-${q.id || q.name}`} value={q.name}>{q.name}</option>)}
                    </select>
                </div>
            )}
            {fields.has('vendor') && (
                <div className="min-w-0">
                    <label htmlFor="vendor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vendor & Customer Name</label>
                    <select id="vendor" className={baseInputClass} value={draftFilters.vendor || ''} onChange={e => handleFilterChange('vendor', e.target.value)}>
                        <option value="">All Vendors</option>
                        {uniqueVendors.map(vendor => <option key={`vendor-${vendor}`} value={vendor}>{vendor}</option>)}
                    </select>
                </div>
            )}
            {fields.has('transportOwner') && (
                <div className="min-w-0">
                    <label htmlFor="transportOwner" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transport & Owner Name</label>
                    <select id="transportOwner" className={baseInputClass} value={draftFilters.transportOwner || ''} onChange={e => handleFilterChange('transportOwner', e.target.value)}>
                        <option value="">All Transport Owners</option>
                        {transportOwners.map(owner => <option key={`transportOwner-${owner.id || owner.name}`} value={owner.name}>{owner.name}</option>)}
                    </select>
                </div>
            )}
            {fields.has('mine') && (
                <div className="min-w-0">
                    <label htmlFor="mine" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mine & Quarry Name</label>
                    <select id="mine" className={baseInputClass} value={draftFilters.mine || ''} onChange={e => handleFilterChange('mine', e.target.value)}>
                        <option value="">All Mines/Quarries</option>
                        {uniqueMines.map(mine => <option key={`mine-${mine}`} value={mine}>{mine}</option>)}
                    </select>
                </div>
            )}
            {fields.has('material') && (
                <div className="min-w-0">
                    <label htmlFor="material" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Material Type</label>
                    <select id="material" className={baseInputClass} value={draftFilters.material || ''} onChange={e => handleFilterChange('material', e.target.value)}>
                        <option value="">All Materials</option>
                        {uniqueMaterials.map(material => <option key={`material-${material}`} value={material}>{material}</option>)}
                    </select>
                </div>
            )}
            {fields.has('royalty') && (
                <div className="min-w-0">
                    <label htmlFor="royalty" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Royalty</label>
                    <select id="royalty" className={baseInputClass} value={draftFilters.royalty || ''} onChange={e => handleFilterChange('royalty', e.target.value)}>
                        <option value="">All Royalty</option>
                        {royaltyOwners.map(r => <option key={`royalty-${r.id || r.name}`} value={r.name}>{r.name}</option>)}
                    </select>
                </div>
            )}
            </div>
            
            <div className="pt-4 flex items-center gap-2">
                <button onClick={applyFilters} className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark">Apply Filters</button>
                <button onClick={resetFilters} className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">Reset</button>
            </div>
        </div>
    );
};

export default FilterPanel;
