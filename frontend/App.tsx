import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import ReportDashboard from './pages/Dashboard';
import DashboardPlaceholder from './pages/DashboardPlaceholder';
import DailyTrips from './pages/DailyTrips';
import Login from './pages/Login';
import Users from './pages/Users';
import Profile from './pages/Profile';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { Role } from './types';
import Financials from './pages/Financials';
import AccountLedgerOverview from './pages/AccountLedgerOverview';
import { DataProvider } from './contexts/DataContext';
import { UIProvider } from './contexts/UIContext';
import Payments from './pages/Payments';
import DailyExpenses from './pages/DailyExpenses';
import ReceivedTrips from './pages/ReceivedTrips';
import Advances from './pages/Advances';
import Reports from './pages/Reports';
import SiteManagerDashboard from './pages/SiteManagerDashboard';
import TripRates from './pages/TripRates';
import Bills from './pages/Bills';
import Vehicles from './pages/Vehicles';
import SiteLocations from './pages/SiteLocations';
import MerchantTypes from './pages/MerchantTypes';
import Merchants from './pages/Merchants';
import MerchantBankAccounts from './pages/MerchantBankAccounts';
import AccountTypes from './pages/AccountTypes';
import MineQuarryData from './pages/MineQuarryData';
import VendorCustomerData from './pages/VendorCustomerData';
import RoyaltyOwnerData from './pages/RoyaltyOwnerData';
import TransportOwnerData from './pages/TransportOwnerData';
import TransportOwnerVehicles from './pages/TransportOwnerVehicles';
import MaterialTypes from './pages/MaterialTypes';
import MaterialRates from './pages/MaterialRates';
import TripData from './pages/TripData';
import TripRecords from './pages/TripRecords';
import ConfigManager from './pages/ConfigManager';
import SupervisorDashboard from './pages/Supervisor/Dashboard';
import SupervisorEnterTrips from './pages/Supervisor/EnterTrips';
import SupervisorDailyExpensesForm from './pages/Supervisor/DailyExpensesForm';
import SupervisorSiteExpenses from './pages/Supervisor/SiteExpenses';
import SupervisorAdvancesForm from './pages/Supervisor/AdvancesForm';
import TripImport from './pages/TripImport';
import PaymentImport from './pages/PaymentImport';
import TripFeed from './pages/TripFeed';
import Accounting from './pages/Accounting';
import Capital from './pages/Capital';
import RoyaltyStock from './pages/RoyaltyStock';

const ProtectedLayout: React.FC = () => (
  <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.SITE_MANAGER, Role.GUEST]}>
    <Layout>
      <Outlet />
    </Layout>
  </ProtectedRoute>
);

const RoleBasedDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  if (role === Role.PICKUP_SUPERVISOR || role === Role.DROPOFF_SUPERVISOR) {
    return <SupervisorDashboard />;
  }
  if (role === Role.SITE_MANAGER) {
    return <SiteManagerDashboard />;
  }
  return <DashboardPlaceholder />;
};

const RoleBasedDailyExpenses: React.FC = () => {
  const { currentUser } = useAuth();
  const isSupervisor = currentUser?.role === Role.PICKUP_SUPERVISOR || currentUser?.role === Role.DROPOFF_SUPERVISOR;
  return isSupervisor ? <SupervisorDailyExpensesForm /> : <DailyExpenses />;
};

