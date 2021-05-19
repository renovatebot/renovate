# Self-hosted experimental environment variables

The following environment variables are "experimental" because:

- They are not commonly needed
- They are typically an effort to work around some other service's or platform's problem
- They can be removed at any time
- They are variables for Renovate's internal use to validate they work as intended

Experimental variables which are commonly used and for which there is no external solution in sight can be converted to a official configuration option by the Renovate bot developers.

Use these experimental variables at your own risk.
We do not follow Semantic Versioning for any experimental variables.
These variables may be removed or have their behavior changed in **any** version.
We will try to keep breakage to a minimum, but make no guarantees that a experimental variable will keep working.

## GITLAB_IGNORE_REPO_URL

If set to any value, Renovate will ignore the Project's `http_url_to_repo` value and instead construct the Git URL manually.

## RENOVATE_CACHE_NPM_MINUTES

If set to any integer, Renovate will use this integer instead of the default npm cache time (15 minutes) for the npm datasource.

## RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK

If set to any value, Renovate will skip its default artifacts filter check in the Maven datasource.
Skiping the check will speed things up, but may result in versions being returned which don't properly exist on the server.

## RENOVATE_PAGINATE_ALL

If set to any value, Renovate will always paginate requests to GitHub fully, instead of stopping after 10 pages.

## RENOVATE_REUSE_PACKAGE_LOCK

If set to "false" (string), Renovate will remove any existing `package-lock.json` before attempting to update it.

## RENOVATE_USER_AGENT

If set to any string, Renovate will use this as the `user-agent` it sends with HTTP requests.

## RENOVATE_X_HARD_EXIT

If set to any value, Renovate will use a "hard" `process.exit()` once all work is done, even if a sub-process is otherwise delaying Node.js from exiting.
See <https://github.com/renovatebot/renovate/issues/8660> for background on why this was created.
