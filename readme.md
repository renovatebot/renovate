![Renovate banner](https://renovateapp.com/images/design/header_small.jpg)

# Renovate

Automated dependency updates. Flexible, so you don't need to be.

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/renovateapp/renovate/master/license)
[![codecov](https://codecov.io/gh/renovateapp/renovate/branch/master/graph/badge.svg)](https://codecov.io/gh/renovateapp/renovate)
[![Join the chat at https://gitter.im/renovate-app/Lobby](https://badges.gitter.im/renovate-app/Lobby.svg)](https://gitter.im/renovate-app/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)

## Why Use Renovate?

* Receive automated Pull Requests whenever dependencies need updating. Or whenever you schedule it for.
* Renovate discovers and processes all dependency files in a repository (e.g. supports
  monorepo architecture such as lerna or yarn workspaces)
* Extremely customisable behaviour via configuration files or within your `package.json`
* Use eslint-like shared config presets for ease of use and simplifying configuration
* Update lock files natively in the same commit, including immediately resolving conflicts whenever PRs are merged
* Supports GitHub, GitLab (APIv4) and VSTS. BitBucket is a WIP.
* Open source (installable via npm/yarn) so can be self-hosted or used for free via GitHub App

## Who Uses Renovate?

Renovate was released in 2017 and is now widely used in the developer community. Example users include the following GitHub organisations:

[<img align="left" src="https://avatars1.githubusercontent.com/u/2034458?s=80&v=4" alt="algolia" title="algolia" hspace="10"/>](https://github.com/algolia)
[<img align="left" src="https://avatars0.githubusercontent.com/u/139426?s=80&v=4" alt="angular" title="angular" hspace="10"/>](https://github.com/angular)
[<img align="left" src="https://avatars2.githubusercontent.com/u/131524?s=80&v=4" alt="mozilla" title="mozilla" hspace="10"/>](https://github.com/mozilla)
[<img align="left" src="https://avatars2.githubusercontent.com/u/33676472?s=80&v=4" alt="uber-workflow" title="uber-workflow" hspace="10"/>](https://github.com/uber-workflow)
[<img align="left" src="https://avatars1.githubusercontent.com/u/22247014?s=80&v=4" alt="yarnpkg" title="yarnpkg" hspace="10"/>](https://github.com/yarnpkg)

<br /><br /><br /><br /><br />

## The Renovate Approach

* Everyone can benefit from automation, whether it's a little or a lot
* Renovate should not cause you to change your workflow against your wishes - don't enforce opinions on users
* All behaviour should be configurable, down to a ridiculous level if desired
* Autodetect settings wherever possible (to minimise configuration) but always allow overrides

## Using Renovate

The easiest way to use Renovate if you are on GitHub is to use the Renovate app. Go to
[https://github.com/apps/renovate](https://github.com/apps/renovate) to install
it now.

## Configuration

The
[Configuration](https://github.com/renovateapp/renovate/blob/master/docs/configuration.md)
and
[Configuration FAQ](https://github.com/renovateapp/renovate/blob/master/docs/faq.md)
documents should be helpful.

You can also raise an issue in https://github.com/renovateapp/config-help if
you'd like to get your config reviewed or ask any questions.

## Self-Hosting

If you are not on GitHub or you prefer to run your own copy of Renovate, then it takes only seconds to set up. Please see [docs/self-hosting.md](https://github.com/renovateapp/renovate/blob/master/docs/self-hosting.md) for instructions.

## Contributing

If you would like to contribute to Renovate or get a local copy running for some other reason, please see the instructions in [contributing.md](contributing.md).

## Security / Disclosure

If you discover any important bug with Renovate that may pose a security problem, please disclose it confidentially to security@renovateapp.com first, so that it can be assessed and hopefully fixed prior to being exploited. Please do not raise GitHub issues for security-related doubts or problems.
