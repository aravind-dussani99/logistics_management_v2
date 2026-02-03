# Roadmap

## Infrastructure
- **Least-privilege Cloud Run deploys**: Remove `--allow-unauthenticated` from CI deploy steps; apply public access once or via a higher-privileged IAM binding step so `roles/run.admin` is not required for routine deploys.
- **Cloud CDN SPA routing**: Ensure the load balancer serves `index.html` for unknown paths so client-side routes work for all screens.
- **Frontend hosting access**: Revisit the CDN/GCS access strategy to avoid AccessDenied/bucket listing trade-offs; decide on the best long-term hosting approach.

## Dev Experience
- **Environment templates**: Add `.env.example` files for local/dev/prod to standardize DB and API configuration.
