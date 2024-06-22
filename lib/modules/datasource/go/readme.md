The best way to lookup Go Modules is using Go proxies.

## GOPROXY settings

This datasource will use default `GOPROXY` settings of `https://proxy.golang.org,direct` if the environment variable is unset.

To override this default and use a different proxy in self-hosted environments, configure `GOPROXY` to an alternative setting in env.

To override this default and stop using any proxy at all, set `GOPROXY` to the value `direct`.

## Pseudo versions

Go proxies return an empty list of versions when queried (`@v/list`) for a package which uses pseudo versions, but return the latest pseudo-version when queried for `@latest`.

If the `@latest` endpoint returns a pseudo-version, and the release list is empty, then this datasource will return the latest pseudo-version as the only release/version for the package.

## Checking for new major releases

When a Go proxy is queried for `@v/list` it returns only versions for v0 or v1 of a package.
Therefore Renovate will also query `@v2/list` just in case there also exists a v2 of the package.
Similarly, if the dependency is already on a higher version such as `v5`, Renovate will check in case higher major versions exist.
You do not need to be worried about any 404 responses which result from such checks - they are the only way for Renovate to know if newer major releases exist.

## Fallback to direct lookups

If no result is found from Go proxy lookups then Renovate will fall back to direct lookups.
