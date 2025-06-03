Extracts all Docker images from with Docker Compose YAML files.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

## Registry Aliases with Variable Defaults

Docker Compose files often use environment variables with default values:

```yaml
services:
  foobar:
    image: ${CI_REGISTRY:-}image:1.0
```

To handle these variables, configure registry aliases with the default value syntax:

```json
{
  "registryAliases": {
    "${CI_REGISTRY:-}": "my-registry.io"
  }
}
```

This works with both formats, regardless of whether the registry alias ends with a slash or not:
- Without slash in the variable: `${CI_REGISTRY:-}/image:1.0`
- With slash in the variable: `${CI_REGISTRY:-}image:1.0`
