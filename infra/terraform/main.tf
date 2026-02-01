# Enable required APIs

resource "google_project_service" "run" {
  service    = "run.googleapis.com"
  depends_on = [google_project_service.serviceusage]
}

resource "google_project_service" "artifact_registry" {
  service    = "artifactregistry.googleapis.com"
  depends_on = [google_project_service.serviceusage]
}

resource "google_project_service" "storage" {
  service    = "storage.googleapis.com"
  depends_on = [google_project_service.serviceusage]
}

resource "google_service_account" "gar_push" {
  account_id   = var.ci_service_account_name
  display_name = "logitrack-gar-push"
}

resource "google_project_iam_member" "gar_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.gar_push.email}"
}

# Artifact Registry repository
resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = var.gar_repository
  format        = "DOCKER"
  description   = "LogiTrack Docker images"
  depends_on    = [google_project_service.artifact_registry]
}

# CI service account (build/push/deploy)
resource "google_service_account" "ci" {
  account_id   = var.ci_service_account_name
  display_name = "logitrack-ci-deploy"
}

resource "google_project_iam_member" "ci_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

resource "google_project_iam_member" "ci_storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

resource "google_project_iam_member" "ci_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

# Buckets
locals {
  logitrack_buckets = {
    "logitrack-attachments"              = { public = false }
    "logitrack-attachments-prod"         = { public = false }
    "logitrack-attachments-prod-replica" = { public = false }
    "logitrack-backend"                  = { public = false }
    "logitrack-frontend"                 = { public = true }
    "logitrack-frontend-prod"            = { public = true }
    "logitrack-frontend-replica"         = { public = false }
    "logitrack-frontend-replica-prod"    = { public = false }
  }
}

resource "google_storage_bucket" "logitrack" {
  for_each                    = local.logitrack_buckets
  name                        = each.key
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false
  depends_on                  = [google_project_service.storage]

  autoclass {
    enabled = true
  }
}

resource "google_storage_bucket_iam_member" "logitrack_public" {
  for_each = {
    for name, cfg in local.logitrack_buckets : name => cfg if cfg.public
  }
  bucket = google_storage_bucket.logitrack[each.key].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# # Backend Cloud Run service
# resource "google_cloud_run_v2_service" "backend" {
#   name     = var.backend_service_name
#   location = var.region
#   depends_on = [
#     google_project_service.run,
#     google_project_service.compute,
#   ]

#   template {
#     containers {
#       image = var.backend_image
#       ports {
#         container_port = 8080
#       }
#     }
#     service_account = var.backend_runtime_service_account
#   }

#   traffic {
#     percent         = 100
#     type            = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
#   }
# }

# # Public access for backend
# resource "google_cloud_run_v2_service_iam_binding" "backend_noauth" {
#   name     = google_cloud_run_v2_service.backend.name
#   location = var.region
#   role     = "roles/run.invoker"
#   members  = ["allUsers"]
# }

# # Frontend bucket
# resource "google_storage_bucket" "frontend" {
#   name                        = var.frontend_bucket_name
#   location                    = var.region
#   uniform_bucket_level_access = true
#   force_destroy               = false
#   depends_on                  = [google_project_service.storage]
# }

# resource "google_storage_bucket_iam_member" "frontend_public" {
#   bucket = google_storage_bucket.frontend.name
#   role   = "roles/storage.objectViewer"
#   member = "allUsers"
# }

# # Cloud CDN via backend bucket + HTTP LB
# resource "google_compute_backend_bucket" "frontend" {
#   name        = var.cdn_name
#   bucket_name = google_storage_bucket.frontend.name
#   enable_cdn  = true
#   depends_on  = [google_project_service.compute]
# }

# resource "google_compute_url_map" "frontend" {
#   name            = "${var.cdn_name}-url-map"
#   default_service = google_compute_backend_bucket.frontend.id
# }

# resource "google_compute_target_http_proxy" "frontend" {
#   name    = "${var.cdn_name}-http-proxy"
#   url_map = google_compute_url_map.frontend.id
# }

# resource "google_compute_global_address" "frontend" {
#   name = "${var.cdn_name}-ip"
# }

# resource "google_compute_global_forwarding_rule" "frontend" {
#   name       = "${var.cdn_name}-http"
#   ip_address = google_compute_global_address.frontend.address
#   port_range = "80"
#   target     = google_compute_target_http_proxy.frontend.id
# }
