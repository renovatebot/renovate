Renovate can update Helm Chart references and Git references in `vendir.yml` files, with the [vendir](https://carvel.dev/vendir/) tool.

For Renovate to work you must:

- let vendir create a [vendir lockfile](https://carvel.dev/vendir/docs/v0.40.x/vendir-lock-spec/)
- put the vendir lockfile in your repository

### Helm Charts

Renovate supports HTTPS and OCI Helm chart repositories.

```yaml title="Example helm chart vendir.yml"
apiVersion: vendir.k14s.io/v1alpha1
kind: Config

# one or more directories to manage with vendir
directories:
  - # path is relative to the `vendir` CLI working directory
    path: config/_ytt_lib
    contents:
      path: github.com/cloudfoundry/cf-k8s-networking
      helmChart:
        # chart name (required)
        name: stable/redis
        # use specific chart version (string; optional)
        version: '1.2.1'
        # specifies Helm repository to fetch from (optional)
        repository:
          # repository url; supports experimental OCI Helm fetch via
          # oci:// scheme (required)
          url: https://...
        # specify Helm binary version to use;
        # '3' means binary 'helm3' needs to be on the path (optional)
        helmVersion: '3'
```

### Registry Aliases

#### OCI

Aliases for OCI registries are supported via Renovate's `dockerfile` or `docker` managers.

### Git

Renovate can update explicit refs in Git references in `vendir.yml` files.

```yaml title="Example git vendir.yml"
apiVersion: vendir.k14s.io/v1alpha1
kind: Config

# one or more directories to manage with vendir
directories:
  - path: config/_ytt_lib
    contents:
      path: github.com/cloudfoundry/cf-k8s-networking
      git:
        # HTTP or SSH URLs are supported (required)
        url: https://github.com/cloudfoundry/cf-k8s-networking
        # branch, tag, commit; origin is the name of the remote (required)
        # optional if refSelection is specified (available in v0.11.0+)
        ref: origin/master
        # depth of commits to fetch; 0 (default) means everything (optional; v0.29.0+)
        depth: 1
        ...
```

### GithubRelease

Renovate can update explicit tags in GitHub releases in `vendir.yml` files.

```yaml title="Example GitHub vendir.yml"
directories:
  - path: config/_ytt_lib
    contents:
      path: github.com/cloudfoundry/cf-k8s-networking
      githubRelease:
        # slug for repository (org/repo) (required)
        slug: k14s/kapp-controller
        # use release tag (optional)
        # optional if tagSelection is specified (available in v0.22.0+)
        tag: v0.1.0
```
