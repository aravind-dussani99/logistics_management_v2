import React, { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import { Role, SiteLocation, User } from '../types';
import { usersApi } from '../services/usersApi';
import { useUI } from '../contexts/UIContext';
import { useData } from '../contexts/DataContext';
import UserForm from '../components/UserForm';

const Users: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const { openModal, closeModal } = useUI();
    const { refreshData, refreshKey, siteLocations, loadSiteLocations } = useData();

    useEffect(() => {
        usersApi.listUsers().then(setUsers).catch((error) => console.error('Failed to load users', error));
    }, [refreshKey]);

    useEffect(() => {
        loadSiteLocations();
    }, [loadSiteLocations, refreshKey]);

    const handleEditUser = (user: User) => {
        openModal(`Edit User: ${user.name}`, <UserForm user={user} siteLocations={siteLocations as SiteLocation[]} onSave={(data) => handleSave(user.id, data)} onClose={closeModal} />);
    };

    const handleCreateUser = () => {
        const emptyUser: User = {
            id: '',
            name: '',
            username: '',
            role: Role.GUEST,
            avatarUrl: '',
        };
        openModal('Create User', <UserForm user={emptyUser} siteLocations={siteLocations as SiteLocation[]} onSave={(data) => handleCreate(data)} onClose={closeModal} isNew />);
    };

    const handleSave = async (userId: string, userData: Partial<User>) => {
        await usersApi.updateUser(userId, userData);
        refreshData();
        closeModal();
    };

    const handleCreate = async (userData: Partial<User>) => {
        await usersApi.createUser(userData);
        refreshData();
        closeModal();
    };

    const headers = ['Name', 'Role', 'Actions'];
    
    const getRoleBadge = (role: string) => {
        const roleColors: { [key: string]: string } = {
            ADMIN: 'bg-red-100 text-red-800',
            MANAGER: 'bg-blue-100 text-blue-800',
            ACCOUNTANT: 'bg-green-100 text-green-800',
            PICKUP_SUPERVISOR: 'bg-yellow-100 text-yellow-800',
            DROPOFF_SUPERVISOR: 'bg-yellow-100 text-yellow-800',
            GUEST: 'bg-gray-200 text-gray-700',
        };
        return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColors[role] || 'bg-gray-100 text-gray-800'}`}>{role}</span>;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-semibold text-gray-800 dark:text-white">User Management</h1>
                <button onClick={handleCreateUser} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark">
                    Add User
                </button>
            </div>
            
            <DataTable
                title="System Users"
                headers={headers}
                data={users}
                renderRow={(user: User) => (
                    <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                    <img className="h-10 w-10 rounded-full" src={user.avatarUrl || 'https://i.pravatar.cc/150?u=default'} alt="" />
                                </div>
                                <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{getRoleBadge(user.role)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => handleEditUser(user)} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark">
                                Edit
                            </button>
                        </td>
                    </tr>
                )}
            />
        </div>
    );
};

export default Users;
