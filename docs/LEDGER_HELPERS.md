## Ledger Calculation Helpers

This document describes the helper utilities used to keep ledger/report calculations consistent across:
- Management Ledger (Reports page)
- Logistics Accounts Reports (AccountLedgerOverview)
- Name/Account reconciliation (AccountReconciliation)
- Trip Rates / GST / Bills tables

The goal is to centralize all rate and amount calculations so every page produces the same totals.

### Location
Helpers live in `frontend/utils.ts`.

### Helpers (current)
- `isComboRate(rate: MaterialRate)`: Detects combined rate entries from remarks.
- `resolveTripRate(rates, tripId, partyType, { comboOnly })`:
  - Returns the effective rate for a trip + party.
  - Prefers open-ended rates (no `effectiveTo`).
  - If an open-ended rate is `0`, it’s treated as deleted.
  - Combo detection relies on `remarks` containing "combo" / "combined".
- `getCombinedRatePerTon(rates, tripId)`:
  - Returns the combined rate per ton for the trip (if any).
- `getComboPartyTypes(rates, tripId)`:
  - Returns which party types (mine/transport/royalty) are covered by a combined rate.

### Usage
When calculating amounts:
1. Use `getCombinedRatePerTon` to determine if the trip has a combined rate.
2. For individual party totals, use `resolveTripRate(..., comboOnly: false)` and multiply `ratePerTon * netWeight`.
3. If a combined rate exists, **do not** also compute individual amounts for the party types included in the combo.

### Design Notes
- This avoids counting the same trip multiple times.
- It ensures “deleted” rates (rate=0) are treated as awaiting.
- It keeps the UI delisting logic consistent after edits/deletes.

### Future Extensions
If more calculation rules are added (e.g., GST, bill totals), keep them in small helpers and reuse across pages.
