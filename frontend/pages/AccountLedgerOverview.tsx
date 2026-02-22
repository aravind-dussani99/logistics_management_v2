import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import PageHeader from '../components/PageHeader';
import { Filters } from '../components/FilterPanel';
import AccountReconciliation, { AccountReconciliationHandle } from './AccountReconciliation';
import { useData } from '../contexts/DataContext';
import { dailyExpenseApi } from '../services/dailyExpenseApi';
import { DailyExpense, Payment, PaymentType, RatePartyType, Trip } from '../types';
import { computeTripGstAmount, formatCurrency, getCombinedRatePerTon, getComboPartyTypes, resolveTripRate } from '../utils';

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

type MonthlyExtractSectionKey = 'individual' | 'two-plus-one' | 'two-activities' | 'all-activities';

type MonthlyExtractPartyRow = {
  key: string;
  personName: string;
  materialTypes: string[];
  tripCount: number;
  totalQty: number;
  totalAmount: number;
  paidOrReceived: number;
  pending: number;
  overpaid: number;
  remarks: string;
  partyRole: 'rate-party' | 'end-customer';
};

type MonthlyExtractNonTripRow = {
  key: string;
  personName: string;
  txType: 'Receipt' | 'Payment';
  txCount: number;
  amount: number;
  accounts: Array<{ account: string; amount: number }>;
};

type MonthlyExtractGstRow = {
  key: string;
  name: string;
  count: number;
  qty: number;
  gstAmount: number;
  direction: 'payable' | 'receivable';
};

type MonthlyExtractBankFlowRow = {
  account: string;
  txCount: number;
  amount: number;
  counterparties: Array<{ name: string; txCount: number; amount: number }>;
};

