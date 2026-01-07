import React, { useState } from 'react';
import { SiteLocation, User, Role } from '../types';

interface UserFormProps {
    user: User;
    siteLocations: SiteLocation[];
    onSave: (userData: Partial<User> & { password?: string }) => Promise<void>;
    onClose: () => void;
    isNew?: boolean;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement> & {label: string, children?: React.ReactNode, isReadOnly?: boolean}> = ({ label, isReadOnly, children, ...props }) => {
    const toId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'field';
    const inputId = props.id || props.name || toId(label);
    const inputName = props.name || inputId;
    return (
        <div>
            <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            {props.type === 'select' ? (
                 <select {...props as React.SelectHTMLAttributes<HTMLSelectElement>} id={inputId} name={inputName} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm">{children}</select>
            ) : (
                 <input {...props as React.InputHTMLAttributes<HTMLInputElement>} id={inputId} name={inputName} readOnly={isReadOnly} className={`mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm ${isReadOnly ? 'bg-gray-100 dark:bg-gray-700' : ''}`} />
            )}
        </div>
    );
};

const UserForm: React.FC<UserFormProps> = ({ user, siteLocations, onSave, onClose, isNew = false }) => {
    const [role, setRole] = useState<Role>(user.role);
    const [username, setUsername] = useState(user.username || '');
    const [name, setName] = useState(user.name || '');
    const [password, setPassword] = useState('');
    const [pickupLocationId, setPickupLocationId] = useState(user.pickupLocationId || '');
    const [dropOffLocationId, setDropOffLocationId] = useState(user.dropOffLocationId || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const updatedData: Partial<User> & { password?: string } = { role, name, username };
        if (password) {
            updatedData.password = password;
        }
        if (role === Role.PICKUP_SUPERVISOR) {
            updatedData.pickupLocationId = pickupLocationId || null;
            updatedData.dropOffLocationId = null;
        } else if (role === Role.DROPOFF_SUPERVISOR) {
            updatedData.dropOffLocationId = dropOffLocationId || null;
            updatedData.pickupLocationId = null;
        } else {
            updatedData.pickupLocationId = null;
            updatedData.dropOffLocationId = null;
        }
        await onSave(updatedData);
    };

    return (
         <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InputField label="Username" id="username" name="username" type="text" value={username} onChange={e => setUsername(e.target.value)} isReadOnly={!isNew} required />
                <InputField label="Name" id="name" name="name" type="text" value={name} onChange={e => setName(e.target.value)} required />
                
                <InputField label="Role" id="role" name="role" type="select" value={role} onChange={e => setRole(e.target.value as Role)} required>
                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                </InputField>

                {role === Role.PICKUP_SUPERVISOR && (
                    <InputField label="Pickup Location" id="pickupLocationId" name="pickupLocationId" type="select" value={pickupLocationId} onChange={e => setPickupLocationId(e.target.value)} required>
                        <option value="">Select pickup location</option>
                        {siteLocations.map(location => (
                            <option key={location.id} value={location.id}>{location.name}</option>
                        ))}
                    </InputField>
                )}

                {role === Role.DROPOFF_SUPERVISOR && (
                    <InputField label="Drop-off Location" id="dropOffLocationId" name="dropOffLocationId" type="select" value={dropOffLocationId} onChange={e => setDropOffLocationId(e.target.value)} required>
                        <option value="">Select drop-off location</option>
                        {siteLocations.map(location => (
                            <option key={location.id} value={location.id}>{location.name}</option>
                        ))}
                    </InputField>
                )}

                <div className="sm:col-span-2">
                    <InputField 
                        label={isNew ? "Password" : "New Password (optional)"} 
                        id="password" 
                        name="password" 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        placeholder={isNew ? "Set initial password" : "Leave blank to keep current password"}
                        required={isNew}
                    />
                </div>
            </div>
            <div className="pt-8 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
                    Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
                    {isSubmitting ? 'Saving...' : 'Save User'}
                </button>
            </div>
        </form>
    );
};

export default UserForm;
