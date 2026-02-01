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
