# Creating/editing Renovate presets

Renovate comes with default presets that you can find in the [`lib/config/presets/internal`](https://github.com/renovatebot/renovate/tree/main/lib/config/presets/internal) directory.
You can suggest changes to the presets with a pull request.

Follow the rules below to increase the chance that your pull request gets merged.

## General rules

1. Avoid creating presets for problems which can be fixed upstream
1. The internal preset should be helpful for a significant number of Renovate users

### Specific rules

#### Group presets

We have multiple kinds of `group:` presets, with different rules.

##### Rules for `group:monorepo` preset

1. Only group dependencies that _must_ be updated together

##### Rules for `group:recommended` presets

1. The `group:recommended` preset is for related dependencies which aren't from a monorepo but which usually need to be updated together as separate PRs may each break

##### Rules for `group:*` presets

1. Finally, any other `group:*` presets can be added if they are beneficial to a wide number of users
1. They don't need to be added to `group:recommended`, meaning that users will "opt in" to them one by one and not get them automatically from `config:recommended`, which includes `group:monorepo` and `group:recommended`

#### Replacement presets

Rules:

1. Replacement PRs should ideally propose a replacement only once the user is on a compatible version, by specifying a compatible `matchCurrentVersion` constraint
1. If no compatible replacement upgrade is possible, it's acceptable to propose an incompatible one (e.g. a major version upgrade)
1. Replacements should update the user to the first recommended version of the new dependency and not include any new changes - whether breaking or not - if they can be avoided

#### Monorepo presets

Rules:

1. The primary use case of monorepo presets is finding packages from the same origin source repository which should be updated together
1. Packages from the same repository which are developed and versioned independently do not need to be grouped as a monorepo, but in many cases we still do
1. Packages from separate repositories but which are released together and dependent on each other may also be added to the "monorepo" definitions even if not strictly true
