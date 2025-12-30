# LogiTrack Setup Guide (GCP)

This repo is now split into:
- `frontend/`: Vite + React UI
- `backend/`: Express + Prisma API

## When to use Cloud Run vs GCS + CDN

Cloud Run (single image serving UI + API)
- Pros: simplest deployment, single URL, easy auth and routing.
- Cons: static assets served by Node, less CDN caching, slower cold starts.
- Use when: you want the fastest path to production with minimal infra.

Cloud Run for API + GCS/Cloud CDN for UI
- Pros: static assets cached globally, faster UI load, backend scales separately.
- Cons: two deployments, need CORS, UI uses API base URL.
- Use when: you need performance, scalability, or CDN caching.

## What Prisma ORM is

Prisma is an ORM that lets you:
- Define your tables and relations in `backend/prisma/schema.prisma`
- Generate a type-safe client for queries
- Run migrations to keep the database schema in sync

The backend uses Prisma client for all table reads/writes.

## How Cloud Run connects to Cloud SQL

1) Create a Cloud SQL Postgres instance.
2) Set a database user and password.
3) Create a database (e.g. `logitrack`).
4) In Cloud Run, attach the instance and set `DATABASE_URL`:
   - Format: `postgresql://USER:PASSWORD@localhost:5432/DB?schema=public`
5) Deploy with:
   - `--add-cloudsql-instances PROJECT:REGION:INSTANCE`
   - `--set-env-vars DATABASE_URL=...`

Cloud Run uses the Cloud SQL connector, so the host is `localhost`.

## How data is stored in multiple tables

Each table is a Prisma model in `backend/prisma/schema.prisma`.
The backend exposes REST endpoints for each table. Typical flow:
- Create: `prisma.table.create`
- Read: `prisma.table.findMany`
- Update: `prisma.table.update`
- Delete: `prisma.table.delete`

For multi-table writes, use transactions:
`prisma.$transaction([ ... ])`

## How documents/images are stored with GCS URLs

Recommended flow:
1) Frontend requests an upload URL from backend.
2) Backend creates a signed URL using GCS SDK.
3) Frontend uploads the file directly to GCS.
4) Backend saves the GCS URL (or object path) to the DB.

This avoids large file uploads through Cloud Run and scales well.

## Backend vs Frontend responsibilities

Backend:
- Auth, validation, and business rules
- DB access (Prisma)
- Signed URL creation for GCS
- Webhooks and notifications

Frontend:
- UI and data entry
- Calls backend APIs
- Uploads files using signed URLs

## GCP Services Used

- Cloud Run: API service
- Cloud SQL (Postgres): relational database
- Cloud Storage: document/image storage
- Cloud CDN (optional): cache UI assets
- Artifact Registry: container images
- IAM: service accounts and permissions
- Secret Manager (optional): DB secrets

## Manual Setup Steps (GCP)

1) Create a GCP project
2) Enable APIs:
   - Cloud Run, Artifact Registry, Cloud SQL Admin, IAM, Secret Manager, Storage
3) Create service accounts:
   - `logitrack-deployer` (GitHub Actions)
   - `logitrack-runtime` (Cloud Run)
4) Grant roles:
   - Deployer: `roles/run.admin`, `roles/artifactregistry.admin`,
     `roles/iam.serviceAccountUser`, `roles/storage.admin`
   - Runtime: `roles/cloudsql.client`, `roles/storage.objectAdmin`
5) Create Artifact Registry repo (Docker)
6) Create Cloud SQL instance + database + user
7) Create a GCS bucket for UI (optional) and a bucket for uploads
8) Configure GitHub Actions variables:
   - `GCP_PROJECT_ID`
   - `GCP_REGION`
   - `GAR_REPOSITORY`
   - `CLOUD_RUN_SERVICE`
   - `FRONTEND_BUCKET` (optional)
   - `IMAGE_NAME` (optional)
   - `LOGITRACK_SA` (service account email)
9) Configure GitHub Actions secrets:
   - `LOGITRACK_SA_KEY` (service account JSON key)
10) Deploy:
   - Push to `main` runs workflow

## Frontend Environment Variables

Set in `frontend/.env.local`:
- `VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_URL`

## Terraform Outline (Later Automation)

Suggested resources:
- `google_project_service` (enable APIs)
- `google_service_account` (deployer, runtime)
- `google_artifact_registry_repository`
- `google_cloud_run_v2_service`
- `google_sql_database_instance`
- `google_sql_database`
- `google_sql_user`
- `google_storage_bucket` (frontend + uploads)
- `google_storage_bucket_iam_member`
- `google_cloud_run_v2_service_iam_member` (public access)

High-level flow:
1) Enable APIs
2) Create service accounts + IAM bindings
3) Create Artifact Registry
4) Create Cloud SQL + DB + user
5) Create buckets + IAM
6) Deploy Cloud Run with image + env vars + Cloud SQL attachment
