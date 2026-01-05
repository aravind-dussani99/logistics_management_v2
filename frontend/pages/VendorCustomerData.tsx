import React, { useEffect, useMemo, useState } from 'react';
import { VendorCustomerData } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

const VendorCustomerDataPage: React.FC = () => {
  const { vendorCustomers, merchantTypes, siteLocations, addVendorCustomer, updateVendorCustomer, deleteVendorCustomer } = useData();
  const { openModal, closeModal } = useUI();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return vendorCustomers;
    return vendorCustomers.filter(row => {
      const merchantTypeName = row.merchantTypeName || merchantTypes.find(item => item.id === row.merchantTypeId)?.name || '';
      const siteLocationName = row.siteLocationName || siteLocations.find(item => item.id === row.siteLocationId)?.name || '';
      return [
        merchantTypeName,
        row.name,
        row.contactNumber,
        row.email,
        siteLocationName,
        row.companyName,
        row.gstNumber,
        row.gstDetails,
        row.remarks || '',
      ].some(value => value.toLowerCase().includes(term));
    });
  }, [vendorCustomers, merchantTypes, siteLocations, searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE) || 1;
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const handleAdd = () => {
    openModal('Add Vendor & Customer', <ProfileForm onSave={handleCreate} onClose={closeModal} />);
  };

  const handleCreate = async (data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    await addVendorCustomer(data);
    setCurrentPage(1);
    closeModal();
  };

  const handleEdit = (row: VendorCustomerData) => {
    openModal('Edit Vendor & Customer', <ProfileForm initialData={row} onSave={(data) => handleUpdate(row.id, data)} onClose={closeModal} />);
  };

  const handleUpdate = async (id: string, data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    await updateVendorCustomer(id, data);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this record?')) return;
    await deleteVendorCustomer(id);
  };

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredRows, currentPage]);

  return (
    <div className="relative">
      <PageHeader
        title="Vendor & Customer Data"
        subtitle="Manage vendor and customer profiles with GST details."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Add Vendor & Customer', action: handleAdd }}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Vendor/customer, type, site"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Vendor & Customer List</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['S. No.', 'Merchant Type', 'Vendor & Customer Name', 'Contact', 'Email', 'Site Location', 'Company', 'GST Opt-in', 'GST Number', 'GST Details', 'Remarks', 'Actions'].map(header => (
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.merchantTypeName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{row.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.contactNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.siteLocationName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.companyName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.gstOptIn ? 'Yes' : 'No'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.gstNumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.gstDetails || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{row.remarks || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(row)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDelete(row.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedRows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No vendor & customer records yet.
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
    initialData?: VendorCustomerData;
    onSave: (data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => void;
    onClose: () => void;
  }) {
    const [formData, setFormData] = useState<Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>>({
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
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      onSave(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <SelectField label="Merchant Type" id="merchantTypeId" name="merchantTypeId" value={formData.merchantTypeId} onChange={handleChange} required>
            <option value="">Select Merchant Type</option>
            {merchantTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
          </SelectField>
          <InputField label="Vendor & Customer Name" id="name" name="name" value={formData.name} onChange={handleChange} required />
          <InputField label="Contact Number" id="contactNumber" name="contactNumber" value={formData.contactNumber} onChange={handleChange} required />
          <InputField label="Email" id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
          <SelectField label="Site Location" id="siteLocationId" name="siteLocationId" value={formData.siteLocationId} onChange={handleChange} required>
            <option value="">Select Site Location</option>
            {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </SelectField>
          <InputField label="Merchant Company Name" id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="col-span-1 flex items-center space-x-3 mt-2">
            <input id="gstOptIn" name="gstOptIn" type="checkbox" checked={formData.gstOptIn} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            <label htmlFor="gstOptIn" className="text-sm font-medium text-gray-700 dark:text-gray-300">GST Opt-in</label>
          </div>
          <InputField label="GST Number" id="gstNumber" name="gstNumber" value={formData.gstNumber} onChange={handleChange} />
          <InputField label="GST Details" id="gstDetails" name="gstDetails" value={formData.gstDetails} onChange={handleChange} />
        </div>

        <TextAreaField label="Remarks" id="remarks" name="remarks" value={formData.remarks} onChange={handleChange} />

        <div className="pt-6 flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
            Cancel
          </button>
          <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
            Save Vendor & Customer
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

export default VendorCustomerDataPage;
