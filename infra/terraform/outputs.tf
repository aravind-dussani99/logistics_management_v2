# output "backend_service_url" {
#   value = google_cloud_run_v2_service.backend.uri
# }

# output "frontend_bucket" {
#   value = google_storage_bucket.frontend.name
# }

# output "frontend_cdn_ip" {
#   value = google_compute_global_address.frontend.address
# }

output "ci_service_account_email" {
  value = google_service_account.ci_deploy.email
}
output "gar_push_service_account_email" {
  value = google_service_account.gar_push_sa.email
}
output "gar_repository" {
  value = google_artifact_registry_repository.docker.repository_id
}

output "logitrack_replica_buckets" {
  value = {
    for name, bucket in google_storage_bucket.logitrack_replica : name => bucket.name
  }
}

output "logitrack_buckets" {
  value = {
    for name, bucket in google_storage_bucket.logitrack : name => bucket.name
  }
}

output "backend_service_name" {
  value = var.backend_service_name
}

output "backend_service_url" {
  value = google_cloud_run_v2_service.backend.uri
}

output "frontend_bucket" {
  value = var.frontend_bucket_name
}

output "frontend_cdn_ip" {
  value = google_compute_global_address.frontend.address
}

output "cloudsql_instance_connection_name" {
  value = google_sql_database_instance.primary.connection_name
}

output "cloudsql_db_name" {
  value = google_sql_database.app.name
}

output "cloudsql_user" {
  value = google_sql_user.app.name
}
