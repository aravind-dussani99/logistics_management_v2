# LogiTrack GCP Setup Guide

This guide covers architecture choices, required GCP services, manual setup steps, and a Terraform outline. It assumes the repo is split into `frontend/` and `backend/`.

## 1) Architecture Choices

### Option A: Cloud Run for Frontend + Backend (two services)
- **When**: Quick setup, unified deployment tooling, fewer moving parts.
- **Pros**: Simple CI/CD, consistent runtime, easy to secure behind IAM later.
- **Cons**: Higher cost for static assets, slower cold-starts for static content.

### Option B: GCS + Cloud CDN for Frontend, Cloud Run for Backend (recommended for production)
- **When**: High-traffic static UI, best performance and cost.
- **Pros**: Global caching, very low cost, fast.
- **Cons**: Two deployment targets (GCS and Cloud Run).

**Rule of thumb**:
- If you want simplicity → **Option A**.
- If you want performance and cost efficiency for static assets → **Option B**.

## 1.1) Cloud Run custom domain (stable URL)

- Cloud Run default URLs are stable but not user-friendly.
- A custom domain gives you a stable, branded URL and avoids URL changes in the UI.
- Costs: domain registration (annual), Cloud DNS (small monthly), managed TLS is free.

Example:
```
gcloud run domain-mappings create \
  --service logitrack-api \
  --domain api.example.com \
  --region us-central1
```

## 1.2) Cloud CDN setup (GCS frontend)

To enable CDN for a static site on GCS you need a Global HTTP(S) Load Balancer:
1) Create a backend bucket and enable CDN.
2) Create a URL map and HTTPS frontend.
3) Point your domain DNS to the load balancer IP.

Costs: load balancer + CDN egress + request charges (small but non-zero).

## 1.3) Runtime Config (no rebuild URL changes)

The frontend loads `/config.json` at runtime and uses `apiBaseUrl`.
This lets you update backend URLs without rebuilding the frontend. Update the
GCS file only.

Admin UI path: `/config-manager` (admin/manager) updates the GCS config via the backend.

## 2) What is Prisma?
Prisma is an ORM (Object-Relational Mapping) that:
- Defines your database schema in `prisma/schema.prisma`
- Generates a typed client for queries (CRUD) in Node.js
- Handles migrations and data access cleanly

## 3) How Cloud Run connects to Cloud SQL
Cloud Run uses a **Cloud SQL connection** and a **DATABASE_URL**:
1) Create Cloud SQL (Postgres).
2) Grant Cloud Run service account the `Cloud SQL Client` role.
3) Configure Cloud Run with:
   - `--add-cloudsql-instances` (connection name)
   - `DATABASE_URL` env var

Example `DATABASE_URL` (Postgres):
```
postgresql://USER:PASSWORD@localhost:5432/DB?schema=public
```

When using Cloud SQL connector, the host is `localhost` and the connector handles the socket.

## 4) Storing documents/images in GCS
**Flow**:
- Frontend uploads file to backend (or directly to GCS via signed URL).
- Backend uploads to GCS bucket.
- Backend stores the **GCS URL** (or signed URL) in the database.

Recommended approach:
- Backend generates a signed upload URL.
- Frontend uploads directly to GCS.
- Backend stores the URL and metadata in DB.

## 5) Services Used in This Application

**Core**
- Cloud Run (backend API service)
- Cloud Run (frontend static service) *or* GCS + Cloud CDN
- Cloud SQL (Postgres)
- Artifact Registry (Docker images)
- Cloud Storage (documents/images)
- IAM (service accounts/roles)

**Optional**
- Secret Manager (store DB passwords, API keys)
- Cloud Logging & Monitoring (visibility)

## 6) Manual Setup Steps (GCP)

### Step 1: Create Project
1. Create a new GCP project.
2. Set billing.
3. Set region (e.g., `us-central1`).

### Step 2: Enable APIs
Enable:
- Cloud Run API
- Artifact Registry API
- Cloud SQL Admin API
- IAM API
- Cloud Storage API
- Secret Manager API (optional)

