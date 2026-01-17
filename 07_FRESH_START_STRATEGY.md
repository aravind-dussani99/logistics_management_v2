# Fresh Start Strategy

## Why the Reset?
The previous iteration suffered from "legacy drift" - trying to integrate new, clean components into an older, complex `App.tsx` structure with tangled providers (Auth, Data, UI) caused rendering failures. A fresh start ensures a clean slate with no hidden dependencies.

## Recommended Workflow: "Vertical Slice" Development

Instead of building all providers and routing upfront, we will build **one feature at a time, end-to-end**.

1.  **Initialize Base**:
    -   Clean `npm create vite@latest` setup.
    -   Install only essential deps: `react-router-dom`, `@mui/material`, `@emotion/react`, `@emotion/styled`.
    -   Create a simple `App.tsx` with *no* providers initially.

2.  **Slice 1: Master Data (Business Types)**
    -   Backend: Setup SQLite & Route.
    -   Frontend: Create API service & Component.
    -   Integration: Connect and Verify.

3.  **Slice 2: Master Data (Business Info)**
    -   Backend: Add Route & File Upload.
    -   Frontend: Create Form & Table.
    -   Integration: Connect and Verify.

4.  **Slice 3: Navigation & Layout**
    -   Add Sidebar/Header.
    -   Implement Routing.

5.  **Slice 4: Authentication (Later)**
    -   Only add AuthProvider when the core app is stable.

## Immediate Next Steps
1.  **Delete** all old files (Done).
2.  **Initialize** new Vite project.
3.  **Setup** Backend server with existing schema.
4.  **Implement** Master Data page (using the logic preserved in `06_MASTER_DATA_IMPLEMENTATION.md`).
