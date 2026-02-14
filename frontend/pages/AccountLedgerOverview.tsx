import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import AccountReconciliation, { AccountReconciliationHandle } from './AccountReconciliation';
import { useData } from '../contexts/DataContext';
import { dailyExpenseApi } from '../services/dailyExpenseApi';
import { DailyExpense, Payment, PaymentType, RatePartyType, Trip } from '../types';
import { computeTripGstAmount, getCombinedRatePerTon, getComboPartyTypes, resolveTripRate } from '../utils';

type RatePartySummary = {
  key: string;
  type: RatePartyType | 'account' | 'mixed' | 'combined';
  name: string;
  trips: Trip[];
  totalTons: number;
  grossAmount: number;
  paidAmount: number;
  balance: number;
};

type MonthlyActivityType =
  | 'combined'
  | 'mine-quarry'
  | 'royalty-owner'
  | 'transport-owner'
  | 'vendor-customer'
  | 'others';

type MonthlyPartyRow = {
  key: string;
  activityType: MonthlyActivityType;
  partyName: string;
  dateRangeLabel: string;
  tripCount: number;
  netTons: number;
  tripAmount: number;
  gstAmount: number;
  businessValue: number;
  paidBySource: Array<{ source: string; amount: number }>;
  totalPaid: number;
  balance: number;
};

type BankSummary = {
  account: string;
  credits: Array<{ name: string; count: number; amount: number }>;
  debits: Array<{ name: string; count: number; amount: number }>;
  totalCredits: number;
  totalDebits: number;
  balance: number;
};

const RATE_PARTY_LABELS: Record<RatePartyType | 'account' | 'mixed' | 'combined', string> = {
  'vendor-customer': 'Vendor & Customer',
  'mine-quarry': 'Mine & Quarry',
  'royalty-owner': 'Royalty Owner',
  'transport-owner': 'Transport & Owner',
  account: 'Account',
  mixed: 'Multiple',
  combined: 'Combined',
};

const MONTHLY_ACTIVITY_LABELS: Record<MonthlyActivityType, string> = {
  combined: 'Combined',
  'mine-quarry': 'Mine & Quarry',
  'royalty-owner': 'Royalty',
  'transport-owner': 'Transport & Owner',
  'vendor-customer': 'Vendor & Customer',
  others: 'Others',
};

const getMtdRange = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return {
    dateFrom: formatDate(startOfMonth),
    dateTo: formatDate(today),
  };
};

