import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Trip, Advance, RatePartyType } from '../types';

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> & { label: string, isReadOnly?: boolean, children?: React.ReactNode }> = ({ label, isReadOnly, ...props }) => {
    const toId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'field';
    const inputId = props.id || props.name || toId(label);
    const inputName = props.name || inputId;
    const inputValue = props.type === 'number' && (props.value === 0 || props.value === '0') ? '' : props.value;
    return (
        <div className="col-span-1">
            <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            {isReadOnly ? (
                <div id={inputId} role="textbox" aria-readonly="true" className="mt-1 block w-full px-3 py-2 text-gray-500 dark:text-gray-400 min-h-[42px] flex items-center bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600">{props.value || '-'}</div>
            ) : props.type === 'select' ? (
                 <select {...props as React.SelectHTMLAttributes<HTMLSelectElement>} id={inputId} name={inputName} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm">{props.children}</select>
            ) : (
                 <input {...props as React.InputHTMLAttributes<HTMLInputElement>} id={inputId} name={inputName} value={inputValue} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
            )}
        </div>
    );
};

const FileInputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; fileName?: string; }> = ({ label, id, fileName, ...props }) => (
     <div className="col-span-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <div className="mt-1 flex items-center">
            <label htmlFor={id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'file'} className="cursor-pointer bg-white dark:bg-gray-700 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                <span>Choose File</span>
                <input {...props} id={id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'file'} name={id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'file'} type="file" className="sr-only" />
            </label>
            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400 truncate">{fileName || "No file chosen"}</span>
        </div>
    </div>
);

interface AdvanceFormProps {
    advance?: Advance;
    onClose: () => void;
}

const RATE_PARTY_LABELS: { value: RatePartyType; label: string }[] = [
    { value: 'mine-quarry', label: 'Mine & Quarry' },
    { value: 'vendor-customer', label: 'Vendor & Customer' },
    { value: 'royalty-owner', label: 'Royalty Owner' },
    { value: 'transport-owner', label: 'Transport & Owner' },
];

