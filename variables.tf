variable "project_id" {
  description = "The Google Cloud project ID where resources will be deployed."
  type        = string
}

variable "region" {
  description = "The Google Cloud region to deploy resources in (e.g., us-central1)."
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "The unique name for your Cloud Run service and Artifact Registry repository."
  type        = string
}

variable "image_url" {
  description = "The full URL of the Docker image that will be deployed to Cloud Run. This is passed from the GitHub Actions workflow."
  type        = string
}