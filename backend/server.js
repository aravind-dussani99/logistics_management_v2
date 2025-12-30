import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';

const app = express();
const PORT = process.env.PORT || 8080;
const prisma = new PrismaClient();
const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000;
const storage = new Storage();
const CONFIG_BUCKET = process.env.CONFIG_BUCKET || '';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');

app.use(express.json({ limit: '20mb' }));
app.use((req, res, next) => {
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/admin/config', async (_req, res) => {
  if (!CONFIG_BUCKET) {
    res.status(400).json({ error: 'CONFIG_BUCKET is not configured' });
    return;
  }
  try {
    const file = storage.bucket(CONFIG_BUCKET).file('config.json');
    const [exists] = await file.exists();
    if (!exists) {
      res.json({ apiBaseUrl: '' });
      return;
    }
    const [contents] = await file.download();
    res.type('application/json').send(contents);
  } catch (error) {
    console.error('Failed to load config.json', error);
    res.status(500).json({ error: 'Failed to load config.json' });
  }
});

app.put('/api/admin/config', async (req, res) => {
  if (!CONFIG_BUCKET) {
    res.status(400).json({ error: 'CONFIG_BUCKET is not configured' });
    return;
  }
  const { apiBaseUrl } = req.body || {};
  if (!apiBaseUrl || typeof apiBaseUrl !== 'string') {
    res.status(400).json({ error: 'apiBaseUrl is required' });
    return;
  }
  try {
    const file = storage.bucket(CONFIG_BUCKET).file('config.json');
    await file.save(JSON.stringify({ apiBaseUrl }, null, 2), {
      contentType: 'application/json',
      resumable: false,
      metadata: {
        cacheControl: 'no-cache, max-age=0',
      },
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to update config.json', error);
    res.status(500).json({ error: 'Failed to update config.json' });
  }
});

const seedSiteLocations = [
  { name: "Rock Quarry", type: "pickup", address: "Quarry Road", pointOfContact: "Ravi", remarks: "" },
  { name: "Riverbed Mining", type: "pickup", address: "River Bank", pointOfContact: "Suresh", remarks: "" },
  { name: "Site A", type: "drop-off", address: "Construction Site A", pointOfContact: "Anita", remarks: "" },
  { name: "Site B", type: "drop-off", address: "Infra Project B", pointOfContact: "Deepak", remarks: "" },
];

const seedAccountTypes = [
  { name: "Savings", remarks: "" },
  { name: "Current", remarks: "" },
  { name: "PhonePe", remarks: "" },
];

const ensureSiteLocationTable = async () => {
  if (!isSqlite) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS SiteLocation (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      address TEXT NOT NULL,
      pointOfContact TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const ensureMerchantTables = async () => {
  if (!isSqlite) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MerchantType (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Merchant (
      id TEXT PRIMARY KEY,
      merchantTypeId TEXT NOT NULL,
      name TEXT NOT NULL,
      contactNumber TEXT NOT NULL,
      email TEXT NOT NULL,
      siteLocationId TEXT NOT NULL,
      companyName TEXT NOT NULL,
      gstOptIn INTEGER NOT NULL DEFAULT 0,
      gstNumber TEXT NOT NULL,
      gstDetails TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MerchantBankAccount (
      id TEXT PRIMARY KEY,
      merchantId TEXT NOT NULL,
      accountType TEXT NOT NULL,
      ratePartyType TEXT NOT NULL,
      ratePartyId TEXT NOT NULL,
      accountName TEXT NOT NULL,
      accountNumber TEXT NOT NULL,
      ifscCode TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE MerchantBankAccount ADD COLUMN ratePartyType TEXT NOT NULL DEFAULT 'vendor-customer'`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE MerchantBankAccount ADD COLUMN ratePartyId TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MineQuarry (
      id TEXT PRIMARY KEY,
      merchantTypeId TEXT NOT NULL,
      name TEXT NOT NULL,
      contactNumber TEXT NOT NULL,
      email TEXT NOT NULL,
      siteLocationId TEXT NOT NULL,
      companyName TEXT NOT NULL,
      gstOptIn INTEGER NOT NULL DEFAULT 0,
      gstNumber TEXT NOT NULL,
      gstDetails TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS VendorCustomer (
      id TEXT PRIMARY KEY,
      merchantTypeId TEXT NOT NULL,
      name TEXT NOT NULL,
      contactNumber TEXT NOT NULL,
      email TEXT NOT NULL,
      siteLocationId TEXT NOT NULL,
      companyName TEXT NOT NULL,
      gstOptIn INTEGER NOT NULL DEFAULT 0,
      gstNumber TEXT NOT NULL,
      gstDetails TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS RoyaltyOwnerProfile (
      id TEXT PRIMARY KEY,
      merchantTypeId TEXT NOT NULL,
      name TEXT NOT NULL,
      contactNumber TEXT NOT NULL,
      email TEXT NOT NULL,
      siteLocationId TEXT NOT NULL,
      companyName TEXT NOT NULL,
      gstOptIn INTEGER NOT NULL DEFAULT 0,
      gstNumber TEXT NOT NULL,
      gstDetails TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TransportOwnerProfile (
      id TEXT PRIMARY KEY,
      merchantTypeId TEXT NOT NULL,
      name TEXT NOT NULL,
      contactNumber TEXT NOT NULL,
      email TEXT NOT NULL,
      siteLocationId TEXT NOT NULL,
      companyName TEXT NOT NULL,
      gstOptIn INTEGER NOT NULL DEFAULT 0,
      gstNumber TEXT NOT NULL,
      gstDetails TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TransportOwnerVehicle (
      id TEXT PRIMARY KEY,
      transportOwnerId TEXT NOT NULL,
      vehicleNumber TEXT NOT NULL,
      effectiveFrom TIMESTAMP NOT NULL,
      effectiveTo TIMESTAMP,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS AccountType (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MaterialTypeDefinition (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MaterialRate (
      id TEXT PRIMARY KEY,
      materialTypeId TEXT NOT NULL,
      ratePartyType TEXT NOT NULL,
      ratePartyId TEXT NOT NULL,
      pickupLocationId TEXT NOT NULL,
      dropOffLocationId TEXT NOT NULL,
      totalKm REAL NOT NULL,
      ratePerKm REAL NOT NULL,
      ratePerTon REAL NOT NULL,
      gstChargeable INTEGER NOT NULL DEFAULT 0,
      gstPercentage REAL NOT NULL,
      gstAmount REAL NOT NULL,
      totalRatePerTon REAL NOT NULL,
      effectiveFrom TIMESTAMP NOT NULL,
      effectiveTo TIMESTAMP,
      status TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE MaterialRate ADD COLUMN status TEXT NOT NULL DEFAULT 'Active'`).catch(() => {});
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS VehicleMaster (
      id TEXT PRIMARY KEY,
      vehicleNumber TEXT NOT NULL,
      vehicleType TEXT NOT NULL,
      capacity REAL NOT NULL,
      ownerName TEXT NOT NULL,
      contactNumber TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS AdvanceRecord (
      id TEXT PRIMARY KEY,
      date TIMESTAMP NOT NULL,
      tripId INTEGER,
      ratePartyType TEXT,
      ratePartyId TEXT,
      counterpartyName TEXT NOT NULL,
      fromAccount TEXT NOT NULL,
      toAccount TEXT NOT NULL,
      place TEXT NOT NULL,
      invoiceDCNumber TEXT NOT NULL,
      ownerAndTransporterName TEXT NOT NULL,
      vehicleNumber TEXT NOT NULL,
      purpose TEXT NOT NULL,
      amount REAL NOT NULL,
      voucherSlipUpload TEXT NOT NULL,
      remarks TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE AdvanceRecord ADD COLUMN ratePartyType TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE AdvanceRecord ADD COLUMN ratePartyId TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE AdvanceRecord ADD COLUMN counterpartyName TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE AdvanceRecord ADD COLUMN remarks TEXT NOT NULL DEFAULT ''`).catch(() => {});

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS DailyExpenseRecord (
      id TEXT PRIMARY KEY,
      date TIMESTAMP NOT NULL,
      "from" TEXT NOT NULL,
      "to" TEXT NOT NULL,
      via TEXT NOT NULL,
      ratePartyType TEXT,
      ratePartyId TEXT,
      counterpartyName TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      subCategory TEXT NOT NULL,
      remarks TEXT NOT NULL,
      availableBalance REAL NOT NULL,
      closingBalance REAL NOT NULL,
      type TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE DailyExpenseRecord ADD COLUMN ratePartyType TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE DailyExpenseRecord ADD COLUMN ratePartyId TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE DailyExpenseRecord ADD COLUMN counterpartyName TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE DailyExpenseRecord ADD COLUMN via TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE DailyExpenseRecord ADD COLUMN category TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE DailyExpenseRecord ADD COLUMN subCategory TEXT NOT NULL DEFAULT ''`).catch(() => {});

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS DailyExpenseOpeningBalance (
      id TEXT PRIMARY KEY,
      supervisorName TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TripRecord (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TIMESTAMP NOT NULL,
      place TEXT NOT NULL,
      pickupPlace TEXT NOT NULL,
      dropOffPlace TEXT NOT NULL,
      vendorName TEXT NOT NULL,
      customer TEXT NOT NULL,
      invoiceDCNumber TEXT NOT NULL,
      quarryName TEXT NOT NULL,
      royaltyOwnerName TEXT NOT NULL,
      material TEXT NOT NULL,
      vehicleNumber TEXT NOT NULL,
      transporterName TEXT NOT NULL,
      transportOwnerMobileNumber TEXT NOT NULL,
      emptyWeight REAL NOT NULL,
      grossWeight REAL NOT NULL,
      netWeight REAL NOT NULL,
      royaltyNumber TEXT NOT NULL,
      royaltyTons REAL NOT NULL,
      royaltyM3 REAL NOT NULL,
      deductionPercentage REAL NOT NULL,
      sizeChangePercentage REAL NOT NULL,
      tonnage REAL NOT NULL,
      revenue REAL NOT NULL,
      materialCost REAL NOT NULL,
      transportCost REAL NOT NULL,
      royaltyCost REAL NOT NULL,
      profit REAL NOT NULL,
      paymentStatus TEXT NOT NULL,
      agent TEXT NOT NULL,
      status TEXT NOT NULL,
      createdBy TEXT NOT NULL,
      ewayBillUpload TEXT NOT NULL,
      invoiceDCUpload TEXT NOT NULL,
      waymentSlipUpload TEXT NOT NULL,
      royaltyUpload TEXT NOT NULL,
      taxInvoiceUpload TEXT NOT NULL,
      receivedDate TIMESTAMP,
      endEmptyWeight REAL,
      endGrossWeight REAL,
      endNetWeight REAL,
      endWaymentSlipUpload TEXT,
      weightDifferenceReason TEXT,
      pendingRequestType TEXT,
      pendingRequestMessage TEXT,
      pendingRequestBy TEXT,
      pendingRequestRole TEXT,
      pendingRequestAt TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE TripRecord ADD COLUMN pendingRequestType TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE TripRecord ADD COLUMN pendingRequestMessage TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE TripRecord ADD COLUMN pendingRequestBy TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE TripRecord ADD COLUMN pendingRequestRole TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE TripRecord ADD COLUMN pendingRequestAt TIMESTAMP`).catch(() => {});

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS NotificationRecord (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp TIMESTAMP NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      targetRole TEXT,
      targetUser TEXT,
      tripId INTEGER,
      requestType TEXT,
      requesterName TEXT,
      requesterRole TEXT,
      requestMessage TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE NotificationRecord ADD COLUMN targetUser TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE NotificationRecord ADD COLUMN tripId INTEGER`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE NotificationRecord ADD COLUMN requestType TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE NotificationRecord ADD COLUMN requesterName TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE NotificationRecord ADD COLUMN requesterRole TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE NotificationRecord ADD COLUMN requestMessage TEXT`).catch(() => {});
};

const ensureSeedData = async () => {
  await ensureSiteLocationTable();
  await ensureMerchantTables();
  const count = await prisma.siteLocation.count();
  if (count === 0) {
    await prisma.siteLocation.createMany({ data: seedSiteLocations });
  }
  const accountTypeCount = await prisma.accountType.count();
  if (accountTypeCount === 0) {
    await prisma.accountType.createMany({ data: seedAccountTypes });
  }
};

const getDatabasePath = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.startsWith('file:')) return null;
  const filePath = dbUrl.replace('file:', '');
  return path.resolve(__dirname, filePath);
};

const createDatabaseBackup = async () => {
  const dbPath = getDatabasePath();
  if (!dbPath) return;
  try {
    await fs.access(dbPath);
  } catch {
    return;
  }
  const backupDir = path.join(__dirname, 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `dev-${timestamp}.db`);
  await fs.copyFile(dbPath, backupPath);
};

const scheduleDatabaseBackups = () => {
  createDatabaseBackup().catch(error => {
    console.error('Failed to create initial DB backup', error);
  });
  setInterval(() => {
    createDatabaseBackup().catch(error => {
      console.error('Failed to create scheduled DB backup', error);
    });
  }, BACKUP_INTERVAL_MS);
};

app.get('/api/site-locations', async (req, res) => {
  try {
    const locations = await prisma.siteLocation.findMany({ orderBy: { name: 'asc' } });
    res.json(locations);
  } catch (error) {
    console.error('Failed to list site locations', error);
    res.status(500).json({ error: 'Failed to list site locations' });
  }
});

app.post('/api/site-locations', async (req, res) => {
  const { name, type, address = '', pointOfContact = '', remarks = '' } = req.body || {};
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required.' });
  }
  try {
    const location = await prisma.siteLocation.create({
      data: { name, type, address, pointOfContact, remarks },
    });
    res.status(201).json(location);
  } catch (error) {
    console.error('Failed to create site location', error);
    res.status(500).json({ error: 'Failed to create site location' });
  }
});

app.put('/api/site-locations/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, address = '', pointOfContact = '', remarks = '' } = req.body || {};
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required.' });
  }
  try {
    const location = await prisma.siteLocation.update({
      where: { id },
      data: { name, type, address, pointOfContact, remarks },
    });
    res.json(location);
  } catch (error) {
    console.error('Failed to update site location', error);
    res.status(500).json({ error: 'Failed to update site location' });
  }
});

app.delete('/api/site-locations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.siteLocation.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete site location', error);
    res.status(500).json({ error: 'Failed to delete site location' });
  }
});

app.get('/api/merchant-types', async (req, res) => {
  try {
    const types = await prisma.merchantType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch (error) {
    console.error('Failed to list merchant types', error);
    res.status(500).json({ error: 'Failed to list merchant types' });
  }
});

app.post('/api/merchant-types', async (req, res) => {
  const { name, remarks = '' } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Merchant type is required.' });
  }
  try {
    const type = await prisma.merchantType.create({ data: { name, remarks } });
    res.status(201).json(type);
  } catch (error) {
    console.error('Failed to create merchant type', error);
    res.status(500).json({ error: 'Failed to create merchant type' });
  }
});

app.put('/api/merchant-types/:id', async (req, res) => {
  const { id } = req.params;
  const { name, remarks = '' } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Merchant type is required.' });
  }
  try {
    const type = await prisma.merchantType.update({ where: { id }, data: { name, remarks } });
    res.json(type);
  } catch (error) {
    console.error('Failed to update merchant type', error);
    res.status(500).json({ error: 'Failed to update merchant type' });
  }
});

app.delete('/api/merchant-types/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.merchantType.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete merchant type', error);
    res.status(500).json({ error: 'Failed to delete merchant type' });
  }
});

app.get('/api/merchants', async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      include: { merchantType: true, siteLocation: true },
      orderBy: { name: 'asc' },
    });
    const response = merchants.map(merchant => ({
      ...merchant,
      merchantTypeName: merchant.merchantType?.name || '',
      siteLocationName: merchant.siteLocation?.name || '',
    }));
    res.json(response);
  } catch (error) {
    console.error('Failed to list merchants', error);
    res.status(500).json({ error: 'Failed to list merchants' });
  }
});

app.post('/api/merchants', async (req, res) => {
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  if (!merchantTypeId || !name || !contactNumber || !siteLocationId) {
    return res.status(400).json({ error: 'Merchant type, name, contact number, and site location are required.' });
  }
  try {
    const merchant = await prisma.merchant.create({
      data: {
        merchantTypeId,
        name,
        contactNumber,
        email,
        siteLocationId,
        companyName,
        gstOptIn: Boolean(gstOptIn),
        gstNumber,
        gstDetails,
        remarks,
      },
      include: { merchantType: true, siteLocation: true },
    });
    res.status(201).json({
      ...merchant,
      merchantTypeName: merchant.merchantType?.name || '',
      siteLocationName: merchant.siteLocation?.name || '',
    });
  } catch (error) {
    console.error('Failed to create merchant', error);
    res.status(500).json({ error: 'Failed to create merchant' });
  }
});

app.put('/api/merchants/:id', async (req, res) => {
  const { id } = req.params;
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  if (!merchantTypeId || !name || !contactNumber || !siteLocationId) {
    return res.status(400).json({ error: 'Merchant type, name, contact number, and site location are required.' });
  }
  try {
    const merchant = await prisma.merchant.update({
      where: { id },
      data: {
        merchantTypeId,
        name,
        contactNumber,
        email,
        siteLocationId,
        companyName,
        gstOptIn: Boolean(gstOptIn),
        gstNumber,
        gstDetails,
        remarks,
      },
      include: { merchantType: true, siteLocation: true },
    });
    res.json({
      ...merchant,
      merchantTypeName: merchant.merchantType?.name || '',
      siteLocationName: merchant.siteLocation?.name || '',
    });
  } catch (error) {
    console.error('Failed to update merchant', error);
    res.status(500).json({ error: 'Failed to update merchant' });
  }
});

app.delete('/api/merchants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.merchant.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete merchant', error);
    res.status(500).json({ error: 'Failed to delete merchant' });
  }
});

app.get('/api/merchant-bank-accounts', async (req, res) => {
  try {
    const accounts = await prisma.merchantBankAccount.findMany({
      include: { merchant: true },
      orderBy: { accountName: 'asc' },
    });
    const response = await Promise.all(accounts.map(async (account) => ({
      ...account,
      merchantName: account.merchant?.name || '',
      ratePartyName: await getBankAccountRatePartyName(account.ratePartyType, account.ratePartyId),
    })));
    res.json(response);
  } catch (error) {
    console.error('Failed to list merchant bank accounts', error);
    res.status(500).json({ error: 'Failed to list merchant bank accounts' });
  }
});

app.post('/api/merchant-bank-accounts', async (req, res) => {
  const {
    merchantId,
    accountType,
    ratePartyType,
    ratePartyId,
    accountName,
    accountNumber,
    ifscCode,
    remarks = '',
  } = req.body || {};
  if (!merchantId || !accountType || !accountName || !accountNumber || !ifscCode || !ratePartyType || !ratePartyId) {
    return res.status(400).json({ error: 'Merchant, account type, rate party, account name, account number, and IFSC are required.' });
  }
  try {
    const account = await prisma.merchantBankAccount.create({
      data: { merchantId, accountType, ratePartyType, ratePartyId, accountName, accountNumber, ifscCode, remarks },
      include: { merchant: true },
    });
    res.status(201).json({
      ...account,
      merchantName: account.merchant?.name || '',
      ratePartyName: await getBankAccountRatePartyName(account.ratePartyType, account.ratePartyId),
    });
  } catch (error) {
    console.error('Failed to create merchant bank account', error);
    res.status(500).json({ error: 'Failed to create merchant bank account' });
  }
});

app.put('/api/merchant-bank-accounts/:id', async (req, res) => {
  const { id } = req.params;
  const {
    merchantId,
    accountType,
    ratePartyType,
    ratePartyId,
    accountName,
    accountNumber,
    ifscCode,
    remarks = '',
  } = req.body || {};
  if (!merchantId || !accountType || !accountName || !accountNumber || !ifscCode || !ratePartyType || !ratePartyId) {
    return res.status(400).json({ error: 'Merchant, account type, rate party, account name, account number, and IFSC are required.' });
  }
  try {
    const account = await prisma.merchantBankAccount.update({
      where: { id },
      data: { merchantId, accountType, ratePartyType, ratePartyId, accountName, accountNumber, ifscCode, remarks },
      include: { merchant: true },
    });
    res.json({
      ...account,
      merchantName: account.merchant?.name || '',
      ratePartyName: await getBankAccountRatePartyName(account.ratePartyType, account.ratePartyId),
    });
  } catch (error) {
    console.error('Failed to update merchant bank account', error);
    res.status(500).json({ error: 'Failed to update merchant bank account' });
  }
});

app.delete('/api/merchant-bank-accounts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.merchantBankAccount.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete merchant bank account', error);
    res.status(500).json({ error: 'Failed to delete merchant bank account' });
  }
});

app.get('/api/account-types', async (req, res) => {
  try {
    const types = await prisma.accountType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch (error) {
    console.error('Failed to list account types', error);
    res.status(500).json({ error: 'Failed to list account types' });
  }
});

app.post('/api/account-types', async (req, res) => {
  const { name, remarks = '' } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Account type is required.' });
  }
  try {
    const type = await prisma.accountType.create({ data: { name, remarks } });
    res.status(201).json(type);
  } catch (error) {
    console.error('Failed to create account type', error);
    res.status(500).json({ error: 'Failed to create account type' });
  }
});

app.put('/api/account-types/:id', async (req, res) => {
  const { id } = req.params;
  const { name, remarks = '' } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Account type is required.' });
  }
  try {
    const type = await prisma.accountType.update({ where: { id }, data: { name, remarks } });
    res.json(type);
  } catch (error) {
    console.error('Failed to update account type', error);
    res.status(500).json({ error: 'Failed to update account type' });
  }
});

app.delete('/api/account-types/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.accountType.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete account type', error);
    res.status(500).json({ error: 'Failed to delete account type' });
  }
});

app.get('/api/advances', async (req, res) => {
  try {
    const advances = await prisma.advanceRecord.findMany({
      orderBy: { date: 'desc' },
    });
    res.json(advances);
  } catch (error) {
    console.error('Failed to list advances', error);
    res.status(500).json({ error: 'Failed to list advances' });
  }
});

app.post('/api/advances', async (req, res) => {
  const {
    date,
    tripId = null,
    ratePartyType = null,
    ratePartyId = null,
    counterpartyName = '',
    fromAccount,
    toAccount,
    place = '',
    invoiceDCNumber = '',
    ownerAndTransporterName = '',
    vehicleNumber = '',
    purpose,
    amount = 0,
    voucherSlipUpload = '',
    remarks = '',
  } = req.body || {};

  if (!date || !fromAccount || !toAccount || !purpose) {
    return res.status(400).json({ error: 'Date, from account, to account, and purpose are required.' });
  }
  try {
    const advance = await prisma.advanceRecord.create({
      data: {
        date: new Date(date),
        tripId: tripId ? Number(tripId) : null,
        ratePartyType,
        ratePartyId,
        counterpartyName,
        fromAccount,
        toAccount,
        place,
        invoiceDCNumber,
        ownerAndTransporterName,
        vehicleNumber,
        purpose,
        amount: Number(amount) || 0,
        voucherSlipUpload,
        remarks,
      },
    });
    res.status(201).json(advance);
  } catch (error) {
    console.error('Failed to create advance', error);
    res.status(500).json({ error: 'Failed to create advance' });
  }
});

app.put('/api/advances/:id', async (req, res) => {
  const { id } = req.params;
  const {
    date,
    tripId = null,
    ratePartyType = null,
    ratePartyId = null,
    counterpartyName = '',
    fromAccount,
    toAccount,
    place = '',
    invoiceDCNumber = '',
    ownerAndTransporterName = '',
    vehicleNumber = '',
    purpose,
    amount = 0,
    voucherSlipUpload = '',
    remarks = '',
  } = req.body || {};

  if (!date || !fromAccount || !toAccount || !purpose) {
    return res.status(400).json({ error: 'Date, from account, to account, and purpose are required.' });
  }
  try {
    const advance = await prisma.advanceRecord.update({
      where: { id },
      data: {
        date: new Date(date),
        tripId: tripId ? Number(tripId) : null,
        ratePartyType,
        ratePartyId,
        counterpartyName,
        fromAccount,
        toAccount,
        place,
        invoiceDCNumber,
        ownerAndTransporterName,
        vehicleNumber,
        purpose,
        amount: Number(amount) || 0,
        voucherSlipUpload,
        remarks,
      },
    });
    res.json(advance);
  } catch (error) {
    console.error('Failed to update advance', error);
    res.status(500).json({ error: 'Failed to update advance' });
  }
});

app.delete('/api/advances/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.advanceRecord.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete advance', error);
    res.status(500).json({ error: 'Failed to delete advance' });
  }
});

app.get('/api/advances/export', async (req, res) => {
  try {
    const advances = await prisma.advanceRecord.findMany({ orderBy: { date: 'desc' } });
    const header = ['Date', 'From', 'To', 'Purpose', 'Amount', 'Trip Id', 'Rate Party Type', 'Rate Party Id', 'Counterparty', 'Remarks'];
    const rows = advances.map(item => ([
      item.date.toISOString().split('T')[0],
      item.fromAccount,
      item.toAccount,
      item.purpose,
      item.amount,
      item.tripId || '',
      item.ratePartyType || '',
      item.ratePartyId || '',
      item.counterpartyName || '',
      item.remarks || '',
    ]));
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="advances.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Failed to export advances', error);
    res.status(500).json({ error: 'Failed to export advances' });
  }
});

app.get('/api/daily-expenses', async (req, res) => {
  const supervisorName = req.query.supervisor;
  if (!supervisorName) {
    return res.status(400).json({ error: 'Supervisor name is required.' });
  }
  try {
    await recalculateDailyExpenseBalances(supervisorName);
    const openingBalance = await getOrCreateOpeningBalance(supervisorName);
    const expenses = await prisma.dailyExpenseRecord.findMany({
      where: { from: supervisorName },
      orderBy: { date: 'desc' },
    });
    res.json({ openingBalance, expenses });
  } catch (error) {
    console.error('Failed to list daily expenses', error);
    res.status(500).json({ error: 'Failed to list daily expenses' });
  }
});

app.get('/api/daily-expenses/all', async (req, res) => {
  try {
    const expenses = await prisma.dailyExpenseRecord.findMany({
      orderBy: { date: 'desc' },
    });
    res.json(expenses);
  } catch (error) {
    console.error('Failed to list daily expenses', error);
    res.status(500).json({ error: 'Failed to list daily expenses' });
  }
});

app.post('/api/daily-expenses', async (req, res) => {
  const {
    date,
    from,
    to,
    via = '',
    ratePartyType = null,
    ratePartyId = null,
    counterpartyName = '',
    amount = 0,
    category = '',
    subCategory = '',
    remarks = '',
    type = 'DEBIT',
  } = req.body || {};

  if (!date || !from || !to) {
    return res.status(400).json({ error: 'Date, from, and to are required.' });
  }

  try {
    const openingBalance = await recalculateDailyExpenseBalances(from);
    const latestEntry = await prisma.dailyExpenseRecord.findFirst({
      where: { from },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    const availableBalance = latestEntry?.closingBalance ?? openingBalance;
    const closingBalance = type === 'DEBIT'
      ? availableBalance - Number(amount || 0)
      : availableBalance + Number(amount || 0);

    const expense = await prisma.dailyExpenseRecord.create({
      data: {
        date: new Date(date),
        from,
        to,
        via,
        ratePartyType,
        ratePartyId,
        counterpartyName,
        amount: Number(amount) || 0,
        category,
        subCategory,
        remarks,
        availableBalance,
        closingBalance,
        type,
      },
    });
    await recalculateDailyExpenseBalances(from);
    res.status(201).json(expense);
  } catch (error) {
    console.error('Failed to create daily expense', error);
    res.status(500).json({ error: 'Failed to create daily expense' });
  }
});

app.put('/api/daily-expenses/:id', async (req, res) => {
  const { id } = req.params;
  const {
    date,
    from,
    to,
    via = '',
    ratePartyType = null,
    ratePartyId = null,
    counterpartyName = '',
    amount = 0,
    category = '',
    subCategory = '',
    remarks = '',
    type = 'DEBIT',
  } = req.body || {};

  if (!date || !from || !to) {
    return res.status(400).json({ error: 'Date, from, and to are required.' });
  }

  try {
    const expense = await prisma.dailyExpenseRecord.update({
      where: { id },
      data: {
        date: new Date(date),
        from,
        to,
        via,
        ratePartyType,
        ratePartyId,
        counterpartyName,
        amount: Number(amount) || 0,
        category,
        subCategory,
        remarks,
        type,
      },
    });
    await recalculateDailyExpenseBalances(from);
    res.json(expense);
  } catch (error) {
    console.error('Failed to update daily expense', error);
    res.status(500).json({ error: 'Failed to update daily expense' });
  }
});

app.delete('/api/daily-expenses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const expense = await prisma.dailyExpenseRecord.findUnique({ where: { id } });
    if (!expense) return res.status(404).json({ error: 'Daily expense not found.' });
    await prisma.dailyExpenseRecord.delete({ where: { id } });
    await recalculateDailyExpenseBalances(expense.from);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete daily expense', error);
    res.status(500).json({ error: 'Failed to delete daily expense' });
  }
});

app.get('/api/daily-expenses/export', async (req, res) => {
  const supervisorName = req.query.supervisor;
  try {
    const where = supervisorName ? { from: supervisorName } : {};
    const expenses = await prisma.dailyExpenseRecord.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    const header = ['Date', 'From', 'To', 'Via', 'Amount', 'Type', 'Category', 'Sub-Category', 'Remarks', 'Closing Balance', 'Rate Party Type', 'Rate Party Id', 'Counterparty'];
    const rows = expenses.map(item => ([
      item.date.toISOString().split('T')[0],
      item.from,
      item.to,
      item.via || '',
      item.amount,
      item.type,
      item.category || '',
      item.subCategory || '',
      item.remarks || '',
      item.closingBalance,
      item.ratePartyType || '',
      item.ratePartyId || '',
      item.counterpartyName || '',
    ]));
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="daily-expenses.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Failed to export daily expenses', error);
    res.status(500).json({ error: 'Failed to export daily expenses' });
  }
});

app.get('/api/trips', async (req, res) => {
  try {
    const trips = await prisma.tripRecord.findMany({ orderBy: { date: 'desc' } });
    res.json(trips);
  } catch (error) {
    console.error('Failed to list trips', error);
    res.status(500).json({ error: 'Failed to list trips' });
  }
});

app.get('/api/notifications', async (req, res) => {
  const { role, user } = req.query;
  try {
    const where = {
      ...(role ? { targetRole: String(role) } : {}),
      ...(user ? { OR: [{ targetUser: null }, { targetUser: String(user) }] } : {}),
    };
    const notifications = await prisma.notificationRecord.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
    res.json(notifications);
  } catch (error) {
    console.error('Failed to list notifications', error);
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

app.post('/api/notifications', async (req, res) => {
  const {
    message,
    type = 'info',
    targetRole = null,
    targetUser = null,
    tripId = null,
    requestType = null,
    requesterName = null,
    requesterRole = null,
    requestMessage = null,
  } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  try {
    const notification = await prisma.notificationRecord.create({
      data: {
        message,
        type,
        timestamp: new Date(),
        read: false,
        targetRole,
        targetUser,
        tripId,
        requestType,
        requesterName,
        requesterRole,
        requestMessage,
      },
    });
    res.status(201).json(notification);
  } catch (error) {
    console.error('Failed to create notification', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    const notification = await prisma.notificationRecord.update({
      where: { id },
      data: { read: true },
    });
    res.json(notification);
  } catch (error) {
    console.error('Failed to mark notification as read', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

app.get('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const notification = await prisma.notificationRecord.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: 'Notification not found.' });
    res.json(notification);
  } catch (error) {
    console.error('Failed to fetch notification', error);
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
});

app.post('/api/trips', async (req, res) => {
  const data = req.body || {};
  if (!data.date || !data.customer || !data.vehicleNumber) {
    return res.status(400).json({ error: 'Date, customer, and vehicle number are required.' });
  }
  try {
    const trip = await prisma.tripRecord.create({
      data: {
        date: new Date(data.date),
        place: data.place || '',
        pickupPlace: data.pickupPlace || '',
        dropOffPlace: data.dropOffPlace || '',
        vendorName: data.vendorName || '',
        customer: data.customer || '',
        invoiceDCNumber: data.invoiceDCNumber || '',
        quarryName: data.quarryName || '',
        royaltyOwnerName: data.royaltyOwnerName || '',
        material: data.material || '',
        vehicleNumber: data.vehicleNumber || '',
        transporterName: data.transporterName || '',
        transportOwnerMobileNumber: data.transportOwnerMobileNumber || '',
        emptyWeight: Number(data.emptyWeight || 0),
        grossWeight: Number(data.grossWeight || 0),
        netWeight: Number(data.netWeight || 0),
        royaltyNumber: data.royaltyNumber || '',
        royaltyTons: Number(data.royaltyTons || 0),
        royaltyM3: Number(data.royaltyM3 || 0),
        deductionPercentage: Number(data.deductionPercentage || 0),
        sizeChangePercentage: Number(data.sizeChangePercentage || 0),
        tonnage: Number(data.tonnage || 0),
        revenue: Number(data.revenue || 0),
        materialCost: Number(data.materialCost || 0),
        transportCost: Number(data.transportCost || 0),
        royaltyCost: Number(data.royaltyCost || 0),
        profit: Number(data.profit || 0),
        paymentStatus: data.paymentStatus || 'unpaid',
        agent: data.agent || '',
        status: data.status || 'pending upload',
        createdBy: data.createdBy || '',
        ewayBillUpload: data.ewayBillUpload || '',
        invoiceDCUpload: data.invoiceDCUpload || '',
        waymentSlipUpload: data.waymentSlipUpload || '',
        royaltyUpload: data.royaltyUpload || '',
        taxInvoiceUpload: data.taxInvoiceUpload || '',
        receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
        endEmptyWeight: data.endEmptyWeight !== undefined ? Number(data.endEmptyWeight) : null,
        endGrossWeight: data.endGrossWeight !== undefined ? Number(data.endGrossWeight) : null,
        endNetWeight: data.endNetWeight !== undefined ? Number(data.endNetWeight) : null,
        endWaymentSlipUpload: data.endWaymentSlipUpload || null,
        weightDifferenceReason: data.weightDifferenceReason || null,
      },
    });
    res.status(201).json(trip);
  } catch (error) {
    console.error('Failed to create trip', error);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

app.put('/api/trips/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body || {};
  try {
    const trip = await prisma.tripRecord.update({
      where: { id: Number(id) },
      data: {
        date: data.date ? new Date(data.date) : undefined,
        place: data.place,
        pickupPlace: data.pickupPlace,
        dropOffPlace: data.dropOffPlace,
        vendorName: data.vendorName,
        customer: data.customer,
        invoiceDCNumber: data.invoiceDCNumber,
        quarryName: data.quarryName,
        royaltyOwnerName: data.royaltyOwnerName,
        material: data.material,
        vehicleNumber: data.vehicleNumber,
        transporterName: data.transporterName,
        transportOwnerMobileNumber: data.transportOwnerMobileNumber,
        emptyWeight: data.emptyWeight !== undefined ? Number(data.emptyWeight) : undefined,
        grossWeight: data.grossWeight !== undefined ? Number(data.grossWeight) : undefined,
        netWeight: data.netWeight !== undefined ? Number(data.netWeight) : undefined,
        royaltyNumber: data.royaltyNumber,
        royaltyTons: data.royaltyTons !== undefined ? Number(data.royaltyTons) : undefined,
        royaltyM3: data.royaltyM3 !== undefined ? Number(data.royaltyM3) : undefined,
        deductionPercentage: data.deductionPercentage !== undefined ? Number(data.deductionPercentage) : undefined,
        sizeChangePercentage: data.sizeChangePercentage !== undefined ? Number(data.sizeChangePercentage) : undefined,
        tonnage: data.tonnage !== undefined ? Number(data.tonnage) : undefined,
        revenue: data.revenue !== undefined ? Number(data.revenue) : undefined,
        materialCost: data.materialCost !== undefined ? Number(data.materialCost) : undefined,
        transportCost: data.transportCost !== undefined ? Number(data.transportCost) : undefined,
        royaltyCost: data.royaltyCost !== undefined ? Number(data.royaltyCost) : undefined,
        profit: data.profit !== undefined ? Number(data.profit) : undefined,
        paymentStatus: data.paymentStatus,
        agent: data.agent,
        status: data.status,
        createdBy: data.createdBy,
        ewayBillUpload: data.ewayBillUpload,
        invoiceDCUpload: data.invoiceDCUpload,
        waymentSlipUpload: data.waymentSlipUpload,
        royaltyUpload: data.royaltyUpload,
        taxInvoiceUpload: data.taxInvoiceUpload,
        receivedDate: data.receivedDate ? new Date(data.receivedDate) : data.receivedDate,
        endEmptyWeight: data.endEmptyWeight !== undefined ? Number(data.endEmptyWeight) : undefined,
        endGrossWeight: data.endGrossWeight !== undefined ? Number(data.endGrossWeight) : undefined,
        endNetWeight: data.endNetWeight !== undefined ? Number(data.endNetWeight) : undefined,
        endWaymentSlipUpload: data.endWaymentSlipUpload,
        weightDifferenceReason: data.weightDifferenceReason,
        pendingRequestType: data.pendingRequestType,
        pendingRequestMessage: data.pendingRequestMessage,
        pendingRequestBy: data.pendingRequestBy,
        pendingRequestRole: data.pendingRequestRole,
        pendingRequestAt: data.pendingRequestAt ? new Date(data.pendingRequestAt) : data.pendingRequestAt,
      },
    });
    res.json(trip);
  } catch (error) {
    console.error('Failed to update trip', error);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

app.post('/api/trips/:id/request-delete', async (req, res) => {
  const { id } = req.params;
  const { requestedBy = 'Supervisor', requestedByRole = 'Supervisor', reason = '' } = req.body || {};
  try {
    const trip = await prisma.tripRecord.findUnique({ where: { id: Number(id) } });
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    const message = `Delete request for Trip #${trip.id} (${trip.invoiceDCNumber || 'No Invoice'}) by ${requestedBy}.${reason ? ` Reason: ${reason}` : ''}`;
    const notification = await prisma.notificationRecord.create({
      data: {
        message,
        type: 'alert',
        timestamp: new Date(),
        read: false,
        targetRole: 'Admin',
        targetUser: null,
        tripId: trip.id,
        requestType: 'delete',
        requesterName: requestedBy,
        requesterRole: requestedByRole,
        requestMessage: reason,
      },
    });
    await prisma.tripRecord.update({
      where: { id: trip.id },
      data: {
        pendingRequestType: 'delete',
        pendingRequestMessage: reason || '',
        pendingRequestBy: requestedBy,
        pendingRequestRole: requestedByRole,
        pendingRequestAt: new Date(),
      },
    });
    res.status(201).json(notification);
  } catch (error) {
    console.error('Failed to request trip delete', error);
    res.status(500).json({ error: 'Failed to request delete' });
  }
});

app.post('/api/trips/:id/request-update', async (req, res) => {
  const { id } = req.params;
  const { requestedBy = 'Supervisor', requestedByRole = 'Supervisor', reason = '' } = req.body || {};
  try {
    const trip = await prisma.tripRecord.findUnique({ where: { id: Number(id) } });
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    const message = `Update request for Trip #${trip.id} (${trip.invoiceDCNumber || 'No Invoice'}) by ${requestedBy}.${reason ? ` Reason: ${reason}` : ''}`;
    const notification = await prisma.notificationRecord.create({
      data: {
        message,
        type: 'alert',
        timestamp: new Date(),
        read: false,
        targetRole: 'Admin',
        targetUser: null,
        tripId: trip.id,
        requestType: 'update',
        requesterName: requestedBy,
        requesterRole: requestedByRole,
        requestMessage: reason,
      },
    });
    await prisma.tripRecord.update({
      where: { id: trip.id },
      data: {
        pendingRequestType: 'update',
        pendingRequestMessage: reason || '',
        pendingRequestBy: requestedBy,
        pendingRequestRole: requestedByRole,
        pendingRequestAt: new Date(),
      },
    });
    res.status(201).json(notification);
  } catch (error) {
    console.error('Failed to request trip update', error);
    res.status(500).json({ error: 'Failed to request update' });
  }
});

app.delete('/api/trips/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.tripRecord.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete trip', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

app.get('/api/vehicle-masters', async (req, res) => {
  try {
    const vehicles = await prisma.vehicleMaster.findMany({ orderBy: { vehicleNumber: 'asc' } });
    res.json(vehicles);
  } catch (error) {
    console.error('Failed to list vehicles', error);
    res.status(500).json({ error: 'Failed to list vehicles' });
  }
});

app.post('/api/vehicle-masters', async (req, res) => {
  const {
    vehicleNumber,
    vehicleType,
    capacity,
    ownerName,
    contactNumber,
    remarks = '',
  } = req.body || {};
  if (!vehicleNumber || !vehicleType || !ownerName || !contactNumber) {
    return res.status(400).json({ error: 'Vehicle number, type, owner name, and contact number are required.' });
  }
  try {
    const vehicle = await prisma.vehicleMaster.create({
      data: {
        vehicleNumber,
        vehicleType,
        capacity: Number.isFinite(Number(capacity)) ? Number(capacity) : 0,
        ownerName,
        contactNumber,
        remarks,
      },
    });
    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Failed to create vehicle', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

app.put('/api/vehicle-masters/:id', async (req, res) => {
  const { id } = req.params;
  const {
    vehicleNumber,
    vehicleType,
    capacity,
    ownerName,
    contactNumber,
    remarks = '',
  } = req.body || {};
  if (!vehicleNumber || !vehicleType || !ownerName || !contactNumber) {
    return res.status(400).json({ error: 'Vehicle number, type, owner name, and contact number are required.' });
  }
  try {
    const vehicle = await prisma.vehicleMaster.update({
      where: { id },
      data: {
        vehicleNumber,
        vehicleType,
        capacity: Number.isFinite(Number(capacity)) ? Number(capacity) : 0,
        ownerName,
        contactNumber,
        remarks,
      },
    });
    res.json(vehicle);
  } catch (error) {
    console.error('Failed to update vehicle', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

app.delete('/api/vehicle-masters/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.vehicleMaster.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete vehicle', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

const shapeMerchantProfile = (record) => ({
  ...record,
  merchantTypeName: record.merchantType?.name || '',
  siteLocationName: record.siteLocation?.name || '',
});

const getRatePartyName = async (ratePartyType, ratePartyId) => {
  switch (ratePartyType) {
    case 'mine-quarry': {
      const record = await prisma.mineQuarry.findUnique({ where: { id: ratePartyId } });
      return record?.name || '';
    }
    case 'vendor-customer': {
      const record = await prisma.vendorCustomer.findUnique({ where: { id: ratePartyId } });
      return record?.name || '';
    }
    case 'royalty-owner': {
      const record = await prisma.royaltyOwnerProfile.findUnique({ where: { id: ratePartyId } });
      return record?.name || '';
    }
    case 'transport-owner': {
      const record = await prisma.transportOwnerProfile.findUnique({ where: { id: ratePartyId } });
      return record?.name || '';
    }
    default:
      return '';
  }
};

const getBankAccountRatePartyName = async (ratePartyType, ratePartyId) => {
  return getRatePartyName(ratePartyType, ratePartyId);
};

const getOrCreateOpeningBalance = async (supervisorName) => {
  const existing = await prisma.dailyExpenseOpeningBalance.findUnique({ where: { supervisorName } });
  if (existing) return existing.amount;
  await prisma.dailyExpenseOpeningBalance.create({
    data: { supervisorName, amount: 0 },
  });
  return 0;
};

const recalculateDailyExpenseBalances = async (supervisorName) => {
  const openingBalance = await getOrCreateOpeningBalance(supervisorName);
  const expenses = await prisma.dailyExpenseRecord.findMany({
    where: { from: supervisorName },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  let runningBalance = openingBalance;
  for (const entry of expenses) {
    const availableBalance = runningBalance;
    const nextBalance = entry.type === 'DEBIT'
      ? runningBalance - entry.amount
      : runningBalance + entry.amount;
    await prisma.dailyExpenseRecord.update({
      where: { id: entry.id },
      data: {
        availableBalance,
        closingBalance: nextBalance,
      },
    });
    runningBalance = nextBalance;
  }
  return openingBalance;
};

const hasMaterialRateOverlap = (start, end, existingStart, existingEnd) => {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const existingStartDate = new Date(existingStart);
  const existingEndDate = existingEnd ? new Date(existingEnd) : null;

  if (!endDate && !existingEndDate) return true;
  if (!endDate) return startDate <= existingEndDate;
  if (!existingEndDate) return existingStartDate <= endDate;
  return startDate <= existingEndDate && existingStartDate <= endDate;
};

const getMaterialRateStatus = (effectiveFrom, effectiveTo) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(effectiveFrom);
  startDate.setHours(0, 0, 0, 0);
  const endDate = effectiveTo ? new Date(effectiveTo) : null;
  if (endDate) endDate.setHours(0, 0, 0, 0);

  if (startDate > today) return 'Future';
  if (endDate && endDate < today) return 'Inactive';
  return 'Active';
};

const validateMerchantProfile = (body) => {
  const {
    merchantTypeId,
    name,
    contactNumber,
    siteLocationId,
  } = body || {};
  if (!merchantTypeId || !name || !contactNumber || !siteLocationId) {
    return 'Merchant type, name, contact number, and site location are required.';
  }
  return '';
};

app.get('/api/mine-quarries', async (req, res) => {
  try {
    const items = await prisma.mineQuarry.findMany({
      include: { merchantType: true, siteLocation: true },
      orderBy: { name: 'asc' },
    });
    res.json(items.map(shapeMerchantProfile));
  } catch (error) {
    console.error('Failed to list mine & quarry data', error);
    res.status(500).json({ error: 'Failed to list mine & quarry data' });
  }
});

app.post('/api/mine-quarries', async (req, res) => {
  const errorMessage = validateMerchantProfile(req.body);
  if (errorMessage) return res.status(400).json({ error: errorMessage });
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  try {
    const record = await prisma.mineQuarry.create({
      data: { merchantTypeId, name, contactNumber, email, siteLocationId, companyName, gstOptIn: Boolean(gstOptIn), gstNumber, gstDetails, remarks },
      include: { merchantType: true, siteLocation: true },
    });
    res.status(201).json(shapeMerchantProfile(record));
  } catch (error) {
    console.error('Failed to create mine & quarry record', error);
    res.status(500).json({ error: 'Failed to create mine & quarry record' });
  }
});

app.put('/api/mine-quarries/:id', async (req, res) => {
  const { id } = req.params;
  const errorMessage = validateMerchantProfile(req.body);
  if (errorMessage) return res.status(400).json({ error: errorMessage });
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  try {
    const record = await prisma.mineQuarry.update({
      where: { id },
      data: { merchantTypeId, name, contactNumber, email, siteLocationId, companyName, gstOptIn: Boolean(gstOptIn), gstNumber, gstDetails, remarks },
      include: { merchantType: true, siteLocation: true },
    });
    res.json(shapeMerchantProfile(record));
  } catch (error) {
    console.error('Failed to update mine & quarry record', error);
    res.status(500).json({ error: 'Failed to update mine & quarry record' });
  }
});

app.delete('/api/mine-quarries/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.mineQuarry.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete mine & quarry record', error);
    res.status(500).json({ error: 'Failed to delete mine & quarry record' });
  }
});

app.get('/api/vendor-customers', async (req, res) => {
  try {
    const items = await prisma.vendorCustomer.findMany({
      include: { merchantType: true, siteLocation: true },
      orderBy: { name: 'asc' },
    });
    res.json(items.map(shapeMerchantProfile));
  } catch (error) {
    console.error('Failed to list vendor & customer data', error);
    res.status(500).json({ error: 'Failed to list vendor & customer data' });
  }
});

app.post('/api/vendor-customers', async (req, res) => {
  const errorMessage = validateMerchantProfile(req.body);
  if (errorMessage) return res.status(400).json({ error: errorMessage });
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  try {
    const record = await prisma.vendorCustomer.create({
      data: { merchantTypeId, name, contactNumber, email, siteLocationId, companyName, gstOptIn: Boolean(gstOptIn), gstNumber, gstDetails, remarks },
      include: { merchantType: true, siteLocation: true },
    });
    res.status(201).json(shapeMerchantProfile(record));
  } catch (error) {
    console.error('Failed to create vendor & customer record', error);
    res.status(500).json({ error: 'Failed to create vendor & customer record' });
  }
});

app.put('/api/vendor-customers/:id', async (req, res) => {
  const { id } = req.params;
  const errorMessage = validateMerchantProfile(req.body);
  if (errorMessage) return res.status(400).json({ error: errorMessage });
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  try {
    const record = await prisma.vendorCustomer.update({
      where: { id },
      data: { merchantTypeId, name, contactNumber, email, siteLocationId, companyName, gstOptIn: Boolean(gstOptIn), gstNumber, gstDetails, remarks },
      include: { merchantType: true, siteLocation: true },
    });
    res.json(shapeMerchantProfile(record));
  } catch (error) {
    console.error('Failed to update vendor & customer record', error);
    res.status(500).json({ error: 'Failed to update vendor & customer record' });
  }
});

app.delete('/api/vendor-customers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.vendorCustomer.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete vendor & customer record', error);
    res.status(500).json({ error: 'Failed to delete vendor & customer record' });
  }
});

app.get('/api/royalty-owners', async (req, res) => {
  try {
    const items = await prisma.royaltyOwnerProfile.findMany({
      include: { merchantType: true, siteLocation: true },
      orderBy: { name: 'asc' },
    });
    res.json(items.map(shapeMerchantProfile));
  } catch (error) {
    console.error('Failed to list royalty owner data', error);
    res.status(500).json({ error: 'Failed to list royalty owner data' });
  }
});

app.post('/api/royalty-owners', async (req, res) => {
  const errorMessage = validateMerchantProfile(req.body);
  if (errorMessage) return res.status(400).json({ error: errorMessage });
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  try {
    const record = await prisma.royaltyOwnerProfile.create({
      data: { merchantTypeId, name, contactNumber, email, siteLocationId, companyName, gstOptIn: Boolean(gstOptIn), gstNumber, gstDetails, remarks },
      include: { merchantType: true, siteLocation: true },
    });
    res.status(201).json(shapeMerchantProfile(record));
  } catch (error) {
    console.error('Failed to create royalty owner record', error);
    res.status(500).json({ error: 'Failed to create royalty owner record' });
  }
});

app.put('/api/royalty-owners/:id', async (req, res) => {
  const { id } = req.params;
  const errorMessage = validateMerchantProfile(req.body);
  if (errorMessage) return res.status(400).json({ error: errorMessage });
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  try {
    const record = await prisma.royaltyOwnerProfile.update({
      where: { id },
      data: { merchantTypeId, name, contactNumber, email, siteLocationId, companyName, gstOptIn: Boolean(gstOptIn), gstNumber, gstDetails, remarks },
      include: { merchantType: true, siteLocation: true },
    });
    res.json(shapeMerchantProfile(record));
  } catch (error) {
    console.error('Failed to update royalty owner record', error);
    res.status(500).json({ error: 'Failed to update royalty owner record' });
  }
});

app.delete('/api/royalty-owners/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.royaltyOwnerProfile.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete royalty owner record', error);
    res.status(500).json({ error: 'Failed to delete royalty owner record' });
  }
});

app.get('/api/transport-owners', async (req, res) => {
  try {
    const items = await prisma.transportOwnerProfile.findMany({
      include: { merchantType: true, siteLocation: true },
      orderBy: { name: 'asc' },
    });
    res.json(items.map(shapeMerchantProfile));
  } catch (error) {
    console.error('Failed to list transport owner data', error);
    res.status(500).json({ error: 'Failed to list transport owner data' });
  }
});

app.post('/api/transport-owners', async (req, res) => {
  const errorMessage = validateMerchantProfile(req.body);
  if (errorMessage) return res.status(400).json({ error: errorMessage });
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  try {
    const record = await prisma.transportOwnerProfile.create({
      data: { merchantTypeId, name, contactNumber, email, siteLocationId, companyName, gstOptIn: Boolean(gstOptIn), gstNumber, gstDetails, remarks },
      include: { merchantType: true, siteLocation: true },
    });
    res.status(201).json(shapeMerchantProfile(record));
  } catch (error) {
    console.error('Failed to create transport owner record', error);
    res.status(500).json({ error: 'Failed to create transport owner record' });
  }
});

app.put('/api/transport-owners/:id', async (req, res) => {
  const { id } = req.params;
  const errorMessage = validateMerchantProfile(req.body);
  if (errorMessage) return res.status(400).json({ error: errorMessage });
  const {
    merchantTypeId,
    name,
    contactNumber,
    email = '',
    siteLocationId,
    companyName = '',
    gstOptIn = false,
    gstNumber = '',
    gstDetails = '',
    remarks = '',
  } = req.body || {};
  try {
    const record = await prisma.transportOwnerProfile.update({
      where: { id },
      data: { merchantTypeId, name, contactNumber, email, siteLocationId, companyName, gstOptIn: Boolean(gstOptIn), gstNumber, gstDetails, remarks },
      include: { merchantType: true, siteLocation: true },
    });
    res.json(shapeMerchantProfile(record));
  } catch (error) {
    console.error('Failed to update transport owner record', error);
    res.status(500).json({ error: 'Failed to update transport owner record' });
  }
});

app.delete('/api/transport-owners/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.transportOwnerProfile.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete transport owner record', error);
    res.status(500).json({ error: 'Failed to delete transport owner record' });
  }
});

app.get('/api/transport-owner-vehicles', async (req, res) => {
  try {
    const items = await prisma.transportOwnerVehicle.findMany({
      include: { transportOwner: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    res.json(items.map(item => ({
      ...item,
      transportOwnerName: item.transportOwner?.name || '',
      vehicleNumber: item.vehicleNumber || '',
    })));
  } catch (error) {
    console.error('Failed to list transport owner vehicles', error);
    res.status(500).json({ error: 'Failed to list transport owner vehicles' });
  }
});

app.post('/api/transport-owner-vehicles', async (req, res) => {
  const { transportOwnerId, vehicleNumber, effectiveFrom, effectiveTo = null, remarks = '' } = req.body || {};
  if (!transportOwnerId || !vehicleNumber || !effectiveFrom) {
    return res.status(400).json({ error: 'Transport owner, vehicle, and effective from date are required.' });
  }
  try {
    const item = await prisma.transportOwnerVehicle.create({
      data: {
        transportOwnerId,
        vehicleNumber,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        remarks,
      },
      include: { transportOwner: true },
    });
    res.status(201).json({
      ...item,
      transportOwnerName: item.transportOwner?.name || '',
      vehicleNumber: item.vehicleNumber || '',
    });
  } catch (error) {
    console.error('Failed to create transport owner vehicle', error);
    res.status(500).json({ error: 'Failed to create transport owner vehicle' });
  }
});

app.put('/api/transport-owner-vehicles/:id', async (req, res) => {
  const { id } = req.params;
  const { transportOwnerId, vehicleNumber, effectiveFrom, effectiveTo = null, remarks = '' } = req.body || {};
  if (!transportOwnerId || !vehicleNumber || !effectiveFrom) {
    return res.status(400).json({ error: 'Transport owner, vehicle, and effective from date are required.' });
  }
  try {
    const item = await prisma.transportOwnerVehicle.update({
      where: { id },
      data: {
        transportOwnerId,
        vehicleNumber,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        remarks,
      },
      include: { transportOwner: true },
    });
    res.json({
      ...item,
      transportOwnerName: item.transportOwner?.name || '',
      vehicleNumber: item.vehicleNumber || '',
    });
  } catch (error) {
    console.error('Failed to update transport owner vehicle', error);
    res.status(500).json({ error: 'Failed to update transport owner vehicle' });
  }
});

app.delete('/api/transport-owner-vehicles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.transportOwnerVehicle.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete transport owner vehicle', error);
    res.status(500).json({ error: 'Failed to delete transport owner vehicle' });
  }
});

app.get('/api/material-types', async (req, res) => {
  try {
    const items = await prisma.materialTypeDefinition.findMany({ orderBy: { name: 'asc' } });
    res.json(items);
  } catch (error) {
    console.error('Failed to list material types', error);
    res.status(500).json({ error: 'Failed to list material types' });
  }
});

app.post('/api/material-types', async (req, res) => {
  const { name, remarks = '' } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Material type is required.' });
  }
  try {
    const item = await prisma.materialTypeDefinition.create({ data: { name, remarks } });
    res.status(201).json(item);
  } catch (error) {
    console.error('Failed to create material type', error);
    res.status(500).json({ error: 'Failed to create material type' });
  }
});

app.put('/api/material-types/:id', async (req, res) => {
  const { id } = req.params;
  const { name, remarks = '' } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'Material type is required.' });
  }
  try {
    const item = await prisma.materialTypeDefinition.update({ where: { id }, data: { name, remarks } });
    res.json(item);
  } catch (error) {
    console.error('Failed to update material type', error);
    res.status(500).json({ error: 'Failed to update material type' });
  }
});

app.delete('/api/material-types/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.materialTypeDefinition.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete material type', error);
    res.status(500).json({ error: 'Failed to delete material type' });
  }
});

