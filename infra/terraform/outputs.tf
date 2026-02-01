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
  value = google_service_account.ci.email
}
output "gar_push_service_account_email" {
  value = google_service_account.gar_push.email
}
output "gar_repository" {
  value = google_artifact_registry_repository.docker.repository_id
}
