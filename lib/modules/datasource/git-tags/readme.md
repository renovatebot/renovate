Renovate reads the tags of a repository with `git ls-remote`, so this datasource works with any git host.
Credentials come from `hostRules` with `hostType: git-tags`.

When the repository is on GitHub, GitLab, Bitbucket Cloud, Gitea or Forgejo, recognized by the host name or by a `hostRule` with that platform's `hostType`, Renovate reads the tags through the platform's API instead, with the `github-tags`, `gitlab-tags`, `bitbucket-tags`, `gitea-tags` or `forgejo-tags` datasource.
That lookup uses the platform's `hostRules` and provides release timestamps, and its result reports the datasource which served it as `effectiveDatasource`.
If the API lookup fails or finds nothing, Renovate falls back to `git ls-remote`.
