<a name="3.1.0"></a>
# [3.1.0](https://github.com/algolia/react-element-to-jsx-string/compare/v3.0.0...v3.1.0) (2016-06-28)



<a name="3.0.0"></a>
# [3.0.0](https://github.com/algolia/react-element-to-jsx-string/compare/v2.6.1...v3.0.0) (2016-05-25)

Boolean attributes are now translated to short version automatically.


<a name="2.6.0"></a>
# [2.6.0](https://github.com/algolia/react-element-to-jsx-string/compare/v2.6.1...v2.6.0) (2016-04-15)




<a name="2.5.0"></a>
# [2.5.0](https://github.com/algolia/react-element-to-jsx-string/compare/v2.6.0...v2.5.0) (2016-04-15)




<a name="2.3.0"></a>
# [2.3.0](https://github.com/algolia/react-element-to-jsx-string/compare/2.4.0...v2.3.0) (2016-02-02)




<a name="2.2.0"></a>
# [2.2.0](https://github.com/algolia/react-element-to-jsx-string/compare/2.3.0...v2.2.0) (2016-02-02)




<a name="2.2.0"></a>
# [2.2.0](https://github.com/algolia/react-element-to-jsx-string/compare/v2.1.5...v2.2.0) (2016-01-14)

* add reactElementToJSXString(ReactElement, opts) opts.displayName option to
  allow choosing the display name of components


<a name="2.1.5"></a>
## [2.1.5](https://github.com/algolia/react-element-to-jsx-string/compare/v2.1.4...v2.1.5) (2016-01-05)

### Bug Fixes

