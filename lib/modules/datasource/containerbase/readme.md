This datasource returns the versions of a [Containerbase](https://github.com/containerbase/base) tool which `install-tool` can install.

The `packageName` is the Containerbase tool name, for example `node` or `pnpm`.
Unknown tool names return no releases.

The versions come from the files published by [containerbase/tool-versions](https://github.com/containerbase/tool-versions), one `<tool>.json` per tool in the `v1` format at `https://containerbase.github.io/tool-versions/v1/`.
Files of another format, as named by their `$schema`, are ignored.
Renovate also reads the root `index.json` of the site and logs a warning when it marks the `v1` format as deprecated, with the date it will be removed.
Set `registryUrls` to the root of a mirror of the site, for example `https://mirror.example.com/tool-versions`; the datasource adds the `v1/` folder itself.

The versions are in exactly the format `install-tool` accepts, for example `21.0.5+11.0.LTS` for `java`.
Prereleases are marked as unstable.
Runtime constraints of a version, like the `node` versions an npm tool supports, are passed on as release constraints for `constraintsFiltering`.
