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



