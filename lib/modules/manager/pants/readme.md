Renovate extracts Python third-party dependencies from [Pants](https://www.pantsbuild.org) build files.

Build files are parsed with a Python grammar rather than regular expressions, so comments, multi-line calls and expressions like `resolve=parametrize("py311")` are all handled.
Only the `name`, `requirements` and `source` fields are read, so values in fields such as `module_mapping` or `overrides` are never mistaken for requirements.

### Supported targets

- [`python_requirement`](https://www.pantsbuild.org/stable/reference/targets/python_requirement): `requirements=[...]` entries are updated in place in the build file
- [`python_requirements`](https://www.pantsbuild.org/stable/reference/targets/python_requirements): reads the file named by `source`, default `requirements.txt`
- [`poetry_requirements`](https://www.pantsbuild.org/stable/reference/targets/poetry_requirements): reads the file named by `source`, default `pyproject.toml`
- [`uv_requirements`](https://www.pantsbuild.org/stable/reference/targets/uv_requirements): reads the file named by `source`, default `pyproject.toml`

For the generator targets, Renovate resolves the source relative to the build file and updates that file.
A source that several targets refer to is extracted once.

### Source file formats

Pants does not require a particular name for a source, so its content decides how Renovate reads it:

| Content                                                | Read as          |
| ------------------------------------------------------ | ---------------- |
| TOML with a `tool.poetry` table                        | Poetry           |
| Any other TOML                                         | PEP 621          |
| Anything else, including a `.toml` that does not parse | pip requirements |

Each dependency keeps the `depType` its own format gives it, including Poetry and uv dependency groups.
Renovate reads the whole file, so a `pyproject.toml` holding both `project.dependencies` and a `[tool.poetry]` table has both reported, even where Pants generates targets from only one.

### Expressions are not evaluated

Renovate reads the values written in the file, so a requirement or source that an expression builds or chooses is not reported, and is invisible to vulnerability alerts:

- `["flask=={}".format(version)]` is not a pin on `flask=={}`
- `["flask==1.1.2" if PY39 else "flask==2.0.0"]` is one requirement, not two
- `requirements=["flask==1.1.2"] if PY39 else ["flask==2.0.0"]` names only one arm, so updating it could leave the live arm stale

Adjacent string literals are the exception, because Python joins them into one value: `["foo" ">=1,<2"]` is a single requirement.
An expression that only adds to the field, such as `["flask==1.1.2"] + extra`, is read normally.
Other entries in the same list are unaffected.

### File patterns

The defaults follow Pants' default `build_patterns`, `BUILD` and `BUILD.*`.
Add to `managerFilePatterns` if your repository sets `build_patterns` in `pants.toml`:

```json
{
  "pants": {
    "managerFilePatterns": ["/(^|/)pants_targets\\.py$/"]
  }
}
```

!!! warning
  Name the files your `build_patterns` name, and nothing else.
  Renovate reads every matched file looking for targets, so a Python module that calls one of these macros inside a function becomes a package file whose dependencies Renovate offers to edit.
  A `pants-plugins` module is the usual example.
  A pattern like `"**"` will produce pull requests against files that declare nothing.

### Skipped files

`build_ignore` is not read, so a file it excludes is still offered to this manager.
Files named like a build file but written as prose are skipped, so documented examples are not proposed as changes to your docs.
Prose is recognised by extension, in any case: `.md`, `.markdown`, `.mdx`, `.rst`, `.adoc`, `.asciidoc`, `.org` and `.textile`.
A `BUILD.txt` is still read as a build file, because `BUILD.*` names are settled before the extension is looked at.
Rename it, or exclude it under this manager's key:

```json
{
  "pants": {
    "ignorePaths": ["**/node_modules/**", "**/bower_components/**", "vendor/**"]
  }
}
```

!!! warning
  Unlike `managerFilePatterns`, `ignorePaths` **replaces** what it inherits rather than adding to it, and the default is not empty: it holds `**/node_modules/**` and `**/bower_components/**`.
  Both appear in the example for that reason: listing only `vendor/**` would hand this manager every `BUILD` file under `node_modules`.

A target naming a source that `build_patterns` covers, such as `source="BUILD.txt"`, is refused with a warning, because Pants reads that file as a build file whatever the target says.
The build file holding the target keeps its own requirements.

### Overlap with other managers

A generator source usually also matches the defaults of the manager owning its format: `pip_requirements`, `pep621` or `poetry`.
Renovate settles this on its own, so there is nothing to configure, but leave those managers enabled so lock files beside your sources stay updated:

- Where both managers match, only this manager proposes the update.
- Where a lock file is present, the other manager keeps the file, because it can regenerate the lock file and this manager cannot.
  `poetry` reports `poetry.lock`, and `pep621` reports `uv.lock`.
  Requirements files carrying `--hash=` entries stay with `pip_requirements` for the same reason.

A source this manager cannot maintain is not reported at all, so the manager that can keeps it.
Where a `source=` gives such a file a name no other manager matches, nothing reports it and its dependencies go unseen.
Name those files conventionally, or enable the manager that owns the format for that name.

### Private indexes

Pants resolves requirements from the indexes named by `[python-repos]` in `pants.toml`, which Renovate does not read.
Set [`registryUrls`](../../../configuration-options.md#registryurls) for this manager if your requirements come from a private index, unless the source file names the index itself.
