# Task: Site Manager & Payments Enhancement

## Trip Rates Page Updates
- [x] Update pagination display format in "Trips Awaiting Rates" section
- [x] Update pagination display format in "Rates Applied" section for all tabs

## Payments Page Enhancements
- [x] Update date field to default to current date
- [x] Add "From" and "To" fields for both Payment In and Payment Out types
- [x] Remove "Site Expense" checkbox
- [x] Make Rate Party Type and Rate Party always visible (not optional)
- [x] Add payment receipt attachment upload field
- [x] Make all fields auto-suggestable/enterable
- [x] Add trip ID search functionality
- [x] Update PaymentRecord schema with new fields
- [x] Create database migration for schema changes
- [x] Update backend API to handle new fields and attachments
- [x] Update PaymentForm component with new UI
- [x] Implement Google Cloud Storage integration for payment receipts
- [x] Update types.ts with new Payment interface fields

## Reliability & Cleanup (Recent)
- [x] Consolidate AdvanceRecord/DailyExpenseRecord into PaymentRecord (Single Table)
- [x] Fix Frontend 404 on Logistics Accounts Overview (Removed deprecated API calls)
- [x] Fix CI/CD Migration Failure (Updated workflow with resolve command)
