import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/mockApi';
import { useData } from '../contexts/DataContext';
import { Trip, TripRateOverride, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface AddTripFormProps {
    onClose: () => void;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> {
  label: string;
  error?: string;
  children?: React.ReactNode;
}

const InputField: React.FC<InputProps> = ({ label, error, type, children, ...props }) => {
    const toId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'field';
    const inputId = props.id || props.name || toId(label);
    const inputName = props.name || inputId;
    const baseClasses = "mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm";
    const errorClasses = "border-red-500 focus:ring-red-500 focus:border-red-500";
    const finalClasses = `${baseClasses} ${error ? errorClasses : ''} ${type === 'date' ? 'pr-8' : ''}`;
    const inputValue = type === 'number' && (props.value === 0 || props.value === '0') ? '' : props.value;

    const renderInput = () => {
        if (type === 'select') {
            return <select {...props} id={inputId} name={inputName} className={finalClasses}>{children}</select>
        }
        return <input type={type} {...props} id={inputId} name={inputName} value={inputValue} className={finalClasses} />
    }

    return (
        <div className="col-span-1">
            <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            <div className="relative">
                {renderInput()}
                {type === 'date' && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ion-icon name="calendar-outline" className="text-gray-400"></ion-icon>
                    </div>
                )}
            </div>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
};

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  fileName?: string;
}

const FileInputField: React.FC<FileInputProps> = ({ label, id, fileName, ...props }) => (
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

const initialFormData = {
    date: '',
    place: '',
    pickupPlace: '',
    dropOffPlace: '',
    customer: '',
    invoiceDCNumber: '',
    quarryName: '',
    royaltyOwnerName: '',
    material: '',
    vehicleNumber: '',
    transporterName: '',
    transportOwnerMobileNumber: '',
    netWeight: '0',
    royaltyNumber: '',
    royaltyM3: '',
    deductionPercentage: '0',
    sizeChangePercentage: '0',
    agent: '',
};

const AddTripForm: React.FC<AddTripFormProps> = ({ onClose }) => {
    const formRef = useRef<HTMLFormElement>(null);
    const { currentUser } = useAuth();
    const {
        addTrip,
        addVendorCustomer,
        addMineQuarry,
        addRoyaltyOwnerProfile,
        addTransportOwnerProfile,
        addVehicleMaster,
        loadTripMasters,
        vehicles,
        materialTypeDefinitions,
        siteLocations,
        merchantTypes,
        vendorCustomers,
        mineQuarries,
        royaltyOwnerProfiles,
        transportOwnerProfiles,
    } = useData();

    const [formData, setFormData] = useState(initialFormData);
    const [files, setFiles] = useState<{ [key: string]: string }>({});
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const ONE_OFF_VALUE = '__oneoff__';
    const isPrivileged = currentUser?.role === Role.ADMIN || currentUser?.role === Role.MANAGER || currentUser?.role === Role.ACCOUNTANT;
    const [oneOffSelection, setOneOffSelection] = useState({
        customer: false,
        quarryName: false,
        royaltyOwnerName: false,
        transporterName: false,
        vehicleNumber: false,
    });
    const [oneOffValues, setOneOffValues] = useState({
        customer: '',
        quarryName: '',
        royaltyOwnerName: '',
        transporterName: '',
        vehicleNumber: '',
    });
    const [saveToMaster, setSaveToMaster] = useState({
        customer: false,
        quarryName: false,
        royaltyOwnerName: false,
        transporterName: false,
        vehicleNumber: false,
    });
    const [oneOffMaster, setOneOffMaster] = useState({
        customer: { merchantTypeId: '', siteLocationId: '', contactNumber: '', email: '', companyName: '', gstOptIn: false, gstNumber: '', gstDetails: '', remarks: '' },
        quarryName: { merchantTypeId: '', siteLocationId: '', contactNumber: '', email: '', companyName: '', gstOptIn: false, gstNumber: '', gstDetails: '', remarks: '' },
        royaltyOwnerName: { merchantTypeId: '', siteLocationId: '', contactNumber: '', email: '', companyName: '', gstOptIn: false, gstNumber: '', gstDetails: '', remarks: '' },
        transporterName: { merchantTypeId: '', siteLocationId: '', contactNumber: '', email: '', companyName: '', gstOptIn: false, gstNumber: '', gstDetails: '', remarks: '' },
        vehicleNumber: { vehicleType: '', ownerName: '', contactNumber: '', capacity: '', remarks: '' },
    });
    const [masterErrors, setMasterErrors] = useState<{ [key: string]: string }>({});
    const [rateError, setRateError] = useState('');
    const [rateOverrideEnabled, setRateOverrideEnabled] = useState(false);
    const [rateOverride, setRateOverride] = useState<TripRateOverride>({
        materialTypeId: '',
        ratePartyType: 'transport-owner',
        ratePartyId: '',
        pickupLocationId: '',
        dropOffLocationId: '',
        totalKm: 0,
        ratePerKm: 0,
        ratePerTon: 0,
        gstChargeable: false,
        gstPercentage: 0,
        gstAmount: 0,
        totalRatePerTon: 0,
        effectiveFrom: '',
        effectiveTo: '',
        remarks: '',
    });

    const pickupSites = siteLocations.filter(site => site.type === 'pickup' || site.type === 'both');
    const dropOffSites = siteLocations.filter(site => site.type === 'drop-off' || site.type === 'both');
    const customerNames = Array.from(new Set(vendorCustomers.map(item => item.name)));
    const ratePartyOptions = (() => {
        switch (rateOverride.ratePartyType) {
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
        loadTripMasters();
    }, [loadTripMasters]);

    useEffect(() => {
        if (!rateOverrideEnabled) return;
        const gstAmount = rateOverride.gstChargeable
            ? (Number(rateOverride.ratePerTon) * Number(rateOverride.gstPercentage || 0)) / 100
            : 0;
        const totalRatePerTon = Number(rateOverride.ratePerTon) + gstAmount;
        if (gstAmount === rateOverride.gstAmount && totalRatePerTon === rateOverride.totalRatePerTon) return;
        setRateOverride(prev => ({
            ...prev,
            gstAmount,
            totalRatePerTon,
        }));
    }, [rateOverrideEnabled, rateOverride.ratePerTon, rateOverride.gstPercentage, rateOverride.gstChargeable, rateOverride.gstAmount, rateOverride.totalRatePerTon]);

    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        const requiredFields: (keyof typeof initialFormData)[] = ['date', 'customer', 'quarryName', 'material', 'netWeight', 'pickupPlace', 'dropOffPlace'];
        
        requiredFields.forEach(field => {
            if (!formData[field] || (field === 'netWeight' && parseFloat(formData[field]) <= 0)) {
                 if(formData[field] === '0' || formData[field] === '')
                    newErrors[field] = 'This field is required and must be positive.';
            }
        });
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            console.log('Validation failed');
            return;
        }
        if (!validateMasterSave()) {
            return;
        }
        if (rateOverrideEnabled) {
            if (!rateOverride.materialTypeId || !rateOverride.ratePartyId || !rateOverride.pickupLocationId || !rateOverride.dropOffLocationId || !rateOverride.effectiveFrom) {
                setRateError('Please complete the required rate fields.');
                return;
            }
            setRateError('');
        }

        setIsSubmitting(true);
        const netWeight = parseFloat(formData.netWeight) || 0;
        
        const selectedVehicle = vehicles.find(v => v.vehicleNumber === formData.vehicleNumber);
        
        try {
            if (oneOffSelection.customer && saveToMaster.customer) {
                await addVendorCustomer({
                    ...oneOffMaster.customer,
                    name: oneOffValues.customer,
                });
            }
            if (oneOffSelection.quarryName && saveToMaster.quarryName) {
                await addMineQuarry({
                    ...oneOffMaster.quarryName,
                    name: oneOffValues.quarryName,
                });
            }
            if (oneOffSelection.royaltyOwnerName && saveToMaster.royaltyOwnerName) {
                await addRoyaltyOwnerProfile({
                    ...oneOffMaster.royaltyOwnerName,
                    name: oneOffValues.royaltyOwnerName,
                });
            }
            if (oneOffSelection.transporterName && saveToMaster.transporterName) {
                await addTransportOwnerProfile({
                    ...oneOffMaster.transporterName,
                    name: oneOffValues.transporterName,
                });
            }
            if (oneOffSelection.vehicleNumber && saveToMaster.vehicleNumber) {
                await addVehicleMaster({
                    vehicleNumber: oneOffValues.vehicleNumber,
                    vehicleType: oneOffMaster.vehicleNumber.vehicleType,
                    ownerName: oneOffMaster.vehicleNumber.ownerName,
                    contactNumber: oneOffMaster.vehicleNumber.contactNumber,
                    capacity: Number(oneOffMaster.vehicleNumber.capacity || 0),
                    remarks: oneOffMaster.vehicleNumber.remarks,
                });
            }
        } catch (error) {
            console.error('Failed to save one-off master data', error);
            setIsSubmitting(false);
            return;
        }

        const newTripData: Omit<Trip, 'id' | 'paymentStatus' | 'revenue' | 'materialCost' | 'transportCost' | 'royaltyCost' | 'profit' | 'status' | 'createdBy'> = {
            date: formData.date,
            place: formData.place || formData.dropOffPlace,
            pickupPlace: formData.pickupPlace,
            dropOffPlace: formData.dropOffPlace,
            vendorName: formData.quarryName, 
            vendorCustomerIsOneOff: oneOffSelection.customer,
            customer: formData.customer,
            invoiceDCNumber: formData.invoiceDCNumber,
            quarryName: formData.quarryName,
            mineQuarryIsOneOff: oneOffSelection.quarryName,
            royaltyOwnerName: formData.royaltyOwnerName,
            royaltyOwnerIsOneOff: oneOffSelection.royaltyOwnerName,
            material: formData.material,
            vehicleNumber: formData.vehicleNumber,
            vehicleIsOneOff: oneOffSelection.vehicleNumber,
            transporterName: formData.transporterName || selectedVehicle?.ownerName || '',
            transportOwnerIsOneOff: oneOffSelection.transporterName,
            emptyWeight: 0, 
            grossWeight: netWeight, 
            netWeight: netWeight,
            royaltyNumber: formData.royaltyNumber,
            royaltyTons: netWeight, 
            royaltyM3: parseFloat(formData.royaltyM3) || 0,
            deductionPercentage: parseFloat(formData.deductionPercentage) || 0,
            sizeChangePercentage: parseFloat(formData.sizeChangePercentage) || 0,
            tonnage: netWeight,
            agent: formData.agent,
            rateOverrideEnabled: rateOverrideEnabled,
            rateOverride: rateOverrideEnabled ? rateOverride : null,
        };

        try {
            await addTrip(newTripData);
            onClose();
        } catch (error) {
            console.error("Failed to add trip", error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        const updated = { ...formData, [id]: value };
        if (id === 'dropOffPlace') {
            updated.place = value;
        }
        if (id === 'transporterName') {
            const owner = transportOwnerProfiles.find(item => item.name === value);
            updated.transportOwnerMobileNumber = owner?.contactNumber || '';
        }
        setFormData(updated);
    };

    const handleOneOffSelect = (field: keyof typeof oneOffSelection, value: string) => {
        const isOneOff = value === ONE_OFF_VALUE;
        setOneOffSelection(prev => ({ ...prev, [field]: isOneOff }));
        setFormData(prev => {
            const updated = {
                ...prev,
                [field]: isOneOff ? '' : value,
                [`${field === 'customer' ? 'vendorCustomerIsOneOff' : field === 'quarryName' ? 'mineQuarryIsOneOff' : field === 'royaltyOwnerName' ? 'royaltyOwnerIsOneOff' : field === 'transporterName' ? 'transportOwnerIsOneOff' : 'vehicleIsOneOff'}`]: isOneOff,
            } as typeof prev;
            if (!isOneOff && field === 'vehicleNumber') {
                const vehicle = vehicles.find(item => item.vehicleNumber === value);
                updated.transporterName = vehicle?.ownerName || '';
                const owner = transportOwnerProfiles.find(item => item.name === updated.transporterName);
                updated.transportOwnerMobileNumber = owner?.contactNumber || '';
            }
            if (!isOneOff && field === 'transporterName') {
                const owner = transportOwnerProfiles.find(item => item.name === value);
                updated.transportOwnerMobileNumber = owner?.contactNumber || '';
            }
            if (!isOneOff && field === 'quarryName') {
                updated.vendorName = value;
            }
            return updated;
        });
        if (isOneOff) {
            setOneOffValues(prev => ({ ...prev, [field]: '' }));
        }
    };

    const handleOneOffValueChange = (field: keyof typeof oneOffValues, value: string) => {
        setOneOffValues(prev => ({ ...prev, [field]: value }));
        setFormData(prev => ({ ...prev, [field]: value } as typeof prev));
    };

    const handleMasterFieldChange = (field: keyof typeof oneOffMaster, key: string, value: string | boolean) => {
        setOneOffMaster(prev => ({
            ...prev,
            [field]: {
                ...prev[field],
                [key]: value,
            },
        }));
    };

    const handleRateOverrideChange = (field: keyof TripRateOverride, value: string | number | boolean) => {
        setRateOverride(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const validateMasterSave = () => {
        const nextErrors: { [key: string]: string } = {};
        (['customer', 'quarryName', 'royaltyOwnerName', 'transporterName'] as const).forEach((field) => {
            if (!saveToMaster[field]) return;
            const entry = oneOffMaster[field];
            if (!entry.merchantTypeId || !entry.siteLocationId || !entry.contactNumber) {
                nextErrors[field] = 'Merchant type, site location, and contact number are required to save.';
            }
        });
        if (saveToMaster.vehicleNumber) {
            const entry = oneOffMaster.vehicleNumber;
            if (!entry.vehicleType || !entry.ownerName || !entry.contactNumber) {
                nextErrors.vehicleNumber = 'Vehicle type, owner name, and contact number are required to save.';
            }
        }
        setMasterErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles({ ...files, [e.target.id]: e.target.files[0].name });
        }
    };
    
    const handleReset = () => {
        setFormData(initialFormData);
        setFiles({});
        setErrors({});
        formRef.current?.reset();
    };

    return (
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="p-8">
            <div className="space-y-10">
                <div>
                    <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">1. Enter Details</h3>
                    <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                        <InputField label="Date" id="date" type="date" required error={errors.date} value={formData.date} onChange={handleInputChange}/>
                        <InputField label="Pickup Place" id="pickupPlace" type="select" value={formData.pickupPlace} onChange={handleInputChange}>
                            <option value="">Select Pickup</option>
                            {pickupSites.map(site => (
                                <option key={site.id} value={site.name}>{site.name}</option>
                            ))}
                        </InputField>
                        <InputField label="Drop-off Place" id="dropOffPlace" type="select" value={formData.dropOffPlace} onChange={handleInputChange}>
                            <option value="">Select Drop-off</option>
                            {dropOffSites.map(site => (
                                <option key={site.id} value={site.name}>{site.name}</option>
                            ))}
                        </InputField>
                        <InputField
                            label="Vendor & Customer Name"
                            id="customer"
                            type="select"
                            required
                            error={errors.customer}
                            value={oneOffSelection.customer ? ONE_OFF_VALUE : formData.customer}
                            onChange={(event) => handleOneOffSelect('customer', event.target.value)}
                        >
                            <option value="">Select Vendor/Customer</option>
                            {customerNames.map(c => <option key={c} value={c}>{c}</option>)}
                            <option value={ONE_OFF_VALUE}>One-time / Other</option>
                        </InputField>
                        {oneOffSelection.customer && (
                            <>
                                <InputField label="One-time Vendor/Customer Name" id="oneOffCustomerName" type="text" value={oneOffValues.customer} onChange={(event) => handleOneOffValueChange('customer', event.target.value)} />
                                <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center gap-2">
                                    <input
                                        id="saveCustomer"
                                        type="checkbox"
                                        checked={saveToMaster.customer}
                                        onChange={(event) => setSaveToMaster(prev => ({ ...prev, customer: event.target.checked }))}
                                    />
                                    <label htmlFor="saveCustomer" className="text-sm text-gray-700 dark:text-gray-300">Save to Master Data</label>
                                    {masterErrors.customer && <span className="text-xs text-red-500">{masterErrors.customer}</span>}
                                </div>
                                {saveToMaster.customer && (
                                    <>
                                        <InputField label="Merchant Type" id="customerMerchantTypeId" type="select" value={oneOffMaster.customer.merchantTypeId} onChange={(event) => handleMasterFieldChange('customer', 'merchantTypeId', event.target.value)}>
                                            <option value="">Select Merchant Type</option>
                                            {merchantTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                        </InputField>
                                        <InputField label="Site Location" id="customerSiteLocationId" type="select" value={oneOffMaster.customer.siteLocationId} onChange={(event) => handleMasterFieldChange('customer', 'siteLocationId', event.target.value)}>
                                            <option value="">Select Site Location</option>
                                            {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                                        </InputField>
                                        <InputField label="Contact Number" id="customerContactNumber" type="text" value={oneOffMaster.customer.contactNumber} onChange={(event) => handleMasterFieldChange('customer', 'contactNumber', event.target.value)} />
                                    </>
                                )}
                            </>
                        )}
                        <InputField label="DC Number" id="invoiceDCNumber" type="text" placeholder="e.g., DC-12345" value={formData.invoiceDCNumber} onChange={handleInputChange}/>
                        <InputField
                            label="Mine & Quarry Name"
                            id="quarryName"
                            type="select"
                            required
                            error={errors.quarryName}
                            value={oneOffSelection.quarryName ? ONE_OFF_VALUE : formData.quarryName}
                            onChange={(event) => handleOneOffSelect('quarryName', event.target.value)}
                        >
                             <option value="">Select Mine/Quarry</option>
                             {mineQuarries.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                             <option value={ONE_OFF_VALUE}>One-time / Other</option>
                        </InputField>
                        {oneOffSelection.quarryName && (
                            <>
                                <InputField label="One-time Mine/Quarry Name" id="oneOffQuarryName" type="text" value={oneOffValues.quarryName} onChange={(event) => handleOneOffValueChange('quarryName', event.target.value)} />
                                <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center gap-2">
                                    <input
                                        id="saveQuarry"
                                        type="checkbox"
                                        checked={saveToMaster.quarryName}
                                        onChange={(event) => setSaveToMaster(prev => ({ ...prev, quarryName: event.target.checked }))}
                                    />
                                    <label htmlFor="saveQuarry" className="text-sm text-gray-700 dark:text-gray-300">Save to Master Data</label>
                                    {masterErrors.quarryName && <span className="text-xs text-red-500">{masterErrors.quarryName}</span>}
                                </div>
                                {saveToMaster.quarryName && (
                                    <>
                                        <InputField label="Merchant Type" id="quarryMerchantTypeId" type="select" value={oneOffMaster.quarryName.merchantTypeId} onChange={(event) => handleMasterFieldChange('quarryName', 'merchantTypeId', event.target.value)}>
                                            <option value="">Select Merchant Type</option>
                                            {merchantTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                        </InputField>
                                        <InputField label="Site Location" id="quarrySiteLocationId" type="select" value={oneOffMaster.quarryName.siteLocationId} onChange={(event) => handleMasterFieldChange('quarryName', 'siteLocationId', event.target.value)}>
                                            <option value="">Select Site Location</option>
                                            {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                                        </InputField>
                                        <InputField label="Contact Number" id="quarryContactNumber" type="text" value={oneOffMaster.quarryName.contactNumber} onChange={(event) => handleMasterFieldChange('quarryName', 'contactNumber', event.target.value)} />
                                    </>
                                )}
                            </>
                        )}
                        <InputField
                            label="Royalty Owner Name"
                            id="royaltyOwnerName"
                            type="select"
                            value={oneOffSelection.royaltyOwnerName ? ONE_OFF_VALUE : formData.royaltyOwnerName}
                            onChange={(event) => handleOneOffSelect('royaltyOwnerName', event.target.value)}
                        >
                             <option value="">Select Royalty Owner</option>
                             {royaltyOwnerProfiles.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                             <option value={ONE_OFF_VALUE}>One-time / Other</option>
                        </InputField>
                        {oneOffSelection.royaltyOwnerName && (
                            <>
                                <InputField label="One-time Royalty Owner Name" id="oneOffRoyaltyOwnerName" type="text" value={oneOffValues.royaltyOwnerName} onChange={(event) => handleOneOffValueChange('royaltyOwnerName', event.target.value)} />
                                <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center gap-2">
                                    <input
                                        id="saveRoyalty"
                                        type="checkbox"
                                        checked={saveToMaster.royaltyOwnerName}
                                        onChange={(event) => setSaveToMaster(prev => ({ ...prev, royaltyOwnerName: event.target.checked }))}
                                    />
                                    <label htmlFor="saveRoyalty" className="text-sm text-gray-700 dark:text-gray-300">Save to Master Data</label>
                                    {masterErrors.royaltyOwnerName && <span className="text-xs text-red-500">{masterErrors.royaltyOwnerName}</span>}
                                </div>
                                {saveToMaster.royaltyOwnerName && (
                                    <>
                                        <InputField label="Merchant Type" id="royaltyMerchantTypeId" type="select" value={oneOffMaster.royaltyOwnerName.merchantTypeId} onChange={(event) => handleMasterFieldChange('royaltyOwnerName', 'merchantTypeId', event.target.value)}>
                                            <option value="">Select Merchant Type</option>
                                            {merchantTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                        </InputField>
                                        <InputField label="Site Location" id="royaltySiteLocationId" type="select" value={oneOffMaster.royaltyOwnerName.siteLocationId} onChange={(event) => handleMasterFieldChange('royaltyOwnerName', 'siteLocationId', event.target.value)}>
                                            <option value="">Select Site Location</option>
                                            {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                                        </InputField>
                                        <InputField label="Contact Number" id="royaltyContactNumber" type="text" value={oneOffMaster.royaltyOwnerName.contactNumber} onChange={(event) => handleMasterFieldChange('royaltyOwnerName', 'contactNumber', event.target.value)} />
                                    </>
                                )}
                            </>
                        )}
                        <InputField label="Material Type" id="material" type="select" required error={errors.material} value={formData.material} onChange={handleInputChange}>
                             <option value="">Select Material</option>
                             {materialTypeDefinitions.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                        </InputField>
                        <InputField label="Vehicle Number" id="vehicleNumber" type="select" error={errors.vehicleNumber} value={oneOffSelection.vehicleNumber ? ONE_OFF_VALUE : formData.vehicleNumber} onChange={(event) => handleOneOffSelect('vehicleNumber', event.target.value)}>
                            <option value="">Select Vehicle</option>
                            {vehicles.map(v => <option key={v.id} value={v.vehicleNumber}>{v.vehicleNumber} ({v.ownerName})</option>)}
                            <option value={ONE_OFF_VALUE}>One-time / Other</option>
                        </InputField>
                        {oneOffSelection.vehicleNumber && (
                            <>
                                <InputField label="One-time Vehicle Number" id="oneOffVehicleNumber" type="text" value={oneOffValues.vehicleNumber} onChange={(event) => handleOneOffValueChange('vehicleNumber', event.target.value)} />
                                <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center gap-2">
                                    <input
                                        id="saveVehicle"
                                        type="checkbox"
                                        checked={saveToMaster.vehicleNumber}
                                        onChange={(event) => setSaveToMaster(prev => ({ ...prev, vehicleNumber: event.target.checked }))}
                                    />
                                    <label htmlFor="saveVehicle" className="text-sm text-gray-700 dark:text-gray-300">Save to Master Data</label>
                                    {masterErrors.vehicleNumber && <span className="text-xs text-red-500">{masterErrors.vehicleNumber}</span>}
                                </div>
                                {saveToMaster.vehicleNumber && (
                                    <>
                                        <InputField label="Vehicle Type" id="vehicleType" type="text" value={oneOffMaster.vehicleNumber.vehicleType} onChange={(event) => handleMasterFieldChange('vehicleNumber', 'vehicleType', event.target.value)} />
                                        <InputField label="Owner Name" id="vehicleOwnerName" type="text" value={oneOffMaster.vehicleNumber.ownerName} onChange={(event) => handleMasterFieldChange('vehicleNumber', 'ownerName', event.target.value)} />
                                        <InputField label="Owner Contact" id="vehicleContactNumber" type="text" value={oneOffMaster.vehicleNumber.contactNumber} onChange={(event) => handleMasterFieldChange('vehicleNumber', 'contactNumber', event.target.value)} />
                                        <InputField label="Capacity" id="vehicleCapacity" type="number" value={oneOffMaster.vehicleNumber.capacity} onChange={(event) => handleMasterFieldChange('vehicleNumber', 'capacity', event.target.value)} />
                                    </>
                                )}
                            </>
                        )}
                        <InputField label="Transport & Owner Name" id="transporterName" type="select" value={oneOffSelection.transporterName ? ONE_OFF_VALUE : formData.transporterName} onChange={(event) => handleOneOffSelect('transporterName', event.target.value)}>
                            <option value="">Select Transport Owner</option>
                            {transportOwnerProfiles.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            <option value={ONE_OFF_VALUE}>One-time / Other</option>
                        </InputField>
                        {oneOffSelection.transporterName && (
                            <>
                                <InputField label="One-time Transport Owner Name" id="oneOffTransportOwnerName" type="text" value={oneOffValues.transporterName} onChange={(event) => handleOneOffValueChange('transporterName', event.target.value)} />
                                <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex items-center gap-2">
                                    <input
                                        id="saveTransportOwner"
                                        type="checkbox"
                                        checked={saveToMaster.transporterName}
                                        onChange={(event) => setSaveToMaster(prev => ({ ...prev, transporterName: event.target.checked }))}
                                    />
                                    <label htmlFor="saveTransportOwner" className="text-sm text-gray-700 dark:text-gray-300">Save to Master Data</label>
                                    {masterErrors.transporterName && <span className="text-xs text-red-500">{masterErrors.transporterName}</span>}
                                </div>
                                {saveToMaster.transporterName && (
                                    <>
                                        <InputField label="Merchant Type" id="transportMerchantTypeId" type="select" value={oneOffMaster.transporterName.merchantTypeId} onChange={(event) => handleMasterFieldChange('transporterName', 'merchantTypeId', event.target.value)}>
                                            <option value="">Select Merchant Type</option>
                                            {merchantTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                                        </InputField>
                                        <InputField label="Site Location" id="transportSiteLocationId" type="select" value={oneOffMaster.transporterName.siteLocationId} onChange={(event) => handleMasterFieldChange('transporterName', 'siteLocationId', event.target.value)}>
                                            <option value="">Select Site Location</option>
                                            {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                                        </InputField>
                                        <InputField label="Contact Number" id="transportContactNumber" type="text" value={oneOffMaster.transporterName.contactNumber} onChange={(event) => handleMasterFieldChange('transporterName', 'contactNumber', event.target.value)} />
                                    </>
                                )}
                            </>
                        )}
                        <InputField label="Transport & Owner Mobile Number" id="transportOwnerMobileNumber" type="text" value={formData.transportOwnerMobileNumber} onChange={handleInputChange} />
                        <InputField label="Agent" id="agent" type="text" placeholder="e.g., Agent Name" value={formData.agent} onChange={handleInputChange} />
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">Wayment Slip</h3>
                     <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
                        <InputField label="Net Weight (Tons)" id="netWeight" type="number" step="0.01" value={formData.netWeight} onChange={handleInputChange} error={errors.netWeight} required />
                        <InputField label="Deduction %" id="deductionPercentage" type="number" step="0.01" value={formData.deductionPercentage} onChange={handleInputChange} />
                        <InputField label="Royalty Number" id="royaltyNumber" type="text" placeholder="e.g., R-9876" value={formData.royaltyNumber} onChange={handleInputChange}/>
                        <InputField label="Royalty M3" id="royaltyM3" type="number" step="0.01" placeholder="e.g., 14" value={formData.royaltyM3} onChange={handleInputChange}/>
                        <InputField label="Size Change %" id="sizeChangePercentage" type="number" step="0.01" value={formData.sizeChangePercentage} onChange={handleInputChange} />
                    </div>
                </div>

                {isPrivileged && (
                    <div>
                        <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">3. Add Rate (Optional)</h3>
                        <div className="mt-4 flex items-center gap-2">
                            <input
                                id="rateOverrideEnabled"
                                type="checkbox"
                                checked={rateOverrideEnabled}
                                onChange={(event) => setRateOverrideEnabled(event.target.checked)}
                            />
                            <label htmlFor="rateOverrideEnabled" className="text-sm text-gray-700 dark:text-gray-300">Override rate for this trip</label>
                            {rateError && <span className="text-xs text-red-500">{rateError}</span>}
                        </div>
                        {rateOverrideEnabled && (
                            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                                <InputField label="Material Type" id="rateOverrideMaterialType" type="select" value={rateOverride.materialTypeId} onChange={(event) => handleRateOverrideChange('materialTypeId', event.target.value)}>
                                    <option value="">Select Material</option>
                                    {materialTypeDefinitions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </InputField>
                                <InputField label="Rate Party Type" id="rateOverrideRatePartyType" type="select" value={rateOverride.ratePartyType} onChange={(event) => {
                                    const nextType = event.target.value as TripRateOverride['ratePartyType'];
                                    setRateOverride(prev => ({ ...prev, ratePartyType: nextType, ratePartyId: '' }));
                                }}>
                                    <option value="transport-owner">Transport Owner</option>
                                    <option value="mine-quarry">Mine/Quarry</option>
                                    <option value="vendor-customer">Vendor/Customer</option>
                                    <option value="royalty-owner">Royalty Owner</option>
                                </InputField>
                                <InputField label="Rate Party" id="rateOverrideRateParty" type="select" value={rateOverride.ratePartyId} onChange={(event) => handleRateOverrideChange('ratePartyId', event.target.value)}>
                                    <option value="">Select Rate Party</option>
                                    {ratePartyOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </InputField>
                                <InputField label="Pickup Location" id="rateOverridePickup" type="select" value={rateOverride.pickupLocationId} onChange={(event) => handleRateOverrideChange('pickupLocationId', event.target.value)}>
                                    <option value="">Select Pickup</option>
                                    {pickupSites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                                </InputField>
                                <InputField label="Drop-off Location" id="rateOverrideDropOff" type="select" value={rateOverride.dropOffLocationId} onChange={(event) => handleRateOverrideChange('dropOffLocationId', event.target.value)}>
                                    <option value="">Select Drop-off</option>
                                    {dropOffSites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                                </InputField>
                                <InputField label="Total Km" id="rateOverrideTotalKm" type="number" step="0.01" value={rateOverride.totalKm} onChange={(event) => handleRateOverrideChange('totalKm', Number(event.target.value))} />
                                <InputField label="Rate per Km" id="rateOverrideRatePerKm" type="number" step="0.01" value={rateOverride.ratePerKm} onChange={(event) => handleRateOverrideChange('ratePerKm', Number(event.target.value))} />
                                <InputField label="Rate per Ton" id="rateOverrideRatePerTon" type="number" step="0.01" value={rateOverride.ratePerTon} onChange={(event) => handleRateOverrideChange('ratePerTon', Number(event.target.value))} />
                                <div className="col-span-1 flex items-center gap-2 pt-6">
                                    <input
                                        id="rateOverrideGstChargeable"
                                        type="checkbox"
                                        checked={rateOverride.gstChargeable}
                                        onChange={(event) => handleRateOverrideChange('gstChargeable', event.target.checked)}
                                    />
                                    <label htmlFor="rateOverrideGstChargeable" className="text-sm text-gray-700 dark:text-gray-300">GST Chargeable</label>
                                </div>
                                <InputField label="GST %" id="rateOverrideGstPercentage" type="number" step="0.01" value={rateOverride.gstPercentage} onChange={(event) => handleRateOverrideChange('gstPercentage', Number(event.target.value))} />
                                <InputField label="GST Amount" id="rateOverrideGstAmount" type="number" step="0.01" value={rateOverride.gstAmount} onChange={(event) => handleRateOverrideChange('gstAmount', Number(event.target.value))} />
                                <InputField label="Total Rate per Ton" id="rateOverrideTotalRate" type="number" step="0.01" value={rateOverride.totalRatePerTon} onChange={(event) => handleRateOverrideChange('totalRatePerTon', Number(event.target.value))} />
                                <InputField label="Effective From" id="rateOverrideEffectiveFrom" type="date" value={rateOverride.effectiveFrom} onChange={(event) => handleRateOverrideChange('effectiveFrom', event.target.value)} />
                                <InputField label="Effective To" id="rateOverrideEffectiveTo" type="date" value={rateOverride.effectiveTo} onChange={(event) => handleRateOverrideChange('effectiveTo', event.target.value)} />
                                <InputField label="Remarks" id="rateOverrideRemarks" type="text" value={rateOverride.remarks} onChange={(event) => handleRateOverrideChange('remarks', event.target.value)} />
                            </div>
                        )}
                    </div>
                )}

                <div className="pt-4">
                     <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">2. Upload Documents</h3>
                     <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                        <FileInputField label="DC Upload" id="dcUpload" onChange={handleFileChange} fileName={files.dcUpload} />
                        <FileInputField label="Wayment Slip Upload" id="waymentUpload" onChange={handleFileChange} fileName={files.waymentUpload}/>
                        <FileInputField label="Royalty Upload" id="royaltyUpload" onChange={handleFileChange} fileName={files.royaltyUpload}/>
                        <FileInputField label="Tax Invoice" id="taxInvoiceUpload" onChange={handleFileChange} fileName={files.taxInvoiceUpload}/>
                        <FileInputField label="Eway Bill" id="ewayBillUpload" onChange={handleFileChange} fileName={files.ewayBillUpload}/>
                     </div>
                </div>
            </div>

            <div className="pt-8 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
                    Cancel
                </button>
                 <button type="button" onClick={handleReset} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
                    Reset
                </button>
                <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : 'Save Trip'}
                </button>
            </div>
        </form>
    );
};

export default AddTripForm;
