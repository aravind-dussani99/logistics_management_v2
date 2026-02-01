variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-south2"
}

variable "gar_repository" {
  description = "Artifact Registry repo name"
  type        = string
}

variable "gar_push_service_account_name" {
  description = "Service account name for CI deployments"
  type        = string
}

variable "backend_service_name" {
  description = "Cloud Run service name for backend"
  type        = string
}

variable "backend_image" {
  description = "Container image for backend Cloud Run service"
  type        = string
}

variable "backend_runtime_service_account" {
  description = "Optional runtime service account email for Cloud Run"
  type        = string
  default     = null
}

variable "frontend_bucket_name" {
  description = "GCS bucket name for frontend assets"
  type        = string
}

variable "cdn_name" {
  description = "Name prefix for CDN resources"
  type        = string
  default     = "logitrack-cdn"
}

variable "ci_service_account_name" {
  description = "Service account name for CI deployments"
  type        = string
}

variable "cloudsql_instance_name" {
  description = "Cloud SQL instance name"
  type        = string
}

variable "cloudsql_db_name" {
  description = "Cloud SQL database name"
  type        = string
}

variable "cloudsql_user" {
  description = "Cloud SQL user"
  type        = string
}

variable "cloudsql_password" {
  description = "Cloud SQL user password"
  type        = string
  sensitive   = true
}

variable "cloudsql_migration_sa_name" {
  description = "Service account name for Cloud SQL migrations"
  type        = string
}

variable "cloudsql_database_version" {
  description = "Cloud SQL database version"
  type        = string
  default     = "POSTGRES_15"
}

variable "cloudsql_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "wif_pool_id" {
  description = "Workload Identity Pool ID"
  type        = string
}

variable "github_owner" {
  description = "GitHub org/user"
  type        = string
}

variable "github_repo" {
  description = "GitHub repo name"
  type        = string
}
