import React, { useState } from 'react';
import { Trip } from '../types';
import { useData } from '../contexts/DataContext';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;

type PartyTab = {
  key: 'vendorCustomer' | 'transportOwner' | 'mineQuarry' | 'royaltyOwner';
  label: string;
  field: keyof Trip;
};

const partyTabs: PartyTab[] = [
  { key: 'vendorCustomer', label: 'Vendor & Customer Name', field: 'customer' },
  { key: 'transportOwner', label: 'Transport & Owner Name', field: 'transporterName' },
  { key: 'mineQuarry', label: 'Mine & Quarry Name', field: 'quarryName' },
  { key: 'royaltyOwner', label: 'Royalty Owner Name', field: 'royaltyOwnerName' },
];

const TripRateLedger: React.FC = () => {
  const { trips } = useData();
  const [appliedRates, setAppliedRates] = useState<Record<string, number>>({});
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [pageIndex, setPageIndex] = useState<Record<string, number>>({});

  const handleInput = (tabKey: string, tripId: number, value: string) => {
    const mapKey = `${tabKey}-${tripId}`;
    setRateInputs(prev => ({ ...prev, [mapKey]: value }));
  };

  const handleApply = (tabKey: string, tripId: number, rateValue: string, netWeight: number) => {
    const mapKey = `${tabKey}-${tripId}`;
    const rateNumber = Number(rateValue) || 0;
    setAppliedRates(prev => ({ ...prev, [mapKey]: rateNumber }));
    setRateInputs(prev => ({ ...prev, [mapKey]: rateValue }));
  };

  const handlePageChange = (tabSection: string, page: number) => {
    setPageIndex(prev => ({ ...prev, [tabSection]: page }));
  };

  return (
    <div>
      <PageHeader title="Trip Rate Ledger" />
      <div className="space-y-6">
        {partyTabs.map(tab => {
          const awaitingKey = `${tab.key}-awaiting`;
          const appliedKey = `${tab.key}-applied`;
          const isApplied = (tripId: number) => Boolean(appliedRates[`${tab.key}-${tripId}`]);
          const awaitingTrips = trips.filter(trip => !isApplied(trip.id));
          const appliedTrips = trips.filter(trip => isApplied(trip.id));
          const awaitingPage = pageIndex[awaitingKey] || 1;
          const appliedPage = pageIndex[appliedKey] || 1;
          const awaitingSlice = awaitingTrips.slice((awaitingPage - 1) * PAGE_SIZE, awaitingPage * PAGE_SIZE);
          const appliedSlice = appliedTrips.slice((appliedPage - 1) * PAGE_SIZE, appliedPage * PAGE_SIZE);
          const awaitingCount = awaitingTrips.length;

          return (
            <div key={tab.key} className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {tab.label}
                  <span className={`ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${awaitingCount > 0 ? 'bg-primary text-white animate-pulse' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>
                    {awaitingCount}
                  </span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Awaiting rates &ndash; {awaitingCount}</div>
              </div>

              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-gray-800 dark:text-gray-100">Trips Awaiting Rates</h3>
                  <Pagination currentPage={awaitingPage} totalPages={Math.max(1, Math.ceil(awaitingTrips.length / PAGE_SIZE))} onPageChange={page => handlePageChange(awaitingKey, page)} />
                </div>
                {awaitingSlice.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-gray-500">No trips pending rate entry.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="w-12 px-3 py-2">S.No.</th>
                          <th className="px-3 py-2">Trip #</th>
                          <th className="px-3 py-2">Invoice/DC</th>
                          <th className="px-3 py-2">Rate Party Name</th>
                          <th className="px-3 py-2">Net Quantity</th>
                          <th className="px-3 py-2">Rate</th>
                          <th className="px-3 py-2">Trip Amount</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {awaitingSlice.map((trip, idx) => {
                          const mapKey = `${tab.key}-${trip.id}`;
                          const rateValue = rateInputs[mapKey] || '';
                          const netQty = Number(trip.netWeight || 0);
                          const amount = netQty * (Number(rateValue) || 0);
                          return (
                            <tr key={trip.id} className="border-b border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                              <td className="px-3 py-2">{(awaitingPage - 1) * PAGE_SIZE + idx + 1}</td>
                              <td className="px-3 py-2">#{trip.id}</td>
                              <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                              <td className="px-3 py-2">{trip[tab.field as keyof typeof trip] || '-'}</td>
                              <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={rateValue}
                                  placeholder="Rate"
                                  onChange={event => handleInput(tab.key, trip.id, event.target.value)}
                                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                                />
                              </td>
                              <td className="px-3 py-2">{amount.toFixed(2)}</td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => handleApply(tab.key, trip.id, rateValue, netQty)}
                                  className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                                  disabled={rateValue.trim() === ''}
                                >
                                  Apply Rate
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-gray-800 dark:text-gray-100">Rates Applied</h3>
                  <Pagination currentPage={appliedPage} totalPages={Math.max(1, Math.ceil(appliedTrips.length / PAGE_SIZE))} onPageChange={page => handlePageChange(appliedKey, page)} />
                </div>
                {appliedSlice.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-gray-500">No rates recorded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="w-12 px-3 py-2">S.No.</th>
                          <th className="px-3 py-2">Trip #</th>
                          <th className="px-3 py-2">Invoice/DC</th>
                          <th className="px-3 py-2">Rate Party Name</th>
                          <th className="px-3 py-2">Net Quantity</th>
                          <th className="px-3 py-2">Rate</th>
                          <th className="px-3 py-2">Trip Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appliedSlice.map((trip, idx) => {
                          const mapKey = `${tab.key}-${trip.id}`;
                          const rateValue = appliedRates[mapKey] ?? Number(rateInputs[mapKey] || 0);
                          const netQty = Number(trip.netWeight || 0);
                          const amount = netQty * rateValue;
                          return (
                            <tr key={trip.id} className="border-b border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200">
                              <td className="px-3 py-2">{(appliedPage - 1) * PAGE_SIZE + idx + 1}</td>
                              <td className="px-3 py-2">#{trip.id}</td>
                              <td className="px-3 py-2">{trip.invoiceDCNumber || '-'}</td>
                              <td className="px-3 py-2">{trip[tab.field as keyof typeof trip] || '-'}</td>
                              <td className="px-3 py-2">{netQty.toFixed(2)}</td>
                              <td className="px-3 py-2">{rateValue.toFixed(2)}</td>
                              <td className="px-3 py-2">{amount.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TripRateLedger;
