# Self-hosted experimental environment variables

The following environment variables are "experimental" because they:

- are not commonly needed
- are typically an effort to work around some other service's or platform's problem
- can be removed at any time
- are variables for Renovate's internal use to validate they work as intended

Experimental variables which are commonly used and for which there is no external solution in sight can be converted to an official configuration option by the Renovate bot developers.

Use these experimental variables at your own risk.
We do not follow Semantic Versioning for any experimental variables.
These variables may be removed or have their behavior changed in **any** version.
We will try to keep breakage to a minimum, but make no guarantees that an experimental variable will keep working.

## `OTEL_EXPORTER_OTLP_ENDPOINT`

If set, Renovate will export OpenTelemetry data to the supplied endpoint.
For more information see [the OpenTelemetry docs](opentelemetry.md).

## `RENOVATE_PAGINATE_ALL`

If set to any value, Renovate will always paginate requests to GitHub fully, instead of stopping after 10 pages.

## `RENOVATE_STATIC_REPO_CONFIG`

If set to a _valid_ `JSON` string containing a _valid_ Renovate configuration, it will be applied to the repository config before resolving the actual configuration file within the repository.

> [!warning]
> An invalid value will result in the scan being aborted.

## `RENOVATE_X_DOCKER_HUB_DISABLE_LABEL_LOOKUP`

If set to any value, Renovate will skip attempting to get release labels (e.g. gitRef, sourceUrl) from manifest annotations for `https://index.docker.io`.

Due to the missing label information like sourceUrl, Renovate will not be able to perform certain actions dependent on these information for the images.

This includes the following:

- Generating changelogs
- Applying package rules dependent on the labels
- Including the sourceUrls in PR bodies

## `RENOVATE_X_DOCKER_HUB_TAGS_DISABLE`

If set to any value, Renovate will stop using the Docker Hub API (`https://hub.docker.com`) to fetch tags and instead use the normal Docker API for images pulled from `https://index.docker.io`.

## `RENOVATE_X_ENCRYPTED_STRICT`

If set to `"true"`, a config error Issue will be raised in case repository config contains `encrypted` objects without any `privateKey` defined.

## `RENOVATE_X_EXEC_GPID_HANDLE`

If set, Renovate will terminate the whole process group of a terminated child process spawned by Renovate.

## `RENOVATE_X_GITLAB_AUTO_MERGEABLE_CHECK_ATTEMPS`

If set to an positive integer, Renovate will use this as the number of attempts to check if a merge request on GitLab is mergeable before trying to automerge.
The formula for the delay between attempts is `RENOVATE_X_GITLAB_MERGE_REQUEST_DELAY * attempt * attempt` milliseconds.

Default value: `5` (attempts results in max. 13.75 seconds timeout).

## `RENOVATE_X_GITLAB_BRANCH_STATUS_CHECK_ATTEMPTS`

If set to a positive integer, Renovate will use this as the number of attempts to check branch status before trying to add a status check.
The delay between attempts is `RENOVATE_X_GITLAB_BRANCH_STATUS_DELAY` milliseconds.

Default value: `2` (attempts results in maximum 2 seconds timeout).

!!! warning Increasing this value too much penalizes projects that do not have defined pipelines, Renovate will systematically wait `RENOVATE_X_GITLAB_BRANCH_STATUS_CHECK_ATTEMPTS * RENOVATE_X_GITLAB_BRANCH_STATUS_DELAY` milliseconds on these projects and slow down the Renovate analyzes.

## `RENOVATE_X_GITLAB_BRANCH_STATUS_DELAY`

Adjust default time (in milliseconds) given to GitLab to create pipelines for a commit pushed by Renovate.

Can be useful for slow-running, self-hosted GitLab instances that don't react fast enough for the default delay to help.

Default value: `1000` (milliseconds).

## `RENOVATE_X_GITLAB_MERGE_REQUEST_DELAY`

If set, Renovate will use this as a delay to proceed with an automerge.

Default value: `250` (milliseconds).

## `RENOVATE_X_HARD_EXIT`

If set to any value, Renovate will use a "hard" `process.exit()` once all work is done, even if a sub-process is otherwise delaying Node.js from exiting.
See [issue 8660](https://github.com/renovatebot/renovate/issues/8660) for background on why this was created.

## `RENOVATE_X_IGNORE_RE2`

Skip initializing `RE2` for regular expressions and instead use Node-native `RegExp` instead.

## `RENOVATE_X_NUGET_DOWNLOAD_NUPKGS`

If set to any value, Renovate will download `nupkg` files for determining package metadata.

## `RENOVATE_X_PLATFORM_VERSION`

Specify this string for Renovate to skip API checks and provide GitLab/Gitea and Forgejo/Bitbucket server version directly.
Particularly useful with GitLab's `CI_JOB_TOKEN` to authenticate Renovate or to reduce API calls for Bitbucket.

Read [platform details](modules/platform/gitlab/index.md) to learn why we need the server version on GitLab.

## `RENOVATE_X_REBASE_PAGINATION_LINKS`

If set, Renovate will rewrite GitHub Enterprise Server's pagination responses to use the `endpoint` URL from the Renovate config.

<!-- prettier-ignore -->
!!! note
    For the GitHub Enterprise Server platform only.

## `RENOVATE_X_REPO_CACHE_FORCE_LOCAL`

If set, Renovate will persist repository cache locally after uploading to S3.

## `RENOVATE_X_SQLITE_PACKAGE_CACHE`

If set, Renovate will use SQLite as the backend for the package cache.
Don't combine with `redisUrl`, Redis would be preferred over SQlite.

## `RENOVATE_X_SUPPRESS_PRE_COMMIT_WARNING`

Suppress the pre-commit support warning in PR bodies.

## `RENOVATE_X_USE_OPENPGP`

Use `openpgp` instead of `kbpgp` for `PGP` decryption.

## `RENOVATE_X_YARN_PROXY`

Configure global Yarn proxy settings if HTTP proxy environment variables are detected.