### Step 3: Create Service Accounts
Create two service accounts:
1. **CI deployer** (for GitHub Actions)
2. **Runtime** (for Cloud Run service)

Recommended names:
- `logitrack-ci`
- `logitrack-runtime`

### Step 4: Assign Roles
**CI deployer**:
- Artifact Registry Writer
- Cloud Run Admin
- Service Account User
- Cloud SQL Admin (if managing SQL in CI)

**Runtime**:
- Cloud SQL Client
- Storage Object Admin

### Step 5: Create Artifact Registry
Create a Docker repo:
```
gcloud artifacts repositories create logitrack \
  --repository-format=docker \
  --location=us-central1
```

### Step 6: Create Cloud SQL
```
gcloud sql instances create logitrack-db \
  --database-version=POSTGRES_15 \
  --cpu=2 --memory=4GB --region=us-central1
```
Create DB + user:
```
gcloud sql databases create logitrack --instance=logitrack-db
gcloud sql users create logitrack_user --instance=logitrack-db --password=YOUR_PASSWORD
```

### Step 7: Create GCS Bucket
```
gsutil mb -l us-central1 gs://YOUR_BUCKET_NAME
```

### Step 8: GitHub Actions Secrets/Vars

**Secrets**
- `LOGITRACK_SA_KEY`: JSON key for `logitrack-sa` (Cloud Run/GAR)
- `LOGITRACK_CLOUD_SQL_SA`: JSON key for `logitrack-cloud-sql-sa`
- `DATABASE_URL_DEV`: dev database connection string
- `DATABASE_URL_PROD`: prod database connection string

**Variables**
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GAR_REPOSITORY`
- `CLOUD_RUN_SERVICE` (backend)
- `IMAGE_NAME_BACKEND`
- `LOGITRACK_SA` (runtime service account email)
- `LOGITRACK_CLOUD_SQL_SA_SA` (Cloud SQL service account email)
- `FRONTEND_API_BASE_URL` (e.g. backend URL)
- `CORS_ORIGIN` (frontend URL)
- `FRONTEND_BUCKET`
- `CLOUD_RUN_SERVICE_DEV`
- `FRONTEND_BUCKET_DEV` (can be same as prod for now)
- `CORS_ORIGIN_DEV`
- `CONFIG_BUCKET` (optional, defaults to frontend bucket)
- `CLOUDSQL_INSTANCE_CONNECTION` (project:region:instance)
- `DB_PROXY_PORT` (optional, default 5432)

## 7) Terraform Outline

High-level Terraform modules:
- **project**: GCP project, APIs
- **iam**: service accounts + IAM roles
- **artifact_registry**: docker repository
- **cloud_sql**: instance, database, user
- **storage**: GCS bucket
- **cloud_run**: backend service
- **storage**: frontend bucket (+ optional CDN)

Example resource list:
```
google_project_service (run, sqladmin, artifactregistry, storage, iam)
google_service_account (logitrack-ci, logitrack-runtime)
google_project_iam_member (roles for each SA)
google_artifact_registry_repository
google_sql_database_instance
google_sql_database
google_sql_user
google_storage_bucket
google_cloud_run_v2_service (backend)
google_cloud_run_v2_service (frontend)
```

## 8) Backend Handling (Summary)

### DB CRUD (Prisma)
- Define models in `backend/prisma/schema.prisma`
- Run `npx prisma generate`
- Use `prisma.<model>.create/update/findMany`

### File Storage (GCS)
- Backend route:
  - Accept file or signed URL request
  - Upload to GCS
  - Store URL in DB

## 9) Frontend Handling (Summary)
- Use `VITE_API_BASE_URL` to target backend
- For uploads:
  - request signed URL
  - upload directly to GCS
  - send metadata to backend

## 10) Local Dev
```
cd backend
npm install
npm run start

cd frontend
npm install
npm run dev
```
