# Best Practices

## General

- Prefer full function declaration, as opposed to `const func = ():void => {}`, for readability and better stack traces
- Avoid [Enums](https://github.com/renovatebot/renovate/issues/13743), use union
  or [immutable objects](https://github.com/renovatebot/renovate/blob/5043379847818ac1fa71ff69c098451975e95710/lib/modules/versioning/pep440/range.ts#L8-L20) instead
- Always add unit tests for full code coverage
  - Only use `istanbul` comments for unreachable code coverage that is needed for `codecov` completion.
  - Use descriptive `istanbul` comments

```js
// istanbul ignore next: can never happen
```

### Logging

- Use logger metadata:

Use

```js
logger.trace({ obj }, 'title');
```

instead of

```js
logger.trace('title:\n' + obj);
```

### Array constructor

Avoid the `Array()` constructor, with or without `new`, in your TypeScript code.
It has confusing and contradictory usage.

```js
const a = new Array(2); // [undefined, undefined]
const b = new Array(2, 3); // [2, 3];
```

Instead, always use bracket notation to initialize arrays, or `from` to initialize an Array with a certain size.

[Source](https://google.github.io/styleguide/tsguide.html#array-constructor)

### Iterating objects & containers

Use `for ( ... of ...)` loops instead of `[Array|Set|Map].prototype.forEach` and `for ( ... in ...)`.

- Using `for ( ... in ...)` for objects is error-prone. It will include enumerable properties from the prototype chain
- Using `for ( ... in ...)` to iterate over arrays, will counterintuitively give the array's indices
- Avoid `[Array|Set|Map].prototype.forEach`. It makes code harder to debug and defeats some useful compiler checks like
  reachability

Only use `Array.prototype.map()` when the return value is used, otherwise use `for ( ... of ...)`.

[Source](https://google.github.io/styleguide/tsguide.html#iterating-objects)

### Exports

Use named exports in all code.
Avoid default `exports`.
This way all `imports` follow the same pattern.

[Source, reasoning and examples.](https://google.github.io/styleguide/tsguide.html#exports)

### Imports

Use ES6 module syntax.
Avoid `require` `(as in import x = require('...');)` for imports.

### HTTP & RESTful API request handling

Prefer using [`got`](https://www.npmjs.com/package/got) for simplifying HTTP request handling.

### Date & Time handling

Use [`Luxon`](https://www.npmjs.com/package/luxon) for date and time handling.
Use `UTC` to be time zone independent.

[Example](https://github.com/renovatebot/renovate/blob/5043379847818ac1fa71ff69c098451975e95710/lib/modules/versioning/distro.ts#L133-L134)

### Unit Testing

- Use `it.each` rather than `test.each`
- Mock Date/Time when testing a Date/Time dependent module
  - For `Luxon` mocking see [Example](https://github.com/renovatebot/renovate/blob/5043379847818ac1fa71ff69c098451975e95710/lib/modules/versioning/distro.spec.ts#L7-L10)
- Prefer `jest.spyOn` for mocking single functions, or mock entire modules
  - Avoid overwriting functions, for example: (`func = jest.fn();`)

### Fixtures

- use `Fixture` class for loading fixtures

```js
Fixture.get('./file.json'); // for loading raw data
Fixture.getJson('./file.json'); // for loading and parsing objects
```

### Working with vanilla JS files (renovate/tools only)

Use [JSDoc](https://jsdoc.app/index.html) to declare types and function prototypes.

[Example](https://github.com/renovatebot/renovate/blob/5043379847818ac1fa71ff69c098451975e95710/tools/distro-json-generate.mjs#L7-L17)

### Classes

Use [Typescript getter setters (Accessors) when needed](https://google.github.io/styleguide/tsguide.html#properties-used-outside-of-class-lexical-scope)
. getter must be a `pure function`.

- Omit constructors when defining Static classes
- [No `#private` fields](https://google.github.io/styleguide/tsguide.html#private-fields). instead, use TypeScript's
  visibility annotations.
- Avoid underscore suffixes or prefixes, for example: `_prop`, use [whole words](https://google.github.io/styleguide/tsguide.html#properties-used-outside-of-class-lexical-scope) as
  suffix/prefix i.e `internalProp`
