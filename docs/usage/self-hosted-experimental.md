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

## `RENOVATE_CACHE_NPM_MINUTES`

If set to any integer, Renovate will use this integer instead of the default npm cache time (15 minutes) for the npm datasource.

## `RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK`

If set to any value, Renovate will skip its default artifacts filter check in the Maven datasource.
Skipping the check will speed things up, but may result in versions being returned which don't properly exist on the server.

## `RENOVATE_PAGINATE_ALL`

If set to any value, Renovate will always paginate requests to GitHub fully, instead of stopping after 10 pages.

## `RENOVATE_REUSE_PACKAGE_LOCK`

If set to "false" (string), Renovate will remove any existing `package-lock.json` before trying to update it.

## `RENOVATE_USER_AGENT`

If set to any string, Renovate will use this as the `user-agent` it sends with HTTP requests.

## `RENOVATE_X_DOCKER_MAX_PAGES`

If set to an integer, Renovate will use this as max page number for docker tags lookup on docker registries, instead of the default 20 pages.
This is useful for registries which ignores the `n` parameter in the query string and only return 50 tags per page.

## `RENOVATE_X_HARD_EXIT`

If set to any value, Renovate will use a "hard" `process.exit()` once all work is done, even if a sub-process is otherwise delaying Node.js from exiting.
See [issue 8660](https://github.com/renovatebot/renovate/issues/8660) for background on why this was created.

## `RENOVATE_X_IGNORE_NODE_WARN`

Suppress the default warning when a deprecated version of Node.js is used to run Renovate.

## `RENOVATE_X_IGNORE_RE2`

Skip initializing `RE2` for regular expressions and instead use Node-native `RegExp` instead.

## `RENOVATE_X_PLATFORM_VERSION`

If set, Renovate will use this string as GitLab server version instead of checking via the GitLab API.
This can be useful when you use the GitLab `CI_JOB_TOKEN` to authenticate Renovate.

Read [platform details](modules/platform/gitlab/index.md) to learn why we need the server version on GitLab.

## `RENOVATE_X_S3_ENDPOINT`

If set, Renovate will use this string as the `endpoint` when instantiating the AWS S3 client.

## `RENOVATE_X_S3_PATH_STYLE`

If set, Renovate will enable `forcePathStyle` when instantiating the AWS S3 client.

> Whether to force path style URLs for S3 objects (e.g., `https://s3.amazonaws.com//` instead of `https://.s3.amazonaws.com/`)

Source: [AWS S3 documentation - Interface BucketEndpointInputConfig](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/interfaces/bucketendpointinputconfig.html)

## `RENOVATE_X_EXEC_GPID_HANDLE`

If set, Renovate will terminate the whole process group of a terminated child process spawned by Renovate.

## `RENOVATE_X_DELETE_CONFIG_FILE`

If `true` Renovate tries to delete the self-hosted config file after reading it.
You can set the config file Renovate should read with the `RENOVATE_CONFIG_FILE` environment variable.

The process that runs Renovate must have the correct permissions to delete the config file.

## `RENOVATE_X_MERGE_CONFIDENCE_API_BASE_URL`

If set, Renovate will query this API for Merge Confidence data.
This feature is in private beta.

## `RENOVATE_X_AUTODISCOVER_REPO_SORT`

<!-- prettier-ignore -->
!!! note
    For the Forgejo and Gitea platform only.

The sort method for autodiscover server side repository search.

Allowed values:

- `alpha`
- `created`
- `updated`
- `size`
- `id`

Default value: `alpha`.

## `RENOVATE_X_AUTODISCOVER_REPO_ORDER`

<!-- prettier-ignore -->
!!! note
    For the Forgejo and Gitea platform only.

The order method for autodiscover server side repository search.

Allowed values:

- `asc`
- `desc`

Default value: `asc`.

## `RENOVATE_X_REBASE_PAGINATION_LINKS`

If set, Renovate will rewrite GitHub Enterprise Server's pagination responses to use the `endpoint` URL from the Renovate config.

<!-- prettier-ignore -->
!!! note
    For the GitHub Enterprise Server platform only.

## `RENOVATE_X_GITLAB_BRANCH_STATUS_DELAY`

Adjust default time (in milliseconds) given to GitLab to create pipelines for a commit pushed by Renovate.

Can be useful for slow-running, self-hosted GitLab instances that don't react fast enough for the default delay to help.

Default value: `1000` (milliseconds).

## `OTEL_EXPORTER_OTLP_ENDPOINT`

If set, Renovate will export OpenTelemetry data to the supplied endpoint.
For more information see [the OpenTelemetry docs](opentelemetry.md).
