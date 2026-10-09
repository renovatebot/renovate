This datasource returns the versions of a [Containerbase](https://github.com/containerbase/base) tool which `install-tool` can install.

The `packageName` is the Containerbase tool name, for example `node` or `pnpm`.
Unknown tool names return no releases.

The versions come from the files published by [containerbase/tool-versions](https://github.com/containerbase/tool-versions), one `<tool>.json` per tool at `https://containerbase.github.io/tool-versions/`.
Set `registryUrls` to use a mirror of these files.

The versions are in exactly the format `install-tool` accepts, for example `21.0.5+11.0.LTS` for `java`.
Prereleases are marked as unstable.