const RoleBasedAdvances: React.FC = () => {
  const { currentUser } = useAuth();
  const isSupervisor = currentUser?.role === Role.PICKUP_SUPERVISOR || currentUser?.role === Role.DROPOFF_SUPERVISOR;
  return isSupervisor ? <SupervisorAdvancesForm /> : <Advances />;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<Login />} />

    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<RoleBasedDashboard />} />
      <Route path="/report" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <ReportDashboard />
        </ProtectedRoute>
      } />
      <Route path="/financials" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.SITE_MANAGER]}>
          <Financials />
        </ProtectedRoute>
      } />
      <Route path="/account-ledger" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.SITE_MANAGER]}>
          <AccountLedgerOverview />
        </ProtectedRoute>
      } />
      <Route path="/trips" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <DailyTrips />
        </ProtectedRoute>
      } />
      <Route path="/trip-import" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.SITE_MANAGER]}>
          <TripImport />
        </ProtectedRoute>
      } />
      <Route path="/payment-import" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.SITE_MANAGER]}>
          <PaymentImport />
        </ProtectedRoute>
      } />
      <Route path="/trip-feed" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.SITE_MANAGER]}>
          <TripFeed />
        </ProtectedRoute>
      } />
      <Route path="/trip-rates" element={
        <ProtectedRoute roles={[Role.SITE_MANAGER, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <TripRates />
        </ProtectedRoute>
      } />
      <Route path="/bills-invoices" element={
        <ProtectedRoute roles={[Role.SITE_MANAGER, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <Bills />
        </ProtectedRoute>
      } />
      <Route path="/enter-trips" element={
        <ProtectedRoute roles={[Role.PICKUP_SUPERVISOR, Role.SITE_MANAGER, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <SupervisorEnterTrips />
        </ProtectedRoute>
      } />
      <Route path="/received" element={
        <ProtectedRoute roles={[Role.DROPOFF_SUPERVISOR, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <ReceivedTrips />
        </ProtectedRoute>
      } />
      {/* Advances route deprecated */}
      <Route path="/management-ledger" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.SITE_MANAGER]}>
          <Reports mode="dashboard" />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.SITE_MANAGER]}>
          <Reports mode="reports" />
        </ProtectedRoute>
      } />
      <Route path="/ledger" element={<Navigate to="/payments" replace />} />
      <Route path="/payments" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.SITE_MANAGER]}>
          <Payments />
        </ProtectedRoute>
      } />
      <Route path="/accounting" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <Accounting />
        </ProtectedRoute>
      } />
      <Route path="/capital" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <Capital />
        </ProtectedRoute>
      } />
      <Route path="/royalty-stock" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <RoyaltyStock />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={<Profile />} />
      <Route path="/royalty" element={<Navigate to="/royalty-owner-data" replace />} />
      <Route path="/daily-expenses" element={
        <ProtectedRoute roles={[Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.SITE_MANAGER]}>
          <RoleBasedDailyExpenses />
        </ProtectedRoute>
      } />
      <Route path="/site-expenses" element={
        <ProtectedRoute roles={[Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR]}>
          <SupervisorSiteExpenses />
        </ProtectedRoute>
      } />
      <Route path="/customers" element={<Navigate to="/vendor-customer-data" replace />} />
      <Route path="/quarries" element={<Navigate to="/mine-quarry-data" replace />} />
      <Route path="/transport" element={<Navigate to="/transport-owner-data" replace />} />
      <Route path="/accounts" element={<Navigate to="/merchant-accounts" replace />} />
      <Route path="/categories" element={<Navigate to="/account-types" replace />} />
      <Route path="/materials" element={<Navigate to="/material-types" replace />} />
      <Route path="/vehicles" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><Vehicles /></ProtectedRoute>} />
      <Route path="/sites" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><SiteLocations /></ProtectedRoute>} />
      <Route path="/merchant-types" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><MerchantTypes /></ProtectedRoute>} />
      <Route path="/merchants" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><Merchants /></ProtectedRoute>} />
      <Route path="/merchant-accounts" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><MerchantBankAccounts /></ProtectedRoute>} />
      <Route path="/account-types" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><AccountTypes /></ProtectedRoute>} />
      <Route path="/mine-quarry-data" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><MineQuarryData /></ProtectedRoute>} />
      <Route path="/vendor-customer-data" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><VendorCustomerData /></ProtectedRoute>} />
      <Route path="/royalty-owner-data" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><RoyaltyOwnerData /></ProtectedRoute>} />
      <Route path="/transport-owner-data" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><TransportOwnerData /></ProtectedRoute>} />
      <Route path="/transport-owner-vehicles" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><TransportOwnerVehicles /></ProtectedRoute>} />
      <Route path="/material-types" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><MaterialTypes /></ProtectedRoute>} />
      <Route path="/material-rates" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><MaterialRates /></ProtectedRoute>} />
      <Route path="/trip-data" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><TripData /></ProtectedRoute>} />
      <Route path="/trip-records" element={<ProtectedRoute roles={[Role.ADMIN]}><TripRecords /></ProtectedRoute>} />
      <Route path="/config-manager" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER]}><ConfigManager /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={[Role.ADMIN]}><Users /></ProtectedRoute>} />
    </Route>
  </Routes>
);


const App: React.FC = () => {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.type === 'number') {
        event.preventDefault();
        active.blur();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLInputElement)) return;
      if (active.type !== 'number') return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <UIProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <DataProvider>
            <AppRoutes />
          </DataProvider>
        </AuthProvider>
      </HashRouter>
    </UIProvider>
  );
};

export default App;
