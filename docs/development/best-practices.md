# Best practices

This document explains our best practices.
Follow these best practices when you're working on our code.

## Git branch names

Branch names should start with a [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) scope like `feat/` or `fix/`.
If you're closing an issue with your PR then put the issue number after the scope.
Finally, describe the changes in the branch in a few words.

Some good branch names:

- `feat/13732-cacache-cleanup`
- `fix/15431-gitea-automerge-strategy`
- `refactor/jest-reset-mocks`
- `docs/rewrite-packageRules-section`

Avoid branch names like `patch-1`.

If you don't know the correct Conventional Commit scope: give your branch a descriptive name like `issue-1-feature-foo`.

If you forgot to pick a good branch name when you started work, then rename the branch before creating the pull request.
Read the [GitHub Docs, renaming a branch](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/renaming-a-branch) to learn how to rename your branch on GitHub.

## General

- Prefer full function declarations for readability and better stack traces, so avoid `const func = ():void => {}`
- Prefer `interface` over `type` for TypeScript type declarations
- Avoid [Enums](https://github.com/renovatebot/renovate/issues/13743), use unions or [immutable objects](https://github.com/renovatebot/renovate/blob/5043379847818ac1fa71ff69c098451975e95710/lib/modules/versioning/pep440/range.ts#L8-L20) instead
- Always add unit tests for full code coverage
  - Only use `istanbul` comments for unreachable code coverage that is needed for `codecov` completion
  - Use descriptive `istanbul` comments
- Avoid cast or prefer `x as T` instead of `<T>x` cast
- Prefer `satisfies` operator over `as`, read the [TypeScript release notes for `satisfies` operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator) to learn more
- Avoid `Boolean` instead use `is` functions from `@sindresorhus/is` package, for example: `is.string`

```ts
// istanbul ignore next: can never happen
```

### Functions

- Use `function foo(){...}` to declare named functions
- Use function declaration instead of assigning function expression into local variables (`const f = function(){...}`) (TypeScript already prevents rebinding functions)
  - Exception: if the function accesses the outer scope's `this` then use arrow functions assigned to variables instead of function declarations
- Regular functions _should not_ access `this`, but arrow functions and methods may access `this`
- Only use nested functions when the [lexical scope](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures) is used

#### Use arrow functions in expressions

Avoid:

```ts
bar(function(){...})
```

Use:

```ts
bar(() => {
  this.doSomething();
});
```

Generally the `this` pointer _should not_ be rebound.
Only use function expressions if you need to dynamically rebind `this`.

Source: [Google TypeScript Style Guide, function declarations](https://google.github.io/styleguide/tsguide.html#function-declarations).

## Code style

### Write understandable code

Write code that is easier to read, review and maintain.
Avoid "clever" code that's hard to understand.

Prefer verbose code which is easier for others to read and maintain than concise code which may be hard or slower for others to understand.
For example, Array `reduce()` functions are often hard to understand first time, and can be replaced with simpler `for` loops.
A `for` loop is just as fast but is simpler to understand and maintain.

#### Write single purpose functions

Single purpose functions are easier to understand, test and debug.

```ts
function caller() {
  // ..code..
  calculateUpdateAndPrint(data)
  // ..code..
}

function calculateUpdateAndPrint(...) { /* code */ }
```

Simplified code:

```ts
function caller() {
    // code..
    const res = calculate(data);
    update(res);
    print(res);
    // code..
}

function calculate(...) { /* code */ }
function update(...)    { /* code */ }
function print(...)     { /* code */ }
```

#### Keep indentation level low

Fail quickly.
Nested code logic is hard to read and prone to logic mistakes.

```ts
function foo(str: string): boolean {
  let result = false;
  if (condition(str)) {
    const x = extractData(str);
    if (x) {
      // do something
      result = true;
    }
  }
  return result;
}
```

Simplified code:

```ts
function foo(str: string): boolean {
  if (!condition(str)) {
    return false;
  }

  const x = extractData(str);
  if (!x) {
    return false;
  }

  // do something
  return true;
}
```

### Refactor one thing at a time

Refactor the code _or_ refactor the tests.

Avoid refactoring the code and tests at the same time, this can mask regression errors.

## Logging

For `WARN`, `ERROR` and `FATAL` log messages use logger metadata.
Also use logger metadata the result is a complex metadata object needing a multiple-line pretty stringification.

For `INFO` and `DEBUG` log messages inline the metadata into the log message where feasible.
It is OK to not inline metadata if it's complex, but in that case first think whether that much information really needs to be logged.

`WARN`, `ERROR` and `FATAL` messages are often used in metrics or error catching services.
These log messages should have a static `msg` component, so they can be automatically grouped or associated.

Good:

```ts
logger.debug({ config }, 'Full config');
logger.debug(`Generated branchName: ${branchName}`);
logger.warn({ presetName }, 'Failed to look up preset');
```

Avoid:

```ts
logger.debug({ branchName }, 'Generated branchName');
logger.warn(`Failed to look up preset ${presetName}`);
```

## Array constructor

Avoid the `Array()` constructor, with or without `new`, in your TypeScript code.
It has confusing and contradictory usage.
So you should avoid:

```ts
const a = new Array(2); // [undefined, undefined]
const b = new Array(2, 3); // [2, 3];
```

Instead, always use bracket notation to initialize arrays, or `from` to initialize an Array with a certain size.
For example:

```ts
// [0, 0, 0, 0, 0]
Array.from<number>({ length: 5 }).fill(0);
```

[Source](https://google.github.io/styleguide/tsguide.html#array-constructor)

## Iterating objects & containers

Use `for ( ... of ...)` loops instead of `[Array|Set|Map].prototype.forEach` and `for ( ... in ...)`.

- Using `for ( ... in ...)` for objects is error-prone. It will include enumerable properties from the prototype chain
- Using `for ( ... in ...)` to iterate over arrays, will counterintuitively return the array's indices
- Avoid `[Array|Set|Map].prototype.forEach`. It makes code harder to debug and defeats some useful compiler checks like reachability

Only use `Array.prototype.map()` when the return value is used, otherwise use `for ( ... of ...)`.

Source: [Google TypeScript Style Guide, iterating objects](https://google.github.io/styleguide/tsguide.html#iterating-objects)

## Exports

Use named exports in all code.
Avoid default `exports`.
This way all `imports` follow the same pattern.

Source: [Google TypeScript Style Guide, exports](https://google.github.io/styleguide/tsguide.html#exports)

## Imports

Use [ES6 module](https://exploringjs.com/es6/ch_modules.html#sec_basics-of-es6-modules) syntax.
For example:

```ts
import { square, diag } from 'lib';

// You may also use:

import * as lib from 'lib';
```

And avoid `require`:

```ts
import x = require('...');
```

## HTTP & RESTful API request handling

Prefer using `Http` from `util/http` to simplify HTTP request handling and to enable authentication and caching, as our `Http` class will transparently handle host rules.
For example:

```ts
import { Http } from '../../../util/http';

const http = new Http('some-host-type');

try {
    const body = (await http.getJson<Response>(url)).body;
} catch (err) {
  ...
}
```

## Async functions

Never use `Promise.resolve` in async functions.
Never use `Promise.reject` in async functions, instead throw an `Error` class type.

## Dates and times

Use the [`Luxon` package](https://www.npmjs.com/package/luxon) to handle dates and times.
Use `UTC` to be time zone independent.

[Example from our code](https://github.com/renovatebot/renovate/blob/5043379847818ac1fa71ff69c098451975e95710/lib/modules/versioning/distro.ts#L133-L134)
:

```ts
if (end) {
  const now = DateTime.now().toUTC();
  const eol = DateTime.fromISO(end, { zone: 'utc' });
  return eol < now;
}
```

## Unit testing

- Separate the _Arrange_, _Act_ and _Assert_ phases with newlines
- Use `it.each` rather than `test.each`
- Prefer [Tagged Template Literal](https://jestjs.io/docs/api#2-testeachtablename-fn-timeout) style for `it.each`, Prettier will help with formatting
  - See [Example](https://github.com/renovatebot/renovate/blob/768e178419437a98f5ce4996bafd23f169e530b4/lib/modules/platform/util.spec.ts#L8-L18)
- Mock Date/Time when testing a Date/Time dependent module
  - For `Luxon` mocking see [Example](https://github.com/renovatebot/renovate/blob/5043379847818ac1fa71ff69c098451975e95710/lib/modules/versioning/distro.spec.ts#L7-L10)
- Prefer `jest.spyOn` for mocking single functions, or mock entire modules
  - Avoid overwriting functions, for example: (`func = jest.fn();`)
- Prefer `toEqual`
- Use `toMatchObject` for huge objects when only parts need to be tested
- Avoid `toMatchSnapshot`, only use it for:
  - huge strings like the Renovate PR body text
  - huge complex objects where you only need to test parts
- Avoid exporting functions purely for the purpose of testing unless you really need to
- Avoid cast or prefer `x as T` instead of `<T>x` cast
  - Use `partial<T>()` from `test/util` if only a partial object is required

## Fixtures

Use the `Fixture` class to load fixtures.
For example:

```ts
Fixture.get('./file.json'); // for loading string data
Fixture.getJson('./file.json'); // for loading and parsing objects
Fixture.getBinary('./file.json'); // for retrieving a buffer
```

## Working with vanilla JS files (renovate/tools only)

Declare types and function prototypes with [JSDoc](https://jsdoc.app/index.html).

[Example](https://github.com/renovatebot/renovate/blob/5043379847818ac1fa71ff69c098451975e95710/tools/distro-json-generate.mjs#L7-L17)

## Classes

- Use [Typescript getter setters (Accessors) when needed](https://google.github.io/styleguide/tsguide.html#properties-used-outside-of-class-lexical-scope).
  The getter must be a `pure function` i.e.
  - The function return values are identical for identical arguments
  - The function has no side effects

[Source](https://en.wikipedia.org/wiki/Pure_function)

- Omit constructors when defining Static classes
- [No `#private` fields](https://google.github.io/styleguide/tsguide.html#private-fields), use TypeScript's visibility annotations instead
- Avoid underscore suffixes or prefixes like `_prop`, instead use [whole words](https://google.github.io/styleguide/tsguide.html#properties-used-outside-of-class-lexical-scope) as the suffix or prefix like `internalProp`

## regex

Use [Named Capturing Groups](https://www.regular-expressions.info/named.html) when capturing multiple groups, for example: `(?<groupName>CapturedGroup)`.

## Windows

We recommend you set [`core.autocrlf = input`](https://git-scm.com/docs/gitattributes#_text) in your Git config.
You can do this by running this Git command:

```bash
git config --global core.autocrlf input
```

This prevents the carriage return `\r\n` which may confuse Renovate.
You can also set the line endings in your repository by adding `* text=auto eol=lf` to your `.gitattributes` file.
