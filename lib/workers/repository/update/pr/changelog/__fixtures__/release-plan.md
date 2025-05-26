# release-plan Changelog

## Release (2025-03-13)

* release-plan 0.16.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#155](https://github.com/embroider-build/release-plan/pull/155) add ability to set tag per package

## Release (2025-03-03)

* release-plan 0.15.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#158](https://github.com/embroider-build/release-plan/pull/158) feat: Display new package versions as list

#### :house: Internal
* `release-plan`
  * [#153](https://github.com/embroider-build/release-plan/pull/153) move publish test to mock execa

## Release (2025-03-03)

release-plan 0.14.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#131](https://github.com/embroider-build/release-plan/pull/131) add skip npm option
  * [#133](https://github.com/embroider-build/release-plan/pull/133) update execa
  * [#124](https://github.com/embroider-build/release-plan/pull/124) support github enterprise api url via env var

#### :bug: Bug Fix
* `release-plan`
  * [#138](https://github.com/embroider-build/release-plan/pull/138) fix readJSONSync import
  * [#107](https://github.com/embroider-build/release-plan/pull/107) Bump chalk from 4.1.2 to 5.4.1

#### :memo: Documentation
* `release-plan`
  * [#141](https://github.com/embroider-build/release-plan/pull/141) Add note about creating initial tag

#### :house: Internal
* `release-plan`
  * [#146](https://github.com/embroider-build/release-plan/pull/146) add extra test coverage to plan
  * [#152](https://github.com/embroider-build/release-plan/pull/152) remove conditional coverage run
  * [#151](https://github.com/embroider-build/release-plan/pull/151) fix coverage summary and double-execution
  * [#150](https://github.com/embroider-build/release-plan/pull/150) fix coverage json summary path
  * [#149](https://github.com/embroider-build/release-plan/pull/149) fix coverage comparison path
  * [#148](https://github.com/embroider-build/release-plan/pull/148) enable coverage comparison to main
  * [#147](https://github.com/embroider-build/release-plan/pull/147) Fix workflow for adding coverage
  * [#145](https://github.com/embroider-build/release-plan/pull/145) add coverage report to PRs
  * [#144](https://github.com/embroider-build/release-plan/pull/144) Bump @vitest/coverage-v8 from 2.1.8 to 3.0.7
  * [#143](https://github.com/embroider-build/release-plan/pull/143) Bump eslint-config-prettier from 9.1.0 to 10.0.2
  * [#142](https://github.com/embroider-build/release-plan/pull/142) Bump the dev-dependencies group across 1 directory with 5 updates
  * [#134](https://github.com/embroider-build/release-plan/pull/134) Update eslint - flat config and better prettier implementation
  * [#132](https://github.com/embroider-build/release-plan/pull/132) update pnpm

## Release (2025-02-12)

release-plan 0.13.1 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#122](https://github.com/embroider-build/release-plan/pull/122) rename embroider-release in error message to release-plan

## Release (2025-02-12)

release-plan 0.13.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#120](https://github.com/embroider-build/release-plan/pull/120) make name of release the same as the tag

## Release (2025-02-11)

release-plan 0.12.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#119](https://github.com/embroider-build/release-plan/pull/119) allow you to define a semver tag when using prerelease
  * [#109](https://github.com/embroider-build/release-plan/pull/109) Bump @octokit/rest from 19.0.13 to 21.1.0

#### :house: Internal
* `release-plan`
  * [#118](https://github.com/embroider-build/release-plan/pull/118) Bump the dev-dependencies group across 1 directory with 3 updates
  * [#92](https://github.com/embroider-build/release-plan/pull/92) Bump @npmcli/package-json from 5.0.0 to 6.1.0
  * [#102](https://github.com/embroider-build/release-plan/pull/102) Bump the dev-dependencies group with 6 updates
  * [#101](https://github.com/embroider-build/release-plan/pull/101) use increase-if-necessary strategy for dependabot
  * [#89](https://github.com/embroider-build/release-plan/pull/89) Bump fs-extra and @types/fs-extra
  * [#100](https://github.com/embroider-build/release-plan/pull/100) update release-plan workflows
  * [#99](https://github.com/embroider-build/release-plan/pull/99) stop using git fork of fixturify-project
  * [#73](https://github.com/embroider-build/release-plan/pull/73) add a dependabot config

## Release (2024-11-24)

release-plan 0.11.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#85](https://github.com/embroider-build/release-plan/pull/85) pass provenance through if provided to publish
  * [#68](https://github.com/embroider-build/release-plan/pull/68) add semverIncrementAs option for granular package version control

#### :house: Internal
* `release-plan`
  * [#83](https://github.com/embroider-build/release-plan/pull/83) use corepack to manage pnpm version

## Release (2024-10-17)

release-plan 0.10.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#81](https://github.com/embroider-build/release-plan/pull/81) Add support for specifying --access, aligning better with default publish behavior

## Release (2024-07-15)

release-plan 0.9.2 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#74](https://github.com/embroider-build/release-plan/pull/74) move @types packages to dev-dependencies

## Release (2024-07-11)

release-plan 0.9.1 (patch)

#### :bug: Bug Fix
* `release-plan`
  * [#72](https://github.com/embroider-build/release-plan/pull/72) add a test to exercise latest-version dependency and update it

#### :memo: Documentation
* `release-plan`
  * [#58](https://github.com/embroider-build/release-plan/pull/58) Update readme

## Release (2024-03-12)

release-plan 0.9.0 (minor)

#### :rocket: Enhancement
* `release-plan`
  * [#66](https://github.com/embroider-build/release-plan/pull/66) start using github-changelog

#### :house: Internal
* `release-plan`
  * [#67](https://github.com/embroider-build/release-plan/pull/67) fix typo in release-plan setup
  * [#64](https://github.com/embroider-build/release-plan/pull/64) update release-plan-setup
