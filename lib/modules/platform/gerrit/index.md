# Gerrit

## Supported Gerrit versions

Renovate supports all Gerrit 3.x versions.
Support for Gerrit is currently _experimental_, meaning that it _might_ still have some undiscovered bugs or design limitations, and that we _might_ need to change functionality in a non-backwards compatible manner in a non-major release.

The current implementation uses Gerrit's "hashtags" feature.
Therefore you must use a Gerrit version that uses the [NoteDB](https://gerrit-review.googlesource.com/Documentation/note-db.html) backend.
We did not test Gerrit `2.x` with NoteDB (only in `2.15` and `2.16`), but could work.

## Authentication

<figure markdown>
  ![Gerrit HTTP access token](/assets/images/gerrit-http-password.png){ loading=lazy }
  <figcaption>First, create a HTTP access token for the Renovate account.</figcaption>
</figure>

Let Renovate use your HTTP access token by doing _one_ of the following:

- Set your HTTP access token as a `password` in your `config.js` file, or
- Set your HTTP access token as an environment variable `RENOVATE_PASSWORD`, or
- Set your HTTP access token when you run Renovate in the CLI with `--password=`

The Gerrit user account must be allowed to assign the Code-Review label with "+2" to their own changes for "automerge" to work.

You must set `platform=gerrit` in your Renovate config file.

## Renovate PR/Branch-Model with Gerrit and needed permissions

If you use the "Code-Review" label and want to get `automerge` working then you must set `autoApprove=true` in your Renovate config.
Renovate will now add the _Code-Review_ label with the value "+2" to each of its "pull requests" (Gerrit-Change).

<!-- prettier-ignore -->
!!! note
    The bot's user account must have permission to give +2 for the Code-Review label.

The Renovate option `automergeType: "branch"` makes no sense for Gerrit, because there are no branches used to create pull requests.
It works similar to the default option `"pr"`.

## Optional features

You can use the `statusCheckNames` configuration to map any of the available branch checks (like `minimumReleaseAge`, `mergeConfidence`, and so on) to a Gerrit label.

For example, if you want to use the [Merge Confidence](https://docs.renovatebot.com/merge-confidence/) feature and map the result of the Merge Confidence check to your Gerrit label "Renovate-Merge-Confidence" you can configure:

```json
{
  "statusCheckNames": {
    "mergeConfidence": "Renovate-Merge-Confidence"
  }
}
```

## Unsupported platform features/concepts

- Creating issues (not a Gerrit concept)
- Dependency Dashboard (needs issues first)

## Known problems

### PR title is different from first commit message

Sometimes the PR title passed to the Gerrit platform code is different from the first line of the commit message.
For example:

Commit-Message=`Update keycloak.version to v21` \
Pull-Request-Title=`Update keycloak.version to v21 (major)`

In this case the Gerrit-Platform implementation tries to detect this and change the commit-message in a second patch-set.
