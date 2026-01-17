import React from 'react';

// Using `declare global` to augment the JSX namespace for custom elements.
// This ensures that our custom 'ion-icon' type is merged with React's
// built-in IntrinsicElements without causing module resolution issues.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'ion-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        name: string;
      };
    }
  }
}

export interface Trip {
  id: number;
  date: string;
  place: string;
  pickupPlace?: string;
  dropOffPlace?: string;
  vendorName: string;
  vendorCustomerIsOneOff?: boolean;
  customer: string;
  invoiceDCNumber: string;
  quarryName: string;
  mineQuarryIsOneOff?: boolean;
  royaltyOwnerName: string;
  royaltyOwnerIsOneOff?: boolean;
  material: string;
  vehicleNumber: string;
  vehicleIsOneOff?: boolean;
  transporterName:string;
  transportOwnerIsOneOff?: boolean;
  transportOwnerMobileNumber?: string;
  emptyWeight: number;
  grossWeight: number;
  netWeight: number;
  royaltyNumber: string;
  royaltyTons: number;
  royaltyM3: number;
  deductionPercentage: number;
  sizeChangePercentage: number;
  tonnage: number;
  revenue: number;
  materialCost: number;
  transportCost: number;
  royaltyCost: number;
  profit: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  agent?: string;

  // New fields for supervisor workflow
  status: 'pending upload' | 'in transit' | 'pending validation' | 'completed';
  createdBy: string;
  ewayBillUpload?: TripUploadPayload;
  invoiceDCUpload?: TripUploadPayload;
  waymentSlipUpload?: TripUploadPayload;
  royaltyUpload?: TripUploadPayload;
  taxInvoiceUpload?: TripUploadPayload;

  // New fields for received trips
  receivedDate?: string;
  receivedBy?: string;
  receivedByRole?: string;
  endEmptyWeight?: number;
  endGrossWeight?: number;
  endNetWeight?: number;
  endWaymentSlipUpload?: TripUploadPayload;
  weightDifferenceReason?: string;
  validatedBy?: string;
  validatedAt?: string;
  validationComments?: string;
  pendingRequestType?: 'delete' | 'update' | 'sent-back' | string;
  pendingRequestMessage?: string;
  pendingRequestBy?: string;
  pendingRequestRole?: string;
  pendingRequestAt?: string;
  rateOverrideEnabled?: boolean;
  rateOverride?: TripRateOverride | null;
  activityCount?: number;
}

export interface TripRateOverride {
  materialTypeId: string;
  ratePartyType: RatePartyType;
  ratePartyId: string;
  pickupLocationId: string;
  dropOffLocationId: string;
  totalKm: number;
  ratePerKm: number;
  ratePerTon: number;
  gstChargeable: boolean;
  gstPercentage: number;
  gstAmount: number;
  totalRatePerTon: number;
  effectiveFrom: string;
  effectiveTo?: string;
  remarks: string;
}

export interface TripUploadFile {
  name: string;
  url: string;
}

export type TripUploadPayload = string | TripUploadFile[];

export interface TripActivity {
  id: string;
  tripId: number;
  action: string;
  message: string;
  attachments?: TripUploadFile[] | null;
  actorName: string;
  actorRole: string;
  createdAt: string;
}

export interface DailyExpense {
    id: string;
    date: string;
    from: string; // Supervisor name
    to: string; // Freeform text
    via?: string;
    headAccount?: string;
    siteExpense?: boolean;
    ratePartyType?: RatePartyType;
    ratePartyId?: string;
    counterpartyName?: string;
    amount: number;
    category?: string;
    subCategory?: string;
    remarks: string;
    availableBalance: number;
    closingBalance: number;
    voucherUploads?: unknown;
    type: 'DEBIT' | 'CREDIT'; // DEBIT = Expense, CREDIT = Top Up
}

export interface Advance {
  id: string;
  date: string;
  tripId?: number;
  ratePartyType?: RatePartyType;
  ratePartyId?: string;
  counterpartyName?: string;
  fromAccount: string;
  toAccount: string;
  place?: string;
  invoiceDCNumber?: string;
  ownerAndTransporterName?: string;
  vehicleNumber?: string;
  purpose: string;
  amount: number;
  voucherSlipUpload?: string;
  remarks?: string;
}

