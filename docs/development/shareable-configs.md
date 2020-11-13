# Preset configs

Renovate uses the term "presets" to refer to shareable config snippets, similar to ESLint.
Unlike ESLint though:

- Presets may be as small as a list of package names, or as large as a full config
- Shared config files can contain many presets

## Preset config URIs

In human-understandable form, the rules are:

- A full preset URI consists of package name, preset name, and preset parameters, such as `package:preset(param)`
- If a package scope is specified and no package exists, then the package name is assumed to be `renovate-config`, e.g. `@rarkins:webapp` is expanded to `@rarkins/renovate-config:webapp`
- If a non-scoped package is specified then it is assumed to have the prefix `renovate-config-`. e.g. `rarkins:webapp` is expanded to `renovate-config-rarkins:webapp`
- If a package name is specified and has no preset name, then `default` is assumed, e.g. `@rarkins` expands in full to `@rarkins/renovate-config:default` and `rarkins` expands in full to `renovate-config-rarkins:default`
- There is a special "default" namespace where no package name is necessary. e.g. `:webapp` (not the leading `:`) expands to `renovate-config-default:webapp`

## Supported config syntax

### Scoped

| name                                                | example use                                            | preset    | npm package resolves as      | parameters           |
| --------------------------------------------------- | ------------------------------------------------------ | --------- | ---------------------------- | -------------------- |
| scoped                                              | `@somescope`                                           | `default` | `@somescope/renovate-config` | none                 |
| scoped with package name                            | `@somescope/somepackagename`                           | `default` | `@somescope/somepackagename` | none                 |
| scoped with preset name                             | `@somescope:webapp`                                    | `webapp`  | `@somescope/renovate-config` | none                 |
| scoped with params                                  | `@somescope(eslint, stylelint)`                        | `default` | `@somescope/renovate-config` | `eslint` `stylelint` |
| scoped with preset name and params                  | `@somescope:webapp(eslint, stylelint)`                 | `webapp`  | `@somescope/renovate-config` | `eslint` `stylelint` |
| scoped with package name and preset name            | `@somescope/somepackagename:webapp`                    | `webapp`  | `@somescope/somepackagename` | none                 |
| scoped with package name and preset name and params | `@somescope/somepackagename:webapp(eslint, stylelint)` | `webapp`  | `@somescope/somepackagename` | `eslint` `stylelint` |

### Non-scoped

If you use a non-scoped config, you must use a preset name!

| name                                         | example use                                       | preset    | npm package resolves as           | parameters |
| -------------------------------------------- | ------------------------------------------------- | --------- | --------------------------------- | ---------- |
| non-scoped short with preset name            | `somepackagename:default`                         | `default` | `renovate-config-somepackagename` | none       |
| non-scoped short with preset name and params | `somepackagename:default(eslint)`                 | `default` | `renovate-config-somepackagename` | `eslint`   |
| non-scoped full with preset name             | `renovate-config-somepackagename:default`         | `default` | `renovate-config-somepackagename` | none       |
| non-scoped full with preset name and params  | `renovate-config-somepackagename:default(eslint)` | `default` | `renovate-config-somepackagename` | `eslint`   |

Reminder: If you use a non-scoped config, you must use a preset name!
