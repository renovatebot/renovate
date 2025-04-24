This datasource returns a list of all runners that are hosted by GitHub.
The datasource is based on GitHub's [`runner-images`](https://github.com/actions/runner-images) and [`partner-runner-images`](https://github.com/actions/partner-runner-images) repositories.

Examples: `windows-2025` / `ubuntu-24.04` / `macos-15`.

## Maintenance

### Adding a new version

New runner versions must be added to the datasource with a pull request.

#### Unstable runners

Unstable runners are tagged as `[beta]` in [the `runner-images` repository's readme](https://github.com/actions/runner-images) and should get the `isStable:false` property in our code.

#### Promoting a version to stable

Once a runner version becomes stable, the `[beta]` tag is removed and the suffix `latest` is added to its YAML label.
We then remove the `isStable:false` property in our code.

### Deprecating a version

Deprecated runners are tagged as `[deprecated]` in [the `runner-images` repository's readme](https://github.com/actions/runner-images) and we should give it the `isDeprecated:true` property.
If a runner is very old, the readme may drop it completely, but we should still give it the `isDeprecated:true` property.
