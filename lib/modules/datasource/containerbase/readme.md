This datasource returns the versions of a [Containerbase](https://github.com/containerbase/base) tool which `install-tool` can install.

The `packageName` is the Containerbase tool name, for example `node` or `pnpm`.
Unknown tool names return no releases.

The versions come from the files published by [containerbase/tool-versions](https://github.com/containerbase/tool-versions), one `<tool>.json` per tool in the `v1` format at `https://containerbase.github.io/tool-versions/v1/`.
Files of another format, as named by their `$schema`, are ignored.
Set `registryUrls` to the root of a mirror of the site, for example `https://mirror.example.com/tool-versions`; the datasource adds the `v1/` folder itself.

The versions are in exactly the format `install-tool` accepts, for example `21.0.5+11.0.LTS` for `java`.
Prereleases are marked as unstable.
