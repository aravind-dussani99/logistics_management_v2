#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  setup_wif_github.sh \
    --project-id PROJECT_ID \
    --pool-id POOL_ID \
    --provider-id PROVIDER_ID \
    --github-owner GITHUB_OWNER \
    --github-repo GITHUB_REPO \
    --tf-sa-name TF_SA_NAME

Example:
  setup_wif_github.sh \
    --project-id project-123 \
    --pool-id my-wif-pool \
    --provider-id github-provider \
    --github-owner myuser \
    --github-repo myrepo \
    --tf-sa-name logitrack-tf-sa

Notes:
  - This script creates a GCS state bucket named: logitrack-tf-state-gcs-backend
  - Make sure you're logged in with the correct Google account:
      gcloud auth login --account you@example.com
USAGE
}

PROJECT_ID=""
POOL_ID=""
PROVIDER_ID=""
GITHUB_OWNER=""
GITHUB_REPO=""
TF_SA_NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-id) PROJECT_ID="$2"; shift 2;;
    --pool-id) POOL_ID="$2"; shift 2;;
    --provider-id) PROVIDER_ID="$2"; shift 2;;
    --github-owner) GITHUB_OWNER="$2"; shift 2;;
    --github-repo) GITHUB_REPO="$2"; shift 2;;
    --tf-sa-name) TF_SA_NAME="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown argument: $1"; usage; exit 1;;
  esac
 done

if [[ -z "$PROJECT_ID" || -z "$POOL_ID" || -z "$PROVIDER_ID" || -z "$GITHUB_OWNER" || -z "$GITHUB_REPO" || -z "$TF_SA_NAME" ]]; then
  echo "Missing required arguments." >&2
  usage
  exit 1
fi

SA_EMAIL="${TF_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
STATE_BUCKET="logitrack-tf-state-gcs-backend"

echo "Using project: ${PROJECT_ID}"

gcloud config set project "${PROJECT_ID}"

echo "Enabling required APIs..."
gcloud services enable \
  serviceusage.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com

echo "Creating service account: ${SA_EMAIL}"
if ! gcloud iam service-accounts describe "${SA_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${TF_SA_NAME}" \
    --display-name="Terraform deployer (GitHub Actions)"
else
  echo "Service account already exists. Skipping create."
fi

echo "Granting roles to service account..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/editor"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

echo "Ensuring Terraform state bucket: ${STATE_BUCKET}"
if ! gsutil ls -b "gs://${STATE_BUCKET}" >/dev/null 2>&1; then
  gsutil mb -p "${PROJECT_ID}" "gs://${STATE_BUCKET}"
else
  echo "State bucket already exists. Skipping create."
fi

echo "Creating Workload Identity Pool: ${POOL_ID}"
if ! gcloud iam workload-identity-pools describe "${POOL_ID}" --location="global" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${POOL_ID}" \
    --location="global" \
    --display-name="GitHub Actions Pool"
else
  echo "Workload Identity Pool already exists. Skipping create."
fi

echo "Creating Workload Identity Provider: ${PROVIDER_ID}"
if ! gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_ID}" \
    --display-name="GitHub Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == \"${GITHUB_OWNER}/${GITHUB_REPO}\""
else
  echo "Workload Identity Provider already exists. Skipping create."
fi

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')

echo "Binding GitHub repo to service account..."
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPO}"

PROVIDER_RESOURCE=$(gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_ID}" \
  --format="value(name)")

cat <<EOF

Done.

Use this in GitHub Actions:
  workload_identity_provider: ${PROVIDER_RESOURCE}
  service_account: ${SA_EMAIL}
  tf_state_bucket: ${STATE_BUCKET}
EOF
