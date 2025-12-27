terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.50.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required Google Cloud services
resource "google_project_service" "run_api" {
  service = "run.googleapis.com"
}

resource "google_project_service" "artifact_registry_api" {
  service = "artifactregistry.googleapis.com"
}

# Create an Artifact Registry repository to store your Docker images
resource "google_artifact_registry_repository" "repository" {
  provider      = google
  location      = var.region
  repository_id = var.service_name
  format        = "DOCKER"
  description   = "Docker repository for the LogiTrack application."
  depends_on    = [google_project_service.artifact_registry_api]
}

# import {
#   id = "projects/{{project}}/locations/{{location}}/services/{{name}}"
#   to = google_cloud_run_v2_service.default
# }

# Create the Cloud Run service to run your container
resource "google_cloud_run_v2_service" "default" {
  provider   = google
  name       = var.service_name
  location   = var.region
  depends_on = [google_project_service.run_api]

  template {
    containers {
      image = var.image_url
      ports {
        container_port = 8080
      }
    }
  }

  traffic {
    percent         = 100
    type            = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# Authoritative IAM binding to make the Cloud Run service publicly accessible.
# This replaces any existing policies for the 'run.invoker' role, guaranteeing public access.
resource "google_cloud_run_v2_service_iam_binding" "noauth" {
  provider = google
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.default.name
  role     = "roles/run.invoker"
  members = [
    "allUsers",
  ]
}

# Output the URL of the deployed service for easy access
output "service_url" {
  value = google_cloud_run_v2_service.default.uri
}