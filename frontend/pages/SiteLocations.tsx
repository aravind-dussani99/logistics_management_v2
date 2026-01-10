import React, { useEffect, useMemo, useState } from 'react';
import { SiteLocation } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

const SiteLocationsPage: React.FC = () => {
  const { siteLocations, addSiteLocation, updateSiteLocation, deleteSiteLocation, loadSiteLocations, refreshKey } = useData();
  const { openModal, closeModal } = useUI();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSites = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return siteLocations;
    return siteLocations.filter(site => (
      [site.name, site.type, site.address, site.pointOfContact, site.remarks || '']
        .some(value => value.toLowerCase().includes(term))
    ));
  }, [siteLocations, searchTerm]);

  const totalPages = Math.ceil(filteredSites.length / ITEMS_PER_PAGE) || 1;
  const paginatedSites = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSites.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSites, currentPage]);

  const handleAddSite = () => {
    openModal('Add Site Location', <SiteLocationForm onSave={handleCreate} onClose={closeModal} />);
  };

  const handleCreate = async (data: Omit<SiteLocation, 'id'>) => {
    await addSiteLocation(data);
    setCurrentPage(1);
    closeModal();
  };

  const handleEditSite = (site: SiteLocation) => {
    openModal('Edit Site Location', <SiteLocationForm initialData={site} onSave={(data) => handleUpdate(site.id, data)} onClose={closeModal} />);
  };

  const handleUpdate = async (id: string, data: Omit<SiteLocation, 'id'>) => {
    await updateSiteLocation(id, data);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this site location?')) return;
    await deleteSiteLocation(id);
  };

  useEffect(() => {
    loadSiteLocations();
  }, [loadSiteLocations, refreshKey]);

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredSites.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredSites, currentPage]);

  return (
    <div className="relative">
      <PageHeader
        title="Site Locations"
        subtitle="Manage pickup and drop-off sites for trips and rate cards."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Add Site', action: handleAddSite }}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Site name, type, address"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Site Locations</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Site Name', 'Type', 'Address', 'Point of Contact', 'Remarks', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedSites.map(site => (
                  <tr key={site.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{site.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">{site.type.replace('-', ' ')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{site.address || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{site.pointOfContact || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{site.remarks || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEditSite(site)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDelete(site.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedSites.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No site locations yet. Add pickup and drop-off sites to power rate cards and trip entry.
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

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> & { label: string }> = ({ label, ...props }) => (
  <div className="col-span-1">
    <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    {props.type === 'select' ? (
      <select {...props as React.SelectHTMLAttributes<HTMLSelectElement>} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
    ) : props.type === 'textarea' ? (
      <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} rows={3} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
    ) : (
      <input {...props as React.InputHTMLAttributes<HTMLInputElement>} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
    )}
  </div>
);

const SiteLocationForm: React.FC<{
  initialData?: SiteLocation;
  onSave: (data: Omit<SiteLocation, 'id'>) => void;
  onClose: () => void;
}> = ({ initialData, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<SiteLocation, 'id'>>({
    name: initialData?.name || '',
    type: initialData?.type || 'pickup',
    address: initialData?.address || '',
    pointOfContact: initialData?.pointOfContact || '',
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
      <InputField label="Site Name" id="name" name="name" type="text" value={formData.name} onChange={handleChange} required />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <InputField label="Site Type" id="type" name="type" type="select" value={formData.type} onChange={handleChange}>
          <option value="pickup">Pickup</option>
          <option value="drop-off">Drop-off</option>
          <option value="both">Both</option>
        </InputField>
        <InputField label="Address" id="address" name="address" type="text" value={formData.address} onChange={handleChange} />
      </div>
      <InputField label="Point of Contact" id="pointOfContact" name="pointOfContact" type="text" value={formData.pointOfContact} onChange={handleChange} />
      <InputField label="Remarks" id="remarks" name="remarks" type="textarea" value={formData.remarks} onChange={handleChange} />
      <div className="pt-6 flex justify-end space-x-3">
        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          Cancel
        </button>
        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
          Save Site
        </button>
      </div>
    </form>
  );
};

export default SiteLocationsPage;
