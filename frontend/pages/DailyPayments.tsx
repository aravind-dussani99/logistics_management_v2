import React from 'react';

const DailyPayments: React.FC = () => (
  <div className="relative">
    <div className="rounded-lg border border-dashed border-gray-300 bg-white/80 p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">Daily Payments</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Record and review daily payouts to vendors, royalty owners, and transporters.</p>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This screen will eventually combine supplier payments, advances, and reconciling notes for each site.</p>
    </div>
  </div>
);

export default DailyPayments;
