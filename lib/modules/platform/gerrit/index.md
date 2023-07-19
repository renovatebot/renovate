# Gerrit

## Supported Gerrit Versions

All Gerrit 3.x Versions should be working.

The current implementation uses the "hashtags" Feature from Gerrit and therefore needs a Gerrit version with [NoteDB](https://gerrit-review.googlesource.com/Documentation/note-db.html) backend.
Gerrit 2.x with NoteDB (available only in 2.15 and 2.16 only) are untested but could work too.

## Authentication

<figure markdown>
  ![Gerrit HTTP access token](/assets/images/gerrit-http-password.png){ loading=lazy }
  <figcaption>First, create a HTTP access token for the Renovate account.</figcaption>
</figure>

Let Renovate use your HTTP access token by doing _one_ of the following:

- Set your HTTP access token as a `password` in your `config.js` file
- Set your HTTP access token as an environment variable `RENOVATE_PASSWORD`
- Set your HTTP access token when you run Renovate in the CLI with `--password=`

Make sure this user is allowed to assign the Code-Review label with "+2" to their own changes or "automerge" can't work.

Remember to set `platform=gerrit` somewhere in your Renovate config file.

## Renovate PR/Branch-Model with Gerrit and needed Permissions

If you use the "Code-Review" label and want `automerge` working, then you have to enable `autoApprove=true` in your Renovate config.
In this case Renovate will automatically add the _Code-Review_ label with the value "+2" to each created "pull-request" (Gerrit-Change).

<!-- prettier-ignore -->
!!! note
    The login must be allowed to give +2 for the Code-Review label.

The Renovate option `automergeType: "branch"` makes no sense for Gerrit, because there are no branches used.
It works similar to the default option `"pr"`.

## Optional Features

The [`minimumReleaseAge`](https://docs.renovatebot.com/configuration-options/#minimumreleaseage) feature can be used.
It needs only a corresponding Gerrit-Label (default `Renovate-Stability`) and the permission to set the min/max value.

You don't need a special Submit-Rule to block submits for Renovate usage (i.e. can be _Trigger Votes_ only).
This is because Renovate will query the label and prevent `automerge` accordingly.

The same applies to the [Merge Confidence feature](https://docs.renovatebot.com/merge-confidence/).

The Gerrit-Label names can be configured in your Renovate config file:

```json
{
  "gerritLabelMapping": {
    "minimumReleaseAgeLabel": "Renovate-MinimumReleaseAge",
    "mergeConfidenceLabel": "Renovate-Merge-Confidence"
  }
}
```

## TODOS

- Images in Markdown comments, needs [Gerrit-Feature](https://bugs.chromium.org/p/gerrit/issues/detail?id=2015)

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
