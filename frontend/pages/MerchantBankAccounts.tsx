import React, { useEffect, useMemo, useState } from 'react';
import { MerchantBankAccount, RatePartyType } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';

const ITEMS_PER_PAGE = 10;
const RATE_PARTY_LABELS: { value: RatePartyType; label: string }[] = [
  { value: 'mine-quarry', label: 'Mine & Quarry' },
  { value: 'vendor-customer', label: 'Vendor & Customer' },
  { value: 'royalty-owner', label: 'Royalty Owner' },
  { value: 'transport-owner', label: 'Transport Owner' },
];

const MerchantBankAccountsPage: React.FC = () => {
  const {
    merchantBankAccounts,
    merchants,
    accountTypes,
    mineQuarries,
    vendorCustomers,
    royaltyOwnerProfiles,
    transportOwnerProfiles,
    addMerchantBankAccount,
    updateMerchantBankAccount,
    deleteMerchantBankAccount,
    loadMerchantBankAccounts,
    loadMerchants,
    loadAccountTypes,
    loadMineQuarries,
    loadVendorCustomers,
    loadRoyaltyOwnerProfiles,
    loadTransportOwnerProfiles,
    refreshKey,
  } = useData();
  const { openModal, closeModal } = useUI();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMerchantBankAccounts();
    loadMerchants();
    loadAccountTypes();
    loadMineQuarries();
    loadVendorCustomers();
    loadRoyaltyOwnerProfiles();
    loadTransportOwnerProfiles();
  }, [
    loadMerchantBankAccounts,
    loadMerchants,
    loadAccountTypes,
    loadMineQuarries,
    loadVendorCustomers,
    loadRoyaltyOwnerProfiles,
    loadTransportOwnerProfiles,
    refreshKey,
  ]);

  const getRatePartyName = (account: MerchantBankAccount) => {
    if (account.ratePartyName) return account.ratePartyName;
    switch (account.ratePartyType) {
      case 'mine-quarry':
        return mineQuarries.find(item => item.id === account.ratePartyId)?.name || '';
      case 'vendor-customer':
        return vendorCustomers.find(item => item.id === account.ratePartyId)?.name || '';
      case 'royalty-owner':
        return royaltyOwnerProfiles.find(item => item.id === account.ratePartyId)?.name || '';
      case 'transport-owner':
        return transportOwnerProfiles.find(item => item.id === account.ratePartyId)?.name || '';
      default:
        return '';
    }
  };

  const filteredAccounts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return merchantBankAccounts;
    return merchantBankAccounts.filter(account => {
      const merchantName = account.merchantName || merchants.find(item => item.id === account.merchantId)?.name || '';
      const ratePartyName = getRatePartyName(account);
      return [merchantName, ratePartyName, account.accountName, account.accountNumber, account.ifscCode, account.remarks || '']
        .some(value => value.toLowerCase().includes(term));
    });
  }, [searchTerm, merchantBankAccounts, merchants, mineQuarries, vendorCustomers, royaltyOwnerProfiles, transportOwnerProfiles]);

  const totalPages = Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE) || 1;
  const paginatedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAccounts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAccounts, currentPage]);

  const handleAdd = () => {
    openModal('Add Merchant Bank Account', <MerchantBankAccountForm onSave={handleCreate} onClose={closeModal} />);
  };

  const handleCreate = async (data: Omit<MerchantBankAccount, 'id' | 'merchantName'>) => {
    await addMerchantBankAccount(data);
    setCurrentPage(1);
    closeModal();
  };

  const handleEdit = (account: MerchantBankAccount) => {
    openModal('Edit Merchant Bank Account', <MerchantBankAccountForm initialData={account} onSave={(data) => handleUpdate(account.id, data)} onClose={closeModal} />);
  };

  const handleUpdate = async (id: string, data: Omit<MerchantBankAccount, 'id' | 'merchantName'>) => {
    await updateMerchantBankAccount(id, data);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this bank account?')) return;
    await deleteMerchantBankAccount(id);
  };

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredAccounts, currentPage]);

  return (
    <div className="relative">
      <PageHeader
        title="Merchant Bank Accounts"
        subtitle="Track merchant bank account information for payments."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Add Bank Account', action: handleAdd }}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[240px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Merchant, rate party, account number"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Merchant Bank Accounts</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['S. No.', 'Merchant Name', 'Rate Party Type', 'Rate Party', 'Account Type', 'Account Name', 'Account Number', 'IFSC Code', 'Remarks', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedAccounts.map((account, index) => (
                  <tr key={account.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{account.merchantName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {RATE_PARTY_LABELS.find(item => item.value === account.ratePartyType)?.label || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getRatePartyName(account) || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{account.accountType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{account.accountName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{account.accountNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{account.ifscCode}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{account.remarks || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(account)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDelete(account.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedAccounts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No bank accounts yet. Add an account after creating merchants.
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

const MerchantBankAccountForm: React.FC<{
  initialData?: MerchantBankAccount;
  onSave: (data: Omit<MerchantBankAccount, 'id' | 'merchantName'>) => void;
  onClose: () => void;
}> = ({ initialData, onSave, onClose }) => {
  const { merchants, accountTypes, mineQuarries, vendorCustomers, royaltyOwnerProfiles, transportOwnerProfiles } = useData();
  const [formData, setFormData] = useState<Omit<MerchantBankAccount, 'id' | 'merchantName'>>({
    merchantId: initialData?.merchantId || '',
    accountType: initialData?.accountType || '',
    ratePartyType: initialData?.ratePartyType || 'vendor-customer',
    ratePartyId: initialData?.ratePartyId || '',
    accountName: initialData?.accountName || '',
    accountNumber: initialData?.accountNumber || '',
    ifscCode: initialData?.ifscCode || '',
    remarks: initialData?.remarks || '',
  });

  const ratePartyOptions = useMemo(() => {
    switch (formData.ratePartyType) {
      case 'mine-quarry':
        return mineQuarries.map(item => ({ id: item.id, name: item.name }));
      case 'vendor-customer':
        return vendorCustomers.map(item => ({ id: item.id, name: item.name }));
      case 'royalty-owner':
        return royaltyOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
      case 'transport-owner':
        return transportOwnerProfiles.map(item => ({ id: item.id, name: item.name }));
      default:
        return [];
    }
  }, [formData.ratePartyType, mineQuarries, vendorCustomers, royaltyOwnerProfiles, transportOwnerProfiles]);

  useEffect(() => {
    if (!formData.accountType && accountTypes.length > 0) {
      setFormData(prev => ({ ...prev, accountType: accountTypes[0].name }));
    }
  }, [accountTypes, formData.accountType]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'ratePartyType' ? { ratePartyId: '' } : null),
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <InputField label="Merchant Name" id="merchantId" name="merchantId" type="select" value={formData.merchantId} onChange={handleChange} required>
          <option value="">Select Merchant</option>
          {merchants.map(merchant => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}
        </InputField>
        <InputField label="Rate Party Type" id="ratePartyType" name="ratePartyType" type="select" value={formData.ratePartyType || 'vendor-customer'} onChange={handleChange} required>
          {RATE_PARTY_LABELS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </InputField>
        <InputField label="Rate Party" id="ratePartyId" name="ratePartyId" type="select" value={formData.ratePartyId || ''} onChange={handleChange} required>
          <option value="">Select Party</option>
          {ratePartyOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </InputField>
        <InputField label="Account Type" id="accountType" name="accountType" type="select" value={formData.accountType} onChange={handleChange} required>
          <option value="">Select Account Type</option>
          {accountTypes.map(type => <option key={type.id} value={type.name}>{type.name}</option>)}
        </InputField>
        <InputField label="Bank Account Name" id="accountName" name="accountName" type="text" value={formData.accountName} onChange={handleChange} required />
        <InputField label="Bank Account Number" id="accountNumber" name="accountNumber" type="text" value={formData.accountNumber} onChange={handleChange} required />
        <InputField label="IFSC Code" id="ifscCode" name="ifscCode" type="text" value={formData.ifscCode} onChange={handleChange} required />
      </div>
      <InputField label="Remarks" id="remarks" name="remarks" type="textarea" value={formData.remarks} onChange={handleChange} />
      <div className="pt-6 flex justify-end space-x-3">
        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          Cancel
        </button>
        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
          Save Bank Account
        </button>
      </div>
    </form>
  );
};

export default MerchantBankAccountsPage;
