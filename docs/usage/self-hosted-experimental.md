# Self-Hosted Experimental Options

The following options are considered "experimental" in that:

- They should not commonly be needed
- They are typically an effort to work around some other service or platform's problem
- We hope they can each be removed one day, or we are waiting to be sure they work as intended

Experimental options which are commonly used and for which there is no external solution in sight should be replaced with official options.

Please use experimental options at your own risk - they may be removed or behavior changed in any release, not just major, however all attempts will be made not to inconvenience anyone.

## GITLAB_IGNORE_REPO_URL

If set to any value, Renovate will ignore the Project's `http_url_to_repo` value and instead construct the git URL manually.

## RENOVATE_CACHE_NPM_MINUTES

This must be a number, and would override Renovate's default npm cache time of 15 minutes for the npm datasource.

## RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK

If set to any value, Renovate will skip its default artifacts filter check in the Maven datasource.
Skiping the check will speed things up, but may result in versions being returned which don't properly exist on the server.

## RENOVATE_LEGACY_GIT_AUTHOR_EMAIL

An additional `gitAuthor` email to ignore.
Deprecated: use `ignoredAuthors` instead.

## RENOVATE_PAGINATE_ALL

If set to any value, Renovate will always paginate requests to GitHub fully, instead of stopping after 10 pages.

## RENOVATE_REUSE_PACKAGE_LOCK

If set to "false" (string), Renovate will remove any existing `package-lock.json` before attempting to update it.

## RENOVATE_USER_AGENT

Configures the `user-agent` string to be sent with HTTP requests.
