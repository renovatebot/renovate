This datasource uses the [Elm Package Registry API](https://package.elm-lang.org) to fetch versions for published Elm packages.

Elm packages use strict semantic versioning. The datasource fetches release timestamps from the registry's per-package releases endpoint.

By design, all Elm packages must be published from GitHub repositories. The package name is the GitHub repository path (e.g., `elm/core` is published from `github.com/elm/core`). This is enforced by the `elm publish` command, which requires packages to be tagged and pushed to GitHub before publishing. Therefore, the source URL is reliably derived from the package name.