const AccountLedgerOverview: React.FC = () => {
  const { trips, payments, vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles, materialRates, loadTrips, loadPayments, loadVendorCustomers, loadMineQuarries, loadRoyaltyOwnerProfiles, loadTransportOwnerProfiles, loadMaterialRates, refreshKey } = useData();
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [filters, setFilters] = useState<Filters>(getMtdRange());
  const [draftFilters, setDraftFilters] = useState<Filters>(getMtdRange());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'abstract' | 'history' | 'party' | 'head' | 'monthly'>('history');
  const partyExportRef = useRef<AccountReconciliationHandle | null>(null);
  const headExportRef = useRef<AccountReconciliationHandle | null>(null);
  useEffect(() => {
    loadTrips();
    loadPayments();
    loadVendorCustomers();
    loadMineQuarries();
    loadRoyaltyOwnerProfiles();
    loadTransportOwnerProfiles();
    loadMaterialRates();
    dailyExpenseApi.getAll()
      .then(setExpenses)
      .catch((error) => {
        console.warn('Failed to load daily expenses for ledger', error);
        setExpenses([]);
      });
  }, [loadTrips, loadPayments, loadVendorCustomers, loadMineQuarries, loadRoyaltyOwnerProfiles, loadTransportOwnerProfiles, loadMaterialRates, refreshKey]);

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const allowDateTyping = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey) return;
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowed.includes(event.key)) return;
    if (/^[0-9-]$/.test(event.key)) return;
    event.preventDefault();
  };
  const openDatePicker = (event: React.MouseEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
      try {
        (input as HTMLInputElement & { showPicker: () => void }).showPicker();
      } catch {
        // Ignore non-gesture errors (Safari/Chrome constraint).
      }
    }
  };
  const updateDraft = (key: keyof Filters, value: string) => {
    setDraftFilters(prev => ({ ...prev, [key]: value }));
  };
  const applyDraftFilters = () => {
    setFilters(draftFilters);
  };
  const resetDraftFilters = () => {
    const resetRange = getMtdRange();
    setDraftFilters(resetRange);
    setFilters(resetRange);
  };

  const partyIdLookup = useMemo(() => {
    const map = new Map<string, string>();
    vendorCustomers.forEach(item => map.set(`vendor-customer:${item.name}`, item.id));
    mineQuarries.forEach(item => map.set(`mine-quarry:${item.name}`, item.id));
    royaltyOwnerProfiles.forEach(item => map.set(`royalty-owner:${item.name}`, item.id));
    transportOwnerProfiles.forEach(item => map.set(`transport-owner:${item.name}`, item.id));
    return map;
  }, [vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles]);

  const partyNameLookup = useMemo(() => {
    const map = new Map<string, { type: RatePartyType; id: string; name: string }>();
    vendorCustomers.forEach(item => map.set(item.name.toLowerCase(), { type: 'vendor-customer', id: item.id, name: item.name }));
    mineQuarries.forEach(item => map.set(item.name.toLowerCase(), { type: 'mine-quarry', id: item.id, name: item.name }));
    royaltyOwnerProfiles.forEach(item => map.set(item.name.toLowerCase(), { type: 'royalty-owner', id: item.id, name: item.name }));
    transportOwnerProfiles.forEach(item => map.set(item.name.toLowerCase(), { type: 'transport-owner', id: item.id, name: item.name }));
    return map;
  }, [vendorCustomers, mineQuarries, royaltyOwnerProfiles, transportOwnerProfiles]);

  const filteredTrips = useMemo(() => {
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
    return trips.filter(trip => {
      const tripDate = trip.date ? new Date(trip.date) : null;
      if (fromDate && tripDate && tripDate < fromDate) return false;
      if (toDate && tripDate && tripDate > toDate) return false;
      return true;
    });
  }, [trips, filters.dateFrom, filters.dateTo]);

  const filteredPayments = useMemo(() => {
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
    return payments.filter(payment => {
      const paymentDate = payment.date ? new Date(payment.date) : null;
      if (fromDate && paymentDate && paymentDate < fromDate) return false;
      if (toDate && paymentDate && paymentDate > toDate) return false;
      return true;
    });
  }, [payments, filters.dateFrom, filters.dateTo]);

  const filteredExpenses = useMemo(() => {
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
    return expenses.filter(expense => {
      const expenseDate = expense.date ? new Date(expense.date) : null;
      if (fromDate && expenseDate && expenseDate < fromDate) return false;
      if (toDate && expenseDate && expenseDate > toDate) return false;
      return true;
    });
  }, [expenses, filters.dateFrom, filters.dateTo]);

  const buildSummaries = useCallback((
    tripsSource: Trip[],
    expensesSource: DailyExpense[],
    paymentsSource: Payment[],
  ) => {
    const bucket = new Map<string, RatePartySummary>();
    const addSummary = (type: RatePartyType | 'account' | 'combined', name: string, trip?: Trip, amountOverride?: number) => {
      const key = `${type}:${name}`;
      if (!bucket.has(key)) {
        bucket.set(key, {
          key,
          type,
          name,
          trips: [],
          totalTons: 0,
          grossAmount: 0,
          paidAmount: 0,
          balance: 0,
        });
      }
      const summary = bucket.get(key)!;
      if (trip) {
        summary.trips.push(trip);
        summary.totalTons += Number(trip.netWeight || 0);
        if (typeof amountOverride === 'number') {
          summary.grossAmount += amountOverride;
        } else {
          if (type === 'vendor-customer') summary.grossAmount += Number(trip.revenue || 0);
          if (type === 'mine-quarry') summary.grossAmount += Number(trip.materialCost || 0);
          if (type === 'transport-owner') summary.grossAmount += Number(trip.transportCost || 0);
          if (type === 'royalty-owner') summary.grossAmount += Number(trip.royaltyCost || 0);
        }
      }
    };

    const getCombinedPartyName = (trip: Trip) => trip.quarryName || trip.royaltyOwnerName || trip.transporterName || 'Combined';

    tripsSource.forEach(trip => {
      if (trip.customer) addSummary('vendor-customer', trip.customer, trip);

      const comboRatePerTon = getCombinedRatePerTon(materialRates, trip.id);
      const comboParties = getComboPartyTypes(materialRates, trip.id);
      const netWeight = Number(trip.netWeight || 0);
      if (comboRatePerTon > 0) {
        addSummary('combined', getCombinedPartyName(trip), trip, netWeight * comboRatePerTon);
      }

      if (trip.quarryName && (!comboRatePerTon || !comboParties.has('mine-quarry'))) {
        const rate = resolveTripRate(materialRates, trip.id, 'mine-quarry', { comboOnly: false });
        const amount = Number(rate?.ratePerTon || 0) * netWeight;
        addSummary('mine-quarry', trip.quarryName, trip, amount);
      }
      if (trip.transporterName && (!comboRatePerTon || !comboParties.has('transport-owner'))) {
        const rate = resolveTripRate(materialRates, trip.id, 'transport-owner', { comboOnly: false });
        const amount = Number(rate?.ratePerTon || 0) * netWeight;
        addSummary('transport-owner', trip.transporterName, trip, amount);
      }
      if (trip.royaltyOwnerName && (!comboRatePerTon || !comboParties.has('royalty-owner'))) {
        const rate = resolveTripRate(materialRates, trip.id, 'royalty-owner', { comboOnly: false });
        const amount = Number(rate?.ratePerTon || 0) * netWeight;
        addSummary('royalty-owner', trip.royaltyOwnerName, trip, amount);
      }
    });

    const addPayment = (type: RatePartyType | 'account' | undefined, name: string | undefined, amount: number) => {
      if (!type || !name) return;
      const key = `${type}:${name}`;
      if (!bucket.has(key)) {
        bucket.set(key, {
          key,
          type,
          name,
          trips: [],
          totalTons: 0,
          grossAmount: 0,
          paidAmount: 0,
          balance: 0,
        });
      }
    bucket.get(key)!.paidAmount += Number(amount || 0);
    };

    const resolvePaymentParty = (payment: Payment) => {
      if (payment.ratePartyType && payment.ratePartyId) {
        const match = Array.from(partyIdLookup.entries()).find(([key, id]) => key.startsWith(`${payment.ratePartyType}:`) && id === payment.ratePartyId);
        if (match) {
          const name = match[0].split(':').slice(1).join(':');
          return { type: payment.ratePartyType as RatePartyType, name };
        }
      }
      if (payment.ratePartyName) {
        const lookup = partyNameLookup.get(payment.ratePartyName.trim().toLowerCase());
        if (lookup) return { type: lookup.type, name: lookup.name };
        return { type: 'account' as const, name: payment.ratePartyName };
      }
      return null;
    };

    const addPaymentRecord = (payment: Payment) => {
      const resolved = resolvePaymentParty(payment);
      if (!resolved) return;
      const isCustomer = resolved.type === 'vendor-customer';
      const signedAmount = payment.type === PaymentType.RECEIPT
        ? (isCustomer ? payment.amount : -payment.amount)
        : (isCustomer ? -payment.amount : payment.amount);
      addPayment(resolved.type, resolved.name, signedAmount);
    };

    expensesSource.forEach(expense => {
      if (!expense.ratePartyType || !expense.ratePartyId) return;
      const match = Array.from(partyIdLookup.entries()).find(([key, id]) => key.startsWith(`${expense.ratePartyType}:`) && id === expense.ratePartyId);
      if (match) {
        const name = match[0].split(':').slice(1).join(':');
        addPayment(expense.ratePartyType, name, expense.amount);
      }
    });

    paymentsSource.forEach(payment => {
      addPaymentRecord(payment);
      if (payment.fromAccount) {
        addSummary('account', payment.fromAccount);
      }
      if (payment.toAccount) {
        addSummary('account', payment.toAccount);
      }
    });

    bucket.forEach(summary => {
      if (summary.type === 'account') {
        summary.balance = summary.grossAmount - summary.paidAmount;
      } else {
        summary.balance = summary.grossAmount - summary.paidAmount;
      }
    });

    return Array.from(bucket.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [materialRates, partyIdLookup, partyNameLookup]);

  const summaries = useMemo<RatePartySummary[]>(() => {
    return buildSummaries(filteredTrips, filteredExpenses, filteredPayments);
  }, [buildSummaries, filteredTrips, filteredExpenses, filteredPayments]);

  const historicalSummaries = useMemo<RatePartySummary[]>(() => {
    const allSummaries = buildSummaries(trips, expenses, payments);
    return allSummaries.filter(item => Math.abs(item.balance) > 0.01);
  }, [buildSummaries, trips, expenses, payments]);

  const mergeSummariesByName = useCallback((items: RatePartySummary[]) => {
    const bucket = new Map<string, { summary: RatePartySummary; types: Set<RatePartySummary['type']>; tripMap: Map<number, Trip> }>();
    items.forEach(item => {
      const key = item.name.trim().toLowerCase();
      const existing = bucket.get(key);
      if (!existing) {
        const tripMap = new Map<number, Trip>();
        item.trips.forEach(trip => tripMap.set(trip.id, trip));
        bucket.set(key, {
          summary: {
            ...item,
            key: `merged:${item.name}`,
            type: item.type,
            trips: [...item.trips],
          },
          types: new Set([item.type]),
          tripMap,
        });
        return;
      }
      item.trips.forEach(trip => existing.tripMap.set(trip.id, trip));
      existing.summary.trips = Array.from(existing.tripMap.values());
      existing.summary.grossAmount += item.grossAmount;
      existing.summary.paidAmount += item.paidAmount;
      existing.summary.balance += item.balance;
      existing.types.add(item.type);
    });
    const merged = Array.from(bucket.values()).map(({ summary, types }) => {
      summary.totalTons = summary.trips.reduce((sum, trip) => sum + Number(trip.netWeight || 0), 0);
      const typeLabel = types.size > 1 ? 'mixed' : Array.from(types)[0];
      return { ...summary, type: typeLabel };
    });
    return merged.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, []);

  const filteredSummaries = useMemo(() => mergeSummariesByName(summaries), [mergeSummariesByName, summaries]);
  const historicalMergedSummaries = useMemo(() => mergeSummariesByName(historicalSummaries), [mergeSummariesByName, historicalSummaries]);
  const visibleSummaries = activeTab === 'history' ? historicalMergedSummaries : filteredSummaries;

  const getActionLabel = (summary: RatePartySummary) => {
    const balance = summary.balance;
    if (Math.abs(balance) <= 0.01) return 'Settled';
    const isCustomer = summary.type === 'vendor-customer';
    const isSupplier = summary.type === 'mine-quarry'
      || summary.type === 'transport-owner'
      || summary.type === 'royalty-owner';
    if (isCustomer) {
      return balance > 0 ? 'Follow up to receive' : 'Refund/Adjust';
    }
    if (isSupplier) {
      return balance > 0 ? 'Pay pending' : 'Recover overpaid';
    }
    return balance < 0 ? 'Receive pending' : 'Pay pending';
  };

  const exportCsv = () => {
    if (activeTab === 'monthly') {
      const header = [
        'Activity Type',
        'Rate Party',
        'Date Range',
        'Trips',
        'Net Tons',
        'Trip Amount',
        'GST Amount',
        'Total Business Value',
        'Paid Split',
        'Total Paid',
        'Balance',
      ];
      const rows = monthlyRows.map(item => [
        MONTHLY_ACTIVITY_LABELS[item.activityType],
        item.partyName,
        item.dateRangeLabel,
        item.tripCount,
        item.netTons.toFixed(2),
        item.tripAmount.toFixed(2),
        item.gstAmount.toFixed(2),
        item.businessValue.toFixed(2),
        item.paidBySource.map(source => `${source.source}: ${source.amount.toFixed(2)}`).join(' | '),
        item.totalPaid.toFixed(2),
        item.balance.toFixed(2),
      ]);
      const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'monthly_abstract.csv';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const exportItems = activeTab === 'history' ? historicalMergedSummaries : filteredSummaries;
    const header = ['Type', 'Name/Account', 'Trips', 'Net Tons', 'Total Amount', 'Paid', 'Balance', 'Action'];
    const rows = exportItems.map(item => [
      RATE_PARTY_LABELS[item.type],
      item.name,
      item.trips.length,
      item.totalTons.toFixed(2),
      item.grossAmount.toFixed(2),
      item.paidAmount.toFixed(2),
      item.balance.toFixed(2),
      getActionLabel(item),
    ]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'logistics_accounts_reports.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = (items: RatePartySummary[]) => {
    const rows = items.map(item => [
      item.name,
      RATE_PARTY_LABELS[item.type],
      item.trips.length,
      item.totalTons.toFixed(2),
      item.grossAmount.toFixed(2),
      item.paidAmount.toFixed(2),
      item.balance.toFixed(2),
      getActionLabel(item),
    ]);
    const html = `
      <html>
        <head>
          <title>Logistics Accounts Reports</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f2f2f2; }
            h3 { margin-top: 24px; }
          </style>
        </head>
        <body>
          <h2>Logistics Accounts Reports</h2>
          <table>
            <thead>
              <tr>
                <th>Name/Account</th>
                <th>Type</th>
                <th>Trips</th>
                <th>Net Tons</th>
                <th>Total Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const popup = window.open('', '_blank', 'width=1000,height=700');
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const exportCurrentTabPdf = () => {
    if (activeTab === 'abstract') {
      exportPdf(filteredSummaries);
      return;
    }
    if (activeTab === 'history') {
      exportPdf(historicalMergedSummaries);
      return;
    }
    if (activeTab === 'monthly') {
      const html = `
        <html>
          <head>
            <title>Monthly Abstract</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: left; vertical-align: top; }
              th { background: #f2f2f2; }
              h2 { margin: 0 0 8px; }
              h3 { margin: 16px 0 6px; }
              .kpi { margin-bottom: 12px; font-size: 12px; }
            </style>
          </head>
          <body>
            <h2>Monthly Abstract</h2>
            <div class="kpi">
              Received: ${monthlyKpis.received.toFixed(2)} |
              Paid: ${monthlyKpis.paid.toFixed(2)} |
              Balance: ${monthlyKpis.balance.toFixed(2)}
            </div>
            <h3>Monthly Abstract by Party & Activity</h3>
            <table>
              <thead>
                <tr>
                  <th>Activity Type</th>
                  <th>Rate Party</th>
                  <th>Date Range</th>
                  <th>Trips</th>
                  <th>Net Tons</th>
                  <th>Trip Amount</th>
                  <th>GST Amount</th>
                  <th>Total Business Value</th>
                  <th>Paid Split</th>
                  <th>Total Paid</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                ${monthlyRows.map(item => `
                  <tr>
                    <td>${MONTHLY_ACTIVITY_LABELS[item.activityType]}</td>
                    <td>${item.partyName}</td>
                    <td>${item.dateRangeLabel}</td>
                    <td>${item.tripCount}</td>
                    <td>${item.netTons.toFixed(2)}</td>
                    <td>${item.tripAmount.toFixed(2)}</td>
                    <td>${item.gstAmount.toFixed(2)}</td>
                    <td>${item.businessValue.toFixed(2)}</td>
                    <td>${item.paidBySource.map(source => `${source.source}: ${source.amount.toFixed(2)}`).join('<br/>')}</td>
                    <td>${item.totalPaid.toFixed(2)}</td>
                    <td>${item.balance.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <h3>Bank Account Summary</h3>
            ${bankSummaries.map(summary => `
              <h4>${summary.account}</h4>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Transactions</th>
                    <th>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${summary.credits.map(item => `
                    <tr>
                      <td>Credit</td>
                      <td>${item.name}</td>
                      <td>${item.count}</td>
                      <td>${item.amount.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  ${summary.debits.map(item => `
                    <tr>
                      <td>Debit</td>
                      <td>${item.name}</td>
                      <td>${item.count}</td>
                      <td>${item.amount.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  <tr>
                    <td colspan="3"><strong>Total Credits</strong></td>
                    <td>${summary.totalCredits.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colspan="3"><strong>Total Debits</strong></td>
                    <td>${summary.totalDebits.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colspan="3"><strong>Balance</strong></td>
                    <td>${summary.balance.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            `).join('')}
          </body>
        </html>
      `;
      const popup = window.open('', '_blank', 'width=1000,height=700');
      if (!popup) return;
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
      return;
    }
    if (activeTab === 'party') {
      const html = partyExportRef.current?.buildPrintHtml();
      if (!html) return;
      const popup = window.open('', '_blank', 'width=1000,height=700');
      if (!popup) return;
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
      return;
    }
    if (activeTab === 'head') {
      const html = headExportRef.current?.buildPrintHtml();
      if (!html) return;
      const popup = window.open('', '_blank', 'width=1000,height=700');
      if (!popup) return;
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
      return;
    }
    const tabId = activeTab === 'party' ? 'ledger-tab-party' : 'ledger-tab-head';
    const content = document.getElementById(tabId);
    if (!content) return;
    const html = `
      <html>
        <head>
          <title>Logistics Accounts Reports</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f2f2f2; }
            h3 { margin-top: 24px; }
            button { display: none !important; }
          </style>
        </head>
        <body>
          <h2>Logistics Accounts Reports</h2>
          ${content.innerHTML}
        </body>
      </html>
    `;
    const popup = window.open('', '_blank', 'width=1000,height=700');
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const applyRelativeRange = (days: number) => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - days + 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    setFilters(prev => ({
      ...prev,
      dateFrom: formatDate(from),
      dateTo: formatDate(today),
    }));
  };

  const resolvePaymentParty = useCallback((payment: Payment) => {
    if (payment.ratePartyType && payment.ratePartyId) {
      const match = Array.from(partyIdLookup.entries()).find(([key, id]) => key.startsWith(`${payment.ratePartyType}:`) && id === payment.ratePartyId);
      if (match) {
        const name = match[0].split(':').slice(1).join(':');
        return { type: payment.ratePartyType as RatePartyType, name };
      }
    }
    if (payment.ratePartyName) {
      const lookup = partyNameLookup.get(payment.ratePartyName.trim().toLowerCase());
      if (lookup) return { type: lookup.type, name: lookup.name };
      return { type: 'account' as const, name: payment.ratePartyName };
    }
    return null;
  }, [partyIdLookup, partyNameLookup]);

  const monthlyRows = useMemo<MonthlyPartyRow[]>(() => {
    const bucket = new Map<string, {
      activityType: MonthlyActivityType;
      partyName: string;
      tripCount: number;
      netTons: number;
      tripAmount: number;
      gstAmount: number;
      minDate?: string;
      maxDate?: string;
      paidBySource: Map<string, number>;
      totalPaid: number;
    }>();
    const updateRange = (entry: { minDate?: string; maxDate?: string }, dateValue?: string) => {
      if (!dateValue) return;
      if (!entry.minDate || dateValue < entry.minDate) entry.minDate = dateValue;
      if (!entry.maxDate || dateValue > entry.maxDate) entry.maxDate = dateValue;
    };

    const getCombinedPartyName = (trip: Trip) => {
      return trip.customer || trip.actualVendorCustomerName || trip.quarryName || trip.transporterName || trip.royaltyOwnerName || 'Combined Activities';
    };

    const getAllInAmount = (trip: Trip) => {
      if (typeof trip.allInCost === 'number') return trip.allInCost;
      if (typeof trip.allInCostPerTon === 'number') {
        return Number(trip.netWeight || 0) * trip.allInCostPerTon;
      }
      const comboRate = getCombinedRatePerTon(materialRates, trip.id);
      if (comboRate > 0) {
        return Number(trip.netWeight || 0) * comboRate;
      }
      return Number(trip.materialCost || 0) + Number(trip.transportCost || 0) + Number(trip.royaltyCost || 0);
    };

    const addTripRow = (activityType: MonthlyActivityType, partyName: string, trip: Trip, amount: number) => {
      const key = `${activityType}:${partyName}`;
      if (!bucket.has(key)) {
        bucket.set(key, {
          activityType,
          partyName,
          tripCount: 0,
          netTons: 0,
          tripAmount: 0,
          gstAmount: 0,
          paidBySource: new Map(),
          totalPaid: 0,
        });
      }
      const entry = bucket.get(key)!;
      entry.tripCount += 1;
      entry.netTons += Number(trip.netWeight || 0);
      entry.tripAmount += amount;
      entry.gstAmount += computeTripGstAmount(trip);
      updateRange(entry, trip.date ? trip.date.split('T')[0] : undefined);
    };

    filteredTrips.forEach(trip => {
      const isCombined = trip.rateMode === 'all_in' || typeof trip.allInCostPerTon === 'number' || typeof trip.allInCost === 'number';
      if (isCombined) {
        addTripRow('combined', getCombinedPartyName(trip), trip, getAllInAmount(trip));
        return;
      }
      if (trip.quarryName) addTripRow('mine-quarry', trip.quarryName, trip, Number(trip.materialCost || 0));
      if (trip.royaltyOwnerName) addTripRow('royalty-owner', trip.royaltyOwnerName, trip, Number(trip.royaltyCost || 0));
      if (trip.transporterName) addTripRow('transport-owner', trip.transporterName, trip, Number(trip.transportCost || 0));
      if (trip.customer) addTripRow('vendor-customer', trip.customer, trip, Number(trip.revenue || 0));
    });

    const addPaymentRow = (activityType: MonthlyActivityType, partyName: string, payment: Payment) => {
      const key = `${activityType}:${partyName}`;
      if (!bucket.has(key)) {
        bucket.set(key, {
          activityType,
          partyName,
          tripCount: 0,
          netTons: 0,
          tripAmount: 0,
          gstAmount: 0,
          paidBySource: new Map(),
          totalPaid: 0,
        });
      }
      const entry = bucket.get(key)!;
      const isCustomer = activityType === 'vendor-customer';
      const isRelevant = isCustomer ? payment.type === PaymentType.RECEIPT : payment.type === PaymentType.PAYMENT;
      if (!isRelevant) return;
      const source = payment.type === PaymentType.PAYMENT
        ? (payment.fromAccount || 'Unknown')
        : (payment.toAccount || 'Unknown');
      entry.paidBySource.set(source, (entry.paidBySource.get(source) || 0) + Number(payment.amount || 0));
      entry.totalPaid += Number(payment.amount || 0);
      updateRange(entry, payment.date ? payment.date.split('T')[0] : undefined);
    };

    filteredPayments.forEach(payment => {
      const resolved = resolvePaymentParty(payment);
      if (resolved?.type && resolved?.name) {
        const activityType: MonthlyActivityType = resolved.type === 'account' ? 'others' : (resolved.type as MonthlyActivityType);
        addPaymentRow(activityType, resolved.name, payment);
        return;
      }
      const fallbackName = payment.ratePartyName || payment.toAccount || payment.fromAccount || 'Unknown';
      addPaymentRow('others', fallbackName, payment);
    });

    const rows = Array.from(bucket.values()).map(entry => {
      const dateRangeLabel = entry.minDate && entry.maxDate
        ? (() => {
          const start = new Date(entry.minDate);
          const end = new Date(entry.maxDate);
          const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return `${entry.minDate} → ${entry.maxDate} (${days} days)`;
        })()
        : '-';
      const paidBySource = Array.from(entry.paidBySource.entries())
        .map(([source, amount]) => ({ source, amount }))
        .sort((a, b) => b.amount - a.amount);
      const businessValue = entry.tripAmount + entry.gstAmount;
      const balance = entry.tripAmount - entry.totalPaid;
      return {
        key: `${entry.activityType}:${entry.partyName}`,
        activityType: entry.activityType,
        partyName: entry.partyName,
        dateRangeLabel,
        tripCount: entry.tripCount,
        netTons: entry.netTons,
        tripAmount: entry.tripAmount,
        gstAmount: entry.gstAmount,
        businessValue,
        paidBySource,
        totalPaid: entry.totalPaid,
        balance,
      };
    });

    return rows.sort((a, b) => b.businessValue - a.businessValue);
  }, [filteredTrips, filteredPayments, materialRates, resolvePaymentParty]);

  const monthlyKpis = useMemo(() => {
    const received = filteredPayments
      .filter(payment => payment.type === PaymentType.RECEIPT)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const paid = filteredPayments
      .filter(payment => payment.type === PaymentType.PAYMENT)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return {
      received,
      paid,
      balance: received - paid,
    };
  }, [filteredPayments]);

  const bankSummaries = useMemo<BankSummary[]>(() => {
    const accounts = new Set<string>();
    filteredPayments.forEach(payment => {
      if (payment.fromAccount) accounts.add(payment.fromAccount);
      if (payment.toAccount) accounts.add(payment.toAccount);
    });

    const groupByName = (items: Payment[], getName: (payment: Payment) => string) => {
      const map = new Map<string, { name: string; count: number; amount: number }>();
      items.forEach(payment => {
        const name = getName(payment);
        if (!map.has(name)) {
          map.set(name, { name, count: 0, amount: 0 });
        }
        const entry = map.get(name)!;
        entry.count += 1;
        entry.amount += Number(payment.amount || 0);
      });
      return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    };

    return Array.from(accounts.values()).sort().map(account => {
      const credits = filteredPayments.filter(payment => payment.type === PaymentType.RECEIPT && payment.toAccount === account);
      const debits = filteredPayments.filter(payment => payment.type === PaymentType.PAYMENT && payment.fromAccount === account);
      const creditRows = groupByName(credits, payment => payment.ratePartyName || payment.fromAccount || 'Unknown');
      const debitRows = groupByName(debits, payment => payment.ratePartyName || payment.toAccount || 'Unknown');
      const totalCredits = creditRows.reduce((sum, item) => sum + item.amount, 0);
      const totalDebits = debitRows.reduce((sum, item) => sum + item.amount, 0);
      return {
        account,
        credits: creditRows,
        debits: debitRows,
        totalCredits,
        totalDebits,
        balance: totalCredits - totalDebits,
      };
    });
  }, [filteredPayments]);

  return (
    <div>
      <PageHeader
        title="Logistics Accounts Reports"
        subtitle="Rate party balances, trips, and payments summary"
        filters={filters}
        onFilterChange={setFilters}
        filterData={{ vehicles: [], transportOwners: [], customers: [], quarries: [], royaltyOwners: [] }}
        showFilters={[]}
        showMoreFilters={[]}
        pageAction={{ label: 'Export CSV', action: exportCsv }}
        secondaryAction={{ label: 'Export PDF', action: exportCurrentTabPdf }}
        headerRight={activeTab === 'history' ? undefined : (
          <div className="rounded-xl border border-gray-200/60 bg-white/90 dark:bg-gray-900/70 dark:border-gray-700/60 shadow-md px-3 py-2">
            {filtersOpen ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Date From</label>
                    <input
                      type="date"
                      inputMode="numeric"
                      onKeyDown={allowDateTyping}
                      onClick={openDatePicker}
                      className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.dateFrom || ''}
                      onChange={e => updateDraft('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 dark:text-gray-400">Date To</label>
                    <input
                      type="date"
                      inputMode="numeric"
                      onKeyDown={allowDateTyping}
                      onClick={openDatePicker}
                      className="w-full h-7 text-[11px] px-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={draftFilters.dateTo || ''}
                      onChange={e => updateDraft('dateTo', e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={applyDraftFilters}
                    className="h-7 px-3 rounded-md text-[11px] font-medium text-white bg-primary hover:bg-primary-dark"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={resetDraftFilters}
                    className="h-7 px-3 rounded-md text-[11px] font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="h-7 px-3 rounded-md text-[11px] font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Hide
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <ion-icon name="chevron-down-outline"></ion-icon>
                  Show Filters
                </button>
              </div>
            )}
          </div>
        )}
      />
      <main className="pt-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'history' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Historical Abstract
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('abstract')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'abstract' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Abstract
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monthly')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'monthly' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Monthly Abstract
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('party')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'party' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Name / Account
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('head')}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === 'head' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            Head Account
          </button>
        </div>

        {(activeTab === 'party' || activeTab === 'head') && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Quick Range:</span>
            <button type="button" onClick={() => applyRelativeRange(30)} className="rounded-md border border-gray-300 px-3 py-1 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">Last 30 Days</button>
            <button type="button" onClick={() => applyRelativeRange(60)} className="rounded-md border border-gray-300 px-3 py-1 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">Last 60 Days</button>
            <button type="button" onClick={() => applyRelativeRange(90)} className="rounded-md border border-gray-300 px-3 py-1 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">Last Quarter</button>
          </div>
        )}

        {activeTab === 'abstract' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Name/Account', 'Type', 'Trips', 'Net Tons', 'Total Amount', 'Paid', 'Balance', 'Action'].map(header => (
                      <th key={header} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleSummaries.map(item => (
                    <tr key={item.key} className="bg-white dark:bg-gray-800">
                      <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-300">{RATE_PARTY_LABELS[item.type]}</td>
                      <td className="px-6 py-3 text-sm">{item.trips.length}</td>
                      <td className="px-6 py-3 text-sm">{item.totalTons.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm">{item.grossAmount.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm text-green-500">{item.paidAmount.toFixed(2)}</td>
                      <td className={`px-6 py-3 text-sm font-semibold ${item.balance >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {item.balance.toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">{getActionLabel(item)}</td>
                    </tr>
                  ))}
                  {visibleSummaries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-6 text-center text-sm text-gray-500">
                        {activeTab === 'history' ? 'No outstanding balances found.' : 'No data available for this date range.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'monthly' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Total Received', value: monthlyKpis.received, tone: 'text-emerald-500' },
                { label: 'Total Paid', value: monthlyKpis.paid, tone: 'text-red-500' },
                { label: 'Balance', value: monthlyKpis.balance, tone: 'text-blue-500' },
              ].map(card => (
                <div key={card.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.label}</div>
                  <div className={`text-lg font-semibold ${card.tone}`}>{card.value.toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                Monthly Abstract by Party & Activity
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                    <tr>
                      {['Activity', 'Rate Party', 'Date Range', 'Trips', 'Net Tons', 'Trip Amount', 'GST Amount', 'Total Value', 'Paid Split', 'Total Paid', 'Balance'].map(header => (
                        <th key={header} className="px-4 py-2 text-left font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {monthlyRows.map(item => (
                      <tr key={item.key} className="bg-white dark:bg-gray-800">
                        <td className="px-4 py-2">{MONTHLY_ACTIVITY_LABELS[item.activityType]}</td>
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{item.partyName}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-300">{item.dateRangeLabel}</td>
                        <td className="px-4 py-2">{item.tripCount}</td>
                        <td className="px-4 py-2">{item.netTons.toFixed(2)}</td>
                        <td className="px-4 py-2">{item.tripAmount.toFixed(2)}</td>
                        <td className="px-4 py-2">{item.gstAmount.toFixed(2)}</td>
                        <td className="px-4 py-2">{item.businessValue.toFixed(2)}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-300">
                          {item.paidBySource.length > 0
                            ? item.paidBySource.map(source => (
                              <div key={`${item.key}-${source.source}`}>{source.source}: {source.amount.toFixed(2)}</div>
                            ))
                            : '-'}
                        </td>
                        <td className="px-4 py-2 text-emerald-500">{item.totalPaid.toFixed(2)}</td>
                        <td className={`px-4 py-2 font-semibold ${item.balance >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {item.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {monthlyRows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-6 py-6 text-center text-sm text-gray-500">
                          No data available for this date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Bank Account Summary</div>
              {bankSummaries.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-300">No bank transactions in this date range.</div>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {bankSummaries.map(summary => (
                  <div key={summary.account} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md overflow-hidden">
                    <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {summary.account}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold">Type</th>
                            <th className="px-4 py-2 text-left font-semibold">Name</th>
                            <th className="px-4 py-2 text-left font-semibold">Transactions</th>
                            <th className="px-4 py-2 text-left font-semibold">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {summary.credits.map(item => (
                            <tr key={`credit-${summary.account}-${item.name}`} className="bg-white dark:bg-gray-800">
                              <td className="px-4 py-2 text-emerald-500">Credit</td>
                              <td className="px-4 py-2">{item.name}</td>
                              <td className="px-4 py-2">{item.count}</td>
                              <td className="px-4 py-2">{item.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                          {summary.debits.map(item => (
                            <tr key={`debit-${summary.account}-${item.name}`} className="bg-white dark:bg-gray-800">
                              <td className="px-4 py-2 text-red-500">Debit</td>
                              <td className="px-4 py-2">{item.name}</td>
                              <td className="px-4 py-2">{item.count}</td>
                              <td className="px-4 py-2">{item.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 dark:bg-gray-900/40">
                            <td className="px-4 py-2 font-semibold" colSpan={3}>Total Credits</td>
                            <td className="px-4 py-2 font-semibold">{summary.totalCredits.toFixed(2)}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-900/40">
                            <td className="px-4 py-2 font-semibold" colSpan={3}>Total Debits</td>
                            <td className="px-4 py-2 font-semibold">{summary.totalDebits.toFixed(2)}</td>
                          </tr>
                          <tr className="bg-gray-50 dark:bg-gray-900/40">
                            <td className="px-4 py-2 font-semibold" colSpan={3}>Balance</td>
                            <td className="px-4 py-2 font-semibold">{summary.balance.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Name/Account', 'Type', 'Trips', 'Net Tons', 'Total Amount', 'Paid', 'Balance', 'Action'].map(header => (
                      <th key={header} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleSummaries.map(item => (
                    <tr key={item.key} className="bg-white dark:bg-gray-800">
                      <td className="px-6 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-300">{RATE_PARTY_LABELS[item.type]}</td>
                      <td className="px-6 py-3 text-sm">{item.trips.length}</td>
                      <td className="px-6 py-3 text-sm">{item.totalTons.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm">{item.grossAmount.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm text-green-500">{item.paidAmount.toFixed(2)}</td>
                      <td className={`px-6 py-3 text-sm font-semibold ${item.balance >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {item.balance.toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">{getActionLabel(item)}</td>
                    </tr>
                  ))}
                  {visibleSummaries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-6 text-center text-sm text-gray-500">
                        No outstanding balances found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'party' && (
          <div id="ledger-tab-party">
            <AccountReconciliation
              ref={partyExportRef}
              initialMode="party"
              hideModeToggle
              hideDownload
              hidePrint
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
            />
          </div>
        )}

        {activeTab === 'head' && (
          <div id="ledger-tab-head">
            <AccountReconciliation
              ref={headExportRef}
              initialMode="head"
              hideModeToggle
              hideDownload
              hidePrint
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default AccountLedgerOverview;
