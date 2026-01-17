import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import SupervisorTripForm from '../../components/SupervisorTripForm';

const SupervisorEnterTrips: React.FC = () => {
  const navigate = useNavigate();
  const [formKey, setFormKey] = useState(0);
  const [filters, setFilters] = useState({});

  const handleReset = () => setFormKey(prev => prev + 1);
  const handleSuccess = () => navigate('/dashboard', { state: { reportType: 'trips' } });

  return (
    <div className="relative">
      <PageHeader
        title="Enter Trips"
        filters={filters}
        onFilterChange={setFilters}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showFilters={[]}
        showAddAction={false}
      />
      <main className="pt-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <SupervisorTripForm
            key={formKey}
            mode="enter"
            onClose={handleReset}
            onSubmitSuccess={handleSuccess}
          />
        </div>
      </main>
    </div>
  );
};

export default SupervisorEnterTrips;
