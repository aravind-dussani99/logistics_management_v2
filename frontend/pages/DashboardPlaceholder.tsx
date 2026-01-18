import React from 'react';

const DashboardPlaceholder: React.FC = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white/80 p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="text-3xl font-semibold text-gray-800 dark:text-gray-100">Dashboard</div>
    <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Dashboard page is being created.</p>
    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">For now, please continue using the Report view to monitor trips and operations.</p>
  </div>
);

export default DashboardPlaceholder;
