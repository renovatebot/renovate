# Creating/editing Renovate presets

Renovate comes with default presets that you can find in the [`lib/config/presets/internal`](https://github.com/renovatebot/renovate/tree/main/lib/config/presets/internal) directory.
You can suggest changes to the presets with a pull request.

Follow the rules below to increase the chance that your pull request gets merged.

## General rules

1. Avoid creating presets for problems which can be fixed upstream
1. The internal preset should help a significant number of Renovate users

### Specific rules

#### Group presets

We have multiple kinds of `group:` presets, with different rules.

##### Rules for `group:monorepos` preset

1. Only group dependencies that _must_ be updated together

##### Rules for `group:recommended` presets

1. The `group:recommended` preset is for related dependencies which aren't from a monorepo but which usually need to be updated together (as separate PRs may each break)

##### Rules for `group:*` presets

1. Finally, any other `group:*` presets can be added if they are beneficial to a wide number of users
1. They don't need to be added to `group:recommended`, meaning that users will "opt in" to them one-by-one and _not_ get them automatically from `config:recommended`, which includes `group:monorepos` and `group:recommended`

#### Rules for replacement presets

1. Replacement PRs should ideally propose a replacement only once the user is on a compatible version, by specifying a compatible `matchCurrentVersion` constraint
1. If no compatible replacement upgrade is possible, it's acceptable to propose an incompatible one (e.g. a major version upgrade)
1. Replacements should update the user to the first recommended version of the new dependency and not include any new changes - whether breaking or not - if they can be avoided, in short: pin the new version

If possible, replacement presets should give the user a replacement version that is _functionally identical_ to the _last version_ under the _old_ name.
We only want a user's tests to fail because of _broken references_ to the old package name, and not because the maintainer(s) changed the _behavior_ of the package.

#### Rules for monorepo presets

1. The primary use case of monorepo presets is finding packages from the same origin source repository which should be updated together
1. Packages from the same repository which are developed and versioned independently do not need to be grouped as a monorepo, but in many cases we still do
1. Packages from separate repositories but which are released together and dependent on each other may also be added to the "monorepo" definitions even if not strictly true

#### Rules for migrating presets

1. Removing a preset: Add the preset name to the `removedPresets` object in [`presets/common`](https://github.com/renovatebot/renovate/blob/main/lib/config/presets/common.ts#L1) and set its value to `null`
1. Renaming a preset: Add the old preset name to the `removedPresets` object in [`presets/common`](https://github.com/renovatebot/renovate/blob/main/lib/config/presets/common.ts#L1) and set its value to the new preset name
1. Renaming a monorepo preset: Add the old monorepo name to the `renamedMonorepos` object in [`presets/common`](https://github.com/renovatebot/renovate/blob/79f0888ebff8034ee80c905ceaca0811ddc1c8b8/lib/config/presets/common.ts#L50) and set its value to the new monorepo name
