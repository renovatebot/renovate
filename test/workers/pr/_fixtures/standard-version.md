# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [7.1.0](https://github.com/conventional-changelog/standard-version/compare/v7.0.1...v7.1.0) (2019-12-08)


### Features

* Adds support for `header` (--header) configuration based on the spec. ([#364](https://github.com/conventional-changelog/standard-version/issues/364)) ([ba80a0c](https://github.com/conventional-changelog/standard-version/commit/ba80a0c27029f54c751fe845560504925b45eab8))
* custom 'bumpFiles' and 'packageFiles' support ([#372](https://github.com/conventional-changelog/standard-version/issues/372)) ([564d948](https://github.com/conventional-changelog/standard-version/commit/564d9482a459d5d7a2020c2972b4d39167ded4bf))


### Bug Fixes

* **deps:** update dependency conventional-changelog to v3.1.15 ([#479](https://github.com/conventional-changelog/standard-version/issues/479)) ([492e721](https://github.com/conventional-changelog/standard-version/commit/492e72192ebf35d7c58c00526b1e6bd2abac7f13))
* **deps:** update dependency conventional-changelog-conventionalcommits to v4.2.3 ([#496](https://github.com/conventional-changelog/standard-version/issues/496)) ([bc606f8](https://github.com/conventional-changelog/standard-version/commit/bc606f8e96bcef1d46b28305622fc76dfbf306cf))
* **deps:** update dependency conventional-recommended-bump to v6.0.5 ([#480](https://github.com/conventional-changelog/standard-version/issues/480)) ([1e1e215](https://github.com/conventional-changelog/standard-version/commit/1e1e215a633963188cdb02be1316b5506e3b99b7))
* **deps:** update dependency yargs to v15 ([#484](https://github.com/conventional-changelog/standard-version/issues/484)) ([35b90c3](https://github.com/conventional-changelog/standard-version/commit/35b90c3f24cfb8237e94482fd20997900569193e))
* use require.resolve for the default preset ([#465](https://github.com/conventional-changelog/standard-version/issues/465)) ([d557372](https://github.com/conventional-changelog/standard-version/commit/d55737239530f5eee684e9cbf959f7238d609fd4))
* **deps:** update dependency detect-newline to v3.1.0 ([#482](https://github.com/conventional-changelog/standard-version/issues/482)) ([04ab36a](https://github.com/conventional-changelog/standard-version/commit/04ab36a12be58915cfa9c60771890e074d1f5685))
* **deps:** update dependency figures to v3.1.0 ([#468](https://github.com/conventional-changelog/standard-version/issues/468)) ([63300a9](https://github.com/conventional-changelog/standard-version/commit/63300a935c0079fd03e8e1acc55fd5b1dcea677f))
* **deps:** update dependency git-semver-tags to v3.0.1 ([#485](https://github.com/conventional-changelog/standard-version/issues/485)) ([9cc188c](https://github.com/conventional-changelog/standard-version/commit/9cc188cbb84ee3ae80d5e66f5c54727877313b14))
* **deps:** update dependency yargs to v14.2.1 ([#483](https://github.com/conventional-changelog/standard-version/issues/483)) ([dc1fa61](https://github.com/conventional-changelog/standard-version/commit/dc1fa6170ffe12d4f8b44b70d23688a64d2ad0fb))
* **deps:** update dependency yargs to v14.2.2 ([#488](https://github.com/conventional-changelog/standard-version/issues/488)) ([ecf26b6](https://github.com/conventional-changelog/standard-version/commit/ecf26b6fc9421a78fb81793c4a932f579f7e9d4a))

### [7.0.1](https://github.com/conventional-changelog/standard-version/compare/v7.0.0...v7.0.1) (2019-11-07)


### Bug Fixes

* **deps:** update dependency conventional-changelog to v3.1.12 ([#463](https://github.com/conventional-changelog/standard-version/issues/463)) ([f04161a](https://github.com/conventional-changelog/standard-version/commit/f04161ae624705e68f9018d563e9f3c09ccf6f30))
* **deps:** update dependency conventional-changelog-config-spec to v2.1.0 ([#442](https://github.com/conventional-changelog/standard-version/issues/442)) ([a2c5747](https://github.com/conventional-changelog/standard-version/commit/a2c574735ac5a165a190661b7735ea284bdc7dda))
* **deps:** update dependency conventional-recommended-bump to v6.0.2 ([#462](https://github.com/conventional-changelog/standard-version/issues/462)) ([84bb581](https://github.com/conventional-changelog/standard-version/commit/84bb581209b50357761cbec45bb8253f6a182801))
* **deps:** update dependency stringify-package to v1.0.1 ([#459](https://github.com/conventional-changelog/standard-version/issues/459)) ([e06a835](https://github.com/conventional-changelog/standard-version/commit/e06a835c8296a92f4fa7c07f98057d765c1a91e5))
* **deps:** update dependency yargs to v14 ([#440](https://github.com/conventional-changelog/standard-version/issues/440)) ([fe37e73](https://github.com/conventional-changelog/standard-version/commit/fe37e7390760d8d16d1b94ca58d8123e292c46a8))
* **deps:** update dependency yargs to v14.2.0 ([#461](https://github.com/conventional-changelog/standard-version/issues/461)) ([fb21851](https://github.com/conventional-changelog/standard-version/commit/fb2185107a90ba4b9dc7c9c1d873ed1283706ac1))

## [7.0.0](https://github.com/conventional-changelog/standard-version/compare/v6.0.1...v7.0.0) (2019-07-30)


### ⚠ BREAKING CHANGES

* we were accepting .version.json as a config file, rather than .versionrc.json

### Bug Fixes

* **bump:** transmit tag prefix argument to conventionalRecommendedBump ([#393](https://github.com/conventional-changelog/standard-version/issues/393)) ([8205222](https://github.com/conventional-changelog/standard-version/commit/8205222))
* **cli:** display only one, correct default for --preset flag ([#377](https://github.com/conventional-changelog/standard-version/issues/377)) ([d17fc81](https://github.com/conventional-changelog/standard-version/commit/d17fc81))
* **commit:** don't try to process and add changelog if skipped ([#318](https://github.com/conventional-changelog/standard-version/issues/318)) ([3e4fdec](https://github.com/conventional-changelog/standard-version/commit/3e4fdec))
* **deps:** update dependency conventional-changelog-config-spec to v2 ([#352](https://github.com/conventional-changelog/standard-version/issues/352)) ([f586844](https://github.com/conventional-changelog/standard-version/commit/f586844))
* **deps:** update dependency conventional-recommended-bump to v6 ([#417](https://github.com/conventional-changelog/standard-version/issues/417)) ([4c5cad1](https://github.com/conventional-changelog/standard-version/commit/4c5cad1))
* **deps:** update dependency find-up to v4 ([#355](https://github.com/conventional-changelog/standard-version/issues/355)) ([73b35f8](https://github.com/conventional-changelog/standard-version/commit/73b35f8))
* **deps:** update dependency find-up to v4.1.0 ([#383](https://github.com/conventional-changelog/standard-version/issues/383)) ([b621a4a](https://github.com/conventional-changelog/standard-version/commit/b621a4a))
* **deps:** update dependency git-semver-tags to v3 ([#418](https://github.com/conventional-changelog/standard-version/issues/418)) ([1ce3f4a](https://github.com/conventional-changelog/standard-version/commit/1ce3f4a))
* **deps:** update dependency semver to v6.3.0 ([#366](https://github.com/conventional-changelog/standard-version/issues/366)) ([cd866c7](https://github.com/conventional-changelog/standard-version/commit/cd866c7))
* **deps:** update dependency yargs to v13.3.0 ([#401](https://github.com/conventional-changelog/standard-version/issues/401)) ([3d0e8c7](https://github.com/conventional-changelog/standard-version/commit/3d0e8c7))
* adds support for `releaseCommitMessageFormat` ([#351](https://github.com/conventional-changelog/standard-version/issues/351)) ([a7133cc](https://github.com/conventional-changelog/standard-version/commit/a7133cc))
* stop suggesting npm publish if package.json was not updated ([#319](https://github.com/conventional-changelog/standard-version/issues/319)) ([a5ac845](https://github.com/conventional-changelog/standard-version/commit/a5ac845))
* Updates package.json to _actual_ supported (tested) NodeJS versions. ([#379](https://github.com/conventional-changelog/standard-version/issues/379)) ([15eec8a](https://github.com/conventional-changelog/standard-version/commit/15eec8a))
* **deps:** update dependency yargs to v13.2.4 ([#356](https://github.com/conventional-changelog/standard-version/issues/356)) ([00b2ce6](https://github.com/conventional-changelog/standard-version/commit/00b2ce6))
* update config file name in command based on README.md ([#357](https://github.com/conventional-changelog/standard-version/issues/357)) ([ce44dd2](https://github.com/conventional-changelog/standard-version/commit/ce44dd2))

### [6.0.1](https://github.com/conventional-changelog/standard-version/compare/v6.0.0...v6.0.1) (2019-05-05)


### Bug Fixes

* don't pass args to git rev-parse ([1ac72f7](https://github.com/conventional-changelog/standard-version/commit/1ac72f7))



## [6.0.0](https://github.com/conventional-changelog/standard-version/compare/v5.0.2...v6.0.0) (2019-05-05)


### Bug Fixes

* always pass version to changelog context ([#327](https://github.com/conventional-changelog/standard-version/issues/327)) ([00e3381](https://github.com/conventional-changelog/standard-version/commit/00e3381))
* **deps:** update dependency detect-indent to v6 ([#341](https://github.com/conventional-changelog/standard-version/issues/341)) ([234d9dd](https://github.com/conventional-changelog/standard-version/commit/234d9dd))
* **deps:** update dependency detect-newline to v3 ([#342](https://github.com/conventional-changelog/standard-version/issues/342)) ([02a6093](https://github.com/conventional-changelog/standard-version/commit/02a6093))
* **deps:** update dependency figures to v3 ([#343](https://github.com/conventional-changelog/standard-version/issues/343)) ([7208ded](https://github.com/conventional-changelog/standard-version/commit/7208ded))
* **deps:** update dependency semver to v6 ([#344](https://github.com/conventional-changelog/standard-version/issues/344)) ([c40487a](https://github.com/conventional-changelog/standard-version/commit/c40487a))
* **deps:** update dependency yargs to v13 ([#345](https://github.com/conventional-changelog/standard-version/issues/345)) ([b2c8e59](https://github.com/conventional-changelog/standard-version/commit/b2c8e59))
* prevent duplicate headers from being added ([#305](https://github.com/conventional-changelog/standard-version/issues/305)) ([#307](https://github.com/conventional-changelog/standard-version/issues/307)) ([db2c6e5](https://github.com/conventional-changelog/standard-version/commit/db2c6e5))


### Build System

* add renovate.json ([#273](https://github.com/conventional-changelog/standard-version/issues/273)) ([bf41474](https://github.com/conventional-changelog/standard-version/commit/bf41474))
* drop Node 6 from testing matrix ([#346](https://github.com/conventional-changelog/standard-version/issues/346)) ([6718428](https://github.com/conventional-changelog/standard-version/commit/6718428))


### Features

* adds configurable conventionalcommits preset ([#323](https://github.com/conventional-changelog/standard-version/issues/323)) ([4fcd4a7](https://github.com/conventional-changelog/standard-version/commit/4fcd4a7))
* allow a user to provide a custom changelog header ([#335](https://github.com/conventional-changelog/standard-version/issues/335)) ([1c51064](https://github.com/conventional-changelog/standard-version/commit/1c51064))
* bump minor rather than major, if release is < 1.0.0 ([#347](https://github.com/conventional-changelog/standard-version/issues/347)) ([5d972cf](https://github.com/conventional-changelog/standard-version/commit/5d972cf))
* suggest branch name other than master ([#331](https://github.com/conventional-changelog/standard-version/issues/331)) ([304b49a](https://github.com/conventional-changelog/standard-version/commit/304b49a))
* update commit msg for when using commitAll ([#320](https://github.com/conventional-changelog/standard-version/issues/320)) ([74a040a](https://github.com/conventional-changelog/standard-version/commit/74a040a))


### Tests

* disable gpg signing in temporary test repositories. ([#311](https://github.com/conventional-changelog/standard-version/issues/311)) ([bd0fcdf](https://github.com/conventional-changelog/standard-version/commit/bd0fcdf))
* use const based on new eslint rules ([#329](https://github.com/conventional-changelog/standard-version/issues/329)) ([b6d3d13](https://github.com/conventional-changelog/standard-version/commit/b6d3d13))


### BREAKING CHANGES

* we now bump the minor rather than major if version < 1.0.0; --release-as can be used to bump to 1.0.0.
* tests are no longer run for Node 6
* we now use the conventionalcommits preset by default, which directly tracks conventionalcommits.org.



## [5.0.2](https://github.com/conventional-changelog/standard-version/compare/v5.0.1...v5.0.2) (2019-03-16)



## [5.0.1](https://github.com/conventional-changelog/standard-version/compare/v5.0.0...v5.0.1) (2019-02-28)


### Bug Fixes

* make pattern for finding CHANGELOG sections work for non anchors ([#292](https://github.com/conventional-changelog/standard-version/issues/292)) ([b684c78](https://github.com/conventional-changelog/standard-version/commit/b684c78))



# [5.0.0](https://github.com/conventional-changelog/standard-version/compare/v4.4.0...v5.0.0) (2019-02-14)


### Bug Fixes

* bin now enforces Node.js > 4 ([#274](https://github.com/conventional-changelog/standard-version/issues/274)) ([e1b5780](https://github.com/conventional-changelog/standard-version/commit/e1b5780))
* no --tag prerelease for private module ([#296](https://github.com/conventional-changelog/standard-version/issues/296)) ([27e2ab4](https://github.com/conventional-changelog/standard-version/commit/27e2ab4)), closes [#294](https://github.com/conventional-changelog/standard-version/issues/294)
* show correct pre-release tag in help output ([#259](https://github.com/conventional-changelog/standard-version/issues/259)) ([d90154a](https://github.com/conventional-changelog/standard-version/commit/d90154a))


### chore

* update testing matrix ([1d46627](https://github.com/conventional-changelog/standard-version/commit/1d46627))


### Features

* adds support for bumping for composer versions ([#262](https://github.com/conventional-changelog/standard-version/issues/262)) ([fee872f](https://github.com/conventional-changelog/standard-version/commit/fee872f))
* cli application accept path/preset option ([#279](https://github.com/conventional-changelog/standard-version/issues/279)) ([69c62cf](https://github.com/conventional-changelog/standard-version/commit/69c62cf))
* fallback to tags if no meta-information file found ([#275](https://github.com/conventional-changelog/standard-version/issues/275)) ([844cde6](https://github.com/conventional-changelog/standard-version/commit/844cde6))
* preserve formatting when writing to package.json ([#282](https://github.com/conventional-changelog/standard-version/issues/282)) ([96216da](https://github.com/conventional-changelog/standard-version/commit/96216da))


### BREAKING CHANGES

* if no package.json, bower.json, etc., is found, we now fallback to git tags
* removed Node 4/5 from testing matrix



<a name="4.4.0"></a>
# [4.4.0](https://github.com/conventional-changelog/standard-version/compare/v4.3.0...v4.4.0) (2018-05-21)


### Bug Fixes

* show full tag name in checkpoint ([#241](https://github.com/conventional-changelog/standard-version/issues/241)) ([b4ed4f9](https://github.com/conventional-changelog/standard-version/commit/b4ed4f9))
* use tagPrefix in CHANGELOG lifecycle step ([#243](https://github.com/conventional-changelog/standard-version/issues/243)) ([a56c7ac](https://github.com/conventional-changelog/standard-version/commit/a56c7ac))


### Features

* add prerelease lifecycle script hook (closes [#217](https://github.com/conventional-changelog/standard-version/issues/217)) ([#234](https://github.com/conventional-changelog/standard-version/issues/234)) ([ba4e7f6](https://github.com/conventional-changelog/standard-version/commit/ba4e7f6))
* manifest.json support ([#236](https://github.com/conventional-changelog/standard-version/issues/236)) ([371d992](https://github.com/conventional-changelog/standard-version/commit/371d992))



<a name="4.3.0"></a>
# [4.3.0](https://github.com/conventional-changelog/standard-version/compare/v4.2.0...v4.3.0) (2018-01-03)


### Bug Fixes

* recommend `--tag` prerelease for npm publish of prereleases ([#196](https://github.com/conventional-changelog/standard-version/issues/196)) ([709dae1](https://github.com/conventional-changelog/standard-version/commit/709dae1)), closes [#183](https://github.com/conventional-changelog/standard-version/issues/183)
* use the `skip` default value for skip cli arg ([#211](https://github.com/conventional-changelog/standard-version/issues/211)) ([3fdd7fa](https://github.com/conventional-changelog/standard-version/commit/3fdd7fa))


### Features

* **format-commit-message:** support multiple %s in the message ([45fcad5](https://github.com/conventional-changelog/standard-version/commit/45fcad5))
* do not update/commit files in .gitignore ([#230](https://github.com/conventional-changelog/standard-version/issues/230)) ([4fd3bc2](https://github.com/conventional-changelog/standard-version/commit/4fd3bc2))
* publish only if commit+push succeed ([#229](https://github.com/conventional-changelog/standard-version/issues/229)) ([c5e1ee2](https://github.com/conventional-changelog/standard-version/commit/c5e1ee2))



<a name="4.2.0"></a>
# [4.2.0](https://github.com/conventional-changelog/standard-version/compare/v4.1.0...v4.2.0) (2017-06-12)


### Features

* add support for `package-lock.json` ([#190](https://github.com/conventional-changelog/standard-version/issues/190)) ([bc0fc53](https://github.com/conventional-changelog/standard-version/commit/bc0fc53))



<a name="4.1.0"></a>
# [4.1.0](https://github.com/conventional-changelog/standard-version/compare/v4.0.0...v4.1.0) (2017-06-06)


### Features

* **cli:** print error and don't run with node <4, closes [#124](https://github.com/conventional-changelog/standard-version/issues/124) ([d0d71a5](https://github.com/conventional-changelog/standard-version/commit/d0d71a5))
* add dry-run mode ([#187](https://github.com/conventional-changelog/standard-version/issues/187)) ([d073353](https://github.com/conventional-changelog/standard-version/commit/d073353))
* add prebump, postbump, precommit, lifecycle scripts ([#186](https://github.com/conventional-changelog/standard-version/issues/186)) ([dfd1d12](https://github.com/conventional-changelog/standard-version/commit/dfd1d12))
* add support for `npm-shrinkwrap.json` ([#185](https://github.com/conventional-changelog/standard-version/issues/185)) ([86af7fc](https://github.com/conventional-changelog/standard-version/commit/86af7fc))
* add support for skipping lifecycle steps, polish lifecycle work ([#188](https://github.com/conventional-changelog/standard-version/issues/188)) ([d31dcdb](https://github.com/conventional-changelog/standard-version/commit/d31dcdb))
* allow a version # to be provided for release-as, rather than just major, minor, patch. ([13eb9cd](https://github.com/conventional-changelog/standard-version/commit/13eb9cd))



<a name="4.0.0"></a>
# [4.0.0](https://github.com/conventional-changelog/standard-version/compare/v4.0.0-1...v4.0.0) (2016-12-02)


### Bug Fixes

* include merge commits in the changelog ([#139](https://github.com/conventional-changelog/standard-version/issues/139)) ([b6e1562](https://github.com/conventional-changelog/standard-version/commit/b6e1562))
* should print message before we bump version ([2894bbc](https://github.com/conventional-changelog/standard-version/commit/2894bbc))
* support a wording change made to git status in git v2.9.1 ([#140](https://github.com/conventional-changelog/standard-version/issues/140)) ([80004ec](https://github.com/conventional-changelog/standard-version/commit/80004ec))


### Features

* add support for bumping version # in bower.json ([#148](https://github.com/conventional-changelog/standard-version/issues/148)) ([b788c5f](https://github.com/conventional-changelog/standard-version/commit/b788c5f))
* make tag prefix configurable ([#143](https://github.com/conventional-changelog/standard-version/issues/143)) ([70b20c8](https://github.com/conventional-changelog/standard-version/commit/70b20c8))
* support releasing a custom version, including pre-releases ([#129](https://github.com/conventional-changelog/standard-version/issues/129)) ([068008d](https://github.com/conventional-changelog/standard-version/commit/068008d))


### BREAKING CHANGES

* merge commits are now included in the CHANGELOG.


<a name="3.0.0"></a>
# [3.0.0](https://github.com/conventional-changelog/standard-version/compare/v2.3.0...v3.0.0) (2016-10-06)


### Bug Fixes

* check the private field in package.json([#102](https://github.com/conventional-changelog/standard-version/issues/102)) ([#103](https://github.com/conventional-changelog/standard-version/issues/103)) ([2ce4160](https://github.com/conventional-changelog/standard-version/commit/2ce4160))
* **err:** don't fail on stderr output, but print the output to stderr ([#110](https://github.com/conventional-changelog/standard-version/issues/110)) ([f7a4915](https://github.com/conventional-changelog/standard-version/commit/f7a4915)), closes [#91](https://github.com/conventional-changelog/standard-version/issues/91)


### Chores

* package.json engines field >=4.0, drop Node 0.10 and 0.12 ([28ff65a](https://github.com/conventional-changelog/standard-version/commit/28ff65a))


### Features

* **options:** add --silent flag and option for squelching output ([2a3fa61](https://github.com/conventional-changelog/standard-version/commit/2a3fa61))
* added support for commitAll option in CLI ([#121](https://github.com/conventional-changelog/standard-version/issues/121)) ([a903f4d](https://github.com/conventional-changelog/standard-version/commit/a903f4d))
* separate cli and defaults from base functionality ([34a6a4e](https://github.com/conventional-changelog/standard-version/commit/34a6a4e))


### BREAKING CHANGES

* drop support for Node < 4.0 to enable usage of
new tools and packages.



<a name="2.4.0"></a>
# [2.4.0](https://github.com/conventional-changelog/standard-version/compare/v2.3.1...v2.4.0) (2016-07-13)


### Bug Fixes

* **index.js:** use blue figures.info for last checkpoint ([#64](https://github.com/conventional-changelog/standard-version/issues/64)) ([e600b42](https://github.com/conventional-changelog/standard-version/commit/e600b42))


### Features

* **changelogStream:** use more default opts ([#67](https://github.com/conventional-changelog/standard-version/issues/67)) ([3e0aa84](https://github.com/conventional-changelog/standard-version/commit/3e0aa84))



<a name="2.3.1"></a>
## [2.3.1](https://github.com/conventional-changelog/standard-version/compare/v2.3.0...v2.3.1) (2016-06-15)


### Bug Fixes

* **commit:** fix windows by separating add and commit exec ([#55](https://github.com/conventional-changelog/standard-version/issues/55)) ([f361c46](https://github.com/conventional-changelog/standard-version/commit/f361c46)), closes [#55](https://github.com/conventional-changelog/standard-version/issues/55) [#49](https://github.com/conventional-changelog/standard-version/issues/49)



<a name="2.3.0"></a>
# [2.3.0](https://github.com/conventional-changelog/standard-version/compare/v2.2.1...v2.3.0) (2016-06-02)


### Bug Fixes

* append line feed to end of package.json ([#42](https://github.com/conventional-changelog/standard-version/issues/42))([178e001](https://github.com/conventional-changelog/standard-version/commit/178e001))


### Features

* **index.js:** add checkpoint for publish script after tag successfully ([#47](https://github.com/conventional-changelog/standard-version/issues/47))([e414ed7](https://github.com/conventional-changelog/standard-version/commit/e414ed7))
* add a --no-verify option to prevent git hooks from being verified ([#44](https://github.com/conventional-changelog/standard-version/issues/44))([026d844](https://github.com/conventional-changelog/standard-version/commit/026d844))



<a name="2.2.1"></a>
## [2.2.1](https://github.com/conventional-changelog/standard-version/compare/v2.2.0...v2.2.1) (2016-05-02)


### Bug Fixes

* upgrade to version of nyc that works with new shelljs([c7ac6e2](https://github.com/conventional-changelog/standard-version/commit/c7ac6e2))



<a name="2.2.0"></a>
# [2.2.0](https://github.com/conventional-changelog/standard-version/compare/v2.1.2...v2.2.0) (2016-05-01)


### Bug Fixes

* format the annotated tag message ([#28](https://github.com/conventional-changelog/standard-version/issues/28))([8f02736](https://github.com/conventional-changelog/standard-version/commit/8f02736))
* upgraded dependencies, switched back to angular format (fixes [#27](https://github.com/conventional-changelog/standard-version/issues/27)), pinned shelljs to version that works with nyc ([#30](https://github.com/conventional-changelog/standard-version/issues/30))([3f51e94](https://github.com/conventional-changelog/standard-version/commit/3f51e94))


### Features

* add --sign flag to sign git commit and tag ([#29](https://github.com/conventional-changelog/standard-version/issues/29))([de758bc](https://github.com/conventional-changelog/standard-version/commit/de758bc))



<a name="2.1.2"></a>
## [2.1.2](https://github.com/conventional-changelog/standard-version/compare/v2.1.1...v2.1.2) (2016-04-11)


### Bug Fixes

* we had too many \n characters ([#17](https://github.com/conventional-changelog/standard-version/issues/17)) ([67a01cd](https://github.com/conventional-changelog/standard-version/commit/67a01cd))



<a name="2.1.1"></a>
## [2.1.1](https://github.com/conventional-changelog/standard-version/compare/v2.1.0...v2.1.1) (2016-04-10)


### Bug Fixes

* **docs:** had a bad URL in package.json, which was breaking all of our links ([caa6359](https://github.com/conventional-changelog/standard-version/commit/caa6359))



<a name="2.1.0"></a>
# [2.1.0](https://github.com/conventional-changelog/standard-version/compare/v2.0.0...v2.1.0) (2016-04-10)


### Features

* adds support for GitHub links (see [#13](https://github.com/conventional-changelog/standard-version/issues/13)), great idea [@bcoe](https://github.com/bcoe)! ([7bf6597](https://github.com/conventional-changelog/standard-version/commit/7bf6597))



<a name="2.0.0"></a>
# [2.0.0](https://github.com/conventional-changelog/standard-version/compare/v1.1.0...v2.0.0) (2016-04-09)


* feat(conventional-changelog-standard): Move to conventional-changelog-standard style. This style lifts the character limit on commit messages, and puts us in a position to make more opinionated decisions in the future. ([c7ccadb](https://github.com/conventional-changelog/standard-version/commit/c7ccadb))


### BREAKING CHANGES

* we no longer accept the preset configuration option.


<a name="1.1.0"></a>
# [1.1.0](https://github.com/conventional-changelog/standard-version/compare/v1.0.0...v1.1.0) (2016-04-08)


### Features

* **cli:** use conventional default commit message with version ([9fadc5f](https://github.com/conventional-changelog/standard-version/commit/9fadc5f))
* **rebrand:** rebrand recommended-workflow to standard-version (#9) ([1f673c0](https://github.com/conventional-changelog/standard-version/commit/1f673c0))
* **tests:** adds test suite, fixed several Node 0.10 issues along the way ([03bd86c](https://github.com/conventional-changelog/standard-version/commit/03bd86c))



<a name="1.0.0"></a>
# 1.0.0 (2016-04-04)


### Features

* **initial-release:** adds flag for generating CHANGELOG.md on the first release. ([b812b44](https://github.com/bcoe/conventional-recommended-workflow/commit/b812b44))
