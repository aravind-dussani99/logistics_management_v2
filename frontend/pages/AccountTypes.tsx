import React, { useEffect, useMemo, useState } from 'react';
import { AccountType } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;

const AccountTypesPage: React.FC = () => {
  const { accountTypes, addAccountType, updateAccountType, deleteAccountType, loadAccountTypes, refreshKey } = useData();
  const { openModal, closeModal } = useUI();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTypes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return accountTypes;
    return accountTypes.filter(item => (
      [item.name, item.remarks || ''].some(value => value.toLowerCase().includes(term))
    ));
  }, [accountTypes, searchTerm]);

  const totalPages = Math.ceil(filteredTypes.length / ITEMS_PER_PAGE) || 1;
  const paginatedTypes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTypes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTypes, currentPage]);

  const handleAdd = () => {
    openModal('Add Account Type', <AccountTypeForm onSave={handleCreate} onClose={closeModal} />);
  };

  const handleCreate = async (data: Omit<AccountType, 'id'>) => {
    await addAccountType(data);
    setCurrentPage(1);
    closeModal();
  };

  const handleEdit = (accountType: AccountType) => {
    openModal('Edit Account Type', <AccountTypeForm initialData={accountType} onSave={(data) => handleUpdate(accountType.id, data)} onClose={closeModal} />);
  };

  const handleUpdate = async (id: string, data: Omit<AccountType, 'id'>) => {
    await updateAccountType(id, data);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this account type?')) return;
    await deleteAccountType(id);
  };

  useEffect(() => {
    loadAccountTypes();
  }, [loadAccountTypes, refreshKey]);

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredTypes.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredTypes, currentPage]);

  return (
    <div className="relative">
      <PageHeader
        title="Account Types"
        subtitle="Define available bank account types for merchants."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Add Account Type', action: handleAdd }}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Account type"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Account Types List</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['S. No.', 'Account Type', 'Remarks', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedTypes.map((accountType, index) => (
                  <tr key={accountType.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{accountType.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{accountType.remarks || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(accountType)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDelete(accountType.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedTypes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No account types yet. Add one to standardize bank account options.
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

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> & { label: string }> = ({ label, ...props }) => (
  <div>
    <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    {props.type === 'textarea' ? (
      <textarea {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>} rows={3} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
    ) : (
      <input {...props as React.InputHTMLAttributes<HTMLInputElement>} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
    )}
  </div>
);

const AccountTypeForm: React.FC<{
  initialData?: AccountType;
  onSave: (data: Omit<AccountType, 'id'>) => void;
  onClose: () => void;
}> = ({ initialData, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<AccountType, 'id'>>({
    name: initialData?.name || '',
    remarks: initialData?.remarks || '',
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <InputField label="Account Type" id="name" name="name" type="text" value={formData.name} onChange={handleChange} required />
      <InputField label="Remarks" id="remarks" name="remarks" type="textarea" value={formData.remarks} onChange={handleChange} />
      <div className="pt-6 flex justify-end space-x-3">
        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          Cancel
        </button>
        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
          Save Account Type
        </button>
      </div>
    </form>
  );
};

export default AccountTypesPage;
