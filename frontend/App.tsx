import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DailyTrips from './pages/DailyTrips';
import Accounting from './pages/Accounting';
import Royalty from './pages/Royalty';
import Customers from './pages/Customers';
import Quarries from './pages/Quarries';
import Transport from './pages/Transport';
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
import RoyaltyStock from './pages/RoyaltyStock';
import Accounts from './pages/Accounts';
import Categories from './pages/Categories';
import Capital from './pages/Capital';
import DailyExpenses from './pages/DailyExpenses';
import ReceivedTrips from './pages/ReceivedTrips';
import Advances from './pages/Advances';
import Reports from './pages/Reports';
import Materials from './pages/Materials';
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
import ConfigManager from './pages/ConfigManager';
import SupervisorDashboard from './pages/Supervisor/Dashboard';
import SupervisorEnterTrips from './pages/Supervisor/EnterTrips';
import SupervisorDailyExpensesForm from './pages/Supervisor/DailyExpensesForm';
import SupervisorSiteExpenses from './pages/Supervisor/SiteExpenses';
import SupervisorAdvancesForm from './pages/Supervisor/AdvancesForm';
import TripImport from './pages/TripImport';

const ProtectedLayout: React.FC = () => (
  <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.GUEST]}>
    <Layout>
      <Outlet />
    </Layout>
  </ProtectedRoute>
);

const RoleBasedDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const isSupervisor = currentUser?.role === Role.PICKUP_SUPERVISOR || currentUser?.role === Role.DROPOFF_SUPERVISOR;
  return isSupervisor ? <SupervisorDashboard /> : <Dashboard />;
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
      <Route path="/financials" element={<Financials />} />
      <Route path="/account-ledger" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><AccountLedgerOverview /></ProtectedRoute>} />
      <Route path="/trips" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
            <DailyTrips />
        </ProtectedRoute>
       } />
      <Route path="/trip-import" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <TripImport />
        </ProtectedRoute>
      } />
      <Route path="/enter-trips" element={
        <ProtectedRoute roles={[Role.PICKUP_SUPERVISOR]}>
          <SupervisorEnterTrips />
        </ProtectedRoute>
      } />
      <Route path="/received" element={
        <ProtectedRoute roles={[Role.DROPOFF_SUPERVISOR, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <ReceivedTrips />
        </ProtectedRoute>
      } />
      <Route path="/advances" element={
        <ProtectedRoute roles={[Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <RoleBasedAdvances />
        </ProtectedRoute>
      } />
       <Route path="/reports" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/accounting" element={<Accounting />} />
      <Route path="/ledger" element={<Navigate to="/payments" replace />} />
      <Route path="/payments" element={
        <ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <Payments />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={<Profile />} />
      <Route path="/capital" element={<Capital />} />
      <Route path="/royalty" element={<Royalty />} />
      <Route path="/royalty-stock" element={<RoyaltyStock />} />
      <Route path="/daily-expenses" element={
        <ProtectedRoute roles={[Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}>
          <RoleBasedDailyExpenses />
        </ProtectedRoute>
      } />
      <Route path="/site-expenses" element={
        <ProtectedRoute roles={[Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR]}>
          <SupervisorSiteExpenses />
        </ProtectedRoute>
      } />
      <Route path="/customers" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><Customers /></ProtectedRoute>} />
      <Route path="/quarries" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><Quarries /></ProtectedRoute>} />
      <Route path="/transport" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><Transport /></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><Accounts /></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><Categories /></ProtectedRoute>} />
      <Route path="/materials" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT]}><Materials /></ProtectedRoute>} />
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
      <Route path="/config-manager" element={<ProtectedRoute roles={[Role.ADMIN, Role.MANAGER]}><ConfigManager /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={[Role.ADMIN]}><Users /></ProtectedRoute>} />
    </Route>
  </Routes>
);


const App: React.FC = () => (
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

export default App;
