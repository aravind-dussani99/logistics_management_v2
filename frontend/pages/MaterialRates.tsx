import React, { useEffect, useMemo, useState } from 'react';
import { MaterialRate, RatePartyType } from '../types';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { formatDateDisplay, safeToFixed } from '../utils';
import AlertDialog from '../components/AlertDialog';

const ITEMS_PER_PAGE = 10;
const RATE_PARTY_LABELS: { value: RatePartyType; label: string }[] = [
  { value: 'mine-quarry', label: 'Mine & Quarry' },
  { value: 'vendor-customer', label: 'Vendor & Customer' },
  { value: 'royalty-owner', label: 'Royalty Owner' },
  { value: 'transport-owner', label: 'Transport Owner' },
];

const MaterialRatesPage: React.FC = () => {
  const {
    materialRates,
    materialTypeDefinitions,
    siteLocations,
    mineQuarries,
    vendorCustomers,
    royaltyOwnerProfiles,
    transportOwnerProfiles,
    addMaterialRate,
    updateMaterialRate,
    deleteMaterialRate,
    loadMaterialRates,
    loadMaterialTypeDefinitions,
    loadSiteLocations,
    loadMineQuarries,
    loadVendorCustomers,
    loadRoyaltyOwnerProfiles,
    loadTransportOwnerProfiles,
    refreshKey,
  } = useData();
  const { openModal, closeModal } = useUI();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [partyTypeFilter, setPartyTypeFilter] = useState<RatePartyType | ''>('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [pickupFilter, setPickupFilter] = useState('');
  const [dropOffFilter, setDropOffFilter] = useState('');

  useEffect(() => {
    loadMaterialRates();
    loadMaterialTypeDefinitions();
    loadSiteLocations();
    loadMineQuarries();
    loadVendorCustomers();
    loadRoyaltyOwnerProfiles();
    loadTransportOwnerProfiles();
  }, [
    loadMaterialRates,
    loadMaterialTypeDefinitions,
    loadSiteLocations,
    loadMineQuarries,
    loadVendorCustomers,
    loadRoyaltyOwnerProfiles,
    loadTransportOwnerProfiles,
    refreshKey,
  ]);

  const getRatePartyName = (rate: MaterialRate) => {
    if (rate.ratePartyName) return rate.ratePartyName;
    switch (rate.ratePartyType) {
      case 'mine-quarry':
        return mineQuarries.find(item => item.id === rate.ratePartyId)?.name || '';
      case 'vendor-customer':
        return vendorCustomers.find(item => item.id === rate.ratePartyId)?.name || '';
      case 'royalty-owner':
        return royaltyOwnerProfiles.find(item => item.id === rate.ratePartyId)?.name || '';
      case 'transport-owner':
        return transportOwnerProfiles.find(item => item.id === rate.ratePartyId)?.name || '';
      default:
        return '';
    }
  };

  const buildOverlapMessage = (data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>) => {
    const partyName = (() => {
      switch (data.ratePartyType) {
        case 'mine-quarry':
          return mineQuarries.find(item => item.id === data.ratePartyId)?.name || 'Selected party';
        case 'vendor-customer':
          return vendorCustomers.find(item => item.id === data.ratePartyId)?.name || 'Selected party';
        case 'royalty-owner':
          return royaltyOwnerProfiles.find(item => item.id === data.ratePartyId)?.name || 'Selected party';
        case 'transport-owner':
          return transportOwnerProfiles.find(item => item.id === data.ratePartyId)?.name || 'Selected party';
        default:
          return 'Selected party';
      }
    })();
    const materialName = materialTypeDefinitions.find(item => item.id === data.materialTypeId)?.name || 'Selected material';
    const pickupName = siteLocations.find(site => site.id === data.pickupLocationId)?.name || 'pickup location';
    const dropName = siteLocations.find(site => site.id === data.dropOffLocationId)?.name || 'drop-off location';
    const effectiveFrom = data.effectiveFrom ? formatDateDisplay(data.effectiveFrom) : 'N/A';
    const effectiveTo = data.effectiveTo ? formatDateDisplay(data.effectiveTo) : 'Present';
    return `A material rate for ${partyName} (${materialName}) from ${pickupName} to ${dropName} with effective dates ${effectiveFrom} to ${effectiveTo} already exists. Please choose different dates or locations.`;
  };

  const filteredRates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return materialRates.filter(rate => {
      if (partyTypeFilter && rate.ratePartyType !== partyTypeFilter) return false;
      if (materialFilter && rate.materialTypeId !== materialFilter) return false;
      if (pickupFilter && rate.pickupLocationId !== pickupFilter) return false;
      if (dropOffFilter && rate.dropOffLocationId !== dropOffFilter) return false;
      if (!term) return true;
      const partyName = rate.ratePartyName || getRatePartyName(rate);
      const materialName = materialTypeDefinitions.find(item => item.id === rate.materialTypeId)?.name || '';
      const pickupName = siteLocations.find(site => site.id === rate.pickupLocationId)?.name || '';
      const dropName = siteLocations.find(site => site.id === rate.dropOffLocationId)?.name || '';
      return [partyName, materialName, pickupName, dropName, rate.remarks || '']
        .some(value => value.toLowerCase().includes(term));
    });
  }, [
    materialRates,
    partyTypeFilter,
    materialFilter,
    pickupFilter,
    dropOffFilter,
    searchTerm,
    materialTypeDefinitions,
    siteLocations,
    mineQuarries,
    vendorCustomers,
    royaltyOwnerProfiles,
    transportOwnerProfiles,
  ]);

  const totalPages = Math.ceil(filteredRates.length / ITEMS_PER_PAGE) || 1;

  const paginatedRates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRates, currentPage]);

  const handleAdd = () => {
    openModal('Add Material Rate', <MaterialRateForm onSave={handleCreate} onClose={closeModal} />);
  };

  const handleCreate = async (data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>) => {
    try {
      await addMaterialRate(data);
      setCurrentPage(1);
      closeModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save material rate.';
      if (message.toLowerCase().includes('overlapping rate exists')) {
        openModal('Rate Already Exists', (
          <AlertDialog message={buildOverlapMessage(data)} onConfirm={closeModal} />
        ));
      } else {
        openModal('Unable to Save Rate', (
          <AlertDialog message={message} onConfirm={closeModal} />
        ));
      }
    }
  };

  const handleEdit = (rate: MaterialRate) => {
    openModal('Edit Material Rate', <MaterialRateForm initialData={rate} onSave={(data) => handleUpdate(rate.id, data)} onClose={closeModal} />);
  };

  const handleUpdate = async (id: string, data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>) => {
    try {
      await updateMaterialRate(id, data);
      closeModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update material rate.';
      if (message.toLowerCase().includes('overlapping rate exists')) {
        openModal('Rate Already Exists', (
          <AlertDialog message={buildOverlapMessage(data)} onConfirm={closeModal} />
        ));
      } else {
        openModal('Unable to Update Rate', (
          <AlertDialog message={message} onConfirm={closeModal} />
        ));
      }
    }
  };

  const handleDelete = async (id: string) => {
    openModal('Delete Material Rate', (
      <AlertDialog
        message="Delete this material rate?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={closeModal}
        onConfirm={async () => {
          await deleteMaterialRate(id);
          closeModal();
        }}
      />
    ));
  };

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredRates.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > nextTotalPages) setCurrentPage(nextTotalPages);
  }, [filteredRates, currentPage]);

  const formatDate = (value?: string) => formatDateDisplay(value);

  const getStatus = (rate: MaterialRate) => {
    if (rate.status) return rate.status;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fromDate = new Date(rate.effectiveFrom);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = rate.effectiveTo ? new Date(rate.effectiveTo) : null;
    if (toDate) toDate.setHours(0, 0, 0, 0);

    if (fromDate > today) return 'Future';
    if (toDate && toDate < today) return 'Inactive';
    return 'Active';
  };

  return (
    <div className="relative">
      <PageHeader
        title="Material Rates"
        subtitle="Maintain material rate cards by party and location."
        filters={{}}
        onFilterChange={() => {}}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        pageAction={{ label: 'Add Material Rate', action: handleAdd }}
      />

      <main className="pt-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Party, material, location, remarks"
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs text-gray-500 dark:text-gray-400">Rate Party Type</label>
            <select
              value={partyTypeFilter}
              onChange={(event) => setPartyTypeFilter(event.target.value as RatePartyType | '')}
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            >
              <option value="">All Types</option>
              {RATE_PARTY_LABELS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs text-gray-500 dark:text-gray-400">Material Type</label>
            <select
              value={materialFilter}
              onChange={(event) => setMaterialFilter(event.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            >
              <option value="">All Materials</option>
              {materialTypeDefinitions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs text-gray-500 dark:text-gray-400">Pickup</label>
            <select
              value={pickupFilter}
              onChange={(event) => setPickupFilter(event.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            >
              <option value="">All Pickups</option>
              {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs text-gray-500 dark:text-gray-400">Drop-off</label>
            <select
              value={dropOffFilter}
              onChange={(event) => setDropOffFilter(event.target.value)}
              className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            >
              <option value="">All Drop-offs</option>
              {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Material Rates</h2>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['S. No.', 'Status', 'Material Type', 'Rate Party', 'Pickup', 'Drop-off', 'Total Km', 'Rate/Km', 'Rate/Ton', 'GST', 'GST %', 'GST Amount', 'Total Rate/Ton', 'Effective From', 'Effective To', 'Remarks', 'Actions'].map(header => (
                    <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedRates.map((rate, index) => (
                  <tr key={rate.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatus(rate)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{materialTypeDefinitions.find(item => item.id === rate.materialTypeId)?.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getRatePartyName(rate) || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{siteLocations.find(site => site.id === rate.pickupLocationId)?.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{siteLocations.find(site => site.id === rate.dropOffLocationId)?.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{safeToFixed(rate.totalKm)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{safeToFixed(rate.ratePerKm)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{safeToFixed(rate.ratePerTon)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{rate.gstChargeable ? 'Yes' : 'No'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{safeToFixed(rate.gstPercentage)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{safeToFixed(rate.gstAmount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{safeToFixed(rate.totalRatePerTon)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(rate.effectiveFrom)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{rate.effectiveTo ? formatDate(rate.effectiveTo) : 'Present'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{rate.remarks || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleEdit(rate)} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit</button>
                      <button onClick={() => handleDelete(rate.id)} className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {paginatedRates.length === 0 && (
                  <tr>
                    <td colSpan={17} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No material rates match the current filters.
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

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => {
  const inputValue = props.type === 'number' && (props.value === 0 || props.value === '0') ? '' : props.value;
  return (
    <div className="col-span-1">
      <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input {...props} value={inputValue} className="mt-1 block w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
    </div>
  );
};

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

const MaterialRateForm: React.FC<{
  initialData?: MaterialRate;
  onSave: (data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>) => void;
  onClose: () => void;
}> = ({ initialData, onSave, onClose }) => {
  const {
    materialTypeDefinitions,
    siteLocations,
    mineQuarries,
    vendorCustomers,
    royaltyOwnerProfiles,
    transportOwnerProfiles,
  } = useData();

  const normalizeDate = (value?: string) => {
    if (!value) return '';
    return value.split('T')[0];
  };

  const [formData, setFormData] = useState<Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>>({
    materialTypeId: initialData?.materialTypeId || '',
    ratePartyType: initialData?.ratePartyType || 'vendor-customer',
    ratePartyId: initialData?.ratePartyId || '',
    pickupLocationId: initialData?.pickupLocationId || '',
    dropOffLocationId: initialData?.dropOffLocationId || '',
    totalKm: initialData?.totalKm || 0,
    ratePerKm: initialData?.ratePerKm || 0,
    ratePerTon: initialData?.ratePerTon || 0,
    gstChargeable: initialData?.gstChargeable || false,
    gstPercentage: initialData?.gstPercentage || 0,
    gstAmount: initialData?.gstAmount || 0,
    totalRatePerTon: initialData?.totalRatePerTon || 0,
    effectiveFrom: normalizeDate(initialData?.effectiveFrom) || new Date().toISOString().split('T')[0],
    effectiveTo: normalizeDate(initialData?.effectiveTo),
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
    const gstAmount = formData.gstChargeable ? (formData.ratePerTon * (formData.gstPercentage / 100)) : 0;
    const totalRatePerTon = formData.ratePerTon + gstAmount;
    setFormData(prev => ({
      ...prev,
      gstAmount,
      totalRatePerTon,
    }));
  }, [formData.ratePerTon, formData.gstChargeable, formData.gstPercentage]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    const checked = (event.target as HTMLInputElement).checked;
    const nextValue = type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? '' : parseFloat(value)) : value);
    setFormData(prev => ({
      ...prev,
      [name]: nextValue,
      ...(name === 'ratePartyType' ? { ratePartyId: '' } : null),
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SelectField label="Material Type" id="materialTypeId" name="materialTypeId" value={formData.materialTypeId} onChange={handleChange} required>
          <option value="">Select Material</option>
          {materialTypeDefinitions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </SelectField>
        <SelectField label="Rate Party Type" id="ratePartyType" name="ratePartyType" value={formData.ratePartyType} onChange={handleChange} required>
          {RATE_PARTY_LABELS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </SelectField>
        <SelectField label="Rate Party" id="ratePartyId" name="ratePartyId" value={formData.ratePartyId} onChange={handleChange} required>
          <option value="">Select Party</option>
          {ratePartyOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </SelectField>
        <SelectField label="Pickup Location" id="pickupLocationId" name="pickupLocationId" value={formData.pickupLocationId} onChange={handleChange} required>
          <option value="">Select Pickup</option>
          {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
        </SelectField>
        <SelectField label="Drop-off Location" id="dropOffLocationId" name="dropOffLocationId" value={formData.dropOffLocationId} onChange={handleChange} required>
          <option value="">Select Drop-off</option>
          {siteLocations.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
        </SelectField>
        <InputField label="Total Km" id="totalKm" name="totalKm" type="number" value={formData.totalKm} onChange={handleChange} />
        <InputField label="Rate per Km" id="ratePerKm" name="ratePerKm" type="number" value={formData.ratePerKm} onChange={handleChange} />
        <InputField label="Rate per Ton" id="ratePerTon" name="ratePerTon" type="number" value={formData.ratePerTon} onChange={handleChange} />
        <div className="col-span-1 flex items-center space-x-3 mt-7">
          <input id="gstChargeable" name="gstChargeable" type="checkbox" checked={formData.gstChargeable} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
          <label htmlFor="gstChargeable" className="text-sm font-medium text-gray-700 dark:text-gray-300">GST Chargeable</label>
        </div>
        <InputField label="GST %" id="gstPercentage" name="gstPercentage" type="number" value={formData.gstPercentage} onChange={handleChange} />
        <InputField label="GST Amount" id="gstAmount" name="gstAmount" type="number" value={safeToFixed(formData.gstAmount)} readOnly className="bg-gray-100 dark:bg-gray-700" />
        <InputField label="Total Rate/Ton" id="totalRatePerTon" name="totalRatePerTon" type="number" value={safeToFixed(formData.totalRatePerTon)} readOnly className="font-bold bg-gray-100 dark:bg-gray-700" />
        <InputField label="Effective From" id="effectiveFrom" name="effectiveFrom" type="date" value={formData.effectiveFrom} onChange={handleChange} required />
        <InputField label="Effective To" id="effectiveTo" name="effectiveTo" type="date" value={formData.effectiveTo || ''} onChange={handleChange} />
      </div>
      <TextAreaField label="Remarks" id="remarks" name="remarks" value={formData.remarks} onChange={handleChange} />
      <div className="pt-6 flex justify-end space-x-3">
        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none">
          Cancel
        </button>
        <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none">
          Save Rate
        </button>
      </div>
    </form>
  );
};

export default MaterialRatesPage;
