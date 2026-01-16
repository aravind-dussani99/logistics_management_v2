# Database Schema

## Overview
The project currently uses SQLite. Below are the schema definitions for the implemented modules.

## Tables

### `business_types`
Stores categories of businesses (e.g., Supplier, Customer).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, Auto-inc | Unique identifier |
| `business_type` | TEXT | Unique, Not Null | Name of the type |
| `remarks` | TEXT | | Optional notes |
| `created_at` | DATETIME | Default NOW | Creation timestamp |
| `updated_at` | DATETIME | Default NOW | Update timestamp |

### `business_info`
Stores detailed information about business entities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, Auto-inc | Starts from 10000 |
| `business_type_id` | INTEGER | FK, Not Null | Links to `business_types` |
| `name` | TEXT | Not Null | Business name |
| `contact_number` | TEXT | Not Null | Primary contact |
| `email` | TEXT | | Email address |
| `address` | TEXT | Not Null | Physical address |
| `remarks` | TEXT | | Optional notes |
| `business_address_proof` | TEXT | | Path to uploaded file |
| `gst_number` | TEXT | | Tax ID |
| `account_number` | TEXT | | Bank account number |
| `account_bank` | TEXT | | Bank name |
| `account_ifsc` | TEXT | | Bank IFSC code |
| `account_nick_name` | TEXT | | Internal nickname |
| `created_at` | DATETIME | Default NOW | Creation timestamp |
| `updated_at` | DATETIME | Default NOW | Update timestamp |

## SQL Schema Script
```sql
-- Business Types table
CREATE TABLE IF NOT EXISTS business_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_type TEXT NOT NULL UNIQUE,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Business Info table
CREATE TABLE IF NOT EXISTS business_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_type_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    remarks TEXT,
    business_address_proof TEXT,
    gst_number TEXT,
    account_number TEXT,
    account_bank TEXT,
    account_ifsc TEXT,
    account_nick_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_type_id) REFERENCES business_types(id)
);

-- Note: ID starting at 10000 is handled in application logic for SQLite
```
