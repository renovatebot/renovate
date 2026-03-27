The `rebar3` manager extracts dependencies from Erlang [rebar3](https://rebar3.org) `rebar.config` files.

It supports the following dependency formats:

- Hex packages: `{cowboy, "~> 2.9"}`, `{cowboy, "2.9.0"}`
- Hex packages with alternate names: `{app, {pkg, hex_name}}`, `{app, "1.0", {pkg, hex_name}}`
- Git dependencies: `{app, {git, "url", {tag, "1.0"}}}`, `{app, {git, "url", {branch, "main"}}}`, `{app, {git, "url", {ref, "abc123"}}}`
- Git subdirectory dependencies: `{app, {git_subdir, "url", {tag, "1.0"}, "path"}}`

Dependencies from `profiles` (e.g., test profile) are also extracted with appropriate `depType`.

The `rebar3` tool is used to keep the `rebar.lock` file up-to-date.

### `lockFileMaintenance`

We recommend you use [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance) for the `rebar3` manager.

`lockFileMaintenance=true` periodically refreshes your `rebar.lock` file, ensuring all indirect dependencies are updated to their latest allowed versions.

### Default `rangeStrategy=auto` behavior

Renovate's default [`rangeStrategy`](../../../configuration-options.md#rangestrategy) is `"auto"`.

For the `rebar3` manager, `"auto"` behaves the same as `"update-lockfile"` for simple ranges and `"widen"` for complex ranges (e.g., `>= 1.0.0 and < 2.0.0`).

### Recommended `rangeStrategy` for apps and libraries

For applications, we recommend using `rangeStrategy=pin` to pin dependencies to exact versions.

For libraries, use `rangeStrategy=widen` with version ranges in your `rebar.config` to allow greater compatibility.
