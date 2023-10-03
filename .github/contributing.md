# Contributing to Renovate

Thank you for considering contributing to our Renovate App. Your help is greatly appreciated! This guide will help you get started and ensure that your contributions are effective.

## Getting Started

### Prerequisites

Before you start contributing, ensure you have the following:

- **Node.js**: You need Node.js (v18 or higher) installed. [Download Node.js](https://nodejs.org/).

- **Git**: Make sure you have Git installed. [Download Git](https://git-scm.com/).

- **GitHub Account**: You'll need a GitHub account to make contributions.

### Setting up the development environment

1. **Fork the Repository**: Click the "Fork" button on the top right of the GitHub repository page. This creates a copy of the repository in your GitHub account.

2. **Clone Your Fork**: Clone the forked repository to your local machine:

   ```bash
   git clone https://github.com/your-username/renovate.git

3. **Navigate to the Project Directory**:
   ```bash
   cd renovate

4. **Install Dependencies: Install the project dependencies:**
   ```bash
   pnpm install

5. **Start the Local Development Server:**
   tO setup your local workstation correctly read [docs/development/local-development.md](../docs/development/local-development.md).

## Submitting Changes

1. **Create a New Branch: Create a new branch for your changes:**
   ```bash
   git checkout -b feature/my-feature

2. **git add :**
   ```bash
      git add .


3. **Make and Commit Changes:** Make your changes and commit them with descriptive messages.
   ```bash
      git commit -m "your-feature-message"


4. **Push Changes:** Push your changes to your GitHub fork:
   ```bash
   git push origin feature/my-feature

5. **Open a Pull Request:** Open a pull request on the main repository with a clear title and description of your changes.

## Review Process

The maintainers will review your pull request and may request changes or provide feedback.

Once your changes are approved, they will be merged into the main branch.

## Security / Disclosure

If you find any bug with Renovate that may be a security problem, then e-mail us at: [renovate-disclosure@mend.io](mailto:renovate-disclosure@mend.io).
This way we can evaluate the bug and hopefully fix it before it gets abused.
Please give us enough time to investigate the bug before you report it anywhere else.

Please do not create GitHub issues for security-related doubts or problems.

## Support

If you want help with your Renovate configuration, go to the [discussions tab in the Renovate repository](https://github.com/renovatebot/renovate/discussions) and open a new "config help" discussion post.

## Bug Reports and Feature Requests

**Bugs**: First search for related bugs in the issues and discussions, if you don't find anything then:

1. Create a [minimal reproduction](https://github.com/renovatebot/renovate/blob/main/docs/development/minimal-reproductions.md)
1. Open a new _discussion_ and link to the minimal reproduction

For **feature requests**: first search for related requests in the issues and discussions, if you don't find anything: create a _discussion_.

## Code

If you would like to fix a bug or work on a feature, please fork the repository and create a Pull Request.
To learn how to setup your local workstation correctly read [docs/development/local-development.md](../docs/development/local-development.md).
Also skim the [docs/development](../docs/development/) folder, it has a lot of helpful information on things like adding a new package manager, how Renovate branches work, design decisions and more.

Before you start any Pull Request, it's recommended that you open a [discussion](https://github.com/renovatebot/renovate/discussions) first if you have any doubts about requirements or implementation.
That way you can be sure that the maintainer(s) agree on what to change and how, and you can hopefully get a quick merge afterwards.
Also, let the maintainers know that you plan to work on a particular issue so that no one else starts any duplicate work.

Pull Requests can only be merged once all status checks are green, which means `pnpm test` passes, and coverage is 100%.

## Do not force push to your pull request branch

Please do not force push to your PR's branch after you have created your PR, as doing so forces us to review the whole PR again.
This makes it harder for us to review your work because we don't know what has changed.
PRs will always be squashed by us when we merge your work.
Commit as many times as you need in your pull request branch.

If you're updating your PR branch from within the GitHub PR interface, use the default "Update branch" button.
This is the "Update with merge commit" option in the dropdown.

Force pushing a PR, or using the "Update with rebase" button is OK when you:

- make large changes on a PR which require a full review anyway
- bring the branch up-to-date with the target branch and incorporating the changes is more work than to create a new PR

## Apply maintainer provided review suggestions

Maintainers can suggest changes while reviewing your pull request, please follow these steps to apply them:

1. Batch the suggestions into a logical group by selecting the **Add suggestion to batch** button
1. Select the **Commit suggestions** button

Read the [GitHub docs, Applying suggested changes](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/incorporating-feedback-in-your-pull-request#applying-suggested-changes) to learn more.

## Resolve review comments instead of commenting

A maintainer/contributor can ask you to make changes, without giving you a _suggestion_ that you can apply.
In this case you should make the necessary changes.

Once you've done the work, resolve the conversation by selecting the **Resolve conversation** button in the PR overview.
Avoid posting comments like "I've done the work", or "Done".

Read the [GitHub Docs, resolving conversations](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request#resolving-conversations) to learn more.

## Re-requesting a review

Please do not ping your reviewer(s) by mentioning them in a new comment.
Instead, use the re-request review functionality.
Read more about this in the [GitHub docs, Re-requesting a review](https://docs.github.com/en/free-pro-team@latest/github/collaborating-with-issues-and-pull-requests/incorporating-feedback-in-your-pull-request#re-requesting-a-review).

## Slack collaboration with maintainers

The codebase can be difficult to navigate, especially for a first-time contributor.
We don't want you spending an hour trying to work out something that would take us only a minute to explain.

For that reason, we have a Slack channel dedicated to helping anyone who's working on or considering Pull Requests for Renovate.
Please email <rhys@arkins.net> and simply mention that you need an invitation to the channel and you'll be added ASAP.

Important: this Slack group is restricted to development questions only in order to keep the volume of messages lower - all technical support questions should still be posted to this repository's Discussions instead.

## Legal

Pull Request authors must sign the [Renovate CLA](https://cla-assistant.io/renovateapp/renovate).

If you cannot or do not want to sign this CLA (e.g. your employment contract for your employer may not allow this), you should not submit a PR.
Open an issue and someone else can do the work.
