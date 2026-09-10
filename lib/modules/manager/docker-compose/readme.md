Extracts all Docker images from with Docker Compose YAML files.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

### Registry aliases with variable defaults

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

Both image reference formats work:

- With a slash after the variable: `${CI_REGISTRY:-}/image:1.0`
- Without a slash after the variable: `${CI_REGISTRY:-}image:1.0`

The alias value works with or without a trailing slash.
