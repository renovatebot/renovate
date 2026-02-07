Extracts dependencies from `elm.json` files.

The following `depTypes` are supported:

For **applications**:

- `dependencies:direct`
- `dependencies:indirect`
- `test-dependencies:direct`
- `test-dependencies:indirect`

For **packages**:

- `dependencies`
- `test-dependencies`

Additionally, the `elm-version` field is extracted as `depType: elm-version` using the `github-tags` datasource for `elm/compiler`.

### Version formats

Applications use exact versions (e.g., `1.0.0`), while packages use Elm's range constraint format (e.g., `1.0.0 <= v < 2.0.0`).
Both formats are supported by the `elm` versioning module.
