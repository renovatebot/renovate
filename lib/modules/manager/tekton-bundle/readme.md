The `tekton-bundle` manager does not have a default `fileMatch` pattern. It won't match any files until it is configured with a pattern.

This is to avoid unexpected issues with unrelated YAML files since there is no well-established file name pattern for [Tekton](https://tekton.dev/) resources.

As an example, the following will config will match all the YAML files in a repository:

```json
{
  "tekton-bundle": {
    "fileMatch": ["\\.yaml$", "\\.yml$"]
  }
}
```

For additional information on file matching see the [fileMatch](https://docs.renovatebot.com/configuration-options/#filematch) documentation.

See the [versioning](https://docs.renovatebot.com/modules/versioning/) documentation for details on the existing versioning rules and possible alterations.
