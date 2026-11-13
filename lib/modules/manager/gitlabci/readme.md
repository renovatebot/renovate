Extracts Docker dependencies from `gitlab-ci.yml` files.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

If you use Gitlab Dependency Proxy then you can use these predefined variables as prefixes for your image:

- `CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX`
- `CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX`

If you use predefined GitLab CI variables like `CI_REGISTRY` or `CI_SERVER_FQDN` make sure to configure their value via `registryAliases`:

```json
{
  "registryAliases": {
    "$CI_REGISTRY": "registry.example.com",
    "$CI_SERVER_FQDN": "gitlab.example.com",
    "$CI_SERVER_HOST": "gitlab.example.com"
  }
}
```

Variables with default values (using the `:-` syntax) are also supported:

```json
{
  "registryAliases": {
    "${CI_REGISTRY:-}": "registry.example.com"
  }
}
```

Both image reference formats work:

- With a slash after the variable: `${CI_REGISTRY:-}/image:1.0`
- Without a slash after the variable: `${CI_REGISTRY:-}image:1.0`

The alias value works with or without a trailing slash.
