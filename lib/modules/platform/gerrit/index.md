# Gerrit

## Authentication

First, ![HTTP access token](/assets/images/gerrit-http-password.png) for the bot account.

Let Renovate use your HTTP access token by doing _one_ of the following:

- Set your HTTP access token as a `password` in your `config.js` file
- Set your HTTP access token as an environment variable `RENOVATE_PASSWORD`
- Set your HTTP access token when you run Renovate in the CLI with `--password=`

Make sure this user is allowed to assign the Code-Review label with "+2" to his own changes or "automerge" can't work.

Remember to set `platform=gerrit` somewhere in your Renovate config file.

## Renovate PR/Branch-Model with Gerrit and needed Permissions

If you use the "Code-Review" label and want `automerge` working, then you have to enable `gerritAutoApprove=true` in your Renovate config.
In this case the bot will automatically add the _Code-Review_ label with the value "+2" to each created "pull-request" (Gerrit-Change).

_Important: The login should be allowed to give +2 for the Code-Review label._

The Renovate option `automergeType: "branch"` makes no sense for Gerrit, because there are no branches used.
It works similar to the default option `"pr"`.

## optional Features

The [StabilityDays](https://docs.renovatebot.com/configuration-options/#stabilitydays) feature can be used.
It needs only a corresponding Gerrit-Label (default `Renovate-Stability`) and the permission to set the min/max value.

There is no special Submit-Rule necessary to block submits for renovate usage, (i.e. can be _Trigger Votes_ only)
because Renovate will query the label and prevent `automerge` accordingly.

The same applies to the (upcoming beta?) feature [Merge-Confidence](https://docs.renovatebot.com/merge-confidence/).

The Gerrit-Label names can be configured in your Renovate config file:

```json
{
  "gerritLabelMapping": {
    "stabilityDaysLabel": "Renovate-StabilityDays",
    "mergeConfidenceLabel": "Renovate-Merge-Confidence"
  }
}
```

## TODOS

- Images in Markdown-Comments, needs [Gerrit-Feature](https://bugs.chromium.org/p/gerrit/issues/detail?id=2015)

## Unsupported platform features/concepts

- Creating issues (not a gerrit concept) / Renovate-Dashboard.
