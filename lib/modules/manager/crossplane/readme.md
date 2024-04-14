To use the `crossplane` manager you must set your own `fileMatch` pattern.
The `crossplane` manager has no default `fileMatch` pattern, because there is no common filename or directory name convention for Crossplane YAML files.
By setting your own `fileMatch` Renovate avoids having to check each `*.yaml` file in a repository for a Crossplane Package definition.

The `crossplane` manager supports these `depType`s:

- `configuration`
- `function`
- `provider`

You can use these `depType`'s to control which dependencies Renovate will upgrade.

If you need to change the versioning format, read the [versioning](../../../modules/versioning/index.md) documentation to learn more.

Some configuration examples:

```json title="If most .yaml files are for Crossplane"
{
  "crossplane": {
    "fileMatch": ["\\.yaml$"]
  }
}
```

```json title="For Crossplane files in a packages/ directory"
{
  "crossplane": {
    "fileMatch": ["packages/.+\\.yaml$"]
  }
}
```

```json title="For a single Crossplane file"
{
  "crossplane": {
    "fileMatch": ["^config/provider\\.yaml$"]
  }
}
```
