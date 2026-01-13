import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import AdvanceForm from '../../components/AdvanceForm';
import { useData } from '../../contexts/DataContext';

const SupervisorAdvancesForm: React.FC = () => {
  const navigate = useNavigate();
  const { loadTrips, loadVendorCustomers, loadMineQuarries, loadRoyaltyOwnerProfiles, loadTransportOwnerProfiles } = useData();
  const [formKey, setFormKey] = useState(0);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    loadTrips();
    loadVendorCustomers();
    loadMineQuarries();
    loadRoyaltyOwnerProfiles();
    loadTransportOwnerProfiles();
  }, [loadTrips, loadVendorCustomers, loadMineQuarries, loadRoyaltyOwnerProfiles, loadTransportOwnerProfiles]);

  const handleReset = () => setFormKey(prev => prev + 1);
  const handleSuccess = () => navigate('/dashboard');

  return (
    <div className="relative">
      <PageHeader
        title="Advances"
        filters={filters}
        onFilterChange={setFilters}
        filterData={{ vehicles: [], customers: [], quarries: [], royaltyOwners: [] }}
        showFilters={[]}
        showAddAction={false}
      />
      <main className="pt-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <AdvanceForm key={formKey} onClose={handleReset} onSubmitSuccess={handleSuccess} />
        </div>
      </main>
    </div>
  );
};

export default SupervisorAdvancesForm;
