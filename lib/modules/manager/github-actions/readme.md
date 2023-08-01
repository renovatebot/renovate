The `github-actions` manager extracts dependencies from GitHub Actions workflow and workflow template files.

If you like to use digest pinning but want to follow the action version tag, you can use the following sample:

```yaml
name: build

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@af513c7a016048ae468971c52ed77d9562c7c819 # v1.0.0
```

Renovate will update the commit SHA but follow the GitHub tag you specified.
Renovate can update digests that use SHA1 and SHA256 algorithms.

If you want to automatically pin action digests add the `helpers:pinGitHubActionDigests` preset to the `extends` array:

```json
{
  "extends": ["helpers:pinGitHubActionDigests"]
}
```

Renovate ignores any GitHub runners which are configured in variables.
For example, Renovate ignores the runner configured in the `RUNNER` variable:

```yaml
name: build
on: [push]

env:
  RUNNER: ubuntu-20.04

jobs:
  build:
    runs-on: ${{ env.RUNNER }}
```
