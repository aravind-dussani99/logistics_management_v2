# Buckets
locals {
  logitrack_replica_buckets = {
    "logitrack-attachments-replica" = { public = false }
    "logitrack-frontend-replica"    = { public = false }
  }

  logitrack_buckets = {
    "logitrack-attachments" = { public = false }
    "logitrack-frontend"    = { public = true }
  }
}
