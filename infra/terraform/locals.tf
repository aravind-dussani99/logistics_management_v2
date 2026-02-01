# Buckets
locals {
  logitrack_replica_buckets = {
    "logitrack-attachments-0123-replica" = { public = false }
    "logitrack-frontend-0123-replica"    = { public = false }
  }

  logitrack_buckets = {
    "logitrack-attachments-0123" = { public = true }
    "logitrack-frontend-0123"    = { public = true }
  }
}
