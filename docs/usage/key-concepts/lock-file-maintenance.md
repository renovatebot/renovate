---
title: Lock File Maintenance
description: Using Renovate to keep lock files up-to-date by recreating them periodically.
---

# Lock File Maintenance

Renovate's [`lockFileMaintenance`](../configuration-options.md#lockfilemaintenance) allows Renovate to periodically re-create package manager lockfiles.

When Renovate performs `lockFileMaintenance` it deletes the lock file and runs the relevant package manager.
That package manager creates a new lock file, where all dependency versions are updated to the latest version.
Renovate then commits that lock file to the update branch and creates the lock file update PR.

## Waht **??**

## Waht is not for?

## What lock files are supported?

Renovate supports updating **??** with the following **??**:

<!-- lock-file-table-begin -->
<!-- lock-file-table-end -->

## FAQs

### What happens to transitive dependencies **??**?

<!-- prettier-ignore -->
!!! note
    Renovate does not handle transitive dependencies itself.
    <br> <br>
    Therefore **??**

### Does Lock File Maintenance work with Minimum Release Age?

No, because Renovate delegates to the package manager to perform the updates, Renovate's understanding of Minimum Release Age [is not taken into account with Lock File Maintenance](./minimum-release-age/#which-update-types-take-minimumreleaseage-into-account).

In the future, [Renovate will delegate this information to package managers that support this check](https://github.com/renovatebot/renovate/issues/41652).

### Can I group Lock File Maintenance **??**?

Lock File Maintenance PRs cannot be grouped with other updates.

However, you can use groups to separate out distinct Lock File Maintenance PRs, for instance one per package manager, or based on directories in your repository.

### Why am I not receiving PRs?

**??**

If you're still unsure, [raise a "Request Help" Discussion](https://github.com/renovatebot/renovate/discussions/new?category=request-help) **??**

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

## Transitive dependencies

Renovate intentionally **??**does not
