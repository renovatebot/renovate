# Self-hosted experimental flags

The following flags are "experimental" because they:

- are not commonly needed
- are typically an effort to work around some other service's or platform's problem
- can be removed at any time
- are flags for Renovate's internal use to validate they work as intended

Experimental flags which are commonly used and for which there is no external solution in sight can be converted to an official configuration option by the Renovate bot developers.

Use these experimental flags at your own risk.
These flags may be removed or have their behavior changed in **any** version.
We will try to keep breakage to a minimum, but make no guarantees that an experimental flag will keep working.

## `disableDockerHubTags`

If added to the `experimentalFlags` list, Renovate will stop using the Docker Hub API (`https://hub.docker.com`) to fetch tags and instead use the normal Docker API for images pulled from `https://index.docker.io`.

Example usage:

```js
experimentalFlags: ['disableDockerHubTags'];
```

## `execGpidHandle`

If added to the `experimentalFlags` list, Renovate will terminate the whole process group of a terminated child process spawned by Renovate.

Example usage:

```js
experimentalFlags: ['execGpidHandle'];
```

## `noMavenPomCheck`

If added to the `experimentalFlags` list, Renovate will skip its default artifacts filter check in the Maven datasource.
Skipping the check will speed things up, but may result in versions being returned which don't properly exist on the server.

Example usage:

```js
experimentalFlags: ['noMavenPomCheck'];
```

## `nugetDownloadNupkgs`

If added to the `experimentalFlags` list, Renovate will download `nupkg` files for determining package metadata.

Example usage:

```js
experimentalFlags: ['nugetDownloadNupkgs'];
```

## `paginateAll`

If added to the `experimentalFlags` list, Renovate will always paginate requests to GitHub fully, instead of stopping after 10 pages.

Example usage:

```js
experimentalFlags: ['paginateAll'];
```

## `rebasePaginationLinks`

If added to the `experimentalFlags` list, Renovate will rewrite GitHub Enterprise Server's pagination responses to use the `endpoint` URL from the Renovate config.

Example usage:

```js
experimentalFlags: ['rebasePaginationLinks'];
```

<!-- prettier-ignore -->
!!! note
    For the GitHub Enterprise Server platform only.

## `repoCacheForceLocal`

If added to the `experimentalFlags` list, Renovate will persist repository cache locally after uploading to S3.

Example usage:

```js
experimentalFlags: ['repoCacheForceLocal'];
```

## `sqlitePackageCache`

If added to the `experimentalFlags` list, Renovate will use SQLite as the backend for the package cache.
Do not combine with `redisUrl`, as Renovate would then prefer Redis over SQlite.

Example usage:

```js
experimentalFlags: ['sqlitePackageCache'];
```

## `suppressPreCommitWarning`

Suppress the pre-commit support warning in PR bodies.

Example usage:

```js
experimentalFlags: ['suppressPreCommitWarning'];
```

## `yarnProxy`

Configure global Yarn proxy settings if HTTP proxy environment variables are detected.

Example usage:

```js
experimentalFlags: ['yarnProxy'];
```

## `useOpenpgp`

Use `openpgp` instead of `kbpgp` for `PGP` decryption.

Example usage:

```js
experimentalFlags: ['useOpenpgp'];
```
