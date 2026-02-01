# Terraform Infra

This folder contains Terraform configuration to provision LogiTrack infrastructure.

Resources managed:
- Enable required APIs (Service Usage, Cloud Run, Artifact Registry, IAM, Storage, Compute)
- Artifact Registry Docker repo
- CI deploy service account + IAM roles
- Backend Cloud Run service
- Frontend GCS bucket + Cloud CDN (HTTP LB)

## Backend State
Use the GCS backend bucket created by the WIF setup script:
- `logitrack-tf-state-gcs-backend`

Example init:
```bash
terraform init \
  -backend-config="bucket=logitrack-tf-state-gcs-backend" \
  -backend-config="prefix=logitrack/terraform"
```

## Required variables
- `project_id`
- `region`
- `gar_repository`
- `backend_service_name`
- `backend_image`
- `frontend_bucket_name`
- `ci_service_account_name`

Optional:
- `backend_runtime_service_account`
- `cdn_name`
