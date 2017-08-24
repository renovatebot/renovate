# Status Checks

## unpublish-safe

Renovate includes a status showing whether upgrades are "unpublish-safe". This is because [packages less than 24 hours old may be unpublished by their authors](https://docs.npmjs.com/cli/unpublish). We recommend you wait for this status check to pass before merging unless the upgrade is urgent, otherwise you may find that packages simply disappear from the npm registry, breaking your build.

If you would like to disable this status check, add `"unpublishSafe": false` to your config.

If you would like to delay creation of Pull Requests until after this check passes, then add `"prCreation": "not-pending"` to your config. This way the PR will only be created once the upgrades in the branch are at least 24 hours old because Renovate sets the status check to "pending" in the meantime.

## lock-file

Renovate adds a `renovate/lock-file=failure` status check to a branch if it failed to generate a lock file (`package-lock.json` or `yarn.lock`);
Previously, Renovate would just skip over such branches/PRs if the lock file could not be generated, but this meant that users of the repository were not alerted that there was a lock file problem preventing updates.

Usually lock file generation problems are caused by lack of credentials, e.g.

-   Use of private npm modules without providing Renovate with npm credentials
-   Use of private github repositories without credentials

Although the status check is marked as failed, you may still of course merge the PR - it's recommended you update the lock file manually first though. Renovate won't attempt to update the lock file again unless the `package.json` dependencies in the branch are updated.

Alternatively, if you fix the authentication problem or wish for Renovate to retry anyway, you need to do the following:

1. Rename the PR to anything (e.g. add a `-` or any other text to its title)
2. Close PR unmerged
3. Delete the branch

Renovate will then attempt to recreate the same PR the next time it runs. There's no limit to how many times you can do this, but be careful to follow the above instructions carefully each time as otherwise Renovate will assume that you wish the PR to remain closed.

If you are unsure why your lock file updates are failing, feel free to raise an issue in this repository to ask for help.
