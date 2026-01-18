# API Specification

## Base URL
`http://localhost:3002/api`

## Endpoints

### Business Types
-   **GET** `/business-types`: List all business types.
-   **GET** `/business-types/:id`: Get a specific business type.
-   **POST** `/business-types`: Create a new business type.
    -   Body: `{ "business_type": "string", "remarks": "string" }`
-   **PUT** `/business-types/:id`: Update a business type.
-   **DELETE** `/business-types/:id`: Delete a business type.

### Business Info
-   **GET** `/business-info`: List all business info records (joins with business_types).
-   **GET** `/business-info/:id`: Get specific business info.
-   **POST** `/business-info`: Create new business info.
    -   **Content-Type**: `multipart/form-data`
    -   **Fields**:
        -   `business_type_id` (required)
        -   `name` (required)
        -   `contact_number` (required)
        -   `address` (required)
        -   `email`, `remarks`, `gst_number`, `account_number`, `account_bank`, `account_ifsc`, `account_nick_name` (optional)
        -   `business_address_proof` (file)
-   **PUT** `/business-info/:id`: Update business info (supports file replacement).
-   **DELETE** `/business-info/:id`: Delete business info and associated file.

## Error Handling
-   **400 Bad Request**: Missing required fields or validation errors.
-   **404 Not Found**: Resource does not exist.
-   **500 Internal Server Error**: Server-side issues (database, file system).
