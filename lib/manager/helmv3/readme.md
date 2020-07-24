Renovate supports updating Helm Chart references within `requirements.yaml` (Helm v2) and `Chart.yaml` (Helm v3) files.

If your Helm charts make use of Aliases then you will need to configure an `aliases` object in your config to tell Renovate where to look for them.
