resource "google_project_service" "sqladmin" {
  service = "sqladmin.googleapis.com"
}

resource "google_service_account" "cloudsql_migrate_sa" {
  account_id   = var.cloudsql_migration_sa_name
  display_name = "logitrack-cloudsql-migrations"
  depends_on   = [google_project_service.sqladmin]
}

resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloudsql_migrate_sa.email}"
}

resource "google_service_account_iam_member" "cloudsql_wif" {
  service_account_id = google_service_account.cloudsql_migrate_sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${var.wif_pool_id}/attribute.repository/${var.github_owner}/${var.github_repo}"
}

resource "google_sql_database_instance" "primary" {
  name                = var.cloudsql_instance_name
  database_version    = var.cloudsql_database_version
  region              = var.region
  deletion_protection = false
  depends_on          = [google_project_service.sqladmin]

  settings {
    tier = var.cloudsql_tier
  }
}

resource "google_sql_database" "app" {
  name     = var.cloudsql_db_name
  instance = google_sql_database_instance.primary.name
}

resource "google_sql_user" "app" {
  name     = var.cloudsql_user
  instance = google_sql_database_instance.primary.name
  password = var.cloudsql_password
}
