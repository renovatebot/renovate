# Contributing

## Security

If you think you've found a **security issue**, please do not mention it in this repository.
Instead, email renovate-disclosure@whitesourcesoftware.com with as much details as possible so that it can be handled confidentially.

## Support

If you want help with your Renovate configuration, go to the [discussions tab in the Renovate repository](https://github.com/renovatebot/renovate/discussions) and open a new "config help" discussion post.

## Bug Reports and Feature Requests

If you've found a **bug** or have a **feature request** then please create an issue in this repository (but search first in case a similar issue already exists).

## Code

If you would like to fix a bug or implement a feature, please fork the repository and create a Pull Request.
More information on getting set up locally can be found in [docs/development/local-development.md](https://github.com/renovatebot/renovate/blob/master/docs/development/local-development.md).

Before you start any Pull Request, it's recommended that you create an issue to discuss first if you have any doubts about requirement or implementation.
That way you can be sure that the maintainer(s) agree on what to change and how, and you can hopefully get a quick merge afterwards.
Also, let the maintainers know that you plan to work on a particular issue so that no one else starts any duplicate work.

Pull Requests can only be merged once all status checks are green, which means `yarn test` passes, and coverage is 100%.

## Do not force push to your pull request branch

Please do not force push to your PR's branch after you have created your PR, as doing so forces us to review the whole PR again.
This makes it harder for us to review your work because we don't know what has changed.
PRs will always be squashed by us when we merge your work.
Commit as many times as you need in your pull request branch.

Force pushing a PR is OK when:

- you need to make large changes on a PR which require a full review anyway
- you need to bring the branch up-to-date with the default branch and incorporating the changes is more work than to create a new PR

## Re-requesting a review

Please do not ping your reviewer(s) by mentioning them in a new comment.
Instead, use the re-request review functionality.
Read more about this in the [GitHub docs, Re-requesting a review](https://docs.github.com/en/free-pro-team@latest/github/collaborating-with-issues-and-pull-requests/incorporating-feedback-in-your-pull-request#re-requesting-a-review).

## Slack collaboration with maintainers

Sometimes the codebase can be a challenge to navigate, especially for a first-time contributor.
We don't want you spending an hour trying to work out something that would take us only a minute to explain.

For that reason, we have a Slack channel dedicated to helping anyone who's working on or considering Pull Requests for Renovate.
Please email rhys@arkins.net and simply mention that you need an invitation to the channel and you'll be added ASAP.

## Legal

Pull Request authors must sign the [Renovate CLA](https://cla-assistant.io/renovateapp/renovate).

If you cannot or do not want to sign this CLA (e.g. your employment contract for your employer may not allow this), you should not submit a PR.
Open an issue and someone else can do the work.
