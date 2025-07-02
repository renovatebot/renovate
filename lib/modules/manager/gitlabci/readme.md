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

Variables with default values (using the `:-` syntax) are also supported, which is useful for Docker Compose files or scripts:

```json
{
  "registryAliases": {
    "${CI_REGISTRY:-}": "registry.example.com"
  }
}
```

This supports both formats with and without slashes:
- `${DEPENDENCY_PROXY:-}/image:1.0`
- `${DEPENDENCY_PROXY:-}image:1.0`
