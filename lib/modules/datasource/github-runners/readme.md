This datasource returns a list of all _stable_ runners that are hosted by GitHub.
This datasource ignores beta releases.
The datasource is based on [GitHub's `runner-images` repository](https://github.com/actions/runner-images).

Examples: `windows-2019` / `ubuntu-22.04` / `macos-13`

## Maintenance

New _stable_ runner versions must be added to the datasource with a pull request.
Unstable runners are tagged as `[beta]` in the readme of the [`runner-images` repository](https://github.com/actions/runner-images).
Once a runner version becomes stable, the `[beta]` tag is removed and the suffix `latest` is added to its YAML label.
