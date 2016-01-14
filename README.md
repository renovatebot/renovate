# react-element-to-jsx-string

[![Version][version-svg]][package-url] [![Build Status][travis-svg]][travis-url] [![License][license-image]][license-url] [![Downloads][downloads-image]][downloads-url]

[travis-svg]: https://img.shields.io/travis/algolia/react-element-to-jsx-string/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/algolia/react-element-to-jsx-string
[license-image]: http://img.shields.io/badge/license-MIT-green.svg?style=flat-square
[license-url]: LICENSE
[downloads-image]: https://img.shields.io/npm/dm/react-element-to-jsx-string.svg?style=flat-square
[downloads-url]: http://npm-stat.com/charts.html?package=react-element-to-jsx-string
[version-svg]: https://img.shields.io/npm/v/react-element-to-jsx-string.svg?style=flat-square
[package-url]: https://npmjs.org/package/react-element-to-jsx-string

Turn a ReactElement into the corresponding JSX string.

Useful for unit testing and any other need you may think of.

Features:
- supports nesting and deep nesting like `<div a={{b: {c: {d: <div />}}}} />`
- props: supports string, number, function (inlined as `prop={function noRefCheck() {}}`), object, ReactElement (inlined), regex..
- order props alphabetically
- sort object keys in a deterministic order (`o={{a: 1, b:2}} === o={{b:2, a:1}}`)
- handle `ref` and `key` attributes, they are always on top of props
- React's documentation indent style for JSX

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [react-element-to-jsx-string](#react-element-to-jsx-string)
  - [Setup](#setup)
  - [Usage](#usage)
  - [Test](#test)
  - [Build](#build)
  - [Thanks](#thanks)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Setup

```sh
npm install react-element-to-jsx-string --save[-dev]
```

## Usage

```js
import React from 'react';
import reactElementToJSXString from 'react-element-to-jsx-string';

console.log(reactElementToJSXString(<div a="1" b="2">Hello, world!</div>));
// <div
//   a="1"
//   b="2"
// >
//   Hello, world!
// </div>
```

## API

### reactElementToJSXString(ReactElement[, options])

**options.displayName: function(ReactElement)**
  
  Provide a different algorithm in charge of finding the right display name (name of the underlying Class) for your element.

  Just return the name you want for the provided ReactElement, as a string.

## Test

```sh
npm test
npm run test:watch
```

## Build

```sh
npm run build
npm run build:watch
```

## Thanks

[alexlande/react-to-jsx](https://github.com/alexlande/react-to-jsx/) was a good source of inspiration.

We built our own module because we had some needs like ordering props in alphabetical order.

