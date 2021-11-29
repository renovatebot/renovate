# Preset configs

Renovate uses the term "presets" to refer to shareable config snippets, similar to ESLint.
Unlike ESLint though:

- Presets may be as small as a list of package names, or as large as a full config
- Shared config files can contain many presets

Presets can be defined using either npm packages, or with GitHub/GitLab repositories.
Only the JSON format is supported.
Bitbucket-hosted presets are yet to be implemented.

## Preset config URIs

In human-understandable form, the rules are:

- A full preset URI consists of package name, preset name, and preset parameters, such as `package:preset(param)`
- If a package scope is specified and no package exists, then the package name is assumed to be `renovate-config`, e.g. `@rarkins:webapp` is expanded to `@rarkins/renovate-config:webapp`
- If a non-scoped package is specified then it is assumed to have the prefix `renovate-config-`. e.g. `rarkins:webapp` is expanded to `renovate-config-rarkins:webapp`
- If a package name is specified and has no preset name, then `default` is assumed, e.g. `@rarkins` expands in full to `@rarkins/renovate-config:default` and `rarkins` expands in full to `renovate-config-rarkins:default`
- There is a special "default" namespace where no package name is necessary. e.g. `:webapp` (not the leading `:`) expands to `renovate-config-default:webapp`

## Supported config syntax

### Scoped

| name                                               | example use                                 | preset    | npm package resolves as      | parameters |
| -------------------------------------------------- | ------------------------------------------- | --------- | ---------------------------- | ---------- |
| scoped                                             | `@somescope`                                | `default` | `@somescope/renovate-config` |            |
| scoped with package name                           | `@somescope/somepackagename`                | `default` | `@somescope/somepackagename` |            |
| scoped with preset name                            | `@somescope:webapp`                         | `webapp`  | `@somescope/renovate-config` |            |
| scoped with param                                  | `@somescope(eslint)`                        | `default` | `@somescope/renovate-config` | `eslint`   |
| scoped with preset name and param                  | `@somescope:webapp(eslint)`                 | `webapp`  | `@somescope/renovate-config` | `eslint`   |
| scoped with package name and preset name           | `@somescope/somepackagename:webapp`         | `webapp`  | `@somescope/somepackagename` |            |
| scoped with package name and preset name and param | `@somescope/somepackagename:webapp(eslint)` | `webapp`  | `@somescope/somepackagename` | `eslint`   |

### Non-scoped

If you use a non-scoped config, you must use a preset name!

| name                                        | example use                                       | preset    | npm package resolves as           | parameters |
| ------------------------------------------- | ------------------------------------------------- | --------- | --------------------------------- | ---------- |
| non-scoped short with preset name           | `somepackagename:default`                         | `default` | `renovate-config-somepackagename` |            |
| non-scoped short with preset name and param | `somepackagename:default(eslint)`                 | `default` | `renovate-config-somepackagename` | `eslint`   |
| non-scoped full with preset name            | `renovate-config-somepackagename:default`         | `default` | `renovate-config-somepackagename` |            |
| non-scoped full with preset name and param  | `renovate-config-somepackagename:default(eslint)` | `default` | `renovate-config-somepackagename` | `eslint`   |

### Git based

In general, GitHub, GitLab or Gitea-based preset hosting is easier than npm because you avoid the "publish" step - simply commit preset code to the default branch and it will be picked up by Renovate the next time it runs.
An additional benefit of using source code hosting is that the same token/authentication can be reused by Renovate in case you want to make your config private.

You can set a Git tag (like a SemVer) to use a specific release of your shared config.

#### GitHub

| name                                        | example use                      | preset    | resolves as                  | filename        | Git tag        |
| ------------------------------------------- | -------------------------------- | --------- | ---------------------------- | --------------- | -------------- |
| GitHub default                              | `github>abc/foo`                 | `default` | `https://github.com/abc/foo` | `default.json`  | Default branch |
| GitHub with preset name                     | `github>abc/foo:xyz`             | `xyz`     | `https://github.com/abc/foo` | `xyz.json`      | Default branch |
| GitHub default with a tag                   | `github>abc/foo#1.5.4`           | `default` | `https://github.com/abc/foo` | `default.json`  | `1.5.4`        |
| GitHub with preset name with a tag          | `github>abc/foo:xyz#1.5.4`       | `xyz`     | `https://github.com/abc/foo` | `xyz.json`      | `1.5.4`        |
| GitHub with preset name and path with a tag | `github>abc/foo//path/xyz#1.5.4` | `xyz`     | `https://github.com/abc/foo` | `path/xyz.json` | `1.5.4`        |
| GitHub with subpreset name and tag          | `github>abc/foo:xyz/sub#1.5.4`   | `sub`     | `https://github.com/abc/foo` | `xyz.json`      | `1.5.4`        |

