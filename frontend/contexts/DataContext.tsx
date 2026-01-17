import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { api } from '../services/mockApi';
import { usersApi } from '../services/usersApi';
import { siteLocationApi } from '../services/siteLocationApi';
import { merchantTypeApi } from '../services/merchantTypeApi';
import { merchantApi } from '../services/merchantApi';
import { merchantBankApi } from '../services/merchantBankApi';
import { accountTypeApi } from '../services/accountTypeApi';
import { mineQuarryApi } from '../services/mineQuarryApi';
import { vendorCustomerApi } from '../services/vendorCustomerApi';
import { royaltyOwnerDataApi } from '../services/royaltyOwnerDataApi';
import { transportOwnerApi } from '../services/transportOwnerApi';
import { transportOwnerVehicleApi } from '../services/transportOwnerVehicleApi';
import { materialTypeDefinitionApi } from '../services/materialTypeDefinitionApi';
import { materialRateApi } from '../services/materialRateApi';
import { vehicleMasterApi } from '../services/vehicleMasterApi';
import { advanceApi } from '../services/advanceApi';
import { dailyExpenseApi } from '../services/dailyExpenseApi';
import { tripApi } from '../services/tripApi';
import { paymentApi } from '../services/paymentApi';
import { Trip, LedgerEntry, VehicleOwner, QuarryOwner, RoyaltyOwner, Customer, RateEntry, CustomerRate, SiteLocation, MerchantType, Merchant, MerchantBankAccount, AccountType, MineQuarryData, VendorCustomerData, RoyaltyOwnerData, TransportOwnerData, TransportOwnerVehicle, MaterialTypeDefinition, MaterialRate, Material, RoyaltyStock, Account, AccountCategory, DailyExpense, Advance, VehicleMaster, Payment, Role } from '../types';
import { useAuth } from './AuthContext';

// Define the type for a new trip from the form
type NewTripData = Omit<Trip, 'id' | 'paymentStatus' | 'revenue' | 'materialCost' | 'transportCost' | 'royaltyCost' | 'profit' | 'status'>;

interface DataContextType {
  loadTrips: () => Promise<void>;
  loadTripMasters: () => Promise<void>;
  loadLegacyMasters: () => Promise<void>;
  loadAdvances: () => Promise<void>;
  loadPayments: () => Promise<void>;
  loadLedgerEntries: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  loadAccountCategories: () => Promise<void>;
  loadMaterials: () => Promise<void>;
  loadRoyaltyStock: () => Promise<void>;
  loadSiteLocations: () => Promise<void>;
  loadMerchantTypes: () => Promise<void>;
  loadMerchants: () => Promise<void>;
  loadMerchantBankAccounts: () => Promise<void>;
  loadAccountTypes: () => Promise<void>;
  loadVehicleMasters: () => Promise<void>;
  loadMineQuarries: () => Promise<void>;
  loadVendorCustomers: () => Promise<void>;
  loadRoyaltyOwnerProfiles: () => Promise<void>;
  loadTransportOwnerProfiles: () => Promise<void>;
  loadTransportOwnerVehicles: () => Promise<void>;
  loadMaterialTypeDefinitions: () => Promise<void>;
  loadMaterialRates: () => Promise<void>;
  trips: Trip[];
  advances: Advance[];
  payments: Payment[];
  ledgerEntries: LedgerEntry[];
  vehicles: VehicleOwner[];
  quarries: QuarryOwner[];
  royaltyOwners: RoyaltyOwner[];
  customers: Customer[];
  royaltyStock: RoyaltyStock[];
  customerRates: CustomerRate[];
  siteLocations: SiteLocation[];
  merchantTypes: MerchantType[];
  merchants: Merchant[];
  merchantBankAccounts: MerchantBankAccount[];
  accountTypes: AccountType[];
  vehicleMasters: VehicleMaster[];
  mineQuarries: MineQuarryData[];
  vendorCustomers: VendorCustomerData[];
  royaltyOwnerProfiles: RoyaltyOwnerData[];
  transportOwnerProfiles: TransportOwnerData[];
  transportOwnerVehicles: TransportOwnerVehicle[];
  materialTypeDefinitions: MaterialTypeDefinition[];
  materialRates: MaterialRate[];
  materials: Material[];
  accounts: Account[];
  accountCategories: AccountCategory[];
  loading: boolean;
  
  addTrip: (trip: Omit<NewTripData, 'createdBy'>) => Promise<void>;
  updateTrip: (tripId: number, tripData: Partial<Trip>) => Promise<void>;
  deleteTrip: (tripId: number) => Promise<void>;

  addAdvance: (advance: Omit<Advance, 'id'>) => Promise<void>;
  updateAdvance: (id: string, data: Omit<Advance, 'id'>) => Promise<void>;
  deleteAdvance: (id: string) => Promise<void>;

  addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  updatePayment: (id: string, data: Omit<Payment, 'id'>) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  
  addLedgerEntry: (entry: Omit<LedgerEntry, 'id'>) => Promise<void>;
  updateLedgerEntry: (id: string, entry: Omit<LedgerEntry, 'id'>) => Promise<void>;
  deleteLedgerEntry: (id: string) => Promise<void>;
  
  getDailyExpenses: (supervisorName: string) => Promise<{ expenses: DailyExpense[], openingBalance: number }>;
  addDailyExpense: (expense: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>) => Promise<void>;
  updateDailyExpense: (id: string, expense: Omit<DailyExpense, 'id' | 'availableBalance' | 'closingBalance'>) => Promise<void>;
  deleteDailyExpense: (id: string) => Promise<void>;
  getSupervisorAccounts: () => Promise<string[]>;

  addAccount: (account: Omit<Account, 'id'>) => Promise<void>;
  addAccountCategory: (category: Omit<AccountCategory, 'id'>) => Promise<void>;

  addVehicleMaster: (vehicle: Omit<VehicleMaster, 'id'>) => Promise<void>;
  updateVehicleMaster: (id: string, vehicle: Omit<VehicleMaster, 'id'>) => Promise<void>;
  deleteVehicleMaster: (id: string) => Promise<void>;
  
