import React, { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import SupervisorTripForm from '../../components/SupervisorTripForm';
import { useUI } from '../../contexts/UIContext';
import { Trip } from '../../types';

const SupervisorEnterTrips: React.FC = () => {
  const [formKey, setFormKey] = useState(0);
  const [filters, setFilters] = useState({});
  const { openModal, closeModal } = useUI();

  const handleReset = () => setFormKey(prev => prev + 1);
  const handleSuccess = (trip?: Trip) => {
    openModal('Trip saved', (
      <div className="space-y-4 p-4">
        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Trip #{trip?.id ?? '—'} saved successfully.</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">Stay on this page to add another trip.</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark focus:outline-none"
          >
            Okay
          </button>
        </div>
      </div>
    ));
  };

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
