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

If added to the experimentalFlags list, Renovate will use the Docker Hub API (`https://hub.docker.com`) to fetch tags instead of the normal Docker API for images pulled from `https://index.docker.io`.

```js
experimentalFlags: ['dockerHubTags'];
```

## `dockerMaxPages`

If set to an integer, Renovate will use this as max page number for docker tags lookup on docker registries, instead of the default 20 pages.
This is useful for registries which ignores the `n` parameter in the query string and only return 50 tags per page.

Example usage:

```js
experimentalFlags: ['dockerMaxPages=10'];
```
