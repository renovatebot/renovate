![Renovate banner](https://renovateapp.com/images/design/header_small.jpg)

# renovate

Automated dependency updates, for humans.

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/renovateapp/renovate/master/license)
[![codecov](https://codecov.io/gh/renovateapp/renovate/branch/master/graph/badge.svg)](https://codecov.io/gh/renovateapp/renovate)
[![Join the chat at https://gitter.im/renovate-app/Lobby](https://badges.gitter.im/renovate-app/Lobby.svg)](https://gitter.im/renovate-app/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![David](https://david-dm.org/renovateapp/renovate.svg)](https://david-dm.org/renovateapp/renovate)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)

## Why

* Receive automated Pull Requests whenever dependencies need updating. Or whenever you schedule it for.
* Discovers and processes all dependency files in a repository (e.g. supports
  monorepo architecture including yarn workspaces)
* Fully customisable behaviour via configuration files or within `package.json`
* Supports eslint-like config presets for ease of use
* Updates `yarn.lock` and `package-lock.json` lock files natively, including immediately recreating if conflicts emerge
* Supports GitHub, GitLab (APIv4) and VSTS (BitBucket is a WIP)
* Open source (installable via npm/yarn) so can be self-hosted or used for free via GitHub App

## The Renovate Approach

* Bots should serve humans, not the other way around. Using Renovate should not cause you to change your workflow against your wishes
* All behaviour should be configurable, down to a ridiculous level if desired
* Autodetect settings wherever possible (to minimise configuration) but always allow overrides

## Using Renovate

The easiest way to use Renovate if you are on GitHub is to enable the free Renovate app. Go to
[https://github.com/apps/renovate](https://github.com/apps/renovate) to enable
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
