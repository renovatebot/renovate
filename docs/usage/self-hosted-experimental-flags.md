# Self-hosted experimental flags

The following flags are "experimental" because they:

- are not commonly needed
- are typically an effort to work around some other service's or platform's problem
- can be removed at any time
- are variables for Renovate's internal use to validate they work as intended

Experimental variables which are commonly used and for which there is no external solution in sight can be converted to an official configuration option by the Renovate bot developers.

Use these experimental flags at your own risk.
We do not follow Semantic Versioning for any experimental variables.
These flags may be removed or have their behavior changed in **any** version.
We will try to keep breakage to a minimum, but make no guarantees that an experimental flag will keep working.

## `dockerHubTags`

If added to the `experimentalFlags` list, Renovate will use the Docker Hub API (`https://hub.docker.com`) to fetch tags instead of the normal Docker API for images pulled from `https://index.docker.io`.

Example usage:

```js
experimentalFlags: ['dockerHubTags'];
```

## `execGpidHandle`

If set, Renovate will terminate the whole process group of a terminated child process spawned by Renovate.

## `noMavenPomCheck`

If set to any value, Renovate will skip its default artifacts filter check in the Maven datasource.
Skipping the check will speed things up, but may result in versions being returned which don't properly exist on the server.

Example usage:

```js
experimentalFlags: ['noMavenPomCheck'];
```

## `nugetDownloadNupkgs`

If set to any value, Renovate will download `nupkg` files for determining package metadata.

## `paginateAll`

If set to any value, Renovate will always paginate requests to GitHub fully, instead of stopping after 10 pages.

## `rebasePaginationLinks`

If set, Renovate will rewrite GitHub Enterprise Server's pagination responses to use the `endpoint` URL from the Renovate config.

<!-- prettier-ignore -->
!!! note
    For the GitHub Enterprise Server platform only.

## `repoCacheForceLocal`

If set, Renovate will persist repository cache locally after uploading to S3.

## `s3PathStyle`

If set, Renovate will enable `forcePathStyle` when instantiating the AWS S3 client.

> Whether to force path style URLs for S3 objects (e.g., `https://s3.amazonaws.com//` instead of `https://.s3.amazonaws.com/`)

Source: [AWS S3 documentation - Interface BucketEndpointInputConfig](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/bucketendpointinputconfig.html)

## `sqlitePackageCache`

If set, Renovate will use SQLite as the backend for the package cache.
Don't combine with `redisUrl`, Redis would be preferred over SQlite.

## `supressPreCpmmitWarning`

Suppress the pre-commit support warning in PR bodies.

## `yarnProxy`

Configure global Yarn proxy settings if HTTP proxy environment variables are detected.

## `useOpenpgp`

Use `openpgp` instead of `kbpgp` for `PGP` decryption.