export interface Payment {
    id: string;
    tripId?: number | null;
    amount: number;
    date: string;
    type: PaymentType;
    entryType?: string;
    headAccount?: string;
    ratePartyType?: string;
    ratePartyId?: string;
    counterpartyName?: string;
    method?: string;
    remarks?: string;
    via?: string;
    fromAccount?: string;
    toAccount?: string;
    category?: string;
    subCategory?: string;
    siteExpense?: boolean;
    voucherUploads?: unknown;
    createdBy?: string;
}

export enum PaymentType {
    PAYMENT = 'PAYMENT',
    RECEIPT = 'RECEIPT',
}

export enum Role {
    ADMIN = 'ADMIN',
    MANAGER = 'MANAGER',
    ACCOUNTANT = 'ACCOUNTANT',
    PICKUP_SUPERVISOR = 'PICKUP_SUPERVISOR',
    DROPOFF_SUPERVISOR = 'DROPOFF_SUPERVISOR',
    GUEST = 'GUEST',
}

export interface User {
    id: string;
    username?: string;
    name: string;
    role: Role;
    avatarUrl?: string;
    password?: string;
    mobileNumber?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    pickupLocationId?: string | null;
    dropOffLocationId?: string | null;
    pickupLocationName?: string | null;
    dropOffLocationName?: string;
}

export interface Notification {
    id: string;
    message: string;
    type: 'alert' | 'info' | 'success';
    timestamp: string;
    read: boolean;
    targetRole?: string | null;
    targetUser?: string | null;
    tripId?: number | null;
    requestType?: 'delete' | 'update' | 'sent-back' | string | null;
    requesterName?: string | null;
    requesterRole?: string | null;
    requestMessage?: string | null;
    requesterContact?: string | null;
}

export interface DailySummary {
    totalTrips: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
}
export interface FinancialStatus {
    outstandingCustomer: number;
    outstandingTransporter: number;
    outstandingQuarry: number;
}
export interface ChartData {
    name: string;
    value: number;
}

// Updated based on request for more detailed ledger entries
export interface LedgerEntry {
    id: string;
    date: string;
    from: string;
    via: string;
    to: string;
    actualTo: string;
    amount: number;
    toBank: string;
    split: string;
    paymentSubType: string;
    paymentType: string;
    remarks: string;
    type: 'CREDIT' | 'DEBIT';
}

export interface RateEntry {
    id: string;
    fromSite: string;
    materialType: string;
    ratePerTon?: number;
    ratePerKm?: number;
    ratePerM3?: number;
    gst: 'inclusive' | 'exclusive' | '';
    gstPercentage: number;
    gstAmount: number;
    totalRate: number;
    effectiveFrom: string;
    effectiveTo: string;
    active: 'active' | 'not active';
    remarks: string;
}
export interface BaseOwner {
    id: string;
    contactNumber: string;
    address: string;
    openingBalance: number;
    rates: RateEntry[];
}
export interface VehicleOwner extends BaseOwner {
    ownerName: string;
    vehicleNumber: string;
    vehicleType: string;
    vehicleCapacity: number;
}
export interface QuarryOwner extends BaseOwner {
    ownerName: string;
    quarryName: string;
    quarryArea: number;
}
export interface RoyaltyOwner extends BaseOwner {
    ownerName: string;
    quarryArea: number;
}
export interface Customer extends BaseOwner {
    name: string;
}

export interface CustomerRate {
  id: number | string;
  customer: string;
  material: string;
  rate: string;
  from: string;
  to: string;
  active: boolean;
  rejectionPercent: string;
  rejectionRemarks: string;
  locationFrom: string;
  locationTo: string;
}

export interface SiteLocation {
    id: string;
    name: string;
    type: 'pickup' | 'drop-off' | 'both';
    address: string;
    pointOfContact: string;
    remarks: string;
}

