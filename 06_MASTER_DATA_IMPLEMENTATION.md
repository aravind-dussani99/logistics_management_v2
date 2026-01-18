# Master Data Implementation Details

## Frontend Components

### `MasterData.tsx` (Page)
-   **Layout**: Header with "Add +" button, Data Table.
-   **Add Button**: Triggers a dropdown menu.
-   **Dropdown Options**: "Add Business Info", "Add Business Type" (and placeholders for others).
-   **Modals**: Opens `BusinessInfoForm` or `BusinessTypeForm` in a dialog.

### `BusinessInfoForm.tsx`
-   **State**: Manages form data and file selection.
-   **Validation**: Checks required fields before submission.
-   **File Upload**: Uses `<input type="file">` and `FormData` object for API submission.
-   **Edit Mode**: Pre-fills data if an `initialData` prop is provided.

### `BusinessTypeForm.tsx`
-   **Simple Form**: Just "Business Type" name and "Remarks".

## Backend Logic

### ID Generation
Since SQLite doesn't support `ALTER SEQUENCE` easily, the backend manually calculates the next ID for `business_info`:
```javascript
function getNextBusinessInfoId() {
    const result = db.prepare('SELECT MAX(id) as maxId FROM business_info').get();
    const maxId = result.maxId || 9999;
    return Math.max(maxId + 1, 10000);
}
```

### File Storage
-   Files are stored in `backend/uploads/business-address-proofs/`.
-   Filenames are sanitized and timestamped to prevent collisions.
-   Files are deleted when the corresponding database record is deleted.
