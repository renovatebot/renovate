This manager extracts dependencies from a Puppet module `metadata.json` file.

It looks for a top-level `dependencies` array with objects of the form:

```
{
  "name": "puppetlabs/stdlib",
  "version_requirement": ">= 9.0.0 < 10.0.0"
}
```

Supported dependency object fields:

- `name` (required): Module identifier. Accepts either `author/module` or `author-module` form. The manager normalizes both to `author/module` internally while leaving the file content unchanged.
- `version_requirement`: Version range/value. If missing, the dependency is skipped with `unspecified-version`.

Notes:

- The top-level `version` field in `metadata.json` (module's own version) is unrelated to dependency constraints and is not read or modified by this manager.
- Unsupported or invalid dependency names are marked with `invalid-name`.

The manager uses the `puppet-forge` datasource exclusively.

For managing module references in `Puppetfile` manifests, see the separate `puppet` manager.
