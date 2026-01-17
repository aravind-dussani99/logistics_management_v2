import React, { useEffect, useMemo, useState } from 'react';
import { TransportOwnerVehicle } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

const TransportOwnerVehiclesPage: React.FC = () => {
  const { transportOwnerVehicles, transportOwnerProfiles, vehicleMasters, addTransportOwnerVehicle, updateTransportOwnerVehicle, deleteTransportOwnerVehicle, loadTransportOwnerVehicles, loadTransportOwnerProfiles, loadVehicleMasters, refreshKey } = useData();
  const { openModal, closeModal } = useUI();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return transportOwnerVehicles;
    return transportOwnerVehicles.filter(row => {
      const ownerName = row.transportOwnerName || transportOwnerProfiles.find(owner => owner.id === row.transportOwnerId)?.name || '';
      return [ownerName, row.vehicleNumber, row.remarks || '']
        .some(value => value.toLowerCase().includes(term));
    });
  }, [searchTerm, transportOwnerVehicles, transportOwnerProfiles]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE) || 1;
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const handleAdd = () => {
    openModal('Assign Vehicle to Transport Owner', <ProfileForm onSave={handleCreate} onClose={closeModal} />);
  };

  const handleCreate = async (data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>) => {
    await addTransportOwnerVehicle(data);
    setCurrentPage(1);
    closeModal();
  };

  const handleEdit = (row: TransportOwnerVehicle) => {
    openModal('Edit Vehicle Assignment', <ProfileForm initialData={row} onSave={(data) => handleUpdate(row.id, data)} onClose={closeModal} />);
  };

  const handleUpdate = async (id: string, data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>) => {
    await updateTransportOwnerVehicle(id, data);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this assignment?')) return;
    await deleteTransportOwnerVehicle(id);
  };

  useEffect(() => {
    loadTransportOwnerVehicles();
    loadTransportOwnerProfiles();
    loadVehicleMasters();
  }, [loadTransportOwnerVehicles, loadTransportOwnerProfiles, loadVehicleMasters, refreshKey]);

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredRows, currentPage]);

  return (
    <div className="relative">
      <PageHeader
        title="Transport Owner Vehicles"
        subtitle="Map vehicles to transport owners with effective dates."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Assign Vehicle', action: handleAdd }}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Transport owner or vehicle number"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Assignments</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['S. No.', 'Transport Owner', 'Vehicle Number', 'Effective From', 'Effective To', 'Remarks', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedRows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.transportOwnerName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.vehicleNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.effectiveFrom}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.effectiveTo || 'Present'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.remarks || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(row)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDelete(row.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No vehicle assignments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );

  function ProfileForm({ initialData, onSave, onClose }: {
    initialData?: TransportOwnerVehicle;
    onSave: (data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>) => void;
    onClose: () => void;
  }) {
    const [formData, setFormData] = useState<Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>>({
      transportOwnerId: initialData?.transportOwnerId || '',
      vehicleNumber: initialData?.vehicleNumber || '',
      effectiveFrom: initialData?.effectiveFrom || new Date().toISOString().split('T')[0],
      effectiveTo: initialData?.effectiveTo || '',
      remarks: initialData?.remarks || '',
    });

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      onSave(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <SelectField label="Transport Owner" id="transportOwnerId" name="transportOwnerId" value={formData.transportOwnerId} onChange={handleChange} required>
            <option value="">Select Transport Owner</option>
            {transportOwnerProfiles.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
          </SelectField>
          <SelectField label="Vehicle" id="vehicleNumber" name="vehicleNumber" value={formData.vehicleNumber || ''} onChange={handleChange} required>
            <option value="">Select Vehicle</option>
            {vehicleMasters.map(vehicle => <option key={vehicle.id} value={vehicle.vehicleNumber}>{vehicle.vehicleNumber}</option>)}
          </SelectField>
          <InputField label="Effective From" id="effectiveFrom" name="effectiveFrom" type="date" value={formData.effectiveFrom} onChange={handleChange} required />
          <InputField label="Effective To" id="effectiveTo" name="effectiveTo" type="date" value={formData.effectiveTo || ''} onChange={handleChange} />
        </div>
        <TextAreaField label="Remarks" id="remarks" name="remarks" value={formData.remarks} onChange={handleChange} />
        <div className="pt-6 flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
            Cancel
          </button>
          <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
            Save Assignment
          </button>
        </div>
      </form>
    );
  }
};

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <div className="col-span-1">
    <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <input {...props} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
  </div>
);

const SelectField: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string, children: React.ReactNode }> = ({ label, children, ...props }) => (
  <div className="col-span-1">
    <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <select {...props} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm">
      {children}
    </select>
  </div>
);

const TextAreaField: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }> = ({ label, ...props }) => (
  <div className="col-span-1">
    <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <textarea {...props} rows={3} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
  </div>
);

export default TransportOwnerVehiclesPage;
