---
title: Minimum Release Age
description: Requires Renovate to wait for a specified amount of time before suggesting a dependency update.
---

# Minimum Release Age

## What is Minimum Release Age?

`minimumReleaseAge` is a feature that requires Renovate to wait for a specified amount of time before suggesting a dependency update.

The use of `minimumReleaseAge` is not to slow down fast releasing project updates, but to provide a means to reduce risk supply chain security risks.

For example, `minimumReleaseAge=14 days` would ensure that a package update is not suggested by Renovate until 14 days after its release, which allows plenty of time to allow security researchers and automated security tools to catch malicious intent in packages.

Note: Renovate will wait for the set duration to pass for each **separate** version.
Renovate does not wait until the package has seen no releases for x time-duration(`minimumReleaseAge`).

When the time passed since the release is _less_ than the set `minimumReleaseAge`: Renovate adds a "pending" status check to that update's branch.
After enough days have passed: Renovate replaces the "pending" status with a "passing" status check.

## Configuration options

The following configuration options can be used to enable and tune the functionality of Minimum Release Age:

- [`minimumReleaseAge`](../configuration-options.md#minimumreleaseage) (previously known as `stabilityDays`)
- [`minimumReleaseAgeBehaviour`](../configuration-options.md#minimumreleaseagebehaviour)
- [`internalChecksFilter`](../configuration-options.md#internalchecksfilter)

## FAQs

### What happens if the datasource and/or registry does not provide a release timestamp, when using `minimumReleaseAge`?

<!-- prettier-ignore -->
!!! warning
    Renovate 42 changed the behaviour detailed below.
    In Renovate 42, the absence of a release timestamp will be treated as if the release is not yet past the timestamp, which provides a safer default.
    Prior to Renovate 42, we would treat the dependency without a release timestamp **as if it has passed** the `minimumReleaseAge`, and will **immediately suggest that dependency update**.
    If using Renovate prior you can opt into the more secure behaviour (which is default in Renovate 42) by using [`minimumReleaseAgeBehaviour=timestamp-required`](../configuration-options.md#minimumreleaseagebehaviour) (added in 41.150.0)

Consider that:

<!-- markdownlint-disable MD007 -->
<!-- prettier-ignore -->
- we have set `minimumReleaseAge` to apply to a given dependency
- that dependency has 4 updates available
    - 1 of which has a release timestamp that has passed
    - 2 of which have a release timestamp that has _not_ yet passed
    - 1 of which does not have a release timestamp

Renovate will create a PR for the 1 dependency update that has passed the release timestamp, and the others will be marked as "Pending Status Checks" on the Dependency Dashboard.
As time goes on, if the 2 updates with a release timestamp are now passed the minimum release age, Renovate will add them to the PR (or create a new one).

### What happens when an update is not yet passing the minimum release age checks?

Renovate will decide whether it will create a branch for a dependency update using [`internalChecksFilter`](../configuration-options.md#internalchecksfilter).

#### `internalChecksFilter=strict`

If you have not configured [`internalChecksFilter`](../configuration-options.md#internalchecksfilter), Renovate will use `internalChecksFilter=strict` as the default.

This will make sure that branches are not created if the `minimumReleaseAge` status check, `renovate/stability-days`, does not pass.

<details>

<summary>Debug logs example when <code>internalChecksFilter=strict</code></summary>

```
DEBUG: Branch renovate/actions-checkout-5.x creation is disabled because internalChecksFilter was not met (repository=..., branch=renovate/actions-checkout-5.x)
```

</details>

In this case, no branch is created.

If you have a Dependency Dashboard enabled, it will be found in the Dependency Dashboard in the "Pending Status Checks".

You can force the dependency update by requesting it via the Dependency Dashboard, or if you are self-hosting, you can use the [`checkedBranches`](../self-hosted-configuration.md#checkedbranches) to force the branch creation.

<!-- prettier-ignore -->
!!! note
    A previous version of the documentation (up until Renovate 42.19.9) recommended configuring [`prCreation`](../configuration-options.md#prcreation). This is no longer the case.

If no branch is created, Renovate will not raise a PR, regardless of [`prCreation`](../configuration-options.md#prcreation)'s settings.

#### Recommended settings

The recommendation is to set `internalChecksFilter=strict` when using `minimumReleaseAge`, so Renovate will create neither branches (nor PRs) on updates that haven't yet met minimum release age checks.

### Which update types take `minimumReleaseAge` into account?

Depending on your manager, datasource and the given package(s), it may be that some updates provide a release timestamp that can have `minimumReleaseAge` enforced.

It's most likely the case that `major`, `minor`, and `patch` update types will have a corresponding `minimumReleaseAge`.

Generally, Renovate does not provide release timestamps for `digest` updates.

The `replacement` update type [does not currently](https://github.com/renovatebot/renovate/issues/39400) provide release timestamps.

The `lockFileMaintenance` update type does not provide release timestamps, as the package manager performs the required changes to update package(s).

You can validate which update types may have release timestamps by following something similar to how [verify if the registry you're using](#which-registries-support-release-timestamps).

### What happens to security updates?

Security updates bypass any `minimumReleaseAge` checks, and so will be raised as soon as Renovate detects them.

### What happens if a package has multiple updates available?

<!-- prettier-ignore -->
!!! note
    This is based on the [recommended settings above](#recommended-settings)

Renovate waits for the set duration to pass for each **separate** version.

If Renovate sees that a package has multiple updates available, it will only raise update(s) that are passing the `minimumReleaseAge` check.

Let us consider a repository with `minimumReleaseAge=1 hour`, and with the following timeline:

- 0000: Renovate runs, and sees no updates
- 0010: Package releases 1.1.0
- 0030: Renovate runs, and sees 1.1.0 and marks it as pending
- 0100: Renovate runs, still sees 1.1.0 as pending
- 0110: Package releases 1.1.1
- 0130: Renovate runs, and sees 1.1.0 and 1.1.1 releases. As 1.1.0 is now past the `minimumReleaseAge`, Renovate raises a PR, and marks 1.1.1 as pending
- 0200: Renovate runs, still sees 1.1.1 as pending
- 0230: No humans have merged the PR for 1.1.0, so when Renovate runs, it sees 1.1.1 is now past the `minimumReleaseAge`, so updates the existing PR to bump the version to 1.1.1

### What happens to transitive dependencies?

Renovate does not currently manage any transitive dependencies - instead leaving that to package managers and [`lockFileMaintenance`](../configuration-options.md#lockfilemaintenance).

### How do I opt out dependencies from minimum release age checks?

To opt out a dependency from minimum release age checks, create a package rule with `minimumReleaseAge=null`:

```jsonc
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    // for instance
    "security:minimumReleaseAgeNpm",
  ],
  "packageRules": [
    {
      "description": "Disable minimum release age checks for internal dependencies",
      "matchPackageNames": ["@super-secret-organisation/*"],
      "minimumReleaseAge": null,
    },
  ],
}
```

<!-- prettier-ignore -->
!!! note
    As of Renovate 42.19.5, using `minimumReleaseAge=0 days` is treated the same as `minimumReleaseAge=null`.

### Which datasources support release timestamps?

<!-- prettier-ignore -->
!!! tip
    You can confirm if your datasource supports the release timestamp by viewing [the documentation for the given datasource](../modules/datasource/index.md).

The datasource that Renovate uses must have a release timestamp for the `minimumReleaseAge` config option to work.
Some datasources may have a release timestamp, but in a format Renovate does not support.
In those cases a feature request needs to be implemented.

Note that you will also need to [verify if the registry you're using](#which-registries-support-release-timestamps) provides the release timestamp.

### Which registries support release timestamps?

The below is a non-exhaustive list of public registries which support release timestamps:

| Datasource           | Registry URL                                       | Supported | Notes                                                            |
| -------------------- | -------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `docker`             | `https://ghcr.io`                                  | ❌        | [Issue](https://github.com/renovatebot/renovate/issues/39064)    |
| `rubygems`           | `https://rubygems.org`                             | ✅        |                                                                  |
| `docker`             | `https://index.docker.io`                          | ✅        |                                                                  |
| `docker`             | `https://quay.io`                                  | ❌        | [Issue](https://github.com/renovatebot/renovate/issues/38572)    |
| `github-releases`    | `https://github.com`                               | ✅        |                                                                  |
| `terraform-provider` | `https://registry.terraform.io`                    | ✅        | Not always returned                                              |
| `github-tags`        | `https://github.com`                               | ✅        |                                                                  |
| `go`                 | `https://proxy.golang.org,`                        | ✅        |                                                                  |
| `golang-version`     | `https://raw.githubusercontent.com/golang/website` | ✅        |                                                                  |
| `maven`              | `https://repo1.maven.org/maven2`                   | ✅        |                                                                  |
| `node-version`       | `https://nodejs.org/dist`                          | ✅        |                                                                  |
| `npm`                | `https://registry.npmjs.org`                       | ✅        |                                                                  |
| `pypi`               | `https://pypi.org/pypi/`                           | ✅        |                                                                  |
| `ruby-version`       | `https://www.ruby-lang.org`                        | ✅        |                                                                  |
| `jsr`                | `https://jsr.io`                                   | ✅        | For packages without explicit timestamps, defaults to 2025-09-18 |

It is _likely_ that if you are using a public registry (i.e. `registry.npmjs.org`, `repo1.maven.org`, etc) the release timestamp data will be present.
We welcome user contributions to this table.

If you use a custom registry, for instance as a pull-through cache, [additional configuration may be required](#how-do-i-add-timestamp-data-to-custom-registries).

If you are using a custom registry, or unsure about a public registry, you can confirm this using Renovate's debug logs by looking for the `packageFiles with updates` debug log line, which may contain a `releaseTimestamp` field in dependency updates:

<details>

<summary><code>packageFiles with updates</code> debug log example</summary>

```jsonc
DEBUG: packageFiles with updates
{
  "baseBranch": "main",
  "config": {
    "dockerfile": [
      {
        "deps": [
          // NOTE that we're not seeing a release timestamp for this Docker digest
          {
            "depName": "ghcr.io/renovatebot/base-image",
            "packageName": "ghcr.io/renovatebot/base-image",
            "currentValue": "10.67.5",
            "currentDigest": "sha256:d67e849707f38e11c8674a59d3fffef1ea6977757f3a65d9d1a3a198bdd160cf",
            "replaceString": "ghcr.io/renovatebot/base-image:10.67.5@sha256:d67e849707f38e11c8674a59d3fffef1ea6977757f3a65d9d1a3a198bdd160cf",
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "datasource": "docker",
            "depType": "stage",
            "updates": [
              {
                "bucket": "major",
                "newVersion": "11.40.5",
                "newValue": "11.40.5",
                "newMajor": 11,
                "newMinor": 40,
                "newPatch": 5,
                "updateType": "major",
                "isBreaking": true,
                "newDigest": "sha256:81bbc8c8c561f6c4c2d059a5bcdfc95ef837682a41ac45bfbc1380d8d07dc941",
                "branchName": "renovate/main-ghcr.io-renovatebot-base-image-11.x"
              }
            ],
          }
      // ...
    ],
    "github-actions": [
      {
        "deps": [
          // NOTE that we get a release timestamp for this GitHub Action major version bump, as well as the current version's timestamp
          {
            "depName": "actions/setup-node",
            "commitMessageTopic": "{{{depName}}} action",
            "datasource": "github-tags",
            "versioning": "docker",
            "depType": "action",
            "replaceString": "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0",
            "autoReplaceStringTemplate": "{{depName}}@{{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}{{/unless}}",
            "currentValue": "v4.4.0",
            "currentDigest": "49933ea5288caeca8642d1e84afbd3f7d6820020",
            "updates": [
              {
                "bucket": "major",
                "newVersion": "v6.0.0",
                "newValue": "v6.0.0",
                "newDigest": "2028fbc5c25fe9cf00d9f06a71cc4710d4507903",
                "releaseTimestamp": "2025-10-14T02:37:06.000Z",
                "newVersionAgeInDays": 10,
                "newMajor": 6,
                "newMinor": 0,
                "newPatch": 0,
                "updateType": "major",
                "isBreaking": true,
                "libYears": 0.5323368531202435,
                "branchName": "renovate/main-actions-setup-node-6.x"
              }
            ],
            "packageName": "actions/setup-node",
            "warnings": [],
            "sourceUrl": "https://github.com/actions/setup-node",
            "registryUrl": "https://github.com",
            "mostRecentTimestamp": "2025-10-14T02:37:06.000Z",
            "isAbandoned": false,
            "currentVersion": "v4.4.0",
            "currentVersionTimestamp": "2025-04-02T19:20:51.000Z",
            "currentVersionAgeInDays": 204,
            "isSingleVersion": true,
            "fixedVersion": "v4.4.0"
          },
```

</details>

Given a log line such as ☝️ you can also use the following `jq` query to identify any dependencies (or their updates) that are missing the `currentVersionTimestamp` or `releaseTimestamp` fields like so:

<details>

<summary><code>jq</code> query</summary>

```sh
# Code snippet licensed under the Apache-2.0, and co-authored-by: gpt-oss:20b
jq '
{
  # -------- missing currentVersionTimestamp ----------
  missingCurrentVersionTimestamps: [
    .config
    | to_entries[] as $ent
    | $ent.value[] as $group
    | $group.deps[] as $dep
    | select($dep.currentVersionTimestamp == null)
    | {
        manager: $ent.key,
        depName: $dep.depName,
        packageFile: $group.packageFile,
        datasource: $dep.datasource,
        registryUrls: (
          ($dep.registryUrl? | if . != null then [.] else [] end)
          + ($dep.registryUrls // [])
        )
      }
  ],
  # -------- missing releaseTimestamp in updates ----------
  missingReleaseTimestamps: [
    .config
    | to_entries[] as $ent
    | $ent.value[] as $group
    | $group.deps[] as $dep
    | select(any($dep.updates[]?; .releaseTimestamp == null))
    | {
        manager: $ent.key,
        depName: $dep.depName,
        packageFile: $group.packageFile,
        datasource: $dep.datasource,
        registryUrls: (
          ($dep.registryUrl? | if . != null then [.] else [] end)
          + ($dep.registryUrls // [])
        ),
        missingUpdates: [
          $dep.updates[]?
          | select(.releaseTimestamp == null)
          | . + {
              dependencyCurrentVersionTimestamp: $dep.currentVersionTimestamp,
              datasource: $dep.datasource
            }
        ]
      }
  ]
}
' debug-log.txt
```

</details>

Will then output:

<details>

<summary><code>jq</code> query output</summary>

```json
{
  "missingCurrentVersionTimestamps": [
    {
      "manager": "dockerfile",
      "datasource": "docker",
      "depName": "ghcr.io/containerbase/devcontainer",
      "packageFile": ".devcontainer/Dockerfile",
      "registryUrls": ["https://ghcr.io"]
    },
    {
      "manager": "renovate-config-presets",
      "datasource": null,
      "depName": "renovatebot/.github",
      "packageFile": "renovate.json",
      "registryUrls": []
    },
    {
      "manager": "regex",
      "datasource": "docker",
      "depName": "ghcr.io/containerbase/sidecar",
      "packageFile": "lib/config/options/index.ts",
      "registryUrls": ["https://ghcr.io"]
    }
  ],
  "missingReleaseTimestamps": [
    {
      "manager": "dockerfile",
      "datasource": "docker",
      "depName": "ghcr.io/renovatebot/base-image",
      "packageFile": "tools/docker/Dockerfile",
      "registryUrls": ["https://ghcr.io"],
      "missingUpdates": [
        {
          "bucket": "major",
          "newVersion": "11.40.5",
          "newValue": "11.40.5",
          "newMajor": 11,
          "newMinor": 40,
          "newPatch": 5,
          "updateType": "major",
          "isBreaking": true,
          "newDigest": "sha256:81bbc8c8c561f6c4c2d059a5bcdfc95ef837682a41ac45bfbc1380d8d07dc941",
          "branchName": "renovate/main-ghcr.io-renovatebot-base-image-11.x",
          "dependencyCurrentVersionTimestamp": null,
          "dependencyDatasource": "docker"
        }
      ]
    },
    {
      "manager": "dockerfile",
      "datasource": "docker",
      "depName": "ghcr.io/renovatebot/base-image",
      "packageFile": "tools/docker/Dockerfile",
      "registryUrls": ["https://ghcr.io"],
      "missingUpdates": [
        {
          "bucket": "major",
          "newVersion": "11.40.5",
          "newValue": "11.40.5-full",
          "newMajor": 11,
          "newMinor": 40,
          "newPatch": 5,
          "updateType": "major",
          "isBreaking": true,
          "newDigest": "sha256:824737973a79d8c280f8ab1928017780fb936396dc83075a4f7770610eda37bd",
          "branchName": "renovate/main-ghcr.io-renovatebot-base-image-11.x",
          "dependencyCurrentVersionTimestamp": null,
          "dependencyDatasource": "docker"
        }
      ]
    },
    {
      "manager": "dockerfile",
      "datasource": "docker",
      "depName": "ghcr.io/renovatebot/base-image",
      "packageFile": "tools/docker/Dockerfile",
      "registryUrls": ["https://ghcr.io"],
      "missingUpdates": [
        {
          "bucket": "major",
          "newVersion": "11.40.5",
          "newValue": "11.40.5",
          "newMajor": 11,
          "newMinor": 40,
          "newPatch": 5,
          "updateType": "major",
          "isBreaking": true,
          "newDigest": "sha256:81bbc8c8c561f6c4c2d059a5bcdfc95ef837682a41ac45bfbc1380d8d07dc941",
          "branchName": "renovate/main-ghcr.io-renovatebot-base-image-11.x",
          "dependencyCurrentVersionTimestamp": null,
          "dependencyDatasource": "docker"
        }
      ]
    }
  ]
}
```

</details>

Notice that this indicates that:

- There are 3 dependencies that do not have a release timestamp, across different Managers and Datasources
- There are 3 dependency updates, where neither the dependency nor the dependency update itself have a release timestamp

### How do I add timestamp data to custom registries?

Renovate requires release timestamp to be provided by the registry.

A common solution is to point Renovate to a registry that _does_ have the release timestamp in the form that Renovate is expecting.
You can achieve this by using `packageRules` to **prepend** the public registry's URL to the `registryUrls`.

You can see exact examples below:

#### Maven datasource

For `minimumReleaseAge` to work, the Maven source must return reliable `last-modified` headers.

<!-- markdownlint-disable MD046 -->

If your custom Maven source registry is **pull-through** and does _not_ support the `last-modified` header, like GAR (Google Artifact Registry's Maven implementation) then you can extend the Maven source registry URL with `https://repo1.maven.org/maven2` as the first item. Then the `currentVersionTimestamp` via `last-modified` will be taken from Maven central for public dependencies.

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "packageRules": [
    {
      "matchDatasources": ["maven"],
      "registryUrls": [
        "https://repo1.maven.org/maven2",
        "https://europe-maven.pkg.dev/org-artifacts/maven-virtual"
      ]
    }
  ]
}
```

#### Pypi datasource

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "packageRules": [
    {
      "matchDatasources": ["pypi"],
      "registryUrls": [
        "https://pypi.org/pypi/",
        "https://custom-registry.example.com/pypi/some-repo/simple/"
      ]
    }
  ]
}
```
