# Enable required APIs (managed manually outside Terraform)

resource "google_project_service" "run" {
  service = "run.googleapis.com"
}

resource "google_project_service" "compute" {
  service = "compute.googleapis.com"
}

data "google_project" "current" {}

# CI service account (build/push/deploy)
resource "google_service_account" "ci_deploy" {
  depends_on   = [google_project_service.run]
  account_id   = var.ci_service_account_name
  display_name = "logitrack-ci-deploy"
}

resource "google_project_iam_member" "ci_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

resource "google_project_iam_member" "ci_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

resource "google_project_iam_member" "ci_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

resource "google_project_iam_member" "ci_gar_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"
}

# Backend Cloud Run service
resource "google_cloud_run_v2_service" "backend" {
  name     = var.backend_service_name
  location = var.region
  depends_on = [
    google_project_service.run,
    google_project_service.compute,
  ]

  template {
    containers {
      image = var.backend_image
      ports {
        container_port = 8080
      }
    }
    service_account = google_service_account.ci_deploy.email
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

# Public access for backend
resource "google_cloud_run_v2_service_iam_binding" "backend_noauth" {
  name     = google_cloud_run_v2_service.backend.name
  location = var.region
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}

# Cloud CDN via backend bucket + HTTP LB
resource "google_compute_backend_bucket" "frontend" {
  name        = var.cdn_name
  bucket_name = var.frontend_bucket_name
  enable_cdn  = true
  depends_on  = [google_project_service.compute, google_storage_bucket_iam_member.frontend_compute_reader]
}

resource "google_compute_url_map" "frontend" {
  name            = "${var.cdn_name}-url-map"
  default_service = google_compute_backend_bucket.frontend.id
}

resource "google_compute_target_http_proxy" "frontend" {
  name    = "${var.cdn_name}-http-proxy"
  url_map = google_compute_url_map.frontend.id
}

resource "google_compute_global_address" "frontend" {
  name       = "${var.cdn_name}-ip"
  depends_on = [google_project_service.compute]
}

resource "google_compute_global_forwarding_rule" "frontend" {
  name       = "${var.cdn_name}-http"
  ip_address = google_compute_global_address.frontend.address
  port_range = "80"
  target     = google_compute_target_http_proxy.frontend.id
}

resource "google_storage_bucket_iam_member" "frontend_compute_reader" {
  bucket     = var.frontend_bucket_name
  role       = "roles/storage.objectViewer"
  member     = "serviceAccount:service-${data.google_project.current.number}@compute-system.iam.gserviceaccount.com"
  depends_on = [google_storage_bucket.logitrack]
}
