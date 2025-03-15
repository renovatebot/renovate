Extracts Docker dependencies from `gitlab-ci.yml` files.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

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