export interface MerchantType {
    id: string;
    name: string;
    remarks: string;
}

export interface Merchant {
    id: string;
    merchantTypeId: string;
    merchantTypeName?: string;
    name: string;
    contactNumber: string;
    email: string;
    siteLocationId: string;
    siteLocationName?: string;
    companyName: string;
    gstOptIn: boolean;
    gstNumber: string;
    gstDetails: string;
    remarks: string;
}

export interface MerchantBankAccount {
    id: string;
    merchantId: string;
    merchantName?: string;
    accountType: string;
    ratePartyType?: RatePartyType;
    ratePartyId?: string;
    ratePartyName?: string;
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    remarks: string;
}

export interface AccountType {
    id: string;
    name: string;
    remarks: string;
}

export interface MineQuarryData {
    id: string;
    merchantTypeId: string;
    merchantTypeName?: string;
    name: string;
    contactNumber?: string | null;
    email?: string | null;
    siteLocationId?: string | null;
    siteLocationName?: string;
    companyName?: string | null;
    gstOptIn: boolean;
    gstNumber?: string | null;
    gstDetails?: string | null;
    remarks?: string | null;
}

export interface VendorCustomerData {
    id: string;
    merchantTypeId: string;
    merchantTypeName?: string;
    name: string;
    contactNumber?: string | null;
    email?: string | null;
    siteLocationId?: string | null;
    siteLocationName?: string;
    companyName?: string | null;
    gstOptIn: boolean;
    gstNumber?: string | null;
    gstDetails?: string | null;
    remarks?: string | null;
}

export interface RoyaltyOwnerData {
    id: string;
    merchantTypeId: string;
    merchantTypeName?: string;
    name: string;
    contactNumber?: string | null;
    email?: string | null;
    siteLocationId?: string | null;
    siteLocationName?: string;
    companyName?: string | null;
    gstOptIn: boolean;
    gstNumber?: string | null;
    gstDetails?: string | null;
    remarks?: string | null;
}

export interface TransportOwnerData {
    id: string;
    merchantTypeId: string;
    merchantTypeName?: string;
    name: string;
    contactNumber?: string | null;
    email?: string | null;
    siteLocationId?: string | null;
    siteLocationName?: string;
    companyName?: string | null;
    gstOptIn: boolean;
    gstNumber?: string | null;
    gstDetails?: string | null;
    remarks?: string | null;
}

export interface TransportOwnerVehicle {
    id: string;
    transportOwnerId: string;
    transportOwnerName?: string;
    vehicleNumber?: string;
    effectiveFrom: string;
    effectiveTo?: string;
    remarks: string;
}

export interface MaterialTypeDefinition {
    id: string;
    name: string;
    remarks: string;
}

export type RatePartyType = 'mine-quarry' | 'vendor-customer' | 'royalty-owner' | 'transport-owner';

export interface MaterialRate {
    id: string;
    materialTypeId: string;
    materialTypeName?: string;
    ratePartyType: RatePartyType;
    ratePartyId: string;
    ratePartyName?: string;
    pickupLocationId: string;
    pickupLocationName?: string;
    dropOffLocationId: string;
    dropOffLocationName?: string;
    totalKm: number;
    ratePerKm: number;
    ratePerTon: number;
    gstChargeable: boolean;
    gstPercentage: number;
    gstAmount: number;
    totalRatePerTon: number;
    effectiveFrom: string;
    effectiveTo?: string;
    status?: string;
    remarks: string;
}

export interface VehicleMaster {
    id: string;
    vehicleNumber: string;
    vehicleType: string;
    capacity: number;
    ownerName: string;
    contactNumber: string;
    remarks: string;
}

export interface Material {
    id: number;
    name: string;
    costPerTon: string;
    costPerCubicMeter: string;
}

export interface RoyaltyStock {
    id: string;
    purchaseDate: string;
    quantity: number;
    cost: number;
}

export interface Account {
    id: string;
    name: string;
    categoryId: string;
    categoryName: string;
}

export interface AccountCategory {
    id: string;
    name: string;
}
