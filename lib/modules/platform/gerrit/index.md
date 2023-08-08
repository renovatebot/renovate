# Gerrit

## Supported Gerrit Versions

All Gerrit 3.x Versions should be working.

The current implementation uses the "hashtags" Feature from Gerrit and therefore needs a Gerrit version with [NoteDB](https://gerrit-review.googlesource.com/Documentation/note-db.html) backend.
Gerrit `2.x` with NoteDB (only in `2.15` and `2.16`) is not tested, but could work.

## Authentication

<figure markdown>
  ![Gerrit HTTP access token](/assets/images/gerrit-http-password.png){ loading=lazy }
  <figcaption>First, create a HTTP access token for the Renovate account.</figcaption>
</figure>

Let Renovate use your HTTP access token by doing _one_ of the following:

- Set your HTTP access token as a `password` in your `config.js` file
- Set your HTTP access token as an environment variable `RENOVATE_PASSWORD`
- Set your HTTP access token when you run Renovate in the CLI with `--password=`

This user must be allowed to assign the Code-Review label with "+2" to their own changes for "automerge" to work.

Remember to set `platform=gerrit` somewhere in your Renovate config file.

## Renovate PR/Branch-Model with Gerrit and needed Permissions

If you use the "Code-Review" label and want `automerge` working: you must set `autoApprove=true` in your Renovate config.
Renovate will now add the _Code-Review_ label with the value "+2" to each of its "pull requests" (Gerrit-Change).

<!-- prettier-ignore -->
!!! note
    The login must be allowed to give +2 for the Code-Review label.

The Renovate option `automergeType: "branch"` makes no sense for Gerrit, because there are no branches used.
It works similar to the default option `"pr"`.

## Optional features

The [Merge Confidence](https://docs.renovatebot.com/merge-confidence/) feature can be used.
It needs only a corresponding Gerrit-Label and the permission to set the min/max value.

You must set a label, for Renovate to pass the information to the Gerrit changes.

```json
{
  "gerritLabelMapping": {
    "mergeConfidenceLabel": "Renovate-Merge-Confidence"
  }
}
```

You don't need a special Submit-Rule to block submits for Renovate usage (i.e. can be _Trigger Votes_ only).
This is because Renovate will query the label and prevent `automerge` accordingly.

## Unsupported platform features/concepts

- Creating issues (not a Gerrit concept)
- Dependency Dashboard (needs issues first)

## Known problems

### PR-title doesn't match first commit-msg line

Sometimes the pull-request title parameter to `platform.createPr(...)/updatePr(...)` is different from the first line of the commit message.
For example:

Commit-Message=`Update keycloak.version to v21` \
Pull-Request-Title=`Update keycloak.version to v21 (major)`

In this case the Gerrit-Platform implementation tries to detect this and change the commit-message on a second patch-set.
