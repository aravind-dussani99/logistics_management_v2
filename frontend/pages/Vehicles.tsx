import React, { useEffect, useMemo, useState } from 'react';
import { VehicleMaster } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

const VehiclesPage: React.FC = () => {
  const { vehicleMasters, addVehicleMaster, updateVehicleMaster, deleteVehicleMaster } = useData();
  const { openModal, closeModal } = useUI();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVehicles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return vehicleMasters;
    return vehicleMasters.filter(vehicle => (
      [vehicle.vehicleNumber, vehicle.vehicleType, vehicle.ownerName, vehicle.contactNumber, vehicle.remarks || '']
        .some(value => value.toLowerCase().includes(term))
    ));
  }, [vehicleMasters, searchTerm]);

  const totalPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE) || 1;
  const paginatedVehicles = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVehicles.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredVehicles, currentPage]);

  const handleAddVehicle = () => {
    openModal('Add Vehicle', <VehicleMasterForm onSave={handleCreate} onClose={closeModal} />);
  };

  const handleCreate = async (data: Omit<VehicleMaster, 'id'>) => {
    await addVehicleMaster(data);
    setCurrentPage(1);
    closeModal();
  };

  const handleEditVehicle = (vehicle: VehicleMaster) => {
    openModal('Edit Vehicle Info', <VehicleMasterForm initialData={vehicle} onSave={(data) => handleUpdateVehicle(vehicle.id, data)} onClose={closeModal} />);
  };

  const handleUpdateVehicle = async (id: string, data: Omit<VehicleMaster, 'id'>) => {
    await updateVehicleMaster(id, data);
    closeModal();
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!window.confirm('Delete this vehicle?')) return;
    await deleteVehicleMaster(id);
  };

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredVehicles, currentPage]);

  return (
    <div className="relative">
      <PageHeader
        title="Vehicles"
        subtitle="Maintain the master vehicle registry for assignments and rates."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Add Vehicle', action: handleAddVehicle }}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Vehicle number, owner, type"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Vehicle List</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['S. No.', 'Vehicle Number', 'Type', 'Capacity (T)', 'Owner', 'Contact Number', 'Remarks', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedVehicles.map((vehicle, index) => (
                  <tr key={vehicle.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{vehicle.vehicleNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{vehicle.vehicleType || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{vehicle.capacity || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{vehicle.ownerName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{vehicle.contactNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{vehicle.remarks || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEditVehicle(vehicle)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDeleteVehicle(vehicle.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedVehicles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No vehicles yet. Add a vehicle to start assigning transport owners.
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
};

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
  <div className="col-span-1">
    <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <input {...props} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
  </div>
);

const TextAreaField: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }> = ({ label, ...props }) => (
  <div className="col-span-1">
    <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <textarea {...props} rows={3} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
  </div>
);

const VehicleMasterForm: React.FC<{
  initialData?: VehicleMaster;
  onSave: (data: Omit<VehicleMaster, 'id'>) => void;
  onClose: () => void;
}> = ({ initialData, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<VehicleMaster, 'id'>>({
    vehicleNumber: initialData?.vehicleNumber || '',
    vehicleType: initialData?.vehicleType || '',
    capacity: initialData?.capacity || 0,
    ownerName: initialData?.ownerName || '',
    contactNumber: initialData?.contactNumber || '',
    remarks: initialData?.remarks || '',
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <InputField label="Vehicle Number" id="vehicleNumber" name="vehicleNumber" type="text" value={formData.vehicleNumber} onChange={handleChange} required />
        <InputField label="Vehicle Type" id="vehicleType" name="vehicleType" type="text" value={formData.vehicleType} onChange={handleChange} required />
        <InputField label="Capacity (T)" id="capacity" name="capacity" type="number" value={formData.capacity} onChange={handleChange} />
        <InputField label="Owner Name" id="ownerName" name="ownerName" type="text" value={formData.ownerName} onChange={handleChange} required />
        <InputField label="Contact Number" id="contactNumber" name="contactNumber" type="text" value={formData.contactNumber} onChange={handleChange} required />
      </div>
      <TextAreaField label="Remarks" id="remarks" name="remarks" value={formData.remarks} onChange={handleChange} />
      <div className="pt-6 flex justify-end space-x-3">
        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          Cancel
        </button>
        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
          Save Vehicle
        </button>
      </div>
    </form>
  );
};

export default VehiclesPage;
