Renovate extracts Python third-party dependencies from [Pants](https://www.pantsbuild.org) build files.

The manager parses the build file with a Python grammar instead of regular expressions.
Comments, multi-line calls and expressions such as `resolve=parametrize("py311")` are all handled.

These Pants targets are supported:

- [`python_requirement`](https://www.pantsbuild.org/stable/reference/targets/python_requirement), whose `requirements=[...]` entries are extracted as PEP 508 requirements and updated in place in the build file
- [`python_requirements`](https://www.pantsbuild.org/stable/reference/targets/python_requirements), which reads the file named by the `source` field, `requirements.txt` by default
- [`poetry_requirements`](https://www.pantsbuild.org/stable/reference/targets/poetry_requirements), which reads the file named by the `source` field, `pyproject.toml` by default
- [`uv_requirements`](https://www.pantsbuild.org/stable/reference/targets/uv_requirements), which reads the file named by the `source` field, `pyproject.toml` by default

The three generator targets are handled the same way.
Renovate resolves the source relative to the build file, extracts it, and updates the dependencies in that file.
A source that several targets refer to is extracted once.

The format of the source file decides which extractor Renovate uses.
Renovate parses a `pyproject.toml` and reads it as Poetry when the file has a `tool.poetry` table, and as PEP 621 when it does not.
Every other source is read as a pip requirements file.
Each dependency keeps the `depType` that its own format gives it, including Poetry and uv dependency groups.

Pants reads a narrower part of some sources than Renovate does.
For example, a `uv_requirements` target generates requirements only from `[tool.uv] dev-dependencies`, while Renovate extracts the whole file.
The extra dependencies are real dependencies of that file, so Renovate is right to update them, but Pants did not turn them into targets.

Renovate ignores all fields except `name`, `requirements` and `source`.
This means string values in `module_mapping` or `overrides` are never mistaken for requirements.

The default `managerFilePatterns` follow the default `build_patterns` of Pants, which are `BUILD` and `BUILD.*`.
These patterns overlap with the file names that Bazel uses, which is harmless, because neither manager finds anything it understands in the build files of the other.
Set `managerFilePatterns` yourself if your repository sets `build_patterns` in `pants.toml`, or if you want to narrow the manager to a single name:

```json
{
  "pants": {
    "managerFilePatterns": ["/(^|/)BUILD\\.pants$/"]
  }
}
```

A file that a generator target refers to usually also matches the default `managerFilePatterns` of the manager that owns that format, which is `pip_requirements`, `pep621` or `poetry`.
Disable one of the two managers to stop them both proposing the same update.
For example:

```json
{
  "pip_requirements": {
    "enabled": false
  }
}
```
