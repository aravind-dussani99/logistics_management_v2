
resource "google_project_service" "gar" {
  service = "artifactregistry.googleapis.com"
}

resource "google_service_account" "gar_push_sa" {
  account_id   = var.gar_push_service_account_name
  display_name = "logitrack-gar-push"
  depends_on   = [google_project_service.gar]
}

resource "google_project_iam_member" "gar_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.gar_push_sa.email}"
}

resource "google_service_account_iam_member" "gar_push_wif" {
  service_account_id = google_service_account.gar_push_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${var.wif_pool_id}/attribute.repository/${var.github_owner}/${var.github_repo}"
}

# Artifact Registry repository
resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = var.gar_repository
  format        = "DOCKER"
  description   = "LogiTrack Docker images"
  depends_on    = [google_project_service.gar]
}