type MonthlyExtractMonthReport = {
  monthKey: string;
  monthLabel: string;
  tripsCount: number;
  totalQty: number;
  totalCredits: number;
  totalDebits: number;
  netBankMovement: number;
  creditSummary: MonthlyExtractBankFlowRow[];
  debitSummary: MonthlyExtractBankFlowRow[];
  activityTables: Record<MonthlyExtractSectionKey, MonthlyExtractPartyRow[]>;
  endCustomerRows: MonthlyExtractPartyRow[];
  nonTripRows: MonthlyExtractNonTripRow[];
  ratePartyGstRows: MonthlyExtractGstRow[];
  endCustomerGstRows: MonthlyExtractGstRow[];
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

const normalizePartyToken = (value?: string) => (value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

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

  const getTripAmountBreakdown = useCallback((trip: Trip) => {
    const netWeight = Number(trip.netWeight || 0);
    const comboRatePerTon = getCombinedRatePerTon(materialRates, trip.id);
    const comboParties = getComboPartyTypes(materialRates, trip.id);

    const latestMineRate = resolveTripRate(materialRates, trip.id, 'mine-quarry');
    const latestTransportRate = resolveTripRate(materialRates, trip.id, 'transport-owner');
    const latestRoyaltyRate = resolveTripRate(materialRates, trip.id, 'royalty-owner');
    const mineCoveredByCombo = comboParties.has('mine-quarry');
    const transportCoveredByCombo = comboParties.has('transport-owner');
    const royaltyCoveredByCombo = comboParties.has('royalty-owner');

    const mineRate = resolveTripRate(materialRates, trip.id, 'mine-quarry', { comboOnly: false });
    const transportRate = resolveTripRate(materialRates, trip.id, 'transport-owner', { comboOnly: false });
    const royaltyRate = resolveTripRate(materialRates, trip.id, 'royalty-owner', { comboOnly: false });

    const materialFallback = Number(trip.materialCost || 0);
    const transportFallback = Number(trip.transportCost || 0);
    const royaltyFallback = Number(trip.royaltyCost || 0);
    const mineAmount = trip.quarryName && !mineCoveredByCombo
      ? (mineRate ? Number(mineRate.ratePerTon || 0) * netWeight : materialFallback)
      : 0;
    const transportAmount = trip.transporterName && !transportCoveredByCombo
      ? (transportRate ? Number(transportRate.ratePerTon || 0) * netWeight : transportFallback)
      : 0;
    const royaltyAmount = trip.royaltyOwnerName && !royaltyCoveredByCombo
      ? (royaltyRate ? Number(royaltyRate.ratePerTon || 0) * netWeight : royaltyFallback)
      : 0;
    const comboAmount = comboRatePerTon > 0 ? netWeight * comboRatePerTon : 0;
    const comboPartyNames = Array.from(new Set([
      mineCoveredByCombo ? (latestMineRate?.ratePartyName || trip.quarryName || '') : '',
      transportCoveredByCombo ? (latestTransportRate?.ratePartyName || trip.transporterName || '') : '',
      royaltyCoveredByCombo ? (latestRoyaltyRate?.ratePartyName || trip.royaltyOwnerName || '') : '',
    ].filter(Boolean)));

    return {
      netWeight,
      comboAmount,
      mineAmount,
      transportAmount,
      royaltyAmount,
      minePartyName: latestMineRate?.ratePartyName || trip.quarryName || '',
      transportPartyName: latestTransportRate?.ratePartyName || trip.transporterName || '',
      royaltyPartyName: latestRoyaltyRate?.ratePartyName || trip.royaltyOwnerName || '',
      comboPartyName: comboPartyNames.length === 1 ? comboPartyNames[0] : '',
      mineCoveredByCombo,
      transportCoveredByCombo,
      royaltyCoveredByCombo,
    };
  }, [materialRates]);

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

    const getCombinedPartyName = (trip: Trip, comboPartyName?: string) =>
      comboPartyName || trip.quarryName || trip.royaltyOwnerName || trip.transporterName || 'Combined';

    tripsSource.forEach(trip => {
      if (trip.customer) addSummary('vendor-customer', trip.customer, trip);
      const amounts = getTripAmountBreakdown(trip);
      if (amounts.comboAmount > 0) {
        addSummary('combined', getCombinedPartyName(trip, amounts.comboPartyName), trip, amounts.comboAmount);
      }
      if (amounts.minePartyName && !amounts.mineCoveredByCombo) {
        addSummary('mine-quarry', amounts.minePartyName, trip, amounts.mineAmount);
      }
      if (amounts.transportPartyName && !amounts.transportCoveredByCombo) {
        addSummary('transport-owner', amounts.transportPartyName, trip, amounts.transportAmount);
      }
      if (amounts.royaltyPartyName && !amounts.royaltyCoveredByCombo) {
        addSummary('royalty-owner', amounts.royaltyPartyName, trip, amounts.royaltyAmount);
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
  }, [getTripAmountBreakdown, partyIdLookup, partyNameLookup]);

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

  const getBalanceToneClass = (summary: RatePartySummary) => {
    const action = getActionLabel(summary).toLowerCase();
    if (action === 'settled') return 'text-green-500';
    if (action.includes('receive') || action.includes('under received')) return 'text-red-500';
    if (action.includes('pay') || action.includes('over received')) return 'text-amber-600';
    return summary.balance >= 0 ? 'text-red-500' : 'text-amber-600';
  };

  const exportCsv = () => {
    if (activeTab === 'monthly') {
      const csvRows: Array<Array<string | number>> = [];
      csvRows.push(['Monthly Extract']);
      csvRows.push(['Selected Date Range', selectedDateRangeLabel]);
      csvRows.push(['Selected Months', selectedMonthRangeLabel]);
      csvRows.push(['Total Received', monthlyKpis.received.toFixed(2), 'Total Paid', monthlyKpis.paid.toFixed(2), 'Balance', monthlyKpis.balance.toFixed(2)]);
      csvRows.push([]);

      const pushPartyTable = (title: string, rows: MonthlyExtractPartyRow[], isEndCustomer = false) => {
        if (rows.length === 0) return;
        csvRows.push([title]);
        csvRows.push(['S. No.', 'Person Name', 'Material Types', 'Trips', 'Total Qty', 'Total Amount', isEndCustomer ? 'Received' : 'Paid', 'Pending', 'Overpaid', 'Remarks']);
        rows.forEach((row, index) => {
          csvRows.push([
            index + 1,
            row.personName,
            row.materialTypes.length ? row.materialTypes.join(', ') : '-',
            row.tripCount,
            row.totalQty.toFixed(2),
            row.totalAmount.toFixed(2),
            row.paidOrReceived.toFixed(2),
            row.pending.toFixed(2),
            row.overpaid.toFixed(2),
            row.remarks,
          ]);
        });
        csvRows.push([]);
      };

      const pushBankFlow = (title: string, rows: MonthlyExtractBankFlowRow[], counterpartyLabel: string) => {
        if (rows.length === 0) return;
        const summaryMap = new Map<string, { name: string; txCount: number; amount: number }>();
        rows.forEach(row => {
          row.counterparties.forEach(cp => {
            const key = cp.name.trim().toLowerCase();
            const item = summaryMap.get(key) || { name: cp.name, txCount: 0, amount: 0 };
            item.txCount += cp.txCount;
            item.amount += cp.amount;
            summaryMap.set(key, item);
          });
        });
        const summaryRows = Array.from(summaryMap.values()).sort((a, b) => b.amount - a.amount);
        if (summaryRows.length === 0) return;
        csvRows.push([title]);
        csvRows.push(['S. No.', counterpartyLabel, 'Transactions', 'Total Amount']);
        summaryRows.forEach((row, index) => csvRows.push([
          index + 1,
          row.name,
          row.txCount,
          row.amount.toFixed(2),
        ]));
        csvRows.push([]);
      };

      const pushGst = (title: string, rows: MonthlyExtractGstRow[]) => {
        if (rows.length === 0) return;
        csvRows.push([title]);
        csvRows.push(['S. No.', 'Name', 'Trips', 'Qty', 'GST Amount']);
        rows.forEach((row, index) => csvRows.push([index + 1, row.name, row.count, row.qty.toFixed(2), row.gstAmount.toFixed(2)]));
        csvRows.push([]);
      };

      const pushNonTrip = (rows: MonthlyExtractNonTripRow[]) => {
        if (rows.length === 0) return;
        csvRows.push(['Other / Non-Trip Transactions']);
        csvRows.push(['S. No.', 'Person / Name', 'Type', 'Transactions', 'Amount', 'Account Split']);
        rows.forEach((row, index) => csvRows.push([
          index + 1,
          row.personName,
          row.txType,
          row.txCount,
          row.amount.toFixed(2),
          row.accounts.map(item => `${item.account}: ${item.amount.toFixed(2)}`).join(' | '),
        ]));
        csvRows.push([]);
      };

      if (monthlyExtractCombinedReport) {
        csvRows.push(['Selected Range Summary']);
        csvRows.push([
          'Trips', monthlyExtractCombinedReport.tripsCount,
          'Qty', monthlyExtractCombinedReport.totalQty.toFixed(2),
          'Credits', monthlyExtractCombinedReport.totalCredits.toFixed(2),
          'Debits', monthlyExtractCombinedReport.totalDebits.toFixed(2),
          'Net', monthlyExtractCombinedReport.netBankMovement.toFixed(2),
        ]);
        csvRows.push([]);
        pushBankFlow('Credits Summary', monthlyExtractCombinedReport.creditSummary, 'From');
        pushBankFlow('Debits Summary', monthlyExtractCombinedReport.debitSummary, 'To');
        (['individual', 'two-plus-one', 'all-activities', 'two-activities'] as MonthlyExtractSectionKey[]).forEach(sectionKey => {
          pushPartyTable(`${activitySectionTitles[sectionKey]} - Rate Parties`, monthlyExtractCombinedReport.activityTables[sectionKey], false);
        });
        pushPartyTable('End Customer Summary', monthlyExtractCombinedReport.endCustomerRows, true);
        pushGst('Rate Party GST Summary (Payable)', monthlyExtractCombinedReport.ratePartyGstRows);
        pushGst('End Customer GST Summary (Receivable)', monthlyExtractCombinedReport.endCustomerGstRows);
        pushNonTrip(monthlyExtractCombinedReport.nonTripRows);
      }

      const csv = csvRows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'monthly_extract.csv';
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
      const renderPdfSimpleTable = (headers: string[], rows: string[][], emptyText: string) => `
        <table>
          <thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.length > 0
              ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')
              : `<tr><td colspan="${headers.length}">${emptyText}</td></tr>`}
          </tbody>
        </table>
      `;

      const renderPdfPartyTable = (title: string, rows: MonthlyExtractPartyRow[], isEndCustomer = false) => `
        <h4>${title}</h4>
        ${renderPdfSimpleTable(
          ['S. No.', 'Person Name', 'Material Types', 'Trips', 'Total Qty', 'Total Amount', isEndCustomer ? 'Received' : 'Paid', 'Pending', 'Overpaid', 'Remarks'],
          rows.map((row, index) => [
            String(index + 1),
            row.personName,
            row.materialTypes.length ? row.materialTypes.join(', ') : '-',
            String(row.tripCount),
            row.totalQty.toFixed(2),
            formatCurrency(row.totalAmount),
            formatCurrency(row.paidOrReceived),
            formatCurrency(row.pending),
            formatCurrency(row.overpaid),
            row.remarks,
          ]),
          'No records for this section in this month.',
        )}
      `;

      const renderPdfGstTable = (title: string, rows: MonthlyExtractGstRow[]) => `
        <h4>${title}</h4>
        ${renderPdfSimpleTable(
          ['S. No.', 'Name', 'Trips', 'Qty', 'GST Amount'],
          rows.map((row, index) => [
            String(index + 1),
            row.name,
            String(row.count),
            row.qty.toFixed(2),
            formatCurrency(row.gstAmount),
          ]),
          'No GST rows in this month.',
        )}
      `;

      const renderPdfNonTripTable = (rows: MonthlyExtractNonTripRow[]) => `
        <h4>Other / Non-Trip Transactions</h4>
        ${renderPdfSimpleTable(
          ['S. No.', 'Person / Name', 'Type', 'Transactions', 'Amount', 'Account Split'],
          rows.map((row, index) => [
            String(index + 1),
            row.personName,
            row.txType,
            String(row.txCount),
            formatCurrency(row.amount),
            row.accounts.map(item => `${item.account}: ${formatCurrency(item.amount)}`).join(' | '),
          ]),
          'No non-trip transactions in this month.',
        )}
      `;

      const html = `
        <html>
          <head>
            <title>Monthly Extract</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              .month-block { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin-top: 16px; }
              .month-head { margin-bottom: 8px; }
              .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 8px 0 12px; }
              .kpi-card { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: left; vertical-align: top; }
              th { background: #f2f2f2; }
              h2 { margin: 0 0 8px; }
              h3 { margin: 16px 0 6px; }
              h4 { margin: 14px 0 6px; font-size: 12px; }
              .kpi { margin-bottom: 12px; font-size: 12px; }
            </style>
          </head>
          <body>
            <h2>Monthly Extract</h2>
            <div class="kpi">
              Selected Date Range: ${selectedDateRangeLabel}<br/>
              Selected Months: ${selectedMonthRangeLabel}<br/>
              Received: ${formatCurrency(monthlyKpis.received)} |
              Paid: ${formatCurrency(monthlyKpis.paid)} |
              Balance: ${formatCurrency(monthlyKpis.balance)}
            </div>
            ${monthlyExtractCombinedReport ? `
              <div class="month-block">
                <div class="month-head">
                  <h3 style="margin:0;">Selected Range Summary (${selectedMonthRangeLabel})</h3>
                  <div style="font-size:12px;color:#4b5563;">Trips: ${monthlyExtractCombinedReport.tripsCount} · Qty: ${monthlyExtractCombinedReport.totalQty.toFixed(2)}</div>
                </div>
                <div class="kpi-grid">
                  <div class="kpi-card"><strong>Total Credits</strong><br/>${formatCurrency(monthlyExtractCombinedReport.totalCredits)}</div>
                  <div class="kpi-card"><strong>Total Debits</strong><br/>${formatCurrency(monthlyExtractCombinedReport.totalDebits)}</div>
                  <div class="kpi-card"><strong>Net Movement</strong><br/>${formatCurrency(monthlyExtractCombinedReport.netBankMovement)}</div>
                </div>
                ${(() => {
                  const map = new Map<string, { name: string; txCount: number; amount: number }>();
                  monthlyExtractCombinedReport.creditSummary.forEach(row => {
                    row.counterparties.forEach(cp => {
                      const key = cp.name.trim().toLowerCase();
                      const item = map.get(key) || { name: cp.name, txCount: 0, amount: 0 };
                      item.txCount += cp.txCount;
                      item.amount += cp.amount;
                      map.set(key, item);
                    });
                  });
                  const summaryRows = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
                  return summaryRows.length > 0 ? `
                    <h4>Credits Summary · ${formatCurrency(summaryRows.reduce((sum, row) => sum + row.amount, 0))}</h4>
                    ${renderPdfSimpleTable(
                      ['S. No.', 'From', 'Transactions', 'Total Amount'],
                      summaryRows.map((row, index) => [String(index + 1), row.name, String(row.txCount), formatCurrency(row.amount)]),
                      'No credits for selected date range.',
                    )}
                  ` : '';
                })()}
                ${(() => {
                  const map = new Map<string, { name: string; txCount: number; amount: number }>();
                  monthlyExtractCombinedReport.debitSummary.forEach(row => {
                    row.counterparties.forEach(cp => {
                      const key = cp.name.trim().toLowerCase();
                      const item = map.get(key) || { name: cp.name, txCount: 0, amount: 0 };
                      item.txCount += cp.txCount;
                      item.amount += cp.amount;
                      map.set(key, item);
                    });
                  });
                  const summaryRows = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
                  return summaryRows.length > 0 ? `
                    <h4>Debits Summary · ${formatCurrency(summaryRows.reduce((sum, row) => sum + row.amount, 0))}</h4>
                    ${renderPdfSimpleTable(
                      ['S. No.', 'To', 'Transactions', 'Total Amount'],
                      summaryRows.map((row, index) => [String(index + 1), row.name, String(row.txCount), formatCurrency(row.amount)]),
                      'No debits for selected date range.',
                    )}
                  ` : '';
                })()}
                ${(['individual', 'two-plus-one', 'all-activities', 'two-activities'] as MonthlyExtractSectionKey[]).map(sectionKey =>
                  monthlyExtractCombinedReport.activityTables[sectionKey].length > 0
                    ? renderPdfPartyTable(`${activitySectionTitles[sectionKey]} - Rate Parties`, monthlyExtractCombinedReport.activityTables[sectionKey], false)
                    : ''
                ).join('')}
                ${monthlyExtractCombinedReport.endCustomerRows.length > 0 ? renderPdfPartyTable('End Customer Summary', monthlyExtractCombinedReport.endCustomerRows, true) : ''}
                ${monthlyExtractCombinedReport.ratePartyGstRows.length > 0 ? renderPdfGstTable('Rate Party GST Summary (Payable)', monthlyExtractCombinedReport.ratePartyGstRows) : ''}
                ${monthlyExtractCombinedReport.endCustomerGstRows.length > 0 ? renderPdfGstTable('End Customer GST Summary (Receivable)', monthlyExtractCombinedReport.endCustomerGstRows) : ''}
                ${monthlyExtractCombinedReport.nonTripRows.length > 0 ? renderPdfNonTripTable(monthlyExtractCombinedReport.nonTripRows) : ''}
              </div>
            ` : '<p>No monthly data available for this date range.</p>'}
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
      const amounts = getTripAmountBreakdown(trip);
      if (amounts.comboAmount > 0) addTripRow('combined', getCombinedPartyName(trip, amounts.comboPartyName), trip, amounts.comboAmount);
      if (amounts.minePartyName && !amounts.mineCoveredByCombo) addTripRow('mine-quarry', amounts.minePartyName, trip, amounts.mineAmount);
      if (amounts.royaltyPartyName && !amounts.royaltyCoveredByCombo) addTripRow('royalty-owner', amounts.royaltyPartyName, trip, amounts.royaltyAmount);
      if (amounts.transportPartyName && !amounts.transportCoveredByCombo) addTripRow('transport-owner', amounts.transportPartyName, trip, amounts.transportAmount);
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
  }, [filteredTrips, filteredPayments, materialRates, resolvePaymentParty, getTripAmountBreakdown]);

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

  const monthlyExtractReports = useMemo<MonthlyExtractMonthReport[]>(() => {
    const monthMap = new Map<string, { trips: Trip[]; payments: Payment[] }>();

    const getMonthKey = (dateValue?: string) => {
      if (!dateValue) return '';
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return '';
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    };

    const getMonthLabel = (monthKey: string) => {
      const [year, month] = monthKey.split('-').map(Number);
      const date = new Date(year, (month || 1) - 1, 1);
      return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    };

    const ensureMonth = (monthKey: string) => {
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { trips: [], payments: [] });
      return monthMap.get(monthKey)!;
    };

    filteredTrips.forEach(trip => {
      const key = getMonthKey(trip.date);
      if (!key) return;
      ensureMonth(key).trips.push(trip);
    });

    filteredPayments.forEach(payment => {
      const key = getMonthKey(payment.date);
      if (!key) return;
      ensureMonth(key).payments.push(payment);
    });

    const buildModeKey = (trip: Trip): MonthlyExtractSectionKey => {
      const comboTypes = getComboPartyTypes(materialRates, trip.id);
      if (comboTypes.size >= 3) return 'all-activities';
      if (comboTypes.size === 2) {
        const presentTypes = [
          trip.quarryName ? 'mine-quarry' : null,
          trip.transporterName ? 'transport-owner' : null,
          trip.royaltyOwnerName ? 'royalty-owner' : null,
        ].filter(Boolean);
        return presentTypes.length > 2 ? 'two-plus-one' : 'two-activities';
      }
      return 'individual';
    };

    const buildComboPartyDisplayName = (trip: Trip, breakdown: ReturnType<typeof getTripAmountBreakdown>) => {
      if (breakdown.comboPartyName) return breakdown.comboPartyName;
      const names = [
        breakdown.mineCoveredByCombo ? (breakdown.minePartyName || trip.quarryName || '') : '',
        breakdown.transportCoveredByCombo ? (breakdown.transportPartyName || trip.transporterName || '') : '',
        breakdown.royaltyCoveredByCombo ? (breakdown.royaltyPartyName || trip.royaltyOwnerName || '') : '',
      ].filter(Boolean);
      return names.length ? names.join(' + ') : 'Combined Activities';
    };

    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, grouped]) => {
        const monthTrips = grouped.trips;
        const monthPayments = grouped.payments;

        const supplierPaymentMap = new Map<string, number>();
        const customerReceiptMap = new Map<string, number>();

        monthPayments.forEach(payment => {
          const resolved = resolvePaymentParty(payment);
          const amount = Number(payment.amount || 0);
          const name = (resolved?.name || payment.ratePartyName || 'Unknown').trim();

          if (resolved?.type === 'vendor-customer') {
            if (payment.type === PaymentType.RECEIPT) {
              const key = normalizePartyToken(name);
              customerReceiptMap.set(key, (customerReceiptMap.get(key) || 0) + amount);
            }
            return;
          }

          if (payment.type === PaymentType.PAYMENT && name) {
            const key = normalizePartyToken(name);
            supplierPaymentMap.set(key, (supplierPaymentMap.get(key) || 0) + amount);
          }
        });

        type MonthlyPartyAccumRow = Omit<MonthlyExtractPartyRow, 'pending' | 'overpaid' | 'remarks' | 'materialTypes'> & {
          materialTypes: Set<string>;
        };
        const makePartyRowBucket = () => new Map<string, MonthlyPartyAccumRow>();
        const activityBuckets: Record<MonthlyExtractSectionKey, ReturnType<typeof makePartyRowBucket>> = {
          individual: makePartyRowBucket(),
          'two-plus-one': makePartyRowBucket(),
          'two-activities': makePartyRowBucket(),
          'all-activities': makePartyRowBucket(),
        };
        const endCustomerBucket = new Map<string, Omit<MonthlyExtractPartyRow, 'pending' | 'overpaid' | 'remarks'>>();
        const tripRelatedNames = new Set<string>();
        const ratePartyGstBucket = new Map<string, MonthlyExtractGstRow>();
        const endCustomerGstBucket = new Map<string, MonthlyExtractGstRow>();

        const addActivityParty = (
          modeKey: MonthlyExtractSectionKey,
          personName: string,
          qty: number,
          amount: number,
          role: 'rate-party' | 'end-customer',
          materialType?: string,
        ) => {
          const cleanName = (personName || 'Unknown').trim() || 'Unknown';
          tripRelatedNames.add(normalizePartyToken(cleanName));
          const bucket = role === 'end-customer' ? endCustomerBucket : activityBuckets[modeKey];
          const key = `${role}:${cleanName}`;
          if (!bucket.has(key)) {
            bucket.set(key, {
              key,
              personName: cleanName,
              materialTypes: new Set<string>(),
              tripCount: 0,
              totalQty: 0,
              totalAmount: 0,
              paidOrReceived: 0,
              partyRole: role,
            });
          }
          const row = bucket.get(key)!;
          row.tripCount += 1;
          row.totalQty += qty;
          row.totalAmount += amount;
          const cleanMaterial = (materialType || '').trim();
          if (cleanMaterial) row.materialTypes.add(cleanMaterial);
        };

        const addGstRow = (
          bucket: Map<string, MonthlyExtractGstRow>,
          name: string,
          qty: number,
          gstAmount: number,
          direction: 'payable' | 'receivable',
        ) => {
          if (gstAmount <= 0) return;
          const cleanName = (name || 'Unknown').trim() || 'Unknown';
          const key = `${direction}:${cleanName}`;
          if (!bucket.has(key)) {
            bucket.set(key, { key, name: cleanName, count: 0, qty: 0, gstAmount: 0, direction });
          }
          const row = bucket.get(key)!;
          row.count += 1;
          row.qty += qty;
          row.gstAmount += gstAmount;
        };

        monthTrips.forEach(trip => {
          const qty = Number(trip.netWeight || 0);
          const modeKey = buildModeKey(trip);
          const breakdown = getTripAmountBreakdown(trip);

          if (breakdown.comboAmount > 0) {
            addActivityParty(modeKey, buildComboPartyDisplayName(trip, breakdown), qty, breakdown.comboAmount, 'rate-party', trip.material);
          }
          if (breakdown.minePartyName && !breakdown.mineCoveredByCombo && breakdown.mineAmount > 0) {
            addActivityParty(modeKey, breakdown.minePartyName, qty, breakdown.mineAmount, 'rate-party', trip.material);
          }
          if (breakdown.transportPartyName && !breakdown.transportCoveredByCombo && breakdown.transportAmount > 0) {
            addActivityParty(modeKey, breakdown.transportPartyName, qty, breakdown.transportAmount, 'rate-party', trip.material);
          }
          if (breakdown.royaltyPartyName && !breakdown.royaltyCoveredByCombo && breakdown.royaltyAmount > 0) {
            addActivityParty(modeKey, breakdown.royaltyPartyName, qty, breakdown.royaltyAmount, 'rate-party', trip.material);
          }

          const endCustomerName = (trip.actualVendorCustomerName || trip.customer || '').trim();
          const finalRate = Number(trip.vendorCustomerRatePerTon || 0);
          const tripRevenue = finalRate > 0 ? qty * finalRate : Number(trip.revenue || 0);
          if (endCustomerName && tripRevenue > 0) {
            addActivityParty(modeKey, endCustomerName, qty, tripRevenue, 'end-customer', trip.material);
          }

          const ratePartyGst = computeTripGstAmount(trip);
          if (ratePartyGst > 0) {
            const gstPayableName = breakdown.mineCoveredByCombo
              ? buildComboPartyDisplayName(trip, breakdown)
              : (breakdown.minePartyName || trip.quarryName || '');
            if (gstPayableName) addGstRow(ratePartyGstBucket, gstPayableName, qty, ratePartyGst, 'payable');
          }

          const endCustomerGst = Number((trip as Trip & { vendorCustomerGstAmount?: number }).vendorCustomerGstAmount || 0);
          if (endCustomerName && endCustomerGst > 0) {
            addGstRow(endCustomerGstBucket, endCustomerName, qty, endCustomerGst, 'receivable');
          }
        });

        const finalizePartyRows = (
          rows: MonthlyPartyAccumRow[],
        ): MonthlyExtractPartyRow[] => rows
          .map(row => {
            const paidOrReceived = row.partyRole === 'end-customer'
              ? (customerReceiptMap.get(normalizePartyToken(row.personName)) || 0)
              : (supplierPaymentMap.get(normalizePartyToken(row.personName)) || 0);
            const gap = row.totalAmount - paidOrReceived;
            const pending = Math.max(gap, 0);
            const overpaid = Math.max(-gap, 0);
            const remarks = row.partyRole === 'end-customer'
              ? (pending > 0 ? 'Receive' : overpaid > 0 ? 'Over Received' : 'Settled')
              : (pending > 0 ? 'Pay' : overpaid > 0 ? 'Overpaid' : 'Settled');
            return {
              ...row,
              materialTypes: Array.from(row.materialTypes).sort((a, b) => a.localeCompare(b)),
              paidOrReceived,
              pending,
              overpaid,
              remarks,
            };
          })
          .sort((a, b) => b.totalAmount - a.totalAmount);

        const creditSummaryMap = new Map<string, { account: string; txCount: number; amount: number; counterparties: Map<string, { name: string; txCount: number; amount: number }> }>();
        const debitSummaryMap = new Map<string, { account: string; txCount: number; amount: number; counterparties: Map<string, { name: string; txCount: number; amount: number }> }>();
        monthPayments.forEach(payment => {
          const amount = Number(payment.amount || 0);
          const resolved = resolvePaymentParty(payment);
          if (payment.type === PaymentType.RECEIPT) {
            const account = payment.toAccount || 'Unknown';
            const row = creditSummaryMap.get(account) || { account, txCount: 0, amount: 0, counterparties: new Map() };
            row.txCount += 1;
            row.amount += amount;
            const fromName = (resolved?.name || payment.ratePartyName || payment.fromAccount || 'Unknown').trim() || 'Unknown';
            const cp = row.counterparties.get(fromName) || { name: fromName, txCount: 0, amount: 0 };
            cp.txCount += 1;
            cp.amount += amount;
            row.counterparties.set(fromName, cp);
            creditSummaryMap.set(account, row);
          } else {
            const account = payment.fromAccount || 'Unknown';
            const row = debitSummaryMap.get(account) || { account, txCount: 0, amount: 0, counterparties: new Map() };
            row.txCount += 1;
            row.amount += amount;
            const toName = (resolved?.name || payment.ratePartyName || payment.toAccount || 'Unknown').trim() || 'Unknown';
            const cp = row.counterparties.get(toName) || { name: toName, txCount: 0, amount: 0 };
            cp.txCount += 1;
            cp.amount += amount;
            row.counterparties.set(toName, cp);
            debitSummaryMap.set(account, row);
          }
        });

        const nonTripMap = new Map<string, MonthlyExtractNonTripRow>();
        monthPayments.forEach(payment => {
          const amount = Number(payment.amount || 0);
          const resolved = resolvePaymentParty(payment);
          const name = (resolved?.name || payment.ratePartyName || '').trim();
          if (!name) return;
          const normalizedName = normalizePartyToken(name);
          if (tripRelatedNames.has(normalizedName)) return;
          const txType = payment.type === PaymentType.RECEIPT ? 'Receipt' : 'Payment';
          const key = `${txType}:${name}`;
          if (!nonTripMap.has(key)) {
            nonTripMap.set(key, { key, personName: name, txType, txCount: 0, amount: 0, accounts: [] });
          }
          const row = nonTripMap.get(key)!;
          row.txCount += 1;
          row.amount += amount;
          const accountName = txType === 'Receipt' ? (payment.toAccount || 'Unknown') : (payment.fromAccount || 'Unknown');
          const existing = row.accounts.find(item => item.account === accountName);
          if (existing) existing.amount += amount;
          else row.accounts.push({ account: accountName, amount });
        });

        const totalCredits = Array.from(creditSummaryMap.values()).reduce((sum, item) => sum + item.amount, 0);
        const totalDebits = Array.from(debitSummaryMap.values()).reduce((sum, item) => sum + item.amount, 0);

        return {
          monthKey,
          monthLabel: getMonthLabel(monthKey),
          tripsCount: monthTrips.length,
          totalQty: monthTrips.reduce((sum, trip) => sum + Number(trip.netWeight || 0), 0),
          totalCredits,
          totalDebits,
          netBankMovement: totalCredits - totalDebits,
          creditSummary: Array.from(creditSummaryMap.values())
            .map(row => ({
              account: row.account,
              txCount: row.txCount,
              amount: row.amount,
              counterparties: Array.from(row.counterparties.values()).sort((a, b) => b.amount - a.amount),
            }))
            .sort((a, b) => b.amount - a.amount),
          debitSummary: Array.from(debitSummaryMap.values())
            .map(row => ({
              account: row.account,
              txCount: row.txCount,
              amount: row.amount,
              counterparties: Array.from(row.counterparties.values()).sort((a, b) => b.amount - a.amount),
            }))
            .sort((a, b) => b.amount - a.amount),
          activityTables: {
            individual: finalizePartyRows(Array.from(activityBuckets.individual.values())),
            'two-plus-one': finalizePartyRows(Array.from(activityBuckets['two-plus-one'].values())),
            'two-activities': finalizePartyRows(Array.from(activityBuckets['two-activities'].values())),
            'all-activities': finalizePartyRows(Array.from(activityBuckets['all-activities'].values())),
          },
          endCustomerRows: finalizePartyRows(Array.from(endCustomerBucket.values())),
          nonTripRows: Array.from(nonTripMap.values())
            .map(row => ({ ...row, accounts: [...row.accounts].sort((a, b) => b.amount - a.amount) }))
            .sort((a, b) => b.amount - a.amount),
          ratePartyGstRows: Array.from(ratePartyGstBucket.values()).sort((a, b) => b.gstAmount - a.gstAmount),
          endCustomerGstRows: Array.from(endCustomerGstBucket.values()).sort((a, b) => b.gstAmount - a.gstAmount),
        };
      });
  }, [filteredTrips, filteredPayments, materialRates, resolvePaymentParty, getTripAmountBreakdown]);

  const selectedDateRangeLabel = useMemo(() => {
    const from = filters.dateFrom || 'All';
    const to = filters.dateTo || 'All';
    return `${from} to ${to}`;
  }, [filters.dateFrom, filters.dateTo]);

  const selectedMonthRangeLabel = useMemo(() => {
    const toMonthLabel = (value?: string) => {
      if (!value) return 'All';
      const date = new Date(`${value}T00:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      const month = date.toLocaleString('en-US', { month: 'short' });
      return `${month}-${date.getFullYear()}`;
    };
    return `${toMonthLabel(filters.dateFrom)} to ${toMonthLabel(filters.dateTo)}`;
  }, [filters.dateFrom, filters.dateTo]);

  const selectedDateRangeHeaderLabel = useMemo(
    () => `${selectedDateRangeLabel} (Months: ${selectedMonthRangeLabel})`,
    [selectedDateRangeLabel, selectedMonthRangeLabel],
  );

  const monthlyExtractCombinedReport = useMemo<MonthlyExtractMonthReport | null>(() => {
    if (monthlyExtractReports.length === 0) return null;

    const mergeBankRows = (lists: MonthlyExtractBankFlowRow[][]) => {
      const map = new Map<string, MonthlyExtractBankFlowRow>();
      lists.flat().forEach(item => {
        const row = map.get(item.account) || { account: item.account, txCount: 0, amount: 0, counterparties: [] };
        row.txCount += item.txCount;
        row.amount += item.amount;
        item.counterparties.forEach(cp => {
          const existing = row.counterparties.find(x => x.name === cp.name);
          if (existing) {
            existing.txCount += cp.txCount;
            existing.amount += cp.amount;
          } else {
            row.counterparties.push({ ...cp });
          }
        });
        map.set(item.account, row);
      });
      return Array.from(map.values())
        .map(row => ({ ...row, counterparties: [...row.counterparties].sort((a, b) => b.amount - a.amount) }))
        .sort((a, b) => b.amount - a.amount);
    };

    const mergePartyRows = (lists: MonthlyExtractPartyRow[][]): MonthlyExtractPartyRow[] => {
      const map = new Map<string, Omit<MonthlyExtractPartyRow, 'pending' | 'overpaid' | 'remarks' | 'materialTypes'> & { materialTypes: Set<string> }>();
      lists.flat().forEach(item => {
        const key = `${item.partyRole}:${normalizePartyToken(item.personName)}`;
        const row = map.get(key) || {
          key: item.key,
          personName: item.personName,
          materialTypes: new Set<string>(),
          tripCount: 0,
          totalQty: 0,
          totalAmount: 0,
          paidOrReceived: 0,
          partyRole: item.partyRole,
        };
        row.tripCount += item.tripCount;
        row.totalQty += item.totalQty;
        row.totalAmount += item.totalAmount;
        row.paidOrReceived += item.paidOrReceived;
        item.materialTypes.forEach(material => row.materialTypes.add(material));
        map.set(key, row);
      });
      return Array.from(map.values())
        .map(row => {
          const gap = row.totalAmount - row.paidOrReceived;
          const pending = Math.max(gap, 0);
          const overpaid = Math.max(-gap, 0);
          const remarks = row.partyRole === 'end-customer'
            ? (pending > 0 ? 'Receive' : overpaid > 0 ? 'Over Received' : 'Settled')
            : (pending > 0 ? 'Pay' : overpaid > 0 ? 'Overpaid' : 'Settled');
          return { ...row, materialTypes: Array.from(row.materialTypes).sort((a, b) => a.localeCompare(b)), pending, overpaid, remarks };
        })
        .sort((a, b) => b.totalAmount - a.totalAmount);
    };

    const mergeGstRows = (lists: MonthlyExtractGstRow[][]) => {
      const map = new Map<string, MonthlyExtractGstRow>();
      lists.flat().forEach(item => {
        const key = `${item.direction}:${item.name}`.toLowerCase();
        const row = map.get(key) || {
          key: item.key,
          name: item.name,
          count: 0,
          qty: 0,
          gstAmount: 0,
          direction: item.direction,
        };
        row.count += item.count;
        row.qty += item.qty;
        row.gstAmount += item.gstAmount;
        map.set(key, row);
      });
      return Array.from(map.values()).sort((a, b) => b.gstAmount - a.gstAmount);
    };

    const mergeNonTripRows = (lists: MonthlyExtractNonTripRow[][]) => {
      const map = new Map<string, MonthlyExtractNonTripRow>();
      lists.flat().forEach(item => {
        const key = `${item.txType}:${item.personName}`.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { key, personName: item.personName, txType: item.txType, txCount: 0, amount: 0, accounts: [] });
        }
        const row = map.get(key)!;
        row.txCount += item.txCount;
        row.amount += item.amount;
        item.accounts.forEach(accountItem => {
          const existing = row.accounts.find(x => x.account === accountItem.account);
          if (existing) existing.amount += accountItem.amount;
          else row.accounts.push({ account: accountItem.account, amount: accountItem.amount });
        });
      });
      return Array.from(map.values())
        .map(row => ({ ...row, accounts: [...row.accounts].sort((a, b) => b.amount - a.amount) }))
        .sort((a, b) => b.amount - a.amount);
    };

    const combined: MonthlyExtractMonthReport = {
      monthKey: 'selected-range',
      monthLabel: `Selected Range (${selectedMonthRangeLabel})`,
      tripsCount: monthlyExtractReports.reduce((sum, report) => sum + report.tripsCount, 0),
      totalQty: monthlyExtractReports.reduce((sum, report) => sum + report.totalQty, 0),
      totalCredits: monthlyExtractReports.reduce((sum, report) => sum + report.totalCredits, 0),
      totalDebits: monthlyExtractReports.reduce((sum, report) => sum + report.totalDebits, 0),
      netBankMovement: monthlyExtractReports.reduce((sum, report) => sum + report.netBankMovement, 0),
      creditSummary: mergeBankRows(monthlyExtractReports.map(report => report.creditSummary)),
      debitSummary: mergeBankRows(monthlyExtractReports.map(report => report.debitSummary)),
      activityTables: {
        individual: mergePartyRows(monthlyExtractReports.map(report => report.activityTables.individual)),
        'two-plus-one': mergePartyRows(monthlyExtractReports.map(report => report.activityTables['two-plus-one'])),
        'two-activities': mergePartyRows(monthlyExtractReports.map(report => report.activityTables['two-activities'])),
        'all-activities': mergePartyRows(monthlyExtractReports.map(report => report.activityTables['all-activities'])),
      },
      endCustomerRows: mergePartyRows(monthlyExtractReports.map(report => report.endCustomerRows)),
      nonTripRows: mergeNonTripRows(monthlyExtractReports.map(report => report.nonTripRows)),
      ratePartyGstRows: mergeGstRows(monthlyExtractReports.map(report => report.ratePartyGstRows)),
      endCustomerGstRows: mergeGstRows(monthlyExtractReports.map(report => report.endCustomerGstRows)),
    };

    return combined;
  }, [monthlyExtractReports, selectedMonthRangeLabel]);

  const activitySectionTitles: Record<MonthlyExtractSectionKey, string> = {
    individual: 'Individual Activity',
    'two-plus-one': '2+1 Activity',
    'two-activities': '2 Activities',
    'all-activities': '3 Activities (All)',
  };

  const renderMonthlyPartyTable = (
    title: string,
    rows: MonthlyExtractPartyRow[],
    isEndCustomer = false,
  ) => {
    const totalAmount = rows.reduce((sum, row) => sum + row.totalAmount, 0);
    const totalPaidOrReceived = rows.reduce((sum, row) => sum + row.paidOrReceived, 0);
    const totalPending = rows.reduce((sum, row) => sum + row.pending, 0);
    const totalOverpaid = rows.reduce((sum, row) => sum + row.overpaid, 0);
    const qtyTotal = rows.reduce((sum, row) => sum + row.totalQty, 0);
    const countTotal = rows.reduce((sum, row) => sum + row.tripCount, 0);
    const paidLabel = isEndCustomer ? 'Received' : 'Paid';

    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
          {title}
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
            Parties: {rows.length} · Trips: {countTotal} · Qty: {qtyTotal.toFixed(2)} · Amount: {formatCurrency(totalAmount)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-300 uppercase tracking-wide">
              <tr>
                {['S. No.', 'Person Name', 'Material Types', 'Trips', 'Total Qty', 'Total Amount', paidLabel, 'Pending', 'Overpaid', 'Remarks'].map(header => (
                  <th key={`${title}-${header}`} className="px-4 py-2 text-left font-semibold">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row, index) => (
                <tr key={`${title}-${row.key}`} className="bg-white dark:bg-gray-800">
                  <td className="px-4 py-2">{index + 1}</td>
                  <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{row.personName}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-300">{row.materialTypes.length ? row.materialTypes.join(', ') : '-'}</td>
                  <td className="px-4 py-2">{row.tripCount}</td>
                  <td className="px-4 py-2">{row.totalQty.toFixed(2)}</td>
                  <td className="px-4 py-2">{formatCurrency(row.totalAmount)}</td>
                  <td className={`px-4 py-2 ${isEndCustomer ? 'text-emerald-600' : 'text-blue-600'}`}>{formatCurrency(row.paidOrReceived)}</td>
                  <td className="px-4 py-2 text-amber-600">{formatCurrency(row.pending)}</td>
                  <td className="px-4 py-2 text-rose-600">{formatCurrency(row.overpaid)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                      row.remarks.toLowerCase().includes('settled')
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : row.remarks.toLowerCase().includes('over')
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    }`}>
                      {row.remarks}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-5 text-center text-sm text-gray-500">
                    No records for this section in this month.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold dark:bg-gray-900/40">
                  <td className="px-4 py-2" colSpan={2}>Total</td>
                  <td className="px-4 py-2">-</td>
                  <td className="px-4 py-2">{countTotal}</td>
                  <td className="px-4 py-2">{qtyTotal.toFixed(2)}</td>
                  <td className="px-4 py-2">{formatCurrency(totalAmount)}</td>
                  <td className="px-4 py-2">{formatCurrency(totalPaidOrReceived)}</td>
                  <td className="px-4 py-2">{formatCurrency(totalPending)}</td>
                  <td className="px-4 py-2">{formatCurrency(totalOverpaid)}</td>
                  <td className="px-4 py-2">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  const renderBankFlowTable = (
    title: string,
    rows: MonthlyExtractBankFlowRow[],
    emptyText: string,
    counterpartyLabel: string,
  ) => {
    const summaryRows = (() => {
      const map = new Map<string, { name: string; txCount: number; amount: number }>();
      rows.forEach(row => {
        row.counterparties.forEach(cp => {
          const key = cp.name.trim().toLowerCase();
          const item = map.get(key) || { name: cp.name, txCount: 0, amount: 0 };
          item.txCount += cp.txCount;
          item.amount += cp.amount;
          map.set(key, item);
        });
      });
      return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    })();
    const totalAmount = summaryRows.reduce((sum, row) => sum + row.amount, 0);
    const totalTx = summaryRows.reduce((sum, row) => sum + row.txCount, 0);

    return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
        {title}
        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
          · {formatCurrency(totalAmount)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-300 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">S. No.</th>
              <th className="px-4 py-2 text-left font-semibold">{counterpartyLabel}</th>
              <th className="px-4 py-2 text-left font-semibold">Transactions</th>
              <th className="px-4 py-2 text-left font-semibold">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {summaryRows.map((row, index) => (
              <tr key={`${title}-${row.name}-${index}`} className="bg-white dark:bg-gray-800">
                <td className="px-4 py-2">{index + 1}</td>
                <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{row.name}</td>
                <td className="px-4 py-2">{row.txCount}</td>
                <td className="px-4 py-2">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
            {summaryRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-5 text-center text-sm text-gray-500">{emptyText}</td>
              </tr>
            )}
          </tbody>
          {summaryRows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold dark:bg-gray-900/40">
                <td className="px-4 py-2" colSpan={2}>Total</td>
                <td className="px-4 py-2">{totalTx}</td>
                <td className="px-4 py-2">{formatCurrency(totalAmount)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
    );
  };

  const renderGstSummaryTable = (title: string, rows: MonthlyExtractGstRow[], emptyText: string) => (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
        {title}
        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
          Count: {rows.reduce((sum, row) => sum + row.count, 0)} · Qty: {rows.reduce((sum, row) => sum + row.qty, 0).toFixed(2)} · GST: {formatCurrency(rows.reduce((sum, row) => sum + row.gstAmount, 0))}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-300 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">S. No.</th>
              <th className="px-4 py-2 text-left font-semibold">Name</th>
              <th className="px-4 py-2 text-left font-semibold">Trips</th>
              <th className="px-4 py-2 text-left font-semibold">Qty</th>
              <th className="px-4 py-2 text-left font-semibold">GST Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row, index) => (
              <tr key={`${title}-${row.key}`} className="bg-white dark:bg-gray-800">
                <td className="px-4 py-2">{index + 1}</td>
                <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{row.name}</td>
                <td className="px-4 py-2">{row.count}</td>
                <td className="px-4 py-2">{row.qty.toFixed(2)}</td>
                <td className="px-4 py-2">{formatCurrency(row.gstAmount)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-center text-sm text-gray-500">{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderNonTripTable = (rows: MonthlyExtractNonTripRow[]) => (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
        Other / Non-Trip Transactions
        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
          Persons: {rows.length} · Total Amount: {formatCurrency(rows.reduce((sum, row) => sum + row.amount, 0))}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-300 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">S. No.</th>
              <th className="px-4 py-2 text-left font-semibold">Person / Name</th>
              <th className="px-4 py-2 text-left font-semibold">Type</th>
              <th className="px-4 py-2 text-left font-semibold">Transactions</th>
              <th className="px-4 py-2 text-left font-semibold">Amount</th>
              <th className="px-4 py-2 text-left font-semibold">Account Split</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row, index) => (
              <tr key={`non-trip-${row.key}`} className="bg-white dark:bg-gray-800">
                <td className="px-4 py-2">{index + 1}</td>
                <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{row.personName}</td>
                <td className={`px-4 py-2 ${row.txType === 'Receipt' ? 'text-emerald-600' : 'text-rose-600'}`}>{row.txType}</td>
                <td className="px-4 py-2">{row.txCount}</td>
                <td className="px-4 py-2">{formatCurrency(row.amount)}</td>
                <td className="px-4 py-2 text-gray-500 dark:text-gray-300">
                  {row.accounts.length ? row.accounts.map(item => `${item.account}: ${formatCurrency(item.amount)}`).join(' | ') : '-'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-5 text-center text-sm text-gray-500">
                  No non-trip transactions in this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

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
            Monthly Extract
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
                      <td className={`px-6 py-3 text-sm font-semibold ${getBalanceToneClass(item)}`}>
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
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-100">
              <span className="font-semibold">Selected Date Range:</span> {selectedDateRangeLabel}
              <span className="mx-2">|</span>
              <span className="font-semibold">Months:</span> {selectedMonthRangeLabel}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Total Received', value: monthlyKpis.received, tone: 'text-emerald-500' },
                { label: 'Total Paid', value: monthlyKpis.paid, tone: 'text-red-500' },
                { label: 'Balance', value: monthlyKpis.balance, tone: 'text-blue-500' },
              ].map(card => (
                <div key={card.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.label}</div>
                  <div className={`text-lg font-semibold ${card.tone}`}>{formatCurrency(card.value)}</div>
                </div>
              ))}
            </div>
            {monthlyExtractCombinedReport && (
              <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/40 p-4 dark:border-gray-700 dark:bg-gray-900/20">
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Selected Range Summary ({selectedMonthRangeLabel})</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Trips: {monthlyExtractCombinedReport.tripsCount} · Qty: {monthlyExtractCombinedReport.totalQty.toFixed(2)}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                        <div className="text-emerald-700 dark:text-emerald-300">Total Credits</div>
                        <div className="font-semibold text-emerald-800 dark:text-emerald-200">{formatCurrency(monthlyExtractCombinedReport.totalCredits)}</div>
                      </div>
                      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/40 dark:bg-rose-900/20">
                        <div className="text-rose-700 dark:text-rose-300">Total Debits</div>
                        <div className="font-semibold text-rose-800 dark:text-rose-200">{formatCurrency(monthlyExtractCombinedReport.totalDebits)}</div>
                      </div>
                      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-900/20">
                        <div className="text-blue-700 dark:text-blue-300">Net Movement</div>
                        <div className={`font-semibold ${monthlyExtractCombinedReport.netBankMovement >= 0 ? 'text-blue-800 dark:text-blue-200' : 'text-rose-700 dark:text-rose-300'}`}>
                          {formatCurrency(monthlyExtractCombinedReport.netBankMovement)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {(monthlyExtractCombinedReport.creditSummary.length > 0 || monthlyExtractCombinedReport.debitSummary.length > 0) && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {monthlyExtractCombinedReport.creditSummary.length > 0 && renderBankFlowTable('Credits Summary', monthlyExtractCombinedReport.creditSummary, 'No credits for selected date range.', 'From')}
                    {monthlyExtractCombinedReport.debitSummary.length > 0 && renderBankFlowTable('Debits Summary', monthlyExtractCombinedReport.debitSummary, 'No debits for selected date range.', 'To')}
                  </div>
                )}

                {(Object.values(monthlyExtractCombinedReport.activityTables).some(rows => rows.length > 0) || monthlyExtractCombinedReport.endCustomerRows.length > 0) && (
                  <div className="grid gap-4">
                    {(['individual', 'two-plus-one', 'all-activities', 'two-activities'] as MonthlyExtractSectionKey[]).map(sectionKey => (
                      monthlyExtractCombinedReport.activityTables[sectionKey].length > 0 ? (
                        <React.Fragment key={`combined-${sectionKey}`}>
                          {renderMonthlyPartyTable(
                            `${activitySectionTitles[sectionKey]} - Rate Parties`,
                            monthlyExtractCombinedReport.activityTables[sectionKey],
                            false,
                          )}
                        </React.Fragment>
                      ) : null
                    ))}
                    {monthlyExtractCombinedReport.endCustomerRows.length > 0 && renderMonthlyPartyTable('End Customer Summary', monthlyExtractCombinedReport.endCustomerRows, true)}
                  </div>
                )}

                {(monthlyExtractCombinedReport.ratePartyGstRows.length > 0 || monthlyExtractCombinedReport.endCustomerGstRows.length > 0) && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {monthlyExtractCombinedReport.ratePartyGstRows.length > 0 && renderGstSummaryTable('Rate Party GST Summary (Payable)', monthlyExtractCombinedReport.ratePartyGstRows, 'No rate-party GST payable rows in selected date range.')}
                    {monthlyExtractCombinedReport.endCustomerGstRows.length > 0 && renderGstSummaryTable('End Customer GST Summary (Receivable)', monthlyExtractCombinedReport.endCustomerGstRows, 'No end-customer GST receivable rows in selected date range.')}
                  </div>
                )}

                {monthlyExtractCombinedReport.nonTripRows.length > 0 && renderNonTripTable(monthlyExtractCombinedReport.nonTripRows)}
              </div>
            )}

            {!monthlyExtractCombinedReport && (
              <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                No monthly data available for this date range.
              </div>
            )}
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
                      <td className={`px-6 py-3 text-sm font-semibold ${getBalanceToneClass(item)}`}>
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
