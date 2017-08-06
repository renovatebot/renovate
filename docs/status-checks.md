# Status Checks

## unpublish-safe

Renovate includes a status showing whether upgrades are "unpublish-safe". This is because [packages less than 24 hours old may be unpublished by their authors](https://docs.npmjs.com/cli/unpublish). We recommend you wait for this status check to pass before merging unless the upgrade is urgent, otherwise you may find that packages simply disappear from the npm registry, breaking your build.

If you would like to disable this status check, add `"unpublishSafe": false` to your config.

If you would like to delay creation of Pull Requests until after this check passes, then add `"prCreation": "not-pending"` to your config. This way the PR will only be created once the upgrades in the branch are at least 24 hours old because Renovate sets the status check to "pending" in the meantime.
