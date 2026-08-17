Renovate extracts Python third-party dependencies from [Pants](https://www.pantsbuild.org) build files.

The manager parses the build file with a Python grammar instead of regular expressions, so comments, multi-line calls and expressions such as `resolve=parametrize("py311")` are handled.

Two Pants targets are supported:

- [`python_requirement`](https://www.pantsbuild.org/stable/reference/targets/python_requirement): every entry of its `requirements=[...]` field is extracted as a PEP 508 requirement, and updated in place in the build file.
- [`python_requirements`](https://www.pantsbuild.org/stable/reference/targets/python_requirements): the file named by its `source` field (default `requirements.txt`) is resolved relative to the build file, extracted, and updated in that file. A file referenced by several targets is extracted once. Pants accepts both formats this field can take: a `pyproject.toml` source is extracted as PEP 621, anything else as a pip requirements file, and each dependency keeps the `depType` its format gives it.

Fields other than `name`, `requirements` and `source` are ignored, so string values in `module_mapping` or `overrides` are never mistaken for requirements.

The default `managerFilePatterns` follow Pants' own default `build_patterns`, `BUILD` and `BUILD.*`. These overlap with the file names Bazel uses, which is harmless — neither manager finds anything it understands in the other's build files. If your repository sets `build_patterns` in `pants.toml`, or you want to narrow the manager to one name, configure it:

```json
{
  "pants": {
    "managerFilePatterns": ["/(^|/)BUILD\\.pants$/"]
  }
}
```

A file referenced by `python_requirements` usually also matches the default `managerFilePatterns` of the manager that owns its format — `pip_requirements` or `pep621`. To avoid two managers proposing the same update, disable one of them, for example:

```json
{
  "pip_requirements": {
    "enabled": false
  }
}
```