  addVehicleOwner: (vehicleOwner: Omit<VehicleOwner, 'id'>) => Promise<void>;
  updateVehicleOwner: (id: string, vehicleOwner: Omit<VehicleOwner, 'id' | 'rates'>) => Promise<void>;
  deleteVehicleOwner: (id: string) => Promise<void>;
  addTransportRate: (transportId: string, rate: Omit<RateEntry, 'id'>) => Promise<void>;
  updateTransportRate: (transportId: string, rate: RateEntry) => Promise<void>;
  deleteTransportRate: (transportId: string, rateId: string) => Promise<void>;
  
  addQuarryOwner: (quarryOwner: Omit<QuarryOwner, 'id'>) => Promise<void>;
  addQuarryRate: (quarryId: string, rate: Omit<RateEntry, 'id'>) => Promise<void>;
  updateQuarryRate: (quarryId: string, rate: RateEntry) => Promise<void>;
  deleteQuarryRate: (quarryId: string, rateId: string) => Promise<void>;

  addRoyaltyOwner: (royaltyOwner: Omit<RoyaltyOwner, 'id'>) => Promise<void>;
  addRoyaltyRate: (royaltyId: string, rate: Omit<RateEntry, 'id'>) => Promise<void>;
  updateRoyaltyRate: (royaltyId: string, rate: RateEntry) => Promise<void>;
  deleteRoyaltyRate: (royaltyId: string, rateId: string) => Promise<void>;
  
  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<void>;
  addCustomerRate: (customerId: string, rate: Omit<RateEntry, 'id'>) => Promise<void>;
  updateCustomerRate: (customerId: string, rate: RateEntry) => Promise<void>;
  deleteCustomerRate: (customerId: string, rateId: string) => Promise<void>;

  addSiteLocation: (site: Omit<SiteLocation, 'id'>) => Promise<SiteLocation>;
  updateSiteLocation: (id: string, site: Omit<SiteLocation, 'id'>) => Promise<void>;
  deleteSiteLocation: (id: string) => Promise<void>;
  mergeSiteLocation: (sourceId: string, targetId: string) => Promise<void>;

  addMerchantType: (data: Omit<MerchantType, 'id'>) => Promise<void>;
  updateMerchantType: (id: string, data: Omit<MerchantType, 'id'>) => Promise<void>;
  deleteMerchantType: (id: string) => Promise<void>;

