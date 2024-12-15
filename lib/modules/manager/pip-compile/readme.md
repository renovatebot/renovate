Due to limited functionality, the `pip-compile` manager should be considered in an "alpha" stage, which means it's not ready for production use for the majority of end users.
We welcome feedback and bug reports!

The current implementation has some limitations.
Read the full document before you start using the `pip-compile` manager.

### Non-configured fileMatch

The `pip-compile` manager has an empty array for default `fileMatch`, meaning it won't match any files ever by default.
You can "activate" the manager by specifying a `fileMatch` pattern such as:

```json
{
  "pip-compile": {
    "fileMatch": ["(^|/)requirements\\.txt$"]
  }
}
```

`pip-compile` reads the output files to extract the arguments passed to the original command, as such the `fileMatch` must be configured for `*.txt` files and not `*.in`.

### Assumption of header with a command

As Renovate matches a `pip-compile` output file it will extract original command that was used to create it from header in this file.
Because of that `pip-compile` manager poses restrictions on how this file is generated:

- Use default header generation, don't use `--no-header` option.
- Pass all source files explicitly.

In turn `pip-compile` manager will find all source files and parse them as package files using their respective managers.

The following files are currently supported:

| Source filename | Manager            |
| --------------: | ------------------ |
|      `setup.py` | `pip_setup`        |
|          `*.in` | `pip_requirements` |

Example header:

```
#
# This file is autogenerated by pip-compile with Python 3.11
# by the following command:
#
#    pip-compile --no-emit-index-url --output-file=requirements.txt requirements.in
#
```

### Conflicts with other managers

Because `pip-compile` will update source files with their associated manager you should disable them to avoid running these managers twice.

```json
{
  "pip_requirements": {
    "enabled": false
  },
  "pip_setup": {
    "enabled": false
  }
}
```

### Configuration of Python version

By default Renovate extracts Python version from the header.
To get Renovate to use another version of Python, add a constraints` rule to the Renovate config:

```json
{
  "constraints": {
    "python": "==3.7"
  }
}
```

### `pip-compile` arguments

Renovate reads the `requirements.txt` file and extracts these `pip-compile` arguments:

- source files as positional arguments
- `--output-file`

All other allowed `pip-compile` arguments will be passed over without modification.

### Transitive / indirect dependencies

This manager detects dependencies that only appear in lock files.
They are disabled by default but can be forced to enable by vulnerability alerts.
They will be upgraded with `--upgrade-package` option.