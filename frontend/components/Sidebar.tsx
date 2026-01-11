import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const { currentUser, logout } = useAuth();
  const isSupervisor = currentUser?.role === Role.PICKUP_SUPERVISOR || currentUser?.role === Role.DROPOFF_SUPERVISOR;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  
  const sections = [
    {
      title: 'Core Operations',
      items: [
        { to: '/dashboard', icon: isSupervisor ? 'enter-outline' : 'speedometer-outline', name: isSupervisor ? 'Enter Trips' : 'Dashboard', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT, Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.GUEST] },
        { to: '/trips', icon: 'bus-outline', name: 'Trip Management', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/received', icon: 'checkbox-outline', name: 'Received Trips', roles: [Role.DROPOFF_SUPERVISOR] },
        { to: '/reports', icon: 'document-text-outline', name: 'Reports', roles: [Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/royalty-stock', icon: 'layers-outline', name: 'Royalty Stock', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
      ],
    },
    {
      title: 'Financial Operations',
      items: [
        { to: '/financials', icon: 'analytics-outline', name: 'Logistics Accounts Overview', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/account-ledger', icon: 'pie-chart-outline', name: 'Logistics Accounts Reports', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/accounting', icon: 'calculator-outline', name: 'Total Accounts Overview', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/advances', icon: 'document-attach-outline', name: 'Advances', roles: [Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/daily-expenses', icon: 'wallet-outline', name: 'Daily Expenses', roles: [Role.PICKUP_SUPERVISOR, Role.DROPOFF_SUPERVISOR, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/payments', icon: 'book-outline', name: 'Payments', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/capital', icon: 'wallet-outline', name: 'Total Accounts Reports', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
      ],
    },
    {
      title: 'Master Data',
      items: [
        { to: '/sites', icon: 'map-outline', name: 'Site Locations', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/merchant-types', icon: 'pricetags-outline', name: 'Merchant Types', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/mine-quarry-data', icon: 'business-outline', name: 'Mine & Quarry Data', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/vendor-customer-data', icon: 'people-outline', name: 'Vendor & Customer Data', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/royalty-owner-data', icon: 'document-text-outline', name: 'Royalty Owner Data', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/transport-owner-data', icon: 'bus-outline', name: 'Transport & Owner Data', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/transport-owner-vehicles', icon: 'git-compare-outline', name: 'Transport Owner Vehicles', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/vehicles', icon: 'car-sport-outline', name: 'Vehicles', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/material-types', icon: 'cube-outline', name: 'Material Types', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/material-rates', icon: 'pricetag-outline', name: 'Material Rates', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/merchant-accounts', icon: 'card-outline', name: 'Merchant Bank Accounts', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/account-types', icon: 'list-outline', name: 'Account Types', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
      ],
    },
    {
      title: 'Legacy Master Data',
      items: [
        { to: '/customers', icon: 'people-circle-outline', name: 'Customers', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/quarries', icon: 'server-outline', name: 'Quarries', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/transport', icon: 'boat-outline', name: 'Transport', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/royalty', icon: 'document-text-outline', name: 'Royalty', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/materials', icon: 'layers-outline', name: 'Materials', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/accounts', icon: 'card-outline', name: 'Accounts', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
        { to: '/categories', icon: 'copy-outline', name: 'Categories', roles: [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT] },
      ],
    },
    {
      title: 'System',
      items: [
        { to: '/config-manager', icon: 'settings-outline', name: 'Runtime Config', roles: [Role.ADMIN, Role.MANAGER] },
        { to: '/users', icon: 'people-outline', name: 'Users', roles: [Role.ADMIN] },
      ],
    },
  ];

  const isDropOffSupervisor = currentUser?.role === Role.DROPOFF_SUPERVISOR;
  const supervisorItems = isDropOffSupervisor
    ? [
        { to: '/received', icon: 'checkbox-outline', name: 'Received Trips' },
        { to: '/advances', icon: 'document-attach-outline', name: 'Advances' },
        { to: '/daily-expenses', icon: 'wallet-outline', name: 'Daily Expenses' },
        { to: '/reports', icon: 'document-text-outline', name: 'Reports' },
      ]
    : [
        { to: '/dashboard', icon: 'enter-outline', name: 'Enter Trips' },
        { to: '/advances', icon: 'document-attach-outline', name: 'Advances' },
        { to: '/daily-expenses', icon: 'wallet-outline', name: 'Daily Expenses' },
        { to: '/reports', icon: 'document-text-outline', name: 'Reports' },
      ];

  const NavItem: React.FC<{ to: string; icon: string; name: string; }> = ({ to, icon, name }) => {
    return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center px-4 py-2 mt-5 rounded-lg transition-colors duration-200 ${
          isActive
            ? 'bg-primary text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`
      }
      onClick={() => setSidebarOpen(false)}
    >
      <ion-icon name={icon} className="text-2xl"></ion-icon>
      <span className="mx-4 font-medium">{name}</span>
    </NavLink>
  );
    }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      ></div>
      
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 transform lg:translate-x-0 lg:static lg:inset-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out`}
      >
        <div className="flex items-center justify-center mt-8">
          <div className="flex items-center">
            <ion-icon name="server-outline" className="text-3xl text-primary"></ion-icon>
            <span className="text-gray-800 dark:text-white text-2xl mx-2 font-semibold">LogiTrack</span>
          </div>
        </div>
        <nav className="flex-grow mt-10 px-2 space-y-4 overflow-y-auto pr-2">
          {isSupervisor
            ? supervisorItems.map(item => <NavItem key={item.name} {...item} />)
            : sections.map(section => {
                const visibleItems = section.items.filter(item => currentUser && item.roles.includes(currentUser.role));
                if (visibleItems.length === 0) return null;
                const isOpen = openSections[section.title] ?? false;
                return (
                  <div key={section.title}>
                    <button
                      type="button"
                      onClick={() => setOpenSections(prev => ({ ...prev, [section.title]: !prev[section.title] }))}
                      className="w-full px-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <span>{section.title}</span>
                      <ion-icon name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'} className="text-base"></ion-icon>
                    </button>
                    {isOpen && visibleItems.map(item => <NavItem key={item.name} {...item} />)}
                  </div>
                );
              })}
        </nav>
        <div className="px-4 pb-4">
           <button
              onClick={logout}
              className="w-full flex items-center px-4 py-2 mt-5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-700/50 hover:text-red-700 dark:hover:text-red-300 transition-colors duration-200"
            >
              <ion-icon name="log-out-outline" className="text-2xl"></ion-icon>
              <span className="mx-4 font-medium">Logout</span>
            </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