  addMerchant: (data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  updateMerchant: (id: string, data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  deleteMerchant: (id: string) => Promise<void>;

  addMerchantBankAccount: (data: Omit<MerchantBankAccount, 'id' | 'merchantName'>) => Promise<void>;
  updateMerchantBankAccount: (id: string, data: Omit<MerchantBankAccount, 'id' | 'merchantName'>) => Promise<void>;
  deleteMerchantBankAccount: (id: string) => Promise<void>;

  addAccountType: (data: Omit<AccountType, 'id'>) => Promise<void>;
  updateAccountType: (id: string, data: Omit<AccountType, 'id'>) => Promise<void>;
  deleteAccountType: (id: string) => Promise<void>;

  addMineQuarry: (data: Omit<MineQuarryData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  updateMineQuarry: (id: string, data: Omit<MineQuarryData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  deleteMineQuarry: (id: string) => Promise<void>;
  mergeMineQuarry: (sourceId: string, targetId: string) => Promise<void>;

  addVendorCustomer: (data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  updateVendorCustomer: (id: string, data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  deleteVendorCustomer: (id: string) => Promise<void>;
  mergeVendorCustomer: (sourceId: string, targetId: string) => Promise<void>;

  addRoyaltyOwnerProfile: (data: Omit<RoyaltyOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  updateRoyaltyOwnerProfile: (id: string, data: Omit<RoyaltyOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  deleteRoyaltyOwnerProfile: (id: string) => Promise<void>;
  mergeRoyaltyOwnerProfile: (sourceId: string, targetId: string) => Promise<void>;

  addTransportOwnerProfile: (data: Omit<TransportOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  updateTransportOwnerProfile: (id: string, data: Omit<TransportOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => Promise<void>;
  deleteTransportOwnerProfile: (id: string) => Promise<void>;
  mergeTransportOwnerProfile: (sourceId: string, targetId: string) => Promise<void>;

  addTransportOwnerVehicle: (data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>) => Promise<void>;
  updateTransportOwnerVehicle: (id: string, data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>) => Promise<void>;
  deleteTransportOwnerVehicle: (id: string) => Promise<void>;

  addMaterialTypeDefinition: (data: Omit<MaterialTypeDefinition, 'id'>) => Promise<void>;
  updateMaterialTypeDefinition: (id: string, data: Omit<MaterialTypeDefinition, 'id'>) => Promise<void>;
  deleteMaterialTypeDefinition: (id: string) => Promise<void>;
  mergeMaterialTypeDefinition: (sourceId: string, targetId: string) => Promise<void>;

  addMaterialRate: (data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>) => Promise<void>;
  updateMaterialRate: (id: string, data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>) => Promise<void>;
  deleteMaterialRate: (id: string) => Promise<void>;

  addMaterial: (material: Omit<Material, 'id'>) => Promise<void>;
  updateMaterial: (id: number, material: Omit<Material, 'id'>) => Promise<void>;
  deleteMaterial: (id: number) => Promise<void>;

  getRoyaltyStock: () => Promise<RoyaltyStock[]>;
  addRoyaltyStock: (stock: Omit<RoyaltyStock, 'id'>) => Promise<void>;

  refreshKey: number;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const [hasLoadedTrips, setHasLoadedTrips] = useState(false);
  const [hasLoadedTripMasters, setHasLoadedTripMasters] = useState(false);
  const [hasLoadedLegacyMasters, setHasLoadedLegacyMasters] = useState(false);
  const [hasLoadedAdvances, setHasLoadedAdvances] = useState(false);
  const [hasLoadedPayments, setHasLoadedPayments] = useState(false);
  const [hasLoadedLedgerEntries, setHasLoadedLedgerEntries] = useState(false);
  const [hasLoadedAccounts, setHasLoadedAccounts] = useState(false);
  const [hasLoadedAccountCategories, setHasLoadedAccountCategories] = useState(false);
  const [hasLoadedMaterials, setHasLoadedMaterials] = useState(false);
  const [hasLoadedRoyaltyStock, setHasLoadedRoyaltyStock] = useState(false);
  const [hasLoadedSiteLocations, setHasLoadedSiteLocations] = useState(false);
  const [hasLoadedMerchantTypes, setHasLoadedMerchantTypes] = useState(false);
  const [hasLoadedMerchants, setHasLoadedMerchants] = useState(false);
  const [hasLoadedMerchantBankAccounts, setHasLoadedMerchantBankAccounts] = useState(false);
  const [hasLoadedAccountTypes, setHasLoadedAccountTypes] = useState(false);
  const [hasLoadedVehicleMasters, setHasLoadedVehicleMasters] = useState(false);
  const [hasLoadedMineQuarries, setHasLoadedMineQuarries] = useState(false);
  const [hasLoadedVendorCustomers, setHasLoadedVendorCustomers] = useState(false);
  const [hasLoadedRoyaltyOwnerProfiles, setHasLoadedRoyaltyOwnerProfiles] = useState(false);
  const [hasLoadedTransportOwnerProfiles, setHasLoadedTransportOwnerProfiles] = useState(false);
  const [hasLoadedTransportOwnerVehicles, setHasLoadedTransportOwnerVehicles] = useState(false);
  const [hasLoadedMaterialTypeDefinitions, setHasLoadedMaterialTypeDefinitions] = useState(false);
  const [hasLoadedMaterialRates, setHasLoadedMaterialRates] = useState(false);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOwner[]>([]);
  const [quarries, setQuarries] = useState<QuarryOwner[]>([]);
  const [royaltyOwners, setRoyaltyOwners] = useState<RoyaltyOwner[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [royaltyStock, setRoyaltyStock] = useState<RoyaltyStock[]>([]);
  const [customerRates, setCustomerRates] = useState<CustomerRate[]>([]);
  const [siteLocations, setSiteLocations] = useState<SiteLocation[]>([]);
  const [merchantTypes, setMerchantTypes] = useState<MerchantType[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantBankAccounts, setMerchantBankAccounts] = useState<MerchantBankAccount[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [vehicleMasters, setVehicleMasters] = useState<VehicleMaster[]>([]);
  const [mineQuarries, setMineQuarries] = useState<MineQuarryData[]>([]);
  const [vendorCustomers, setVendorCustomers] = useState<VendorCustomerData[]>([]);
  const [royaltyOwnerProfiles, setRoyaltyOwnerProfiles] = useState<RoyaltyOwnerData[]>([]);
  const [transportOwnerProfiles, setTransportOwnerProfiles] = useState<TransportOwnerData[]>([]);
  const [transportOwnerVehicles, setTransportOwnerVehicles] = useState<TransportOwnerVehicle[]>([]);
  const [materialTypeDefinitions, setMaterialTypeDefinitions] = useState<MaterialTypeDefinition[]>([]);
  const [materialRates, setMaterialRates] = useState<MaterialRate[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountCategories, setAccountCategories] = useState<AccountCategory[]>([]);


  const refreshData = useCallback(() => {
    setRefreshKey(oldKey => oldKey + 1);
  }, []);

  useEffect(() => {
    setHasLoadedTrips(false);
    setHasLoadedTripMasters(false);
    setHasLoadedLegacyMasters(false);
    setHasLoadedAdvances(false);
    setHasLoadedPayments(false);
    setHasLoadedLedgerEntries(false);
    setHasLoadedAccounts(false);
    setHasLoadedAccountCategories(false);
    setHasLoadedMaterials(false);
    setHasLoadedRoyaltyStock(false);
    setHasLoadedSiteLocations(false);
    setHasLoadedMerchantTypes(false);
    setHasLoadedMerchants(false);
    setHasLoadedMerchantBankAccounts(false);
    setHasLoadedAccountTypes(false);
    setHasLoadedVehicleMasters(false);
    setHasLoadedMineQuarries(false);
    setHasLoadedVendorCustomers(false);
    setHasLoadedRoyaltyOwnerProfiles(false);
    setHasLoadedTransportOwnerProfiles(false);
    setHasLoadedTransportOwnerVehicles(false);
    setHasLoadedMaterialTypeDefinitions(false);
    setHasLoadedMaterialRates(false);
  }, [refreshKey]);

  const loadTrips = useCallback(async () => {
    if (!currentUser || hasLoadedTrips) return;
    const tripsData = await tripApi.getAll();
    setTrips(tripsData);
    setHasLoadedTrips(true);
  }, [currentUser, hasLoadedTrips]);

  const loadTripMasters = useCallback(async () => {
    if (!currentUser || hasLoadedTripMasters) return;
    const [
      siteLocationsData,
      merchantTypesData,
      vehicleMasterData,
      mineQuarryData,
      vendorCustomerData,
      royaltyOwnerData,
      transportOwnerData,
      materialTypeDefinitionData,
      materialRateData,
    ] = await Promise.all([
      siteLocationApi.getAll(),
      merchantTypeApi.getAll(),
      vehicleMasterApi.getAll(),
      mineQuarryApi.getAll(),
      vendorCustomerApi.getAll(),
      royaltyOwnerDataApi.getAll(),
      transportOwnerApi.getAll(),
      materialTypeDefinitionApi.getAll(),
      materialRateApi.getAll(),
    ]);
    setSiteLocations(siteLocationsData);
    setMerchantTypes(merchantTypesData);
    setVehicleMasters(vehicleMasterData);
    setMineQuarries(mineQuarryData);
    setVendorCustomers(vendorCustomerData);
    setRoyaltyOwnerProfiles(royaltyOwnerData);
    setTransportOwnerProfiles(transportOwnerData);
    setMaterialTypeDefinitions(materialTypeDefinitionData);
    setMaterialRates(materialRateData);
    setHasLoadedTripMasters(true);
  }, [currentUser, hasLoadedTripMasters]);

  const loadLegacyMasters = useCallback(async () => {
    if (!currentUser || hasLoadedLegacyMasters) return;
    const [vehiclesData, quarriesData, royaltyData, customersData, customerRatesData] = await Promise.all([
      api.getVehicleOwners(),
      api.getQuarryOwners(),
      api.getRoyaltyOwners(),
      api.getCustomers(),
      api.getCustomerRates(),
    ]);
    setVehicles(vehiclesData);
    setQuarries(quarriesData);
    setRoyaltyOwners(royaltyData);
    setCustomers(customersData);
    setCustomerRates(customerRatesData);
    setHasLoadedLegacyMasters(true);
  }, [currentUser, hasLoadedLegacyMasters]);

  const loadAdvances = useCallback(async () => {
    if (!currentUser || hasLoadedAdvances) return;
    const advancesData = await advanceApi.getAll();
    setAdvances(advancesData);
    setHasLoadedAdvances(true);
  }, [currentUser, hasLoadedAdvances]);

  const loadPayments = useCallback(async () => {
    if (!currentUser || hasLoadedPayments) return;
    const canReadPayments = [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT].includes(currentUser.role);
    if (!canReadPayments) {
      setPayments([]);
      setHasLoadedPayments(true);
      return;
    }
    const paymentsData = await paymentApi.getAll();
    setPayments(paymentsData);
    setHasLoadedPayments(true);
  }, [currentUser, hasLoadedPayments]);

  const loadLedgerEntries = useCallback(async () => {
    if (!currentUser || hasLoadedLedgerEntries) return;
    const ledgerData = await api.getLedgerEntries();
    setLedgerEntries(ledgerData);
    setHasLoadedLedgerEntries(true);
  }, [currentUser, hasLoadedLedgerEntries]);

  const loadAccounts = useCallback(async () => {
    if (!currentUser || hasLoadedAccounts) return;
    const accountsData = await api.getAccounts();
    setAccounts(accountsData);
    setHasLoadedAccounts(true);
  }, [currentUser, hasLoadedAccounts]);

  const loadAccountCategories = useCallback(async () => {
    if (!currentUser || hasLoadedAccountCategories) return;
    const categoriesData = await api.getAccountCategories();
    setAccountCategories(categoriesData);
    setHasLoadedAccountCategories(true);
  }, [currentUser, hasLoadedAccountCategories]);

  const loadMaterials = useCallback(async () => {
    if (!currentUser || hasLoadedMaterials) return;
    const materialsData = await api.getMaterials();
    setMaterials(materialsData);
    setHasLoadedMaterials(true);
  }, [currentUser, hasLoadedMaterials]);

  const loadRoyaltyStock = useCallback(async () => {
    if (!currentUser || hasLoadedRoyaltyStock) return;
    const stockData = await api.getRoyaltyStock();
    setRoyaltyStock(stockData);
    setHasLoadedRoyaltyStock(true);
  }, [currentUser, hasLoadedRoyaltyStock]);

  const loadSiteLocations = useCallback(async () => {
    if (!currentUser || hasLoadedSiteLocations) return;
    const siteLocationsData = await siteLocationApi.getAll();
    setSiteLocations(siteLocationsData);
    setHasLoadedSiteLocations(true);
  }, [currentUser, hasLoadedSiteLocations]);

  const loadMerchantTypes = useCallback(async () => {
    if (!currentUser || hasLoadedMerchantTypes) return;
    const merchantTypesData = await merchantTypeApi.getAll();
    setMerchantTypes(merchantTypesData);
    setHasLoadedMerchantTypes(true);
  }, [currentUser, hasLoadedMerchantTypes]);

  const loadMerchants = useCallback(async () => {
    if (!currentUser || hasLoadedMerchants) return;
    const merchantsData = await merchantApi.getAll();
    setMerchants(merchantsData);
    setHasLoadedMerchants(true);
  }, [currentUser, hasLoadedMerchants]);

  const loadMerchantBankAccounts = useCallback(async () => {
    if (!currentUser || hasLoadedMerchantBankAccounts) return;
    const merchantBankAccountsData = await merchantBankApi.getAll();
    setMerchantBankAccounts(merchantBankAccountsData);
    setHasLoadedMerchantBankAccounts(true);
  }, [currentUser, hasLoadedMerchantBankAccounts]);

  const loadAccountTypes = useCallback(async () => {
    if (!currentUser || hasLoadedAccountTypes) return;
    const accountTypesData = await accountTypeApi.getAll();
    setAccountTypes(accountTypesData);
    setHasLoadedAccountTypes(true);
  }, [currentUser, hasLoadedAccountTypes]);

  const loadVehicleMasters = useCallback(async () => {
    if (!currentUser || hasLoadedVehicleMasters) return;
    const vehicleMasterData = await vehicleMasterApi.getAll();
    setVehicleMasters(vehicleMasterData);
    setHasLoadedVehicleMasters(true);
  }, [currentUser, hasLoadedVehicleMasters]);

  const loadMineQuarries = useCallback(async () => {
    if (!currentUser || hasLoadedMineQuarries) return;
    const mineQuarryData = await mineQuarryApi.getAll();
    setMineQuarries(mineQuarryData);
    setHasLoadedMineQuarries(true);
  }, [currentUser, hasLoadedMineQuarries]);

  const loadVendorCustomers = useCallback(async () => {
    if (!currentUser || hasLoadedVendorCustomers) return;
    const vendorCustomerData = await vendorCustomerApi.getAll();
    setVendorCustomers(vendorCustomerData);
    setHasLoadedVendorCustomers(true);
  }, [currentUser, hasLoadedVendorCustomers]);

  const loadRoyaltyOwnerProfiles = useCallback(async () => {
    if (!currentUser || hasLoadedRoyaltyOwnerProfiles) return;
    const royaltyOwnerData = await royaltyOwnerDataApi.getAll();
    setRoyaltyOwnerProfiles(royaltyOwnerData);
    setHasLoadedRoyaltyOwnerProfiles(true);
  }, [currentUser, hasLoadedRoyaltyOwnerProfiles]);

  const loadTransportOwnerProfiles = useCallback(async () => {
    if (!currentUser || hasLoadedTransportOwnerProfiles) return;
    const transportOwnerData = await transportOwnerApi.getAll();
    setTransportOwnerProfiles(transportOwnerData);
    setHasLoadedTransportOwnerProfiles(true);
  }, [currentUser, hasLoadedTransportOwnerProfiles]);

  const loadTransportOwnerVehicles = useCallback(async () => {
    if (!currentUser || hasLoadedTransportOwnerVehicles) return;
    const transportOwnerVehicleData = await transportOwnerVehicleApi.getAll();
    setTransportOwnerVehicles(transportOwnerVehicleData);
    setHasLoadedTransportOwnerVehicles(true);
  }, [currentUser, hasLoadedTransportOwnerVehicles]);

  const loadMaterialTypeDefinitions = useCallback(async () => {
    if (!currentUser || hasLoadedMaterialTypeDefinitions) return;
    const materialTypeDefinitionData = await materialTypeDefinitionApi.getAll();
    setMaterialTypeDefinitions(materialTypeDefinitionData);
    setHasLoadedMaterialTypeDefinitions(true);
  }, [currentUser, hasLoadedMaterialTypeDefinitions]);

  const loadMaterialRates = useCallback(async () => {
    if (!currentUser || hasLoadedMaterialRates) return;
    const materialRateData = await materialRateApi.getAll();
    setMaterialRates(materialRateData);
    setHasLoadedMaterialRates(true);
  }, [currentUser, hasLoadedMaterialRates]);

  useEffect(() => {
    if (!currentUser) {
        setTrips([]);
        setAdvances([]);
        setPayments([]);
        setLedgerEntries([]);
        setVehicles([]);
        setQuarries([]);
        setRoyaltyOwners([]);
        setCustomers([]);
        setCustomerRates([]);
        setSiteLocations([]);
        setMerchantTypes([]);
        setMerchants([]);
        setMerchantBankAccounts([]);
        setAccountTypes([]);
        setVehicleMasters([]);
        setMineQuarries([]);
        setVendorCustomers([]);
        setRoyaltyOwnerProfiles([]);
        setTransportOwnerProfiles([]);
        setTransportOwnerVehicles([]);
        setMaterialTypeDefinitions([]);
        setMaterialRates([]);
        setMaterials([]);
        setRoyaltyStock([]);
        setAccounts([]);
        setAccountCategories([]);
        setLoading(false);
        setHasLoadedTrips(false);
        setHasLoadedTripMasters(false);
        setHasLoadedLegacyMasters(false);
        setHasLoadedAdvances(false);
        setHasLoadedPayments(false);
        setHasLoadedLedgerEntries(false);
        setHasLoadedAccounts(false);
        setHasLoadedAccountCategories(false);
        setHasLoadedMaterials(false);
        setHasLoadedRoyaltyStock(false);
        setHasLoadedSiteLocations(false);
        setHasLoadedMerchantTypes(false);
        setHasLoadedMerchants(false);
        setHasLoadedMerchantBankAccounts(false);
        setHasLoadedAccountTypes(false);
        setHasLoadedVehicleMasters(false);
        setHasLoadedMineQuarries(false);
        setHasLoadedVendorCustomers(false);
        setHasLoadedRoyaltyOwnerProfiles(false);
        setHasLoadedTransportOwnerProfiles(false);
        setHasLoadedTransportOwnerVehicles(false);
        setHasLoadedMaterialTypeDefinitions(false);
        setHasLoadedMaterialRates(false);
        return;
    }
    setLoading(false);
  }, [currentUser]);

  const addTrip = async (trip: Omit<NewTripData, 'createdBy'>) => {
    if (!currentUser) throw new Error("User not authenticated");
    const getRatePartyIdByName = (type: string, name?: string) => {
      if (!name) return '';
      switch (type) {
        case 'vendor-customer':
          return vendorCustomers.find(item => item.name === name)?.id || '';
        case 'mine-quarry':
          return mineQuarries.find(item => item.name === name)?.id || '';
        case 'royalty-owner':
          return royaltyOwnerProfiles.find(item => item.name === name)?.id || '';
        case 'transport-owner':
          return transportOwnerProfiles.find(item => item.name === name)?.id || '';
        default:
          return '';
      }
    };

    const getMaterialTypeIdByName = (name?: string) => {
      if (!name) return '';
      return materialTypeDefinitions.find(item => item.name === name)?.id || '';
    };

    const getLocationIdByName = (name?: string) => {
      if (!name) return '';
      return siteLocations.find(item => item.name === name)?.id || '';
    };

    const findRate = (ratePartyType: string, partyName?: string) => {
      const partyId = getRatePartyIdByName(ratePartyType, partyName);
      const materialTypeId = getMaterialTypeIdByName(trip.material);
      const pickupLocationId = getLocationIdByName(trip.pickupPlace);
      const dropOffLocationId = getLocationIdByName(trip.dropOffPlace);
      if (!partyId || !materialTypeId || !pickupLocationId || !dropOffLocationId) return 0;
      const tripDate = new Date(trip.date);
      const candidates = materialRates.filter(rate =>
        rate.ratePartyType === ratePartyType
        && rate.ratePartyId === partyId
        && rate.materialTypeId === materialTypeId
        && rate.pickupLocationId === pickupLocationId
        && rate.dropOffLocationId === dropOffLocationId
        && new Date(rate.effectiveFrom) <= tripDate
        && (!rate.effectiveTo || new Date(rate.effectiveTo) >= tripDate)
      );
      if (candidates.length === 0) return 0;
      const latest = candidates.sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0];
      return latest.totalRatePerTon || 0;
    };

    const netWeight = Number(trip.netWeight || 0);
    const resolveOverrideRate = (ratePartyType: string) => {
      if (!trip.rateOverrideEnabled || !trip.rateOverride) return null;
      if (trip.rateOverride.ratePartyType !== ratePartyType) return null;
      return Number(trip.rateOverride.totalRatePerTon || 0);
    };

    const customerRate = resolveOverrideRate('vendor-customer') ?? findRate('vendor-customer', trip.customer);
    const quarryRate = resolveOverrideRate('mine-quarry') ?? findRate('mine-quarry', trip.quarryName);
    const transportRate = resolveOverrideRate('transport-owner') ?? findRate('transport-owner', trip.transporterName);
    const royaltyRate = resolveOverrideRate('royalty-owner') ?? findRate('royalty-owner', trip.royaltyOwnerName);

    const revenue = customerRate * netWeight;
    const materialCost = quarryRate * netWeight;
    const transportCost = transportRate * netWeight;
    const royaltyCost = royaltyRate * netWeight;
    const profit = revenue - (materialCost + transportCost + royaltyCost);

    const newTripData = {
      ...trip,
      createdBy: currentUser.name,
      revenue,
      materialCost,
      transportCost,
      royaltyCost,
      profit,
    };
    const createdTrip = await tripApi.create(newTripData);
    setTrips(prev => [createdTrip, ...prev]);
  }
  
  const updateTrip = async (tripId: number, tripData: Partial<Trip>) => {
    const updatedTrip = await tripApi.update(tripId, tripData);
    setTrips(prev => prev.map(trip => trip.id === tripId ? updatedTrip : trip));
  };

  const deleteTrip = async (tripId: number) => {
    await tripApi.remove(tripId);
    setTrips(prev => prev.filter(trip => trip.id !== tripId));
  };

  const addAdvance = async (advance: Omit<Advance, 'id'>) => {
    await advanceApi.create(advance);
    refreshData();
  };
  const updateAdvance = async (id: string, data: Omit<Advance, 'id'>) => {
    await advanceApi.update(id, data);
    refreshData();
  };
  const deleteAdvance = async (id: string) => {
    await advanceApi.remove(id);
    refreshData();
  };

  const addPayment = async (payment: Omit<Payment, 'id'>) => {
    await paymentApi.create(payment);
    refreshData();
  };

  const updatePayment = async (id: string, data: Omit<Payment, 'id'>) => {
    await paymentApi.update(id, data);
    refreshData();
  };

  const deletePayment = async (id: string) => {
    await paymentApi.remove(id);
    refreshData();
  };

  const addLedgerEntry = async (entry: Omit<LedgerEntry, 'id'>) => {
    await api.addLedgerEntry(entry);
    refreshData();
  };

  const updateLedgerEntry = async (id: string, entry: Omit<LedgerEntry, 'id'>) => {
    await api.updateLedgerEntry(id, entry);
    refreshData();
  };

  const deleteLedgerEntry = async (id: string) => {
    await api.deleteLedgerEntry(id);
    refreshData();
  };
  
  const addAccount = async (account: Omit<Account, 'id'>) => {
    await api.addAccount(account);
    refreshData();
  };
  
  const addAccountCategory = async (category: Omit<AccountCategory, 'id'>) => {
    await api.addAccountCategory(category);
    refreshData();
  }

  const addVehicleMaster = async (vehicle: Omit<VehicleMaster, 'id'>) => {
    const newVehicle = await vehicleMasterApi.create(vehicle);
    setVehicleMasters(prev => [...prev, newVehicle]);
  };

  const updateVehicleMaster = async (id: string, vehicle: Omit<VehicleMaster, 'id'>) => {
    const updatedVehicle = await vehicleMasterApi.update(id, vehicle);
    setVehicleMasters(prev => prev.map(item => item.id === id ? updatedVehicle : item));
  };

  const deleteVehicleMaster = async (id: string) => {
    await vehicleMasterApi.remove(id);
    setVehicleMasters(prev => prev.filter(item => item.id !== id));
  };

  const getDailyExpenses = useCallback(async (supervisorName: string) => dailyExpenseApi.getBySupervisor(supervisorName), []);
  const addDailyExpense = async (expense: Omit<DailyExpense, 'id'|'availableBalance'|'closingBalance'>) => {
    await dailyExpenseApi.create(expense);
  };
  const updateDailyExpense = async (id: string, expense: Omit<DailyExpense, 'id'|'availableBalance'|'closingBalance'>) => {
    await dailyExpenseApi.update(id, expense);
  };
  const deleteDailyExpense = async (id: string) => {
    await dailyExpenseApi.remove(id);
  };
  const getSupervisorAccounts = useCallback(async () => {
    const users = await usersApi.listUsers();
    return users
      .filter((user) => user.role === Role.PICKUP_SUPERVISOR || user.role === Role.DROPOFF_SUPERVISOR)
      .map((user) => user.name);
  }, []);

  const addVehicleOwner = async (vehicleOwner: Omit<VehicleOwner, 'id'>) => { await api.addVehicleOwner(vehicleOwner); refreshData(); };
  const updateVehicleOwner = async (id: string, vehicleOwner: Omit<VehicleOwner, 'id' | 'rates'>) => { await api.updateVehicleOwner(id, vehicleOwner); refreshData(); };
  const deleteVehicleOwner = async (id: string) => { await api.deleteVehicleOwner(id); refreshData(); };
  const addTransportRate = async (transportId: string, rate: Omit<RateEntry, 'id'>) => { await api.addTransportRate(transportId, rate); refreshData(); };
  const updateTransportRate = async (transportId: string, rate: RateEntry) => { await api.updateTransportRate(transportId, rate); refreshData(); };
  const deleteTransportRate = async (transportId: string, rateId: string) => { await api.deleteTransportRate(transportId, rateId); refreshData(); };

  const addQuarryOwner = async (quarryOwner: Omit<QuarryOwner, 'id'>) => { await api.addQuarryOwner(quarryOwner); refreshData(); };
  const addQuarryRate = async (quarryId: string, rate: Omit<RateEntry, 'id'>) => { await api.addQuarryRate(quarryId, rate); refreshData(); };
  const updateQuarryRate = async (quarryId: string, rate: RateEntry) => { await api.updateQuarryRate(quarryId, rate); refreshData(); };
  const deleteQuarryRate = async (quarryId: string, rateId: string) => { await api.deleteQuarryRate(quarryId, rateId); refreshData(); };

  const addRoyaltyOwner = async (royaltyOwner: Omit<RoyaltyOwner, 'id'>) => { await api.addRoyaltyOwner(royaltyOwner); refreshData(); };
  const addRoyaltyRate = async (royaltyId: string, rate: Omit<RateEntry, 'id'>) => { await api.addRoyaltyRate(royaltyId, rate); refreshData(); };
  const updateRoyaltyRate = async (royaltyId: string, rate: RateEntry) => { await api.updateRoyaltyRate(royaltyId, rate); refreshData(); };
  const deleteRoyaltyRate = async (royaltyId: string, rateId: string) => { await api.deleteRoyaltyRate(royaltyId, rateId); refreshData(); };

  const addCustomer = async (customer: Omit<Customer, 'id'>) => { await api.addCustomer(customer); refreshData(); };
  const addCustomerRate = async (customerId: string, rate: Omit<RateEntry, 'id'>) => { await api.addCustomerRate(customerId, rate); refreshData(); };
  const updateCustomerRate = async (customerId: string, rate: RateEntry) => { await api.updateCustomerRate(customerId, rate); refreshData(); };
  const deleteCustomerRate = async (customerId: string, rateId: string) => { await api.deleteCustomerRate(customerId, rateId); refreshData(); };

  const addSiteLocation = async (site: Omit<SiteLocation, 'id'>) => {
    const newSite = await siteLocationApi.create(site);
    setSiteLocations(prev => [...prev, newSite]);
    return newSite;
  };
  const updateSiteLocation = async (id: string, site: Omit<SiteLocation, 'id'>) => {
    const updatedSite = await siteLocationApi.update(id, site);
    setSiteLocations(prev => prev.map(location => location.id === id ? updatedSite : location));
  };
  const deleteSiteLocation = async (id: string) => {
    await siteLocationApi.remove(id);
    setSiteLocations(prev => prev.filter(location => location.id !== id));
  };
  const mergeSiteLocation = async (sourceId: string, targetId: string) => {
    await siteLocationApi.merge(sourceId, targetId);
    refreshData();
  };

  const addMerchantType = async (data: Omit<MerchantType, 'id'>) => {
    const newType = await merchantTypeApi.create(data);
    setMerchantTypes(prev => [...prev, newType]);
  };
  const updateMerchantType = async (id: string, data: Omit<MerchantType, 'id'>) => {
    const updatedType = await merchantTypeApi.update(id, data);
    setMerchantTypes(prev => prev.map(type => type.id === id ? updatedType : type));
  };
  const deleteMerchantType = async (id: string) => {
    await merchantTypeApi.remove(id);
    setMerchantTypes(prev => prev.filter(type => type.id !== id));
  };

  const addMerchant = async (data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const newMerchant = await merchantApi.create(data);
    setMerchants(prev => [...prev, newMerchant]);
  };
  const updateMerchant = async (id: string, data: Omit<Merchant, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const updatedMerchant = await merchantApi.update(id, data);
    setMerchants(prev => prev.map(merchant => merchant.id === id ? updatedMerchant : merchant));
  };
  const deleteMerchant = async (id: string) => {
    await merchantApi.remove(id);
    setMerchants(prev => prev.filter(merchant => merchant.id !== id));
  };

  const addMerchantBankAccount = async (data: Omit<MerchantBankAccount, 'id' | 'merchantName'>) => {
    const newAccount = await merchantBankApi.create(data);
    setMerchantBankAccounts(prev => [...prev, newAccount]);
  };
  const updateMerchantBankAccount = async (id: string, data: Omit<MerchantBankAccount, 'id' | 'merchantName'>) => {
    const updatedAccount = await merchantBankApi.update(id, data);
    setMerchantBankAccounts(prev => prev.map(account => account.id === id ? updatedAccount : account));
  };
  const deleteMerchantBankAccount = async (id: string) => {
    await merchantBankApi.remove(id);
    setMerchantBankAccounts(prev => prev.filter(account => account.id !== id));
  };

  const addAccountType = async (data: Omit<AccountType, 'id'>) => {
    const newType = await accountTypeApi.create(data);
    setAccountTypes(prev => [...prev, newType]);
  };
  const updateAccountType = async (id: string, data: Omit<AccountType, 'id'>) => {
    const updatedType = await accountTypeApi.update(id, data);
    setAccountTypes(prev => prev.map(type => type.id === id ? updatedType : type));
  };
  const deleteAccountType = async (id: string) => {
    await accountTypeApi.remove(id);
    setAccountTypes(prev => prev.filter(type => type.id !== id));
  };

  const addMineQuarry = async (data: Omit<MineQuarryData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const newItem = await mineQuarryApi.create(data);
    setMineQuarries(prev => [...prev, newItem]);
  };
  const updateMineQuarry = async (id: string, data: Omit<MineQuarryData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const updatedItem = await mineQuarryApi.update(id, data);
    setMineQuarries(prev => prev.map(item => item.id === id ? updatedItem : item));
  };
  const deleteMineQuarry = async (id: string) => {
    await mineQuarryApi.remove(id);
    setMineQuarries(prev => prev.filter(item => item.id !== id));
  };
  const mergeMineQuarry = async (sourceId: string, targetId: string) => {
    await mineQuarryApi.merge(sourceId, targetId);
    refreshData();
  };

  const addVendorCustomer = async (data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const newItem = await vendorCustomerApi.create(data);
    setVendorCustomers(prev => [...prev, newItem]);
  };
  const updateVendorCustomer = async (id: string, data: Omit<VendorCustomerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const updatedItem = await vendorCustomerApi.update(id, data);
    setVendorCustomers(prev => prev.map(item => item.id === id ? updatedItem : item));
  };
  const deleteVendorCustomer = async (id: string) => {
    await vendorCustomerApi.remove(id);
    setVendorCustomers(prev => prev.filter(item => item.id !== id));
  };
  const mergeVendorCustomer = async (sourceId: string, targetId: string) => {
    await vendorCustomerApi.merge(sourceId, targetId);
    refreshData();
  };

  const addRoyaltyOwnerProfile = async (data: Omit<RoyaltyOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const newItem = await royaltyOwnerDataApi.create(data);
    setRoyaltyOwnerProfiles(prev => [...prev, newItem]);
  };
  const updateRoyaltyOwnerProfile = async (id: string, data: Omit<RoyaltyOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const updatedItem = await royaltyOwnerDataApi.update(id, data);
    setRoyaltyOwnerProfiles(prev => prev.map(item => item.id === id ? updatedItem : item));
  };
  const deleteRoyaltyOwnerProfile = async (id: string) => {
    await royaltyOwnerDataApi.remove(id);
    setRoyaltyOwnerProfiles(prev => prev.filter(item => item.id !== id));
  };
  const mergeRoyaltyOwnerProfile = async (sourceId: string, targetId: string) => {
    await royaltyOwnerDataApi.merge(sourceId, targetId);
    refreshData();
  };

  const addTransportOwnerProfile = async (data: Omit<TransportOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const newItem = await transportOwnerApi.create(data);
    setTransportOwnerProfiles(prev => [...prev, newItem]);
  };
  const updateTransportOwnerProfile = async (id: string, data: Omit<TransportOwnerData, 'id' | 'merchantTypeName' | 'siteLocationName'>) => {
    const updatedItem = await transportOwnerApi.update(id, data);
    setTransportOwnerProfiles(prev => prev.map(item => item.id === id ? updatedItem : item));
  };
  const deleteTransportOwnerProfile = async (id: string) => {
    await transportOwnerApi.remove(id);
    setTransportOwnerProfiles(prev => prev.filter(item => item.id !== id));
  };
  const mergeTransportOwnerProfile = async (sourceId: string, targetId: string) => {
    await transportOwnerApi.merge(sourceId, targetId);
    refreshData();
  };

  const addTransportOwnerVehicle = async (data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>) => {
    const newItem = await transportOwnerVehicleApi.create(data);
    setTransportOwnerVehicles(prev => [...prev, newItem]);
  };
  const updateTransportOwnerVehicle = async (id: string, data: Omit<TransportOwnerVehicle, 'id' | 'transportOwnerName'>) => {
    const updatedItem = await transportOwnerVehicleApi.update(id, data);
    setTransportOwnerVehicles(prev => prev.map(item => item.id === id ? updatedItem : item));
  };
  const deleteTransportOwnerVehicle = async (id: string) => {
    await transportOwnerVehicleApi.remove(id);
    setTransportOwnerVehicles(prev => prev.filter(item => item.id !== id));
  };

  const addMaterialTypeDefinition = async (data: Omit<MaterialTypeDefinition, 'id'>) => {
    const newItem = await materialTypeDefinitionApi.create(data);
    setMaterialTypeDefinitions(prev => [...prev, newItem]);
  };
  const updateMaterialTypeDefinition = async (id: string, data: Omit<MaterialTypeDefinition, 'id'>) => {
    const updatedItem = await materialTypeDefinitionApi.update(id, data);
    setMaterialTypeDefinitions(prev => prev.map(item => item.id === id ? updatedItem : item));
  };
  const deleteMaterialTypeDefinition = async (id: string) => {
    await materialTypeDefinitionApi.remove(id);
    setMaterialTypeDefinitions(prev => prev.filter(item => item.id !== id));
  };
  const mergeMaterialTypeDefinition = async (sourceId: string, targetId: string) => {
    await materialTypeDefinitionApi.merge(sourceId, targetId);
    refreshData();
  };

  const addMaterialRate = async (data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>) => {
    const newItem = await materialRateApi.create(data);
    setMaterialRates(prev => [...prev, newItem]);
  };
  const updateMaterialRate = async (id: string, data: Omit<MaterialRate, 'id' | 'materialTypeName' | 'ratePartyName' | 'pickupLocationName' | 'dropOffLocationName'>) => {
    const updatedItem = await materialRateApi.update(id, data);
    setMaterialRates(prev => prev.map(item => item.id === id ? updatedItem : item));
  };
  const deleteMaterialRate = async (id: string) => {
    await materialRateApi.remove(id);
    setMaterialRates(prev => prev.filter(item => item.id !== id));
  };

  const addMaterial = async (material: Omit<Material, 'id'>) => { await api.addMaterial(material); refreshData(); };
  const updateMaterial = async (id: number, material: Omit<Material, 'id'>) => { await api.updateMaterial(id, material); refreshData(); };
  const deleteMaterial = async (id: number) => { await api.deleteMaterial(id); refreshData(); };
  
  const getRoyaltyStock = async () => api.getRoyaltyStock();
  const addRoyaltyStock = async (stock: Omit<RoyaltyStock, 'id'>) => { await api.addRoyaltyStock(stock); refreshData(); };

  const value = {
    loadTrips,
    loadTripMasters,
    loadLegacyMasters,
    loadAdvances,
    loadPayments,
    loadLedgerEntries,
    loadAccounts,
    loadAccountCategories,
    loadMaterials,
    loadRoyaltyStock,
    loadSiteLocations,
    loadMerchantTypes,
    loadMerchants,
    loadMerchantBankAccounts,
    loadAccountTypes,
    loadVehicleMasters,
    loadMineQuarries,
    loadVendorCustomers,
    loadRoyaltyOwnerProfiles,
    loadTransportOwnerProfiles,
    loadTransportOwnerVehicles,
    loadMaterialTypeDefinitions,
    loadMaterialRates,
    trips,
    advances,
    payments,
    ledgerEntries,
    vehicles,
    quarries,
    royaltyOwners,
    customers,
    royaltyStock,
    customerRates,
    siteLocations,
    merchantTypes,
    merchants,
    merchantBankAccounts,
    accountTypes,
    vehicleMasters,
    mineQuarries,
    vendorCustomers,
    royaltyOwnerProfiles,
    transportOwnerProfiles,
    transportOwnerVehicles,
    materialTypeDefinitions,
    materialRates,
    materials,
    accounts,
    accountCategories,
    loading,
    addTrip,
    updateTrip,
    deleteTrip,
    addAdvance,
    updateAdvance,
    deleteAdvance,
    addPayment,
    updatePayment,
    deletePayment,
    addLedgerEntry,
    updateLedgerEntry,
    deleteLedgerEntry,
    getDailyExpenses,
    addDailyExpense,
    updateDailyExpense,
    deleteDailyExpense,
    getSupervisorAccounts,
    addAccount,
    addAccountCategory,
    addVehicleMaster,
    updateVehicleMaster,
    deleteVehicleMaster,
    addVehicleOwner,
    updateVehicleOwner,
    deleteVehicleOwner,
    addTransportRate, updateTransportRate, deleteTransportRate,
    addQuarryOwner,
    addQuarryRate, updateQuarryRate, deleteQuarryRate,
    addRoyaltyOwner,
    addRoyaltyRate, updateRoyaltyRate, deleteRoyaltyRate,
    addCustomer,
    addCustomerRate, updateCustomerRate, deleteCustomerRate,
    addSiteLocation,
    updateSiteLocation,
    deleteSiteLocation,
    mergeSiteLocation,
    addMerchantType,
    updateMerchantType,
    deleteMerchantType,
    addMerchant,
    updateMerchant,
    deleteMerchant,
    addMerchantBankAccount,
    updateMerchantBankAccount,
    deleteMerchantBankAccount,
    addAccountType,
    updateAccountType,
    deleteAccountType,
    addMineQuarry,
    updateMineQuarry,
    deleteMineQuarry,
    mergeMineQuarry,
    addVendorCustomer,
    updateVendorCustomer,
    deleteVendorCustomer,
    mergeVendorCustomer,
    addRoyaltyOwnerProfile,
    updateRoyaltyOwnerProfile,
    deleteRoyaltyOwnerProfile,
    mergeRoyaltyOwnerProfile,
    addTransportOwnerProfile,
    updateTransportOwnerProfile,
    deleteTransportOwnerProfile,
    mergeTransportOwnerProfile,
    addTransportOwnerVehicle,
    updateTransportOwnerVehicle,
    deleteTransportOwnerVehicle,
    addMaterialTypeDefinition,
    updateMaterialTypeDefinition,
    deleteMaterialTypeDefinition,
    mergeMaterialTypeDefinition,
    addMaterialRate,
    updateMaterialRate,
    deleteMaterialRate,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    getRoyaltyStock, addRoyaltyStock,
    refreshKey,
    refreshData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