app.get('/api/material-rates', async (req, res) => {
  try {
    const items = await prisma.materialRate.findMany({
      include: { materialType: true, pickupLocation: true, dropOffLocation: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    const response = await Promise.all(items.map(async (item) => {
      const status = getMaterialRateStatus(item.effectiveFrom, item.effectiveTo);
      if (status !== item.status) {
        await prisma.materialRate.update({
          where: { id: item.id },
          data: { status },
        });
      }
      return {
        ...item,
        status,
        materialTypeName: item.materialType?.name || '',
        pickupLocationName: item.pickupLocation?.name || '',
        dropOffLocationName: item.dropOffLocation?.name || '',
        ratePartyName: await getRatePartyName(item.ratePartyType, item.ratePartyId),
      };
    }));
    res.json(response);
  } catch (error) {
    console.error('Failed to list material rates', error);
    res.status(500).json({ error: 'Failed to list material rates' });
  }
});

app.post('/api/material-rates', async (req, res) => {
  const {
    materialTypeId,
    ratePartyType,
    ratePartyId,
    pickupLocationId,
    dropOffLocationId,
    totalKm = 0,
    ratePerKm = 0,
    ratePerTon = 0,
    gstChargeable = false,
    gstPercentage = 0,
    gstAmount = 0,
    totalRatePerTon = 0,
    effectiveFrom,
    effectiveTo = null,
    remarks = '',
  } = req.body || {};

  if (!materialTypeId || !ratePartyType || !ratePartyId || !pickupLocationId || !dropOffLocationId || !effectiveFrom) {
    return res.status(400).json({ error: 'Material type, rate party, locations, and effective from date are required.' });
  }

  try {
    const newStart = new Date(effectiveFrom);
    const item = await prisma.$transaction(async (tx) => {
      const existingRates = await tx.materialRate.findMany({
        where: {
          materialTypeId,
          ratePartyType,
          ratePartyId,
          pickupLocationId,
          dropOffLocationId,
        },
      });
      const futureOverlap = existingRates.some(rate => {
        const rateStart = new Date(rate.effectiveFrom);
        if (rateStart < newStart) return false;
        return hasMaterialRateOverlap(effectiveFrom, effectiveTo, rate.effectiveFrom, rate.effectiveTo);
      });
      if (futureOverlap) {
        throw new Error('DUPLICATE_RATE');
      }
      const duplicateExists = existingRates.some(rate => {
        const startMatch = new Date(rate.effectiveFrom).toISOString().split('T')[0] === newStart.toISOString().split('T')[0];
        const endMatch = (rate.effectiveTo ? new Date(rate.effectiveTo).toISOString().split('T')[0] : null) === (effectiveTo ? new Date(effectiveTo).toISOString().split('T')[0] : null);
        return startMatch && endMatch;
      });
      if (duplicateExists) {
        throw new Error('DUPLICATE_RATE');
      }

      const previousDay = new Date(newStart);
      previousDay.setDate(previousDay.getDate() - 1);

      await tx.materialRate.updateMany({
        where: {
          materialTypeId,
          ratePartyType,
          ratePartyId,
          pickupLocationId,
          dropOffLocationId,
          effectiveFrom: { lt: newStart },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: newStart } },
          ],
        },
        data: {
          effectiveTo: previousDay,
        },
      });

      return tx.materialRate.create({
        data: {
          materialTypeId,
          ratePartyType,
          ratePartyId,
          pickupLocationId,
          dropOffLocationId,
          totalKm,
          ratePerKm,
          ratePerTon,
          gstChargeable: Boolean(gstChargeable),
          gstPercentage,
          gstAmount,
          totalRatePerTon,
          effectiveFrom: newStart,
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          status: getMaterialRateStatus(newStart, effectiveTo),
          remarks,
        },
        include: { materialType: true, pickupLocation: true, dropOffLocation: true },
      });
    });
    res.status(201).json({
      ...item,
      materialTypeName: item.materialType?.name || '',
      pickupLocationName: item.pickupLocation?.name || '',
      dropOffLocationName: item.dropOffLocation?.name || '',
      ratePartyName: await getRatePartyName(item.ratePartyType, item.ratePartyId),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_RATE') {
      return res.status(409).json({ error: 'Overlapping rate exists for this party, material, and locations.' });
    }
    console.error('Failed to create material rate', error);
    res.status(500).json({ error: 'Failed to create material rate' });
  }
});

app.put('/api/material-rates/:id', async (req, res) => {
  const { id } = req.params;
  const {
    materialTypeId,
    ratePartyType,
    ratePartyId,
    pickupLocationId,
    dropOffLocationId,
    totalKm = 0,
    ratePerKm = 0,
    ratePerTon = 0,
    gstChargeable = false,
    gstPercentage = 0,
    gstAmount = 0,
    totalRatePerTon = 0,
    effectiveFrom,
    effectiveTo = null,
    remarks = '',
  } = req.body || {};

  if (!materialTypeId || !ratePartyType || !ratePartyId || !pickupLocationId || !dropOffLocationId || !effectiveFrom) {
    return res.status(400).json({ error: 'Material type, rate party, locations, and effective from date are required.' });
  }

  try {
    const existingRates = await prisma.materialRate.findMany({
      where: {
        materialTypeId,
        ratePartyType,
        ratePartyId,
        pickupLocationId,
        dropOffLocationId,
        NOT: { id },
      },
    });
    const overlapExists = existingRates.some(rate => hasMaterialRateOverlap(effectiveFrom, effectiveTo, rate.effectiveFrom, rate.effectiveTo));
    if (overlapExists) {
      return res.status(409).json({ error: 'Overlapping rate exists for this party, material, and locations.' });
    }

    const item = await prisma.materialRate.update({
      where: { id },
      data: {
        materialTypeId,
        ratePartyType,
        ratePartyId,
        pickupLocationId,
        dropOffLocationId,
        totalKm,
        ratePerKm,
        ratePerTon,
        gstChargeable: Boolean(gstChargeable),
        gstPercentage,
        gstAmount,
        totalRatePerTon,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        status: getMaterialRateStatus(effectiveFrom, effectiveTo),
        remarks,
      },
      include: { materialType: true, pickupLocation: true, dropOffLocation: true },
    });
    res.json({
      ...item,
      materialTypeName: item.materialType?.name || '',
      pickupLocationName: item.pickupLocation?.name || '',
      dropOffLocationName: item.dropOffLocation?.name || '',
      ratePartyName: await getRatePartyName(item.ratePartyType, item.ratePartyId),
    });
  } catch (error) {
    console.error('Failed to update material rate', error);
    res.status(500).json({ error: 'Failed to update material rate' });
  }
});

app.delete('/api/material-rates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.materialRate.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete material rate', error);
    res.status(500).json({ error: 'Failed to delete material rate' });
  }
});
// Listen on all network interfaces, which is required for containerized environments
const startServer = async () => {
  await ensureSeedData();
  scheduleDatabaseBackups();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
