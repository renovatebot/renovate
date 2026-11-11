The `rebar` manager extracts dependencies from Erlang [rebar3](https://rebar3.org) `rebar.config` files.

It supports the following dependency formats:

- Hex packages: `{cowboy, "~> 2.9"}`, `{cowboy, "2.9.0"}`
- Hex packages with alternate names: `{app, {pkg, hex_name}}`, `{app, "1.0", {pkg, hex_name}}`
- Git dependencies: `{app, {git, "url", {tag, "1.0"}}}`, `{app, {git, "url", {branch, "main"}}}`, `{app, {git, "url", {ref, "abc123"}}}`
- Git subdirectory dependencies: `{app, {git_subdir, "url", {tag, "1.0"}, "path"}}`

Dependencies declared under `{profiles, [...]}` are extracted too, using the profile name as their `depType`.

The rebar2-style 3-tuple forms `{app, "1.0", {git, "url", {tag, "1.0"}}}` and `{app, {git, "url"}, [raw]}` are not extracted.
