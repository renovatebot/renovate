# Creating/editing Renovate presets

Renovate comes with default presets that you can find in the `lib/config/presets/internal` directory.
You can suggest changes to the presets with a pull request.

Follow the rules below to increase the chance that your pull request gets merged.

## General rules

1. Only create/edit presets for problems which can not be fixed upstream
1. The internal preset must be helpful for most Renovate users

### Specific rules

#### Group presets

File location: `lib/config/presets/internal/group.ts`

Rules:

1. Only group dependencies that _must_ be updated together

#### Replacement presets

File location: `lib/config/presets/internal/replacements.ts`

Rules:

1. Only suggest a replacement PR when the user is on the latest `major` release of the deprecated dependency, use the `matchCurrent` config option to control when the replacement PR is allowed
1. No big version jumps, update to the first stable version of the replacement dependency

#### Monorepo presets

File location: `lib/config/presets/internal/monorepo.ts`

Rules:

1. First check if the problem can be fixed in the source monorepo itself, sometimes the monorepo is not configured properly
