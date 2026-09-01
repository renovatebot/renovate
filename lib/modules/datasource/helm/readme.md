This datasource reads `index.yaml` from a Helm chart repository.

In addition to HTTP(S) repositories, an `s3://` registry URL is supported, so charts hosted in an Amazon S3 bucket (or an S3-compatible backend) can be looked up:

```yaml
dependencies:
  - name: my-chart
    version: 1.0.0
    repository: s3://my-bucket/charts
```

Renovate then reads `s3://my-bucket/charts/index.yaml` with the AWS SDK, which signs the request with AWS Signature Version 4.
Because the datasource uses the AWS SDK for JavaScript, you can configure it like other AWS tools, for example (partial list):

- Setting the region via `AWS_REGION` (environment variable) or your `~/.aws/config` file
- Providing credentials via `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (environment variables) or your `~/.aws/credentials` file
- Selecting the profile to use via the `AWS_PROFILE` environment variable

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
