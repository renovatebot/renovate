---
title: Lock File Maintenance
description: Using Renovate to keep lock files up-to-date by recreating them periodically.
---

# Lock File Maintenance

Renovate's [`lockFileMaintenance`](../configuration-options.md#lockfilemaintenance) allows Renovate to periodically re-create package manager lockfiles.

When Renovate performs `lockFileMaintenance` it deletes the lock file and runs the relevant package manager.
That package manager creates a new lock file, where all dependency versions are updated to the latest version.
Renovate then commits that lock file to the update branch and creates the lock file update PR.

## What is Lock File Maintenance useful for?

- To update transitive dependencies
- To keep inexact versions in your configuration (for instance to use a `package.json` with `^1.2.3`), but keep the lockfile updated with the current resolved version of the dependency
  - This is related to, but different, to using [`rangeStrategy`](../configuration-options.md#rangestrategy)

## What is it not for?

- **??**
- Updating the inexact versions in your configuration (for instance to update `package.json`'s `^1.2.3` version to `^1.6.0`)

## What lock files are supported?

Renovate supports updating the following lock files:

<!-- lock-file-table-begin -->
<!-- lock-file-table-end -->

## FAQs

### What happens to transitive dependencies **??**?

Transitive dependencies will be updated using Lock File Maintenance.

Renovate does not handle transitive dependencies itself.
However, because Renovate delegates to package managers when executing Lock File Maintenance, they should be updated.

### Does Lock File Maintenance work with Minimum Release Age?

No, because Renovate delegates to the package manager to perform the updates, Renovate's understanding of Minimum Release Age [is not taken into account with Lock File Maintenance](./minimum-release-age/#which-update-types-take-minimumreleaseage-into-account).

In the future, [Renovate will delegate this information to package managers that support this check](https://github.com/renovatebot/renovate/issues/41652).

### Can I group Lock File Maintenance **??**?

Lock File Maintenance PRs cannot be grouped with other updates.

However, you can use groups to separate out distinct Lock File Maintenance PRs, for instance one per package manager, or based on directories in your repository.

### Why am I not receiving PRs?

**??**

If you're still unsure, [raise a "Request Help" Discussion](https://github.com/renovatebot/renovate/discussions/new?category=request-help) **??**

#### Self-hosted **??**

If you're running self-hosted, it might be worth **??** https://github.com/renovatebot/renovate/issues/40777#issuecomment-4024430413

### Why is the update showing as `no-work`?

If you see **??**:

```json
DEBUG: branches info extended
{
  "branchesInformation": [
    {
      "branchName": "renovate/main-lock-file-maintenance",
      "prNo": null,
      "prTitle": "chore(deps): lock file maintenance (main)",
      "result": "no-work",
      "upgrades": [
        {
          "displayPending": "",
          "packageFile": "pyproject.toml",
          "updateType": "lockFileMaintenance"
        },
        {
          "displayPending": "",
          "packageFile": "pnpm-workspace.yaml",
          "updateType": "lockFileMaintenance"
        },
        {
          "displayPending": "",
          "packageFile": "package.json",
          "updateType": "lockFileMaintenance"
        }
      ]
    },
  ]
}
```

This means that there is **??**.

### **??**

---

You can use `lockFileMaintenance` to refresh lock files to keep them up-to-date.

When Renovate performs `lockFileMaintenance` it deletes the lock file and runs the relevant package manager.
That package manager creates a new lock file, where all dependency versions are updated to the latest version.
Renovate then commits that lock file to the update branch and creates the lock file update PR.

Support for new lock files may be added via feature request.

By default, `lockFileMaintenance` is disabled.
To enable `lockFileMaintenance` add this to your configuration:

```json
{
  "lockFileMaintenance": { "enabled": true }
}
```

To reduce "noise" in the repository, Renovate performs `lockFileMaintenance` `"before 4am on monday"`, i.e. to achieve once-per-week semantics.
Depending on its running schedule, Renovate may run a few times within that time window - even possibly updating the lock file more than once - but it hopefully leaves enough time for tests to run and automerge to apply, if configured.

Renove **??**
