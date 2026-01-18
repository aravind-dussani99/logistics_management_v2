import React, { useEffect, useMemo, useState } from 'react';
import { Merchant } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

const MerchantsPage: React.FC = () => {
  const { merchants, merchantTypes, siteLocations, addMerchant, updateMerchant, deleteMerchant, loadMerchants, loadMerchantTypes, loadSiteLocations, refreshKey } = useData();

  useEffect(() => {
    loadMerchants();
    loadMerchantTypes();
    loadSiteLocations();
  }, [loadMerchants, loadMerchantTypes, loadSiteLocations, refreshKey]);
  const { openModal, closeModal } = useUI();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMerchants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return merchants;
    return merchants.filter(merchant => {
      const merchantTypeName = merchant.merchantTypeName || merchantTypes.find(item => item.id === merchant.merchantTypeId)?.name || '';
      const siteLocationName = merchant.siteLocationName || siteLocations.find(item => item.id === merchant.siteLocationId)?.name || '';
      return [
        merchantTypeName,
        merchant.name,
        merchant.contactNumber,
        merchant.email,
        siteLocationName,
        merchant.companyName,
        merchant.gstNumber,
        merchant.gstDetails,
        merchant.remarks || '',
      ].some(value => value.toLowerCase().includes(term));
    });
  }, [merchants, merchantTypes, siteLocations, searchTerm]);

  const totalPages = Math.ceil(filteredMerchants.length / ITEMS_PER_PAGE) || 1;
  const paginatedMerchants = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMerchants.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMerchants, currentPage]);

  const handleAdd = () => {
    openModal('Add Merchant', <MerchantForm onSave={handleCreate} onClose={closeModal} />);
  };

  const handleCreate = async (data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    await addMerchant(data);
    setCurrentPage(1);
    closeModal();
  };

  const handleEdit = (merchant: Merchant) => {
    openModal('Edit Merchant', <MerchantForm initialData={merchant} onSave={(data) => handleUpdate(merchant.id, data)} onClose={closeModal} />);
  };

  const handleUpdate = async (id: string, data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    await updateMerchant(id, data);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this merchant?')) return;
    await deleteMerchant(id);
  };

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredMerchants.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredMerchants, currentPage]);

  return (
    <div className="relative">
      <PageHeader
        title="Merchant Data"
        subtitle="Maintain merchant details with site and GST information."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Add Merchant', action: handleAdd }}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Merchant, type, site, GST"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Merchant List</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['S. No.', 'Merchant Type', 'Name', 'Contact', 'Email', 'Site Location', 'Company', 'GST Opt-in', 'GST Number', 'GST Details', 'Remarks', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedMerchants.map((merchant, index) => (
                  <tr key={merchant.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{merchant.merchantTypeName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{merchant.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{merchant.contactNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{merchant.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{merchant.siteLocationName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{merchant.companyName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{merchant.gstOptIn ? 'Yes' : 'No'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{merchant.gstNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{merchant.gstDetails || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{merchant.remarks || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(merchant)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDelete(merchant.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedMerchants.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No merchants yet. Add a merchant once you have merchant types and site locations.
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

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> & { label: string, children?: React.ReactNode }> = ({ label, ...props }) => (
  <div className="col-span-1">
    <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    {props.type === 'select' ? (
      <select {...props as React.SelectHTMLAttributes<HTMLSelectElement>} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm">{props.children}</select>
    ) : props.type === 'textarea' ? (
      <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} rows={3} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
    ) : (
      <input {...props as React.InputHTMLAttributes<HTMLInputElement>} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
    )}
  </div>
);

const MerchantForm: React.FC<{
  initialData?: Merchant;
  onSave: (data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>) => void;
  onClose: () => void;
}> = ({ initialData, onSave, onClose }) => {
  const { merchantTypes, siteLocations } = useData();
  const [formData, setFormData] = useState<Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>>({
    merchantTypeId: initialData?.merchantTypeId || '',
    name: initialData?.name || '',
    contactNumber: initialData?.contactNumber || '',
    email: initialData?.email || '',
    siteLocationId: initialData?.siteLocationId || '',
    companyName: initialData?.companyName || '',
    gstOptIn: initialData?.gstOptIn || false,
    gstNumber: initialData?.gstNumber || '',
    gstDetails: initialData?.gstDetails || '',
    remarks: initialData?.remarks || '',
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    const checked = (event.target as HTMLInputElement).checked;
    const nextValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: nextValue }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <InputField label="Merchant Type" id="merchantTypeId" name="merchantTypeId" type="select" value={formData.merchantTypeId} onChange={handleChange} required>
          <option value="">Select Merchant Type</option>
          {merchantTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
        </InputField>
        <InputField label="Merchant Name" id="name" name="name" type="text" value={formData.name} onChange={handleChange} required />
        <InputField label="Contact Number" id="contactNumber" name="contactNumber" type="text" value={formData.contactNumber} onChange={handleChange} required />
        <InputField label="Email" id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
        <InputField label="Site Location" id="siteLocationId" name="siteLocationId" type="select" value={formData.siteLocationId} onChange={handleChange} required>
          <option value="">Select Site Location</option>
          {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
        </InputField>
        <InputField label="Merchant Company Name" id="companyName" name="companyName" type="text" value={formData.companyName} onChange={handleChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="col-span-1 flex items-center space-x-3 mt-2">
          <input id="gstOptIn" name="gstOptIn" type="checkbox" checked={formData.gstOptIn} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
          <label htmlFor="gstOptIn" className="text-sm font-medium text-gray-700 dark:text-gray-300">GST Opt-in</label>
        </div>
        <InputField label="GST Number" id="gstNumber" name="gstNumber" type="text" value={formData.gstNumber} onChange={handleChange} />
        <InputField label="GST Details" id="gstDetails" name="gstDetails" type="text" value={formData.gstDetails} onChange={handleChange} />
      </div>

      <InputField label="Remarks" id="remarks" name="remarks" type="textarea" value={formData.remarks} onChange={handleChange} />

      <div className="pt-6 flex justify-end space-x-3">
        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          Cancel
        </button>
        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
          Save Merchant
        </button>
      </div>
    </form>
  );
};

export default MerchantsPage;
