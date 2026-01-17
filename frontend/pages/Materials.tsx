import React, { useMemo, useState, useEffect } from 'react';
import { Material } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { formatCurrency } from '../utils';

const ITEMS_PER_PAGE = 10;

const MaterialsPage: React.FC = () => {
  const { materials, addMaterial, updateMaterial, deleteMaterial, loadMaterials, refreshKey } = useData();
  const { openModal, closeModal } = useUI();
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials, refreshKey]);

  const totalPages = Math.ceil(materials.length / ITEMS_PER_PAGE) || 1;
  const paginatedMaterials = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return materials.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [materials, currentPage]);

  const handleAddMaterial = () => {
    openModal('Add Material', <MaterialForm onSave={handleCreate} onClose={closeModal} />);
  };

  const handleCreate = async (data: Omit<Material, 'id'>) => {
    await addMaterial(data);
    closeModal();
  };

  const handleEdit = (material: Material) => {
    openModal('Edit Material', <MaterialForm initialData={material} onSave={(data) => handleUpdate(material.id, data)} onClose={closeModal} />);
  };

  const handleUpdate = async (id: number, data: Omit<Material, 'id'>) => {
    await updateMaterial(id, data);
    closeModal();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this material? This cannot be undone.')) return;
    await deleteMaterial(id);
  };

  return (
    <div className="relative">
      <PageHeader
        title="Materials"
        subtitle="Manage material types and their base costs."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Add Material', action: handleAddMaterial }}
      />

      <main className="pt-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Material List</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Material', 'Cost / Ton', 'Cost / m³', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedMaterials.map(material => (
                  <tr key={material.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{material.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(material.costPerTon)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(material.costPerCubicMeter)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(material)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDelete(material.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedMaterials.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No materials yet. Add your first material to start using rate selectors.
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
  <div>
    <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    <input {...props} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
  </div>
);

const MaterialForm: React.FC<{
  initialData?: Material;
  onSave: (data: Omit<Material, 'id'>) => void;
  onClose: () => void;
}> = ({ initialData, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<Material, 'id'>>({
    name: initialData?.name || '',
    costPerTon: initialData?.costPerTon || '',
    costPerCubicMeter: initialData?.costPerCubicMeter || '',
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <InputField label="Material Name" id="name" name="name" type="text" value={formData.name} onChange={handleChange} required />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <InputField label="Cost per Ton (₹)" id="costPerTon" name="costPerTon" type="number" value={formData.costPerTon} onChange={handleChange} required />
        <InputField label="Cost per Cubic Meter (₹)" id="costPerCubicMeter" name="costPerCubicMeter" type="number" value={formData.costPerCubicMeter} onChange={handleChange} required />
      </div>
      <div className="pt-6 flex justify-end space-x-3">
        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          Cancel
        </button>
        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
          Save Material
        </button>
      </div>
    </form>
  );
};

export default MaterialsPage;
