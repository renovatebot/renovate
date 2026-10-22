This datasource reads `index.yaml` from a Helm chart repository.

## OCI registries

`oci://` registry URLs are not supported by this datasource.
Renovate logs a warning and skips the lookup.
To look up a Helm chart stored in an OCI registry, use the `docker` datasource and set `packageName` to the full chart path, for example `ghcr.io/grafana/helm-charts/grafana-operator`.

## Amazon S3 repositories

In addition to HTTP(S) repositories, an `s3://` registry URL is supported, so charts hosted in an Amazon S3 bucket (or an S3-compatible backend) can be looked up:

```yaml
dependencies:
  - name: my-chart
    version: 1.0.0
    repository: s3://my-bucket/charts
```

Renovate then reads `s3://my-bucket/charts/index.yaml` with the AWS SDK, which signs the request with AWS Signature Version 4.
See [Calling AWS Services from Renovate](../../../calling-aws-services.md) for how to configure your credentials.

For S3-compatible backends, set the self-hosted `s3Endpoint` and `s3PathStyle` configuration options.

You can also provide credentials specifically for a bucket with a `hostRules` entry.
Set `hostType` to `helm`, `matchHost` to the bucket name, `username` to the access key ID, `password` to the secret access key, and optionally `token` to the session token:

```json
{
  "hostRules": [
    {
      "hostType": "helm",
      "matchHost": "my-bucket",
      "username": "AKIAIOSFODNN7EXAMPLE",
      "password": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    }
  ]
}
```

If no matching host rule provides both `username` and `password`, the default AWS credential provider chain is used.
