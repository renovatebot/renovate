# Minimum Release Age

## What is Minimum Release Age?

`minimumReleaseAge` is a feature to require Renovate to wait for an amount of time before suggesting a dependency update.

If `minimumReleaseAge` is set to a time duration _and_ the update has a release timestamp header, then Renovate will check if the set duration has passed.

The use of `minimumReleaseAge` is not to slow down fast releasing project updates, but to provide a means to reduce risk supply chain security risks.

For example, `minimumReleaseAge=14 days` would ensure that a package update is not suggested by Renovate until 14 days after its release, which allows plenty of time to be scanned by malware scanners.

Note: Renovate will wait for the set duration to pass for each **separate** version.
Renovate does not wait until the package has seen no releases for x time-duration(`minimumReleaseAge`).

When the time passed since the release is _less_ than the set `minimumReleaseAge`: Renovate adds a "pending" status check to that update's branch.
After enough days have passed: Renovate replaces the "pending" status with a "passing" status check.

## Configuration options

The following configuration options can be used to enable and tune the functionality of Minimum Release Age:

- [`minimumReleaseAge`](./configuration-options.md#minimumreleaseage)
- [`minimumReleaseAgeBehaviour`](./configuration-options.md#minimumreleaseagebehaviour)
- [`internalChecksFilter`](./configuration-options.md#internalchecksfilter)

## FAQs

### What happens if the Datasource and/or registry does not provide a release timestamp, when using `minimumReleaseAge`?

<!-- prettier-ignore -->
!!! warning
    Renovate 42 [will change](https://github.com/renovatebot/renovate/discussions/38841) the behaviour detailed below.
    In Renovate 42, the absence of a release timestamp will be treated as if the release is not yet past the timestamp, which provides a safer default.
    Until Renovate 42, you can opt into this behaviour using [`minimumReleaseAgeBehaviour=timestamp-required`](./configuration-options.md#minimumreleaseagebehaviour) (added in 41.150.0)

Consider that:

- we have set `minimumReleaseAge` to apply to a given dependency
- that dependency has 3 updates available
  - 2 of which have a release timestamp that has not yet passed
  - 1 of which does not have a release timestamp

The current behaviour in Renovate is that we will treat the dependency without a release timestamp **as if it has passed** the `minimumReleaseAge`, and will **immediately suggest that dependency update**.

<!-- prettier-ignore -->
!!! warning
    This is counter-intuitive behaviour.

### What happens when an update is not yet passing the minimum release age checks?

If an update is pending the minimum release age checks, it will be found under the Dependency Dashboard in the "Pending Status Checks".

You can force the dependency update by requesting it via the Dependency Dashboard, or if you are self-hosting, you can use the [`checkedBranches`](https://docs.renovatebot.com/self-hosted-configuration/#checkedbranches) to force the branch creation.

### Which datasources support release timestamps?

The datasource that Renovate uses must have a release timestamp for the `minimumReleaseAge` config option to work.
Some datasources may have a release timestamp, but in a format Renovate does not support.
In those cases a feature request needs to be implemented.

You can confirm if your datasource supports the release timestamp by viewing [the documentation for the given datasource](./modules/datasource/index.md).

Note that you will also need to [verify if the registry you're using](#which-registries-support-release-timestamps) provides the release timestamp.

### Which registries support release timestamps?

We do not currently have an exhaustive list of registries which support release timestamps.

If you use a custom registry, for instance as a pull-through cache, [additional configuration may be required](#how-do-i-add-timestamp-data-to-custom-registries).

However, is _likely_ that if you are using a public registry (i.e. `registry.npmjs.org`, `repo1.maven.org`, etc) the release timestamp data will be present.

If you are using a custom registry, or unsure about a public registry, you can confirm this using Renovate's debug logs by looking for the `packageFiles with updates` debug log line, which may contain a `releaseTimestamp` field in dependency updates:

<details>

<summary><code>packageFiles with updates</code> debug log example</summary>

```jsonc
DEBUG: packageFiles with updates
{
  "baseBranch": "main"
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
          // NOTE that we do get a release timestamp for this GitHub Action major version bump but we do for this
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

#### Maven Datasource

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

#### Pypi Datasource

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
