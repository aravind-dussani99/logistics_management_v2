# Permissions Reference

This document tracks the roles granted across GCP for the LogiTrack app and why they are required.

## Service Accounts

### logitrack-sa (runtime + deploy)
Used for Cloud Run deployments and runtime service account for the backend.

- Cloud Run Developer  
  Deploy Cloud Run services without changing IAM policy at deploy time.
- Artifact Registry Writer  
  Push backend container images into GAR.
- Service Account User  
  Allow deploy commands to set the Cloud Run runtime service account.
- Cloud SQL Client  
  Allow Cloud Run runtime to connect to Cloud SQL instances.
- Storage Object Admin  
  Read/write static frontend assets and config.json in GCS buckets.
- Service Account Token Creator  
  Required to generate signed URLs for private attachments in GCS.

### logitrack-cloud-sql-sa (migration-only)
Used in CI to run Prisma migrations through Cloud SQL Proxy.

- Cloud SQL Admin  
  Access Cloud SQL instance metadata and run migrations.
- Cloud SQL Client  
  Connect to Cloud SQL through the proxy.

## Buckets

- Frontend bucket(s)  
  Static UI assets (`index.html`, `assets/*`, `config.json`).
- Attachments bucket(s)  
  Private uploads for trip documents. Access is via signed URLs only.

## Notes

- If you want the backend to be publicly callable, grant `roles/run.invoker` to `allUsers` or set `--allow-unauthenticated` once with a higher-privilege account.
- Signed URLs are time-limited. Only authenticated app users should request them via the API.
