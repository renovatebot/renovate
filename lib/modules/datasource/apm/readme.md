The `apm` datasource looks up [APM (Agent Package Manager)](https://github.com/microsoft/apm) packages on a dedicated package registry which implements the [APM registry HTTP API](https://microsoft.github.io/apm/reference/registry-http-api/).
JFrog Artifactory [Agent Packages repositories](https://docs.jfrog.com/artifactory/docs/agent-packages-repositories) are one such registry.

It is used for APM dependencies that are installed from a registry instead of a Git host, so Renovate can update them on networks where the Git host is not reachable.
Dependencies which are installed from a Git host keep using the `github-tags`, `gitlab-tags` and `git-tags` datasources.

## Registry URL

There is no public default registry, so you must set a `registryUrl`.
Use the registry base URL, without the `/v1/...` path, for example:

```
https://artifactory.example.com/artifactory/api/agentpackages/apm-local
```

The [`apm` manager](../../manager/apm/index.md) sets the `registryUrl` from the `registries:` block of `apm.yml`.
You can override it with a `packageRules` entry:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["apm"],
      "registryUrls": [
        "https://artifactory.example.com/artifactory/api/agentpackages/apm-local"
      ]
    }
  ]
}
```

## Authentication

Private registries usually need a token.
Add a `hostRules` entry with `hostType` set to `apm`.
A `token` is sent as a `Bearer` token, and a `username` and `password` pair as HTTP Basic auth:

```json
{
  "hostRules": [
    {
      "hostType": "apm",
      "matchHost": "https://artifactory.example.com",
      "token": "<your Artifactory identity token>"
    }
  ]
}
```
