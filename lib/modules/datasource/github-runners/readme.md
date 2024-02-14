This datasource returns a list of all runners that are hosted by GitHub.
The datasource is based on [GitHub's `runner-images` repository](https://github.com/actions/runner-images).

Examples: `windows-2022` / `ubuntu-22.04` / `macos-13`

## Maintenance

New runner versions must be added to the datasource with a pull request.
Unstable runners are tagged as `[beta]` in the readme of the [`runner-images` repository](https://github.com/actions/runner-images) and should have the `isStable:false` property.
Deprecated runners are tagged as `[deprecated]` in the readme and should have the `isDeprecated:true` property.
If a runner is very old, the readme may drop it completely, but we should still give it the `isDeprecated:true` property.
Once a runner version becomes stable, the `[beta]` tag is removed and the suffix `latest` is added to its YAML label and the `isStable:false` should be removed.
Once a runner version becomes deprecated, the `isDeprecated:true` property should be added.
