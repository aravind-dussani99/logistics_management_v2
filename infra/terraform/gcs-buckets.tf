
resource "google_project_service" "storage" {
  service = "storage.googleapis.com"
}
resource "google_storage_bucket" "logitrack_replica" {
  depends_on                  = [google_project_service.storage]
  for_each                    = local.logitrack_replica_buckets
  name                        = each.key
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  autoclass {
    enabled = true
  }

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age                = 15
      num_newer_versions = 2
      with_state         = "ARCHIVED"
    }
  }
}

resource "google_storage_bucket" "logitrack" {
  depends_on                  = [google_storage_bucket.logitrack_replica]
  for_each                    = local.logitrack_buckets
  name                        = each.key
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  autoclass {
    enabled = true
  }

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age                = 15
      num_newer_versions = 2
      with_state         = "ARCHIVED"
    }
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
