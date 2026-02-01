resource "google_project_service" "sqladmin" {
  service = "sqladmin.googleapis.com"
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
