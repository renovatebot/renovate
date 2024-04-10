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

## `autoDiscoverRepoOrder`

<!-- prettier-ignore -->
!!! note
    For the Forgejo and Gitea platform only.

The order method for autodiscover server side repository search.

> If multiple `autodiscoverTopics` are used resulting order will be per topic not global.

Allowed values:

- `asc`
- `desc`

Default value: `asc`.

Example usage:

```js
experimentalFlags: ['autoDiscoverRepoOrder=desc'];
```

## `dockerHubTags`

If added to the `experimentalFlags` list, Renovate will use the Docker Hub API (`https://hub.docker.com`) to fetch tags instead of the normal Docker API for images pulled from `https://index.docker.io`.

Example usage:

```js
experimentalFlags: ['dockerHubTags'];
```

## `dockerMaxPages`

The default maximum page number for Docker tags lookup on Docker registries is `20`.
You can override this default by setting a new integer number in the `dockerMaxPages` field.
This is useful for registries which ignore the `n` parameter in the query string and only return `50` tags per page.

Example usage:

```js
experimentalFlags: ['dockerMaxPages=10'];
```

## `mergeConfidenceSupportedDatasources`

If set, Renovate will query the merge-confidence JSON API only for datasources that are part of this list.
The expected value for this environment variable is a list of strings separated by a comma `,`.

Example usage:

```js
experimentalFlags: ['mergeConfidenceSupportedDatasources=["docker","deno"]'];
```
