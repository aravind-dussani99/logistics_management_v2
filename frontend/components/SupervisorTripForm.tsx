import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Trip, Trip as TripType, TripUploadFile, TripActivity, Role } from '../types';
import { safeToFixed } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { tripApi } from '../services/tripApi';

interface SupervisorTripFormProps {
    mode: 'enter' | 'upload' | 'edit' | 'view';
    trip?: TripType;
    onClose: () => void;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> & React.SelectHTMLAttributes<HTMLSelectElement> & { label: string, isReadOnly?: boolean, children?: React.ReactNode }> = ({ label, isReadOnly, ...props }) => {
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
            ) : props.type === 'textarea' ? (
                 <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} id={inputId} name={inputName} rows={2} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
            ) : (
                 <input {...props as React.InputHTMLAttributes<HTMLInputElement>} id={inputId} name={inputName} value={inputValue} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
            )}
        </div>
    );
};

const FileInputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; files?: TripUploadFile[]; isReadOnly?: boolean; }> = ({ label, id, files, isReadOnly, ...props }) => (
     <div className="col-span-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        {isReadOnly ? (
             <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 truncate">{files && files.length > 0 ? `${files.length} file(s)` : "Not uploaded"}</p>
        ) : (
            <div className="mt-1 flex items-center">
                <label htmlFor={id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'file'} className="cursor-pointer bg-white dark:bg-gray-700 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <span>Choose File</span>
                    <input {...props} id={id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'file'} name={id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'file'} type="file" className="sr-only" />
                </label>
                <span className="ml-3 text-sm text-gray-500 dark:text-gray-400 truncate">{files && files.length > 0 ? `${files.length} file(s) selected` : "No file chosen"}</span>
            </div>
        )}
    </div>
);

