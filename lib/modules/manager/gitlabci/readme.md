Extracts Docker dependencies from `gitlab-ci.yml` files.

If you need to change the versioning format, read the [versioning](../../versioning.md) documentation to learn more.

If you use Gitlab Dependency Proxy then you can use these predefined variables as prefixes for your image:

- `CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX`
- `CI_DEPENDENCY_PROXY_DIRECT_GROUP_IMAGE_PREFIX`

If you use the predefined `CI_REGISTRY` variable make sure to configure its value via `registryAliases`:

```json
{
  "registryAliases": {
    "$CI_REGISTRY": "registry.example.com"
  }
}
```

GitLab CI Components that are included are also supported, but should not reference environment variables.

```yaml
include:
  - component: $CI_SERVER_FQDN/my-organization/my-components/specific-component@0.1.0 # This will not work
  - component: gitlab.example.biz/my-organization/my-components/specific-component@0.1.0 # This will work
```
