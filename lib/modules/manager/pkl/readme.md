Updates the `package://` URIs in `amends`, `extends`, `import` and `import*` clauses, and in `import(...)` and `import*(...)` expressions, of `.pkl` modules.

The manager looks up each package with the [`github-releases`](../../datasource/github-releases/index.md) datasource and [`semver`](../../versioning/semver/index.md) versioning.
It maps the package URI to a GitHub repository as follows:

| Package URI                                                                    | GitHub repository | Release tag        |
| ------------------------------------------------------------------------------ | ----------------- | ------------------ |
| `package://github.com/<owner>/<repo>/releases/download/<tag>/<name>@<version>` | `<owner>/<repo>`  | `<tag>`            |
| `package://pkg.pkl-lang.org/github.com/<owner>/<repo>/<name>@<version>`        | `<owner>/<repo>`  | `<name>@<version>` |
| `package://pkg.pkl-lang.org/<project>/<name>@<version>`                        | `apple/<project>` | `<name>@<version>` |

The dependency name is the package name, for example `hk`.
Thus a Pkl package and the tool of the same name in the [`mise`](../mise/index.md) manager update in the same branch.

The manager skips:

- a package URI on another host, or with another path.
- a package URI that pins a `::sha256:` checksum, because a new version invalidates the checksum.
- a package URI whose release tag does not contain the version.

The manager does not update the dependencies in `PklProject` files, because that needs a new `PklProject.deps.json` file too.
