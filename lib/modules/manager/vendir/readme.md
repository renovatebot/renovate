
Renovate supports updating Helm Chart references in  vendir.yml via the [vendir](https://carvel.dev/vendir/) tool

It supports both https and oci helm chart repositories.

```yaml title="Example helmChart"
# fetch Helm chart contents (optional; v0.11.0+)
helmChart:
  # chart name (required)
  name: stable/redis
  # use specific chart version (string; optional)
  version: '1.2.1'
  # specifies Helm repository to fetch from (optional)
  repository:
    # repository url; supports exprimental oci helm fetch via
    # oci:// scheme (required)
    url: https://...
    # specifies name of a secret with helm repo auth details;
    # secret may include 'username', 'password';
    # as of v0.19.0+, dockerconfigjson secrets are also supported (optional)
    # as of v0.22.0+, 0 or 1 auth credential is expected within dockerconfigjson secret
    #   if >1 auth creds found, error will be returned. (currently registry hostname
    #   is not used when found in provide auth credential.)
    secretRef:
      # (required)
      name: my-helm-auth
  # specify helm binary version to use;
  # '3' means binary 'helm3' needs to be on the path (optional)
  helmVersion: '3'
```

### Subchart Archives

To get updates for subchart archives put `vendirUpdateSubChartArchives` in your `postUpdateOptions` configuration.
Renovate now updates archives in the folder specified by your vendir.yml.

```json
{
  "postUpdateOptions": ["vendirUpdateSubChartArchives"]
}
```
