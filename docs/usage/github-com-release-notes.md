---
title: Configuring a Token for GitHub.com-hosted Release Notes
description: How to ensure Renovate can fetch release notes from github.com
---

# Configuring a Token for GitHub.com-hosted Release Notes

Renovate needs credentials configured in order to be able to fetch release notes from github.com repositories.

If you are already running Renovate against a github.com repository (e.g. you use the WhiteSource Renovate GitHub app, or you use self-hosted Renovate against github.com) then Renovate will already have the credentials it needs and you need to take no further action.

## Why the Token is Required

Although open source repositories are public, GitHub's API applies strict rate limiting to unauthenticated requests, so Renovate will not attempt to fetch unless it can detect a token. To fetch without a token would risk getting requests denied, which could in turn result in confusing inconsistencies in Pull or Merge Requests, including bodies which flip flop between release notes and none.

## Generate a Personal Access Token

Any read-only, public-only Personal Access Token for github.com will work.

While logged in, go to [https://github.com/settings/tokens/new](https://github.com/settings/tokens/new). Add a note like "renovate release notes" and then generate the token - no further permissions are required.

## Self-hosted Renovate users

If you are using the self-hosted Renovate OSS CLI or WhiteSource Renovate On-Prem (ex-Renovate Pro), and you use GitLab, GitHub Enterprise, Bitbucket or Azure DevOps, then you will need to configure a token for GitHub.com.

The easiest way to do this is to set it in `GITHUB_COM_TOKEN` in env.

## WhiteSource Renovate App users (gitlab.com)

Never expose your token in a public repository, as GitHub will detect this and revoke it anyway. If you use the hosted WhiteSource Renovate app for GitLab.com, visit [https://renovatebot.com/encrypt](https://renovatebot.com/encrypt), paste your token into "Raw value", and then click "Encrypt". Configure the resulting value into your renovate config or preset like this:

```json
{
  "hostRules": [
    {
      "domainName": "github.com",
      "encrypted": {
        "token": "zmWY1ucZFj8wS0ap5ahQluho8aVJBVfyM9LTJ5fCV3Cl6Ys9ml+ZnsQMABKPPGbDoXhhy/REokuho8aVJBVfyM9LTJ5fCV3Cl6Ys9ml+ZnsQMABKPPGbDoXhhy/REokQRS7sFhwTPwpRC9+DyWUgYYO28/kCmw+/8wNupIY1C+rSVSGc4PxV7y2YYd/Ef1jTEVJR+LUrGYuzpJxPuo6ai2wbUCFtx0Z43lH24aDql9btupxYAWNP3RVR6bAp6rA9YGESeD6YTDVvn5czGpvUnIOryxEkigoDcEYmIXFm9Y6F4DLXpLOQ=="
      }
    }
  ]
}
```
