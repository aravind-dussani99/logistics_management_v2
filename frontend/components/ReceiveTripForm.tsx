import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Trip, TripUploadFile, Role } from '../types';
import { formatDateDisplay, safeToFixed } from '../utils';
import { notificationApi } from '../services/notificationApi';

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> & { label: string, isReadOnly?: boolean }> = ({ label, isReadOnly, ...props }) => {
    const toId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'field';
    const inputId = props.id || props.name || toId(label);
    const inputName = props.name || inputId;
    const inputValue = props.type === 'number' && (props.value === 0 || props.value === '0') ? '' : props.value;
    return (
        <div className="col-span-1">
            <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            {isReadOnly ? (
                <div id={inputId} role="textbox" aria-readonly="true" className="mt-1 block w-full px-3 py-2 text-gray-500 dark:text-gray-400 min-h-[42px] flex items-center bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600">{props.value || '-'}</div>
            ) : props.type === 'textarea' ? (
                 <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} id={inputId} name={inputName} rows={2} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
            ) : (
                <input {...props} id={inputId} name={inputName} value={inputValue} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
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


interface ReceiveTripFormProps {
    trip: Trip;
    onClose: () => void;
}

const ReceiveTripForm: React.FC<ReceiveTripFormProps> = ({ trip, onClose }) => {
    const { updateTrip } = useData();
    const { currentUser } = useAuth();
    const [formData, setFormData] = useState({
        receivedDate: new Date().toISOString().split('T')[0],
        endEmptyWeight: '',
        endGrossWeight: '',
        endNetWeight: 0,
        weightDifferenceReason: '',
    });
    const [endSlipFiles, setEndSlipFiles] = useState<TripUploadFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const gross = Number(formData.endGrossWeight || 0);
        const empty = Number(formData.endEmptyWeight || 0);
        const net = Math.max(0, gross - empty);
        setFormData(p => ({ ...p, endNetWeight: net }));
    }, [formData.endGrossWeight, formData.endEmptyWeight]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value, type } = e.target;
        setFormData(p => ({ ...p, [id]: type === 'number' ? value : value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const fileList = Array.from(e.target.files);
        const entries = await Promise.all(fileList.map(file => new Promise<TripUploadFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, url: String(reader.result || '') });
            reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
            reader.readAsDataURL(file);
        })));
        setEndSlipFiles(entries);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const endWaymentSlipUpload = endSlipFiles.length > 0 ? JSON.stringify(endSlipFiles) : '';
            await updateTrip(trip.id, {
                ...formData,
                endEmptyWeight: Number(formData.endEmptyWeight || 0),
                endGrossWeight: Number(formData.endGrossWeight || 0),
                endNetWeight: Number(formData.endNetWeight || 0),
                endWaymentSlipUpload,
                receivedBy: currentUser?.name || currentUser?.username || '',
                receivedByRole: currentUser?.role || '',
                status: 'pending validation',
            });
            const rolesToNotify = [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT];
            await Promise.all(rolesToNotify.map(targetRole => notificationApi.create({
                message: `Trip #${trip.id} received and pending validation.`,
                type: 'info',
                targetRole,
                targetUser: null,
                tripId: trip.id,
                requestType: 'pending-validation',
                requesterName: currentUser?.name || currentUser?.username || 'Supervisor',
                requesterRole: currentUser?.role || Role.DROPOFF_SUPERVISOR,
                requestMessage: '',
                requesterContact: currentUser?.mobileNumber || '',
            })));
            onClose();
        } catch (error) {
            console.error("Failed to receive trip", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const weightDifference = trip.netWeight - formData.endNetWeight;

    return (
        <form onSubmit={handleSubmit} className="p-8">
            <div className="space-y-8">
                <div>
                    <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">Trip Details (In Transit)</h3>
                    <div className="mt-4 grid grid-cols-1 gap-y-4 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
                        <InputField label="Started Date" value={formatDateDisplay(trip.date)} isReadOnly />
                        <InputField label="Vehicle Number" value={trip.vehicleNumber} isReadOnly />
                        <InputField label="Invoice/DC Number" value={trip.invoiceDCNumber} isReadOnly />
                        <InputField label="Start Net Weight (T)" value={`${safeToFixed(trip.netWeight)} T`} isReadOnly />
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-white">Receiving Details</h3>
                    <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
                        <InputField label="Received Date" id="receivedDate" type="date" value={formData.receivedDate} onChange={handleInputChange} required />
                        <InputField label="End Empty Weight (T)" id="endEmptyWeight" type="number" step="0.01" value={formData.endEmptyWeight} onChange={handleInputChange} />
                        <InputField label="End Gross Weight (T)" id="endGrossWeight" type="number" step="0.01" value={formData.endGrossWeight} onChange={handleInputChange} />
                        <InputField label="End Net Weight (T)" id="endNetWeight" type="number" step="0.01" value={safeToFixed(formData.endNetWeight)} isReadOnly />
                         <div className="lg:col-span-4">
                             <FileInputField label="Wayment Slip (End Location)" id="endWaymentSlipUpload" onChange={handleFileChange} fileName={endSlipFiles.length ? `${endSlipFiles.length} file(s)` : ''} multiple />
                         </div>
                         <div className="lg:col-span-2">
                             <InputField label="Weight Difference (T)" value={`${safeToFixed(weightDifference)} T`} isReadOnly />
                         </div>
                          <div className="lg:col-span-2">
                            <InputField label="Reason for Difference" id="weightDifferenceReason" type="textarea" value={formData.weightDifferenceReason} onChange={handleInputChange} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="pt-8 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
                    Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : 'Submit'}
                </button>
            </div>
        </form>
    );
};
export default ReceiveTripForm;