const AdvanceForm: React.FC<AdvanceFormProps> = ({ advance, onClose }) => {
    const { trips, accounts, addAdvance, updateAdvance, mineQuarries, vendorCustomers, royaltyOwnerProfiles, transportOwnerProfiles } = useData();
    const [entryType, setEntryType] = useState<'trip' | 'manual'>(advance?.tripId ? 'trip' : 'manual');
    const [selectedTripId, setSelectedTripId] = useState<string>(advance?.tripId?.toString() || '');
    const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
    const [formData, setFormData] = useState({
        date: advance?.date || new Date().toISOString().split('T')[0],
        purpose: advance?.purpose || '',
        amount: advance?.amount || 0,
        fromAccount: advance?.fromAccount || '',
        toAccount: advance?.toAccount || '',
        ratePartyType: advance?.ratePartyType || '',
        ratePartyId: advance?.ratePartyId || '',
        counterpartyName: advance?.counterpartyName || '',
        remarks: advance?.remarks || '',
    });
    const [fileName, setFileName] = useState<string | undefined>(advance?.voucherSlipUpload);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const ratePartyOptions = (() => {
        switch (formData.ratePartyType) {
            case 'mine-quarry':
                return mineQuarries.map(item => ({ id: item.id, name: item.name }));
            case 'vendor-customer':
                return vendorCustomers.map(item => ({ id: item.id, name: item.name }));
            case 'royalty-owner':
                return royaltyOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
            case 'transport-owner':
                return transportOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
            default:
                return [];
        }
    })();

    useEffect(() => {
        const trip = trips.find(t => t.id === Number(selectedTripId));
        setSelectedTrip(trip || null);
        if (trip) {
            const vendor = vendorCustomers.find(item => item.name === trip.customer);
            setFormData(f => ({
                ...f,
                toAccount: `${trip.vendorName} / ${trip.transporterName}`,
                ratePartyType: vendor ? 'vendor-customer' : f.ratePartyType,
                ratePartyId: vendor ? vendor.id : f.ratePartyId,
                counterpartyName: vendor ? vendor.name : f.counterpartyName,
            }));
        }
    }, [selectedTripId, trips, vendorCustomers]);

    useEffect(() => {
        if (formData.ratePartyId) {
            const selected = ratePartyOptions.find(item => item.id === formData.ratePartyId);
            if (selected && selected.name !== formData.counterpartyName) {
                setFormData(prev => ({ ...prev, counterpartyName: selected.name }));
            }
        }
    }, [formData.ratePartyId, ratePartyOptions, formData.counterpartyName]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value, type } = e.target;
        setFormData(p => ({
            ...p,
            [id]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value,
            ...(id === 'ratePartyType' ? { ratePartyId: '', counterpartyName: '' } : null),
        }));
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFileName(e.target.files[0].name);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const isTripLinked = entryType === 'trip' && selectedTrip;
            const payload: Omit<Advance, 'id'> = {
                date: formData.date,
                fromAccount: formData.fromAccount,
                toAccount: isTripLinked ? `${selectedTrip.vendorName} / ${selectedTrip.transporterName}` : formData.toAccount,
                ratePartyType: formData.ratePartyType || undefined,
                ratePartyId: formData.ratePartyId || undefined,
                counterpartyName: formData.counterpartyName || formData.toAccount,
                purpose: formData.purpose,
                amount: formData.amount,
                voucherSlipUpload: fileName,
                remarks: formData.remarks,
                ...(isTripLinked && {
                    tripId: selectedTrip.id,
                    place: selectedTrip.place,
                    invoiceDCNumber: selectedTrip.invoiceDCNumber,
                    vehicleNumber: selectedTrip.vehicleNumber,
                    ownerAndTransporterName: `${selectedTrip.vendorName} / ${selectedTrip.transporterName}`,
                })
            };
            if (advance) {
                await updateAdvance(advance.id, payload);
            } else {
                await addAdvance(payload);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save advance", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-8">
            <div className="space-y-8">
                <div>
                    <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">Advance Details</h3>
                    <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                        <InputField label="Date" id="date" type="date" value={formData.date} onChange={handleInputChange} required />
                        <InputField label="Purpose" id="purpose" type="text" value={formData.purpose} onChange={handleInputChange} required />
                        <InputField label="Amount" id="amount" type="number" step="0.01" value={formData.amount} onChange={handleInputChange} required />
                        
                        <InputField label="Payment From" id="fromAccount" type="select" value={formData.fromAccount} onChange={handleInputChange} required>
                            <option value="">Select source account...</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                        </InputField>
                        <InputField label="Rate Party Type (Optional)" id="ratePartyType" type="select" value={formData.ratePartyType} onChange={handleInputChange}>
                            <option value="">Select rate party type...</option>
                            {RATE_PARTY_LABELS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </InputField>
                        <InputField label="Rate Party (Optional)" id="ratePartyId" type="select" value={formData.ratePartyId} onChange={handleInputChange} disabled={!formData.ratePartyType}>
                            <option value="">Select rate party...</option>
                            {ratePartyOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                        </InputField>
                        
                        <div className="sm:col-span-2 flex items-center space-x-4 pt-6">
                            <label><input type="radio" value="manual" checked={entryType === 'manual'} onChange={() => setEntryType('manual')} className="mr-2"/> Manual Entry</label>
                            <label><input type="radio" value="trip" checked={entryType === 'trip'} onChange={() => setEntryType('trip')} className="mr-2"/> Link to Trip</label>
                        </div>
                        
                        {entryType === 'manual' && (
                             <InputField label="Payment To" id="toAccount" type="text" value={formData.toAccount} onChange={handleInputChange} required />
                        )}

                        {entryType === 'trip' && (
                             <div className="lg:col-span-2">
                                <InputField label="Select Trip by Date & Vehicle" id="tripId" type="select" value={selectedTripId} onChange={e => setSelectedTripId(e.target.value)} required>
                                    <option value="">Select a trip...</option>
                                    {trips.map(trip => (
                                        <option key={trip.id} value={trip.id}>
                                            {trip.date} - {trip.vehicleNumber} ({trip.customer})
                                        </option>
                                    ))}
                                </InputField>
                            </div>
                        )}

                        <InputField label="Counterparty Name" id="counterpartyName" type="text" value={formData.counterpartyName} onChange={handleInputChange} placeholder="Optional freeform name" />
                        <InputField label="Remarks" id="remarks" type="text" value={formData.remarks} onChange={handleInputChange} />

                         <div className="lg:col-span-3">
                             <FileInputField label="Voucher Slip Upload" id="voucherSlipUpload" onChange={handleFileChange} fileName={fileName} />
                         </div>
                    </div>
                </div>
            </div>
             <div className="pt-8 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
                    Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : 'Save Advance'}
                </button>
            </div>
        </form>
    );
};
export default AdvanceForm;
