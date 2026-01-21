# Refactoring to Single Table Architecture

## Objective
Consolidate `AdvanceRecord`, `DailyExpenseRecord`, and `DailyExpenseOpeningBalance` into the single `PaymentRecord` table to simplify the architecture and unify financial tracking.

## Changes Implemented

### 1. Database Schema
- **Modified**: `PaymentRecord` is now the sole source of truth for all financial entries.
- **Removed**:
  - `AdvanceRecord` (Merged into PaymentRecord via `remarks`)
  - `DailyExpenseRecord` (Functionality already handled by PaymentRecord)
  - `DailyExpenseOpeningBalance` (Converted to `PaymentRecord` entries with `entryType='OPENING_BALANCE'`)

### 2. Backend Logic
- **Opening Balances**:
  - `getOrCreateOpeningBalance` now queries `PaymentRecord` for `entryType: 'OPENING_BALANCE'`.
  - New opening balances are created as `CREDIT` entries in `PaymentRecord` with `createdBy: 'SYSTEM'`.
- **Advances**:
  - Deprecated and removed legacy `/api/advances` endpoints.
  - Users should now use the **Payments** interface to record advances, using the `remarks` field to tag them (e.g., "Advance for Trip #123").

### 3. Frontend
- **Navigation**: Removed "Advances" from the Sidebar and App routing.
- **Access**: The separate Advances page is no longer accessible.

## Migration Guide for Existing Data
Since we deprecated the tables, if you have existing data in `AdvanceRecord` or `DailyExpenseOpeningBalance` that you wish to keep, you should run a data migration script (SQL) to move them to `PaymentRecord` before applying the drop table migration.

**Example Migration Logic (Run before dropping):**
```sql
-- Migrate Advances
INSERT INTO "PaymentRecord" (id, date, amount, "fromAccount", "toAccount", remarks, "entryType", "createdAt", "updatedAt")
SELECT id, date, amount, "fromAccount", "toAccount", remarks, 'PAYMENT', "createdAt", "updatedAt"
FROM "AdvanceRecord";

-- Migrate Opening Balances
INSERT INTO "PaymentRecord" (id, date, amount, "fromAccount", "entryType", type, remarks, "createdAt", "updatedAt", "createdBy")
SELECT id, "createdAt", amount, "supervisorName", 'OPENING_BALANCE', 'CREDIT', 'Migrated Opening Balance', "createdAt", "updatedAt", 'SYSTEM'
FROM "DailyExpenseOpeningBalance";
```

## Next Steps
- Commit the changes.
- Ensure your CI/CD applies the new migrations.