* stop breaking lines when interpolating {number}s ([13b832c](https://github.com/algolia/react-element-to-jsx-string/commit/13b832c))

<a name="2.1.4"></a>
## [2.1.4](https://github.com/algolia/react-element-to-jsx-string/compare/v2.1.3...v2.1.4) (2015-12-10)


### Bug Fixes

* **stateless comps:** add No Display Name as default component name ([89ea2f2](https://github.com/algolia/react-element-to-jsx-string/commit/89ea2f2))
* consider elements containing only {''} as empty (resulting DOM being empty) ([d837683](https://github.com/algolia/react-element-to-jsx-string/commit/d837683))

<a name="2.1.3"></a>
## [2.1.3](https://github.com/algolia/react-element-to-jsx-string/compare/v2.1.0...v2.1.3) (2015-11-30)


### Bug Fixes

* handle <div>{123}</div> ([609ac78](https://github.com/algolia/react-element-to-jsx-string/commit/609ac78)), closes [#8](https://github.com/algolia/react-element-to-jsx-string/issues/8)
* **lodash:** just use plain lodash and import ([062b3fe](https://github.com/algolia/react-element-to-jsx-string/commit/062b3fe))
* **whitespace:** handle {true} {false} ([eaca1a2](https://github.com/algolia/react-element-to-jsx-string/commit/eaca1a2)), closes [#6](https://github.com/algolia/react-element-to-jsx-string/issues/6) [#7](https://github.com/algolia/react-element-to-jsx-string/issues/7)
* **whitespace:** stop rendering it differently in SOME cases ([128aa95](https://github.com/algolia/react-element-to-jsx-string/commit/128aa95))



<a name="2.1.2"></a>
## [2.1.2](https://github.com/algolia/react-element-to-jsx-string/compare/v2.1.0...v2.1.2) (2015-11-08)


### Bug Fixes

* **whitespace:** handle {true} {false} ([eaca1a2](https://github.com/algolia/react-element-to-jsx-string/commit/eaca1a2)), closes [#6](https://github.com/algolia/react-element-to-jsx-string/issues/6) [#7](https://github.com/algolia/react-element-to-jsx-string/issues/7)
* handle <div>{123}</div> ([609ac78](https://github.com/algolia/react-element-to-jsx-string/commit/609ac78)), closes [#8](https://github.com/algolia/react-element-to-jsx-string/issues/8)
* **whitespace:** stop rendering it differently in SOME cases ([128aa95](https://github.com/algolia/react-element-to-jsx-string/commit/128aa95))



<a name="2.1.1"></a>
## [2.1.1](https://github.com/algolia/react-element-to-jsx-string/compare/v2.1.0...v2.1.1) (2015-11-08)


### Bug Fixes

* **whitespace:** handle {true} {false} ([eaca1a2](https://github.com/algolia/react-element-to-jsx-string/commit/eaca1a2)), closes [#6](https://github.com/algolia/react-element-to-jsx-string/issues/6) [#7](https://github.com/algolia/react-element-to-jsx-string/issues/7)
* handle <div>{123}</div> ([609ac78](https://github.com/algolia/react-element-to-jsx-string/commit/609ac78)), closes [#8](https://github.com/algolia/react-element-to-jsx-string/issues/8)



<a name="2.1.0"></a>
# [2.1.0](https://github.com/algolia/react-element-to-jsx-string/compare/v2.0.5...v2.1.0) (2015-10-25)


### Features

* handle key="" ([da85281](https://github.com/algolia/react-element-to-jsx-string/commit/da85281))
* handle ref="manual-ref" ([5b18191](https://github.com/algolia/react-element-to-jsx-string/commit/5b18191))



<a name="2.0.5"></a>
## [2.0.5](https://github.com/algolia/react-element-to-jsx-string/compare/v2.0.4...v2.0.5) (2015-10-21)


### Bug Fixes

* merge plain strings props replacements ([7c2bf27](https://github.com/algolia/react-element-to-jsx-string/commit/7c2bf27))



<a name="2.0.4"></a>
## [2.0.4](https://github.com/algolia/react-element-to-jsx-string/compare/v2.0.3...v2.0.4) (2015-10-16)


### Bug Fixes

* **tagName:** fixed an edge-case with decorated component name ([9169ac7](https://github.com/algolia/react-element-to-jsx-string/commit/9169ac7))



<a name="2.0.3"></a>
## [2.0.3](https://github.com/algolia/react-element-to-jsx-string/compare/v2.0.2...v2.0.3) (2015-10-16)


### Bug Fixes

* handle arrays the right way ([597a910](https://github.com/algolia/react-element-to-jsx-string/commit/597a910))



<a name="2.0.2"></a>
## [2.0.2](https://github.com/algolia/react-element-to-jsx-string/compare/v2.0.1...v2.0.2) (2015-10-16)


### Bug Fixes

* **children:** ensure the array of children is well handled ([36b462a](https://github.com/algolia/react-element-to-jsx-string/commit/36b462a))



<a name="2.0.1"></a>
## [2.0.1](https://github.com/algolia/react-element-to-jsx-string/compare/v2.0.0...v2.0.1) (2015-10-16)


### Bug Fixes

* handle empty objects ([fe052bd](https://github.com/algolia/react-element-to-jsx-string/commit/fe052bd))



<a name="2.0.0"></a>
# [2.0.0](https://github.com/algolia/react-element-to-jsx-string/compare/v1.1.2...v2.0.0) (2015-10-16)


### Features

* **deep:** handle deeply set functions ([ad21917](https://github.com/algolia/react-element-to-jsx-string/commit/ad21917))
* **deep:** handle deeply set React elements ([a06f329](https://github.com/algolia/react-element-to-jsx-string/commit/a06f329))


### BREAKING CHANGES

* deep: functions are now stringified to `function noRefCheck()
{}` instead of `function () {code;}`. For various reasons AND to be
specific about the fact that we do not represent the function in a
realistic way.



<a name="1.1.2"></a>
## [1.1.2](https://github.com/algolia/react-element-to-jsx-string/compare/v1.1.1...v1.1.2) (2015-10-16)


### Bug Fixes

* handle null and undefined prop values ([9a57a10](https://github.com/algolia/react-element-to-jsx-string/commit/9a57a10)), closes [#1](https://github.com/algolia/react-element-to-jsx-string/issues/1)



<a name="1.1.1"></a>
## [1.1.1](https://github.com/algolia/react-element-to-jsx-string/compare/v1.1.0...v1.1.1) (2015-10-15)




<a name="1.1.0"></a>
# [1.1.0](https://github.com/algolia/react-element-to-jsx-string/compare/3e2e7b8...v1.1.0) (2015-10-15)


### Bug Fixes

* **whitespace:** remove unwanted whitespace in output ([3e2e7b8](https://github.com/algolia/react-element-to-jsx-string/commit/3e2e7b8))

### Features

* sort object keys in a deterministic way ([c1ce8a6](https://github.com/algolia/react-element-to-jsx-string/commit/c1ce8a6))



