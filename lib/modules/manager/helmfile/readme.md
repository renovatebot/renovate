Checks `helmfile.yaml` files and extracts dependencies for the `helm` datasource.

The `helmfile` manager defines this default registryAlias:

```json
{
  "registryAliases": {
    "stable": "https://charts.helm.sh/stable"
  }
}
```

If your Helm charts make use of repository aliases then you will need to configure an `registryAliases` object in your config to tell Renovate where to look for them. Be aware that alias values must be properly formatted URIs.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

### Private repositories and registries

To use private sources of Helm charts, you must set the password and username you use to authenticate to the private source.
For this you use a custom `hostRules` array.

#### Classic repositories

Renovate passes `hostRules` with `hostType: 'helm'` to `helmfile deps` for classic (non-OCI) repositories.
It does so through the `<NAME>_USERNAME` and `<NAME>_PASSWORD` environment variables, where `<NAME>` is the repository name in upper case with dashes replaced by underscores.
The `hostRules` entry must have both a `username` and a `password`, and its `matchHost` must match the repository `url`.
Helmfile uses each variable only when the repository does not set that field itself.

For example, with this `helmfile.yaml`:

```yaml
repositories:
  - name: team-a-charts
    url: https://charts.example.com/team-a
  - name: public
    url: https://public.example.com
releases:
  - name: app
    chart: team-a-charts/app
    version: 1.0.0
```

and this Renovate config:

```json5
{
  hostRules: [
    {
      matchHost: 'https://charts.example.com',
      hostType: 'helm',
      username: '<some-username>',
      password: '<some-password>',
    },
  ],
}
```

Renovate runs `helmfile deps` with `TEAM_A_CHARTS_USERNAME` and `TEAM_A_CHARTS_PASSWORD` set.
The `public` repository has no matching `hostRules` entry, so it gets no credentials.

#### OCI registries

```json5
{
  hostRules: [
    {
      // global login
      matchHost: 'ghcr.io',
      hostType: 'docker',
      username: '<some-username>',
      password: '<some-password>',
    },
    {
      // login with encrypted password
      matchHost: 'https://ghci.io',
      hostType: 'docker',
      username: '<some-username>',
      encrypted: {
        password: 'some-encrypted-password',
      },
    },
  ],
}
```