#### GitLab

| name                                        | example use                      | preset    | resolves as                  | filename        | Git tag        |
| ------------------------------------------- | -------------------------------- | --------- | ---------------------------- | --------------- | -------------- |
| GitLab default                              | `gitlab>abc/foo`                 | `default` | `https://gitlab.com/abc/foo` | `default.json`  | Default branch |
| GitLab with preset name                     | `gitlab>abc/foo:xyz`             | `xyz`     | `https://gitlab.com/abc/foo` | `xyz.json`      | Default branch |
| GitLab default with a tag                   | `gitlab>abc/foo#1.5.4`           | `default` | `https://gitlab.com/abc/foo` | `default.json`  | `1.5.4`        |
| GitLab with preset name with a tag          | `gitlab>abc/foo:xyz#1.5.4`       | `xyz`     | `https://gitlab.com/abc/foo` | `xyz.json`      | `1.5.4`        |
| GitLab with preset name and path with a tag | `gitlab>abc/foo//path/xyz#1.5.4` | `xyz`     | `https://gitlab.com/abc/foo` | `path/xyz.json` | `1.5.4`        |
| GitLab with subpreset name and tag          | `gitlab>abc/foo:xyz/sub#1.5.4`   | `sub`     | `https://gitlab.com/abc/foo` | `xyz.json`      | `1.5.4`        |

#### Gitea

| name                                       | example use                     | preset    | resolves as                 | filename        | Git tag        |
| ------------------------------------------ | ------------------------------- | --------- | --------------------------- | --------------- | -------------- |
| Gitea default                              | `gitea>abc/foo`                 | `default` | `https://gitea.com/abc/foo` | `default.json`  | Default branch |
| Gitea with preset name                     | `gitea>abc/foo:xyz`             | `xyz`     | `https://gitea.com/abc/foo` | `xyz.json`      | Default branch |
| Gitea default with a tag                   | `gitea>abc/foo#1.5.4`           | `default` | `https://gitea.com/abc/foo` | `default.json`  | `1.5.4`        |
| Gitea with preset name with a tag          | `gitea>abc/foo:xyz#1.5.4`       | `xyz`     | `https://gitea.com/abc/foo` | `xyz.json`      | `1.5.4`        |
| Gitea with preset name and path with a tag | `gitea>abc/foo//path/xyz#1.5.4` | `xyz`     | `https://gitea.com/abc/foo` | `path/xyz.json` | `1.5.4`        |
| Gitea with subpreset name and tag          | `gitea>abc/foo:xyz/sub#1.5.4`   | `sub`     | `https://gitea.com/abc/foo` | `xyz.json`      | `1.5.4`        |

#### Self-hosted Git

| name                                       | example use                     | preset    | resolves as                          | filename        | Git tag        |
| ------------------------------------------ | ------------------------------- | --------- | ------------------------------------ | --------------- | -------------- |
| Local default                              | `local>abc/foo`                 | `default` | `https://github.company.com/abc/foo` | `default.json`  | Default branch |
| Local with preset path                     | `local>abc/foo:path/xyz`        | `default` | `https://github.company.com/abc/foo` | `path/xyz.json` | Default branch |
| Local default with a tag                   | `local>abc/foo#1.5.4`           | `default` | `https://github.company.com/abc/foo` | `default.json`  | `1.5.4`        |
| Local with preset name with a tag          | `local>abc/foo:xyz#1.5.4`       | `default` | `https://github.company.com/abc/foo` | `xyz.json`      | `1.5.4`        |
| Local with preset name and path with a tag | `local>abc/foo//path/xyz#1.5.4` | `default` | `https://github.company.com/abc/foo` | `path/xyz.json` | `1.5.4`        |
| Local with subpreset name and tag          | `local>abc/foo:xyz/sub#1.5.4`   | `sub`     | `https://github.company.com/abc/foo` | `xyz.json`      | `1.5.4`        |
