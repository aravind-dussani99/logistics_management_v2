# Management Guide

## GCP Project Migration (New Project)

Use this guide to move LogiTrack to a new Google Cloud project for testing/development.

### Migration Checklist
- [ ] Create/confirm the new GCP project ID and billing is active.
- [ ] Enable required APIs (Cloud Run, Artifact Registry, Cloud SQL Admin, IAM Credentials, Cloud Storage, Service Usage).
- [ ] Create runtime service account (`logitrack-sa`) and assign roles.
- [ ] Create CI deploy service account (`logitrack-deploy-sa`) and assign roles.
- [ ] Export CI deploy service account JSON key for GitHub Secrets.
- [ ] Create Cloud SQL Postgres instance, database, and user.
- [ ] Record Cloud SQL instance connection name (`PROJECT:REGION:INSTANCE`).
- [ ] Create Artifact Registry Docker repository.
- [ ] Create GCS buckets (frontend, attachments, config if separate).
- [ ] Update `.github/workflows/cloud-run-deploy.yml` env values.
- [ ] Update GitHub Secrets for DB URLs, SA keys, and reset token.
- [ ] Run a PR to validate lint/build/docker jobs.
- [ ] Merge to `main` to deploy backend + frontend.

### 1) Enable Required GCP Services
Enable these APIs in the new project:
- Cloud Run
- Artifact Registry
- Cloud SQL Admin API
- Cloud Build (optional, but commonly required by some tooling)
- IAM Service Account Credentials API
- Secret Manager (optional, if you later move secrets into GCP)
- Cloud Storage
- Service Usage API

### 2) Create Service Accounts
Create two service accounts (or reuse one if you prefer):

1) **Runtime service account** (used by Cloud Run):
   - Name: `logitrack-sa`
   - Roles (minimum):
     - Cloud Run Invoker (if needed)
     - Cloud SQL Client
     - Storage Object Admin (for frontend/config/attachments buckets)
     - Artifact Registry Reader (if needed at runtime)

2) **CI deploy service account** (used by GitHub Actions):
   - Name: `logitrack-deploy-sa`
   - Roles (minimum):
     - Cloud Run Admin
     - Artifact Registry Admin
     - Cloud SQL Client
     - Storage Admin (for frontend bucket uploads)
     - Service Account User (on the runtime service account)

Export the JSON key for the CI deploy service account and save it for GitHub Secrets.

### 3) Create Cloud SQL (Postgres)
- Create a Postgres instance (example: `logitrack-cloudsql-v2-instance`).
- Create database (example: `logitrack_dev`).
- Create user (example: `logitrack_cloudsql_v2_user`).
- Note the **instance connection name**: `PROJECT:REGION:INSTANCE`.

### 4) Create Artifact Registry
- Create a Docker repository (example: `logitrack-v2`).

### 5) Create Storage Buckets
- Frontend static bucket (example: `logitrack-frontend`).
- Attachments bucket (example: `logitrack-attachments`).
- Optional config bucket (can be the same as frontend bucket).

### 6) Update GitHub Actions Workflow Values
Update `.github/workflows/cloud-run-deploy.yml` env values for the new project:
- `PROJECT_ID`
- `REGION`
- `GAR_REPOSITORY`
- `BACKEND_SERVICE_NAME`
- `LOGITRACK_SA` (runtime service account email)
- `CORS_ORIGIN_DEV`
- `FRONTEND_BUCKET_DEV`
- `CONFIG_BUCKET_DEV`
- `ATTACHMENTS_BUCKET_DEV`
- `CLOUDSQL_INSTANCE_CONNECTION`
- `DB_PROXY_PORT` (if different)

### 7) Update GitHub Secrets (Required)
Set these in GitHub **Secrets**:
- `LOGITRACK_SA_KEY`: JSON key for the CI deploy service account
- `LOGITRACK_CLOUD_SQL_SA`: JSON key for the Cloud SQL proxy/ops service account (if separate)
- `DATABASE_URL_DEV`: local/proxy URL (used for migrations in CI)
- `DATABASE_URL_DEV_CLOUDRUN`: Cloud Run URL format with `host=/cloudsql/INSTANCE` in query params
- `ADMIN_RESET_TOKEN_DEV`: admin reset token for runtime
- `CLOUDSQL_PASSWORD`: only needed by maintenance workflow

### 8) Verify CI/CD
- Trigger a PR to validate lint/build/docker jobs.
- Merge to `main` to deploy backend + frontend to Cloud Run and GCS.

---

## Terraform Configuration Placeholder

This section is reserved for Terraform configuration details. Do not add actual Terraform code here yet.

Planned modules/resources (placeholders):
- `google_project_service` (enable APIs)
- `google_artifact_registry_repository`
- `google_sql_database_instance`
- `google_sql_database`
- `google_sql_user`
- `google_storage_bucket` (frontend, attachments, config)
- `google_cloud_run_service`
- `google_service_account` (runtime + CI)
- `google_service_account_key` (CI)
- `google_project_iam_member` (roles bindings)
