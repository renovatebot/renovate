# Pre-release features

We try to only turn on features by default once we think they are well-tested and unlikely to cause anyone _problems_. Sometimes it's fine to enable a feature by default even if it's not "complete" so long as the functionality that does exist is reliable and useful as-is.

The below is a list of upcoming features with statuses, as well as info on how you can help test them.

As a general guide:

- Alpha: in need of additional testing
- Beta: almost ready for default enabling for everyone, but ideally needs a few more users running it in production giving it the thumbs-up
- Generally Available (GA): safe to enable by default for everyone

### Bitbucket Cloud

Status: beta

Bitbucket Cloud support (i.e. [https://bitbucket.org](https://bitbucket.org)) is still missing some nice-to-have features (reviewers, issues, etc) but none of these have to hold it back from being considered GA. Mostly, we'd just like to get some more feedback from users who have been testing it.

Note: we plan to add support for Bitbucket.org to the _hosted_ Renovate Bot _service_ that already supports GitHub.com and GitLab.com, so you won't need to run your own bot unless you want to.

How to use: run your own bot from npm, Docker or clone the repository. Follow the instructions from: [https://github.com/renovatebot/renovate/blob/master/docs/self-hosting.md#bitbucket-cloud](https://github.com/renovatebot/renovate/blob/master/docs/self-hosting.md#bitbucket-cloud).

### Bundler

Status: alpha

Bundler support is considered "alpha" because there's currently a PR underway to replace the initial JS-based parsing with a Ruby-based one. Perhaps your `Gemfile` works already though, in which case you can test out the other features.

How to use: Add `"bundler": { "enabled": true }` to either your bot config or your repository's `renovate.json`. If your repository contains _only_ Bundler package files and no others then you'll need to add the `renovate.json` manually as otherwise Renovate won't detect any package files by default and will skip the Onboarding PR.

### Gradle

Status: beta

Gradle support has been implemented but is undergoing a rewrite so that it relies less on third-party Gradle plugins and can take more control itself of things like stable/unstable and major/minor.

How to use: Add `"gradle": { "enabled": true }` to either your bot config or your repository's `renovate.json`. If your repository contains _only_ Gradle package files and no others then you'll need to add the `renovate.json` manually as otherwise Renovate won't detect any package files by default and will skip the Onboarding PR.

### Maven

Status: beta

Maven support has been implemented, initially supporting exact/pinned versions only, which should still be useful for hte majority of users who don't specify ranges in their `pom.xml` files.

How to use: Add `"maven": { "enabled": true }` to either your bot config or your repository's `renovate.json`. If your repository contains _only_ Maven package files and no others then you'll need to add the `renovate.json` manually as otherwise Renovate won't detect any package files by default and will skip the Onboarding PR.

### Pipenv

Status: beta

Pipenv support has been implemented awaits a bit more testing before being switched on by default.

How to use: Add `"pipenv": { "enabled": true }` to either your bot config or your repository's `renovate.json`. If your repository contains _only_ Pipenv package files and no others then you'll need to add the `renovate.json` manually as otherwise Renovate won't detect any package files by default and will skip the Onboarding PR.
