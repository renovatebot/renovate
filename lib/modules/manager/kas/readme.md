Renovate supports upgrading dependencies in [kas files](https://github.com/siemens/kas/).
Please refer to the [kas Project Configuration](https://kas.readthedocs.io/en/latest/userguide/project-configuration.html) to learn more.

By default, Renovate does not scan for kas configuration files, as these can be any YAML or JSON file.

Use the `managerFilePatterns` configuration option to specify the entry-point kas files.
These entry-point files can then include many more kas files, which should not be specified individually here.

```json
{
  "kas": {
    "managerFilePatterns": ["kas.yml"]
  }
}
```

Renovate does not run the `kas` binary.
It merges kas files (includes and `*.lock.*` files) in the same order as kas does.
Includes from other repositories (`repo: ... file: ...`) are not followed, and lock file maintenance is skipped for entry files that use them.
Mercurial repos and the legacy `refspec` field are ignored.

Renovate updates:

- `commit` and `tag` fields in project files, and `overrides.repos.<name>.commit` in lock files
- With `lockFileMaintenance` enabled, Renovate behaves like `kas lock --update` for each entry file: floating repos (no `commit`) get their `branch` or `tag` resolved and pinned in the first lock file that already locks them.
  Repos not locked anywhere are added to `<entry>.lock.<ext>`, which is created if missing.
