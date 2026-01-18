# Technical Architecture

## Technology Stack

### Frontend
-   **Framework**: React 18+ (with Vite)
-   **Language**: TypeScript
-   **UI Library**: Material-UI (MUI) v5+
-   **Styling**: Emotion (MUI default) + CSS Modules (if needed)
-   **Routing**: React Router DOM v6
-   **State Management**: React Context API (AuthContext, DataContext, UIContext)
-   **HTTP Client**: Fetch API (or Axios)

### Backend
-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Database**: SQLite (via `better-sqlite3`) for local dev; PostgreSQL compatible.
-   **File Uploads**: Multer (for handling multipart/form-data)

## Folder Structure (Recommended for Fresh Start)
```
/
├── backend/
│   ├── config/         # Database and app config
│   ├── data/           # SQLite database file
│   ├── migrations/     # SQL schema scripts
│   ├── routes/         # API route handlers
│   ├── uploads/        # Stored user uploads
│   └── server.js       # Entry point
├── frontend/           # (or root level if preferred)
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page-level components
│   │   ├── services/   # API client services
│   │   ├── types/      # TypeScript interfaces
│   │   ├── App.tsx     # Main app component
│   │   └── main.tsx    # Entry point
│   └── index.html
└── ...config files
```

## Key Design Decisions
1.  **SQLite for Local Dev**: chosen for zero-config, file-based persistence that mimics PostgreSQL.
2.  **Auto-Increment IDs**: Business Info IDs start at 10000 to distinguish from other entities.
3.  **File Uploads**: Stored locally in `backend/uploads` for simplicity in Phase 1.
4.  **Minimal App Structure**: Moving forward, avoid complex provider wrapping until features are stable.