const SupervisorTripForm: React.FC<SupervisorTripFormProps> = ({ mode, trip, onClose }) => {
    const { addTrip, updateTrip, vehicles, materialTypeDefinitions, siteLocations, vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles } = useData();
    const { currentUser } = useAuth();
    const [formData, setFormData] = useState<Partial<TripType>>({
        date: new Date().toISOString().split('T')[0],
        emptyWeight: 0,
        grossWeight: 0,
        netWeight: 0,
        royaltyTons: 0,
        royaltyM3: 0,
    });
    const [files, setFiles] = useState<Record<'ewayBillUpload' | 'invoiceDCUpload' | 'waymentSlipUpload' | 'royaltyUpload' | 'taxInvoiceUpload' | 'endWaymentSlipUpload', TripUploadFile[]>>({
        ewayBillUpload: [],
        invoiceDCUpload: [],
        waymentSlipUpload: [],
        royaltyUpload: [],
        taxInvoiceUpload: [],
        endWaymentSlipUpload: [],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewFile, setPreviewFile] = useState<TripUploadFile | null>(null);
    const [activityLog, setActivityLog] = useState<TripActivity[]>([]);
    const [activityError, setActivityError] = useState('');
    const pickupSites = siteLocations.filter(site => site.type === 'pickup' || site.type === 'both');
    const dropOffSites = siteLocations.filter(site => site.type === 'drop-off' || site.type === 'both');

    const parseUploadValue = (value?: TripUploadFile[] | string | null) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.filter(item => item && typeof item.name === 'string' && typeof item.url === 'string');
            }
        } catch (error) {
            console.warn('Failed to parse upload field', error);
        }
        return value ? [{ name: String(value), url: '' }] : [];
    };

    const serializeUploadValue = (value?: TripUploadFile[]) => {
        if (!value || value.length === 0) return '';
        return JSON.stringify(value);
    };

    const isPreviewable = (file: TripUploadFile) => Boolean(file.url);
    const isImageFile = (file: TripUploadFile) => {
        if (!file.url) return false;
        if (file.url.startsWith('data:image')) return true;
        return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
    };
    
    useEffect(() => {
        if (trip) {
            const normalizedTrip = {
                ...trip,
                dropOffPlace: trip.dropOffPlace || trip.place || '',
                place: trip.place || trip.dropOffPlace || '',
                date: trip.date ? trip.date.split('T')[0] : trip.date,
            };
            setFormData(normalizedTrip);
            setFiles({
                ewayBillUpload: parseUploadValue(trip.ewayBillUpload),
                invoiceDCUpload: parseUploadValue(trip.invoiceDCUpload),
                waymentSlipUpload: parseUploadValue(trip.waymentSlipUpload),
                royaltyUpload: parseUploadValue(trip.royaltyUpload),
                taxInvoiceUpload: parseUploadValue(trip.taxInvoiceUpload),
                endWaymentSlipUpload: parseUploadValue(trip.endWaymentSlipUpload),
            });
        }
    }, [trip]);

    useEffect(() => {
        if (mode !== 'view' || !trip?.id) return;
        if (!currentUser || ![Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT].includes(currentUser.role)) return;
        tripApi.getActivity(trip.id)
            .then(setActivityLog)
            .catch((error) => {
                console.error('Failed to load trip activity', error);
                setActivityError('Failed to load trip history.');
            });
    }, [mode, trip?.id, currentUser]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value, type } = e.target;
        let newFormData = { ...formData, [id]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value };

        if (id === 'grossWeight' || id === 'emptyWeight') {
            const gross = id === 'grossWeight' ? parseFloat(value) : newFormData.grossWeight;
            const empty = id === 'emptyWeight' ? parseFloat(value) : newFormData.emptyWeight;
            newFormData.netWeight = Math.max(0, (gross || 0) - (empty || 0));
        }

        if (id === 'endGrossWeight' || id === 'endEmptyWeight') {
            const endGross = id === 'endGrossWeight' ? parseFloat(value) : newFormData.endGrossWeight;
            const endEmpty = id === 'endEmptyWeight' ? parseFloat(value) : newFormData.endEmptyWeight;
            newFormData.endNetWeight = Math.max(0, (endGross || 0) - (endEmpty || 0));
        }
        
        if (id === 'dropOffPlace') {
            newFormData.place = value;
        }

        if (id === 'vehicleNumber') {
            const vehicle = vehicles.find(v => v.vehicleNumber === value);
            newFormData.transporterName = vehicle?.ownerName || '';
            const ownerMatch = transportOwnerProfiles.find(item => item.name === newFormData.transporterName);
            newFormData.transportOwnerMobileNumber = ownerMatch?.contactNumber || '';
        }

        if (id === 'transporterName') {
            const ownerMatch = transportOwnerProfiles.find(item => item.name === value);
            newFormData.transportOwnerMobileNumber = ownerMatch?.contactNumber || '';
        }
        
        if (id === 'quarryName') {
            newFormData.vendorName = value;
        }

        setFormData(newFormData);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, files: selected } = e.target;
        if (!selected || selected.length === 0) return;
        const fileList = Array.from(selected);
        const entries = await Promise.all(fileList.map(file => new Promise<TripUploadFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, url: String(reader.result || '') });
            reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
            reader.readAsDataURL(file);
        })));
        const fieldId = id as keyof typeof files;
        setFiles(prev => ({ ...prev, [fieldId]: entries }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (mode === 'enter') {
                const tripPayload = {
                    ...formData,
                    place: formData.place || formData.dropOffPlace || '',
                };
                await addTrip(tripPayload as Omit<Trip, 'id' | 'paymentStatus' | 'revenue' | 'materialCost' | 'transportCost' | 'royaltyCost' | 'profit' | 'status' | 'createdBy'>);
            } else if (mode === 'upload' || mode === 'edit') {
                const uploadData = {
                    ewayBillUpload: serializeUploadValue(files.ewayBillUpload),
                    invoiceDCUpload: serializeUploadValue(files.invoiceDCUpload),
                    waymentSlipUpload: serializeUploadValue(files.waymentSlipUpload),
                    royaltyUpload: serializeUploadValue(files.royaltyUpload),
                    taxInvoiceUpload: serializeUploadValue(files.taxInvoiceUpload),
                    endWaymentSlipUpload: serializeUploadValue(files.endWaymentSlipUpload),
                }
                const nextStatus = mode === 'upload' ? 'in transit' : formData.status;
                await updateTrip(trip!.id, { ...formData, ...uploadData, status: nextStatus });
            }
            onClose();
        } catch (error) {
            console.error("Failed to save trip", error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const isReadOnly = mode === 'view';

    const renderUploadList = (label: string, list: TripUploadFile[]) => (
        <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{label}</div>
            {list.length === 0 ? (
                <div className="mt-2 text-sm text-gray-400">Not uploaded</div>
            ) : (
                <ul className="mt-2 space-y-2 text-sm">
                    {list.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                {isImageFile(file) ? (
                                    <img
                                        src={file.url}
                                        alt={file.name}
                                        className="h-10 w-10 rounded-md object-cover border border-gray-200 dark:border-gray-600"
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded-md flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-xs text-gray-500">
                                        DOC
                                    </div>
                                )}
                                <span className="truncate text-gray-700 dark:text-gray-200">{file.name}</span>
                            </div>
                            {isPreviewable(file) ? (
                                <button
                                    type="button"
                                    onClick={() => setPreviewFile(file)}
                                    className="text-primary hover:underline"
                                >
                                    View
                                </button>
                            ) : (
                                <span className="text-gray-400 text-xs">No preview</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="p-8">
            <div className="space-y-8">
                { /* ENTER MODE: Expanded form */ }
                {mode === 'enter' && (
                     <div>
                        <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">Enter New Trip</h3>
                        <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
                             <InputField label="Date" id="date" type="date" value={formData.date} onChange={handleInputChange} required />
                            <InputField label="Pickup Place" id="pickupPlace" type="select" value={formData.pickupPlace || ''} onChange={handleInputChange} required>
                                <option value="">Select Pickup</option>
                                {pickupSites.map(site => <option key={site.id} value={site.name}>{site.name}</option>)}
                            </InputField>
                            <InputField label="Drop-off Place" id="dropOffPlace" type="select" value={formData.dropOffPlace || ''} onChange={handleInputChange} required>
                                <option value="">Select Drop-off</option>
                                {dropOffSites.map(site => <option key={site.id} value={site.name}>{site.name}</option>)}
                            </InputField>
                             <InputField label="Invoice & DC Number" id="invoiceDCNumber" type="text" value={formData.invoiceDCNumber} onChange={handleInputChange} />
                            <InputField label="Vendor & Customer Name" id="customer" type="select" value={formData.customer} onChange={handleInputChange} required>
                                <option value="">Select Vendor/Customer</option>
                                {vendorCustomers.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                             <InputField label="Mine & Quarry Name" id="quarryName" type="select" value={formData.quarryName} onChange={handleInputChange} required>
                                <option value="">Select Mine/Quarry</option>
                                {mineQuarries.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                            <InputField label="Material Type" id="material" type="select" value={formData.material} onChange={handleInputChange} required>
                                <option value="">Select Material</option>
                                {materialTypeDefinitions.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                            <InputField label="Royalty Owner Name" id="royaltyOwnerName" type="select" value={formData.royaltyOwnerName} onChange={handleInputChange}>
                                 <option value="">Select Royalty Owner</option>
                                 {royaltyOwnerProfiles.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                            <InputField label="Royalty Number" id="royaltyNumber" type="text" value={formData.royaltyNumber} onChange={handleInputChange} />
                            <InputField label="Royalty Tons" id="royaltyTons" type="number" step="0.01" value={formData.royaltyTons} onChange={handleInputChange} />
                            <InputField label="Royalty M3" id="royaltyM3" type="number" step="0.01" value={formData.royaltyM3} onChange={handleInputChange} />

                            <InputField label="Vehicle Number" id="vehicleNumber" type="select" value={formData.vehicleNumber} onChange={handleInputChange} required>
                                <option value="">Select Vehicle</option>
                                {vehicles.map(v => <option key={v.id} value={v.vehicleNumber}>{v.vehicleNumber}</option>)}
                            </InputField>
                            <InputField label="Transport & Owner Name" id="transporterName" type="select" value={formData.transporterName} onChange={handleInputChange} required>
                                <option value="">Select Transport Owner</option>
                                {transportOwnerProfiles.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                            <InputField label="Transport & Owner Mobile Number" id="transportOwnerMobileNumber" type="text" value={formData.transportOwnerMobileNumber} onChange={handleInputChange} />
                            
                            <InputField label="Empty Weight (Tons)" id="emptyWeight" type="number" step="0.01" value={formData.emptyWeight} onChange={handleInputChange} />
                            <InputField label="Gross Weight (Tons)" id="grossWeight" type="number" step="0.01" value={formData.grossWeight} onChange={handleInputChange} />
                            <InputField label="Net Weight (Tons)" id="netWeight" type="number" step="0.01" value={safeToFixed(formData.netWeight)} isReadOnly={true} />
                        </div>
                    </div>
                )}
                
                { /* UPLOAD MODE: Read-only summary + upload fields */ }
                {mode === 'upload' && (
                    <>
                        <div>
                             <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">Upload Documents for Trip #{trip?.id}</h3>
                             <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg grid grid-cols-3 gap-4 text-sm">
                                <div><strong>Vendor & Customer Name:</strong> {trip?.customer || '-'}</div>
                                <div><strong>Transport & Owner Name:</strong> {trip?.transporterName || '-'}</div>
                                <div><strong>Vehicle Number:</strong> {trip?.vehicleNumber || '-'}</div>
                                <div><strong>Mine & Quarry Name:</strong> {trip?.quarryName || '-'}</div>
                                <div><strong>Material Type:</strong> {trip?.material || '-'}</div>
                                <div><strong>Royalty Owner Name:</strong> {trip?.royaltyOwnerName || '-'}</div>
                                <div><strong>Royalty M3:</strong> {trip?.royaltyM3 ?? '-'}</div>
                                <div><strong>Net Weight (Tons):</strong> {trip?.netWeight ?? '-'}</div>
                                <div><strong>Pickup Place:</strong> {trip?.pickupPlace || '-'}</div>
                                <div><strong>Drop-off Place:</strong> {trip?.dropOffPlace || trip?.place || '-'}</div>
                             </div>
                        </div>
                        <div>
                            <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                                <FileInputField label="E-Way Bill" id="ewayBillUpload" onChange={handleFileChange} files={files.ewayBillUpload} multiple />
                                <FileInputField label="Invoice / DC" id="invoiceDCUpload" onChange={handleFileChange} files={files.invoiceDCUpload} multiple />
                                <FileInputField label="Wayment Slip" id="waymentSlipUpload" onChange={handleFileChange} files={files.waymentSlipUpload} multiple />
                                <FileInputField label="Royalty Slip" id="royaltyUpload" onChange={handleFileChange} files={files.royaltyUpload} multiple />
                                <FileInputField label="Tax Invoice" id="taxInvoiceUpload" onChange={handleFileChange} files={files.taxInvoiceUpload} multiple />
                            </div>
                            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {renderUploadList('E-Way Bill', files.ewayBillUpload)}
                                {renderUploadList('Invoice / DC', files.invoiceDCUpload)}
                                {renderUploadList('Wayment Slip', files.waymentSlipUpload)}
                                {renderUploadList('Royalty Slip', files.royaltyUpload)}
                                {renderUploadList('Tax Invoice', files.taxInvoiceUpload)}
                            </div>
                        </div>
                    </>
                )}

                { /* EDIT or VIEW MODE: All fields, no subsections */ }
                {(mode === 'edit' || mode === 'view') && (
                     <div>
                        <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">{mode === 'edit' ? 'Edit' : 'View'} Trip #{trip?.id}</h3>
                        <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
                             <InputField label="Date" id="date" type="date" value={formData.date} onChange={handleInputChange} isReadOnly={isReadOnly} required />
                             <InputField label="Pickup Place" id="pickupPlace" type="select" value={formData.pickupPlace || ''} onChange={handleInputChange} isReadOnly={isReadOnly} required>
                                <option value="">Select Pickup</option>
                                {pickupSites.map(site => <option key={site.id} value={site.name}>{site.name}</option>)}
                            </InputField>
                             <InputField label="Drop-off Place" id="dropOffPlace" type="select" value={formData.dropOffPlace || ''} onChange={handleInputChange} isReadOnly={isReadOnly} required>
                                <option value="">Select Drop-off</option>
                                {dropOffSites.map(site => <option key={site.id} value={site.name}>{site.name}</option>)}
                            </InputField>
                             <InputField label="Invoice & DC Number" id="invoiceDCNumber" type="text" value={formData.invoiceDCNumber} onChange={handleInputChange} isReadOnly={isReadOnly} />
                            <InputField label="Vendor & Customer Name" id="customer" type="select" value={formData.customer} onChange={handleInputChange} isReadOnly={isReadOnly} required>
                                <option value="">Select Vendor/Customer</option>
                                {vendorCustomers.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                            <InputField label="Mine & Quarry Name" id="quarryName" type="select" value={formData.quarryName} onChange={handleInputChange} isReadOnly={isReadOnly} required>
                                <option value="">Select Mine/Quarry</option>
                                {mineQuarries.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                            <InputField label="Material Type" id="material" type="select" value={formData.material} onChange={handleInputChange} isReadOnly={isReadOnly} required>
                                <option value="">Select Material</option>
                                {materialTypeDefinitions.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                            <InputField label="Royalty Owner Name" id="royaltyOwnerName" type="select" value={formData.royaltyOwnerName} onChange={handleInputChange} isReadOnly={isReadOnly}>
                                <option value="">Select Royalty Owner</option>
                                {royaltyOwnerProfiles.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                            <InputField label="Royalty Number" id="royaltyNumber" type="text" value={formData.royaltyNumber} onChange={handleInputChange} isReadOnly={isReadOnly} />
                            <InputField label="Royalty Tons" id="royaltyTons" type="number" step="0.01" value={formData.royaltyTons} onChange={handleInputChange} isReadOnly={isReadOnly} />
                            <InputField label="Royalty M3" id="royaltyM3" type="number" step="0.01" value={formData.royaltyM3} onChange={handleInputChange} isReadOnly={isReadOnly} />

                            <InputField label="Vehicle Number" id="vehicleNumber" type="select" value={formData.vehicleNumber} onChange={handleInputChange} isReadOnly={isReadOnly} required>
                                <option value="">Select Vehicle</option>
                                {vehicles.map(v => <option key={v.id} value={v.vehicleNumber}>{v.vehicleNumber}</option>)}
                            </InputField>
                            <InputField label="Transport & Owner Name" id="transporterName" type="select" value={formData.transporterName} onChange={handleInputChange} isReadOnly={isReadOnly}>
                                <option value="">Select Transport Owner</option>
                                {transportOwnerProfiles.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                            </InputField>
                            <InputField label="Transport & Owner Mobile Number" id="transportOwnerMobileNumber" type="text" value={formData.transportOwnerMobileNumber} onChange={handleInputChange} isReadOnly={isReadOnly} />

                            <InputField label="Empty Weight (Tons)" id="emptyWeight" type="number" step="0.01" value={formData.emptyWeight} onChange={handleInputChange} isReadOnly={isReadOnly} />
                            <InputField label="Gross Weight (Tons)" id="grossWeight" type="number" step="0.01" value={formData.grossWeight} onChange={handleInputChange} isReadOnly={isReadOnly} />
                            <InputField label="Net Weight (Tons)" id="netWeight" type="number" step="0.01" value={safeToFixed(formData.netWeight)} isReadOnly={true} />
                            
                            <InputField label="Vendor Name (Quarry Owner)" id="vendorName" type="text" value={formData.vendorName} isReadOnly={true} />


                            {/* Upload fields integrated */}
                            <FileInputField label="E-Way Bill" id="ewayBillUpload" onChange={handleFileChange} files={files.ewayBillUpload} isReadOnly={isReadOnly} multiple />
                            <FileInputField label="Invoice / DC" id="invoiceDCUpload" onChange={handleFileChange} files={files.invoiceDCUpload} isReadOnly={isReadOnly} multiple />
                            <FileInputField label="Wayment Slip" id="waymentSlipUpload" onChange={handleFileChange} files={files.waymentSlipUpload} isReadOnly={isReadOnly} multiple />
                            <FileInputField label="Royalty Slip" id="royaltyUpload" onChange={handleFileChange} files={files.royaltyUpload} isReadOnly={isReadOnly} multiple />
                            <FileInputField label="Tax Invoice" id="taxInvoiceUpload" onChange={handleFileChange} files={files.taxInvoiceUpload} isReadOnly={isReadOnly} multiple />
                            <FileInputField label="Wayment Slip (End Location)" id="endWaymentSlipUpload" onChange={handleFileChange} files={files.endWaymentSlipUpload} isReadOnly={isReadOnly} multiple />
                        </div>
                        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {renderUploadList('E-Way Bill', files.ewayBillUpload)}
                            {renderUploadList('Invoice / DC', files.invoiceDCUpload)}
                            {renderUploadList('Wayment Slip', files.waymentSlipUpload)}
                            {renderUploadList('Royalty Slip', files.royaltyUpload)}
                            {renderUploadList('Tax Invoice', files.taxInvoiceUpload)}
                            {renderUploadList('Wayment Slip (End Location)', files.endWaymentSlipUpload)}
                        </div>
                        <div className="mt-8">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Received Details</h4>
                            <div className="mt-4 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
                                <InputField label="Received Date" id="receivedDate" type="date" value={formData.receivedDate ? String(formData.receivedDate).split('T')[0] : ''} onChange={handleInputChange} isReadOnly={isReadOnly} />
                                <InputField label="End Empty Weight (T)" id="endEmptyWeight" type="number" step="0.01" value={formData.endEmptyWeight ?? ''} onChange={handleInputChange} isReadOnly={isReadOnly} />
                                <InputField label="End Gross Weight (T)" id="endGrossWeight" type="number" step="0.01" value={formData.endGrossWeight ?? ''} onChange={handleInputChange} isReadOnly={isReadOnly} />
                                <InputField label="End Net Weight (T)" id="endNetWeight" type="number" step="0.01" value={safeToFixed(formData.endNetWeight)} isReadOnly={true} />
                                <div className="lg:col-span-4">
                                    <InputField label="Reason for Difference" id="weightDifferenceReason" type="textarea" value={formData.weightDifferenceReason || ''} onChange={handleInputChange} isReadOnly={isReadOnly} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Validation Details</h4>
                            <div className="mt-4 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
                                <InputField label="Validated By" id="validatedBy" type="text" value={formData.validatedBy || ''} onChange={handleInputChange} isReadOnly={true} />
                                <InputField label="Validated At" id="validatedAt" type="date" value={formData.validatedAt ? String(formData.validatedAt).split('T')[0] : ''} onChange={handleInputChange} isReadOnly={true} />
                                <div className="lg:col-span-4">
                                    <InputField label="Validation Comments" id="validationComments" type="textarea" value={formData.validationComments || ''} onChange={handleInputChange} isReadOnly={isReadOnly} />
                                </div>
                            </div>
                        </div>
                        {mode === 'view' && currentUser && [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT].includes(currentUser.role) && (
                            <div className="mt-8">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Trip History</h4>
                                <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4">
                                    {activityError && (
                                        <div className="text-sm text-red-500">{activityError}</div>
                                    )}
                                    {!activityError && activityLog.length === 0 && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400">No activity logged yet.</div>
                                    )}
                                    {!activityError && activityLog.length > 0 && (
                                        <ul className="space-y-3 text-sm">
                                            {activityLog.map(entry => (
                                                <li key={entry.id} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-none last:pb-0">
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-semibold text-gray-800 dark:text-gray-100 capitalize">{entry.action.replace(/_/g, ' ')}</div>
                                                        <div className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</div>
                                                    </div>
                                                    <div className="mt-1 text-gray-600 dark:text-gray-300">{entry.message || '-'}</div>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {entry.actorName} ({entry.actorRole})
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="pt-8 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
                    {isReadOnly ? 'Close' : 'Cancel'}
                </button>
                {!isReadOnly && (
                    <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none disabled:opacity-50">
                        {isSubmitting ? 'Saving...' : (mode === 'upload' ? 'Save & Send to Transit' : 'Save')}
                    </button>
                )}
            </div>
            {previewFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{previewFile.name}</div>
                            <button
                                type="button"
                                onClick={() => setPreviewFile(null)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                Close
                            </button>
                        </div>
                        <div className="p-4">
                            {isImageFile(previewFile) ? (
                                <img src={previewFile.url} alt={previewFile.name} className="max-h-[70vh] w-full object-contain rounded-md" />
                            ) : (
                                <iframe
                                    title={previewFile.name}
                                    src={previewFile.url}
                                    className="w-full h-[70vh] rounded-md border border-gray-200 dark:border-gray-700"
                                />
                            )}
                        </div>
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setPreviewFile(null)}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};

export default SupervisorTripForm;
