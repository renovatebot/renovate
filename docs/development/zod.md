### Table of Contents

- [Zod schema guideline](#introduction)
  - [When/where to use Zod](#when-and-where-to-use)
  - [Technical guide](#technical-guide)
    - [Use `schema.ts` files for Zod schemas](#use-schema-ts)
    - [Name schemas without any `Schema` suffix](#avoid-schema-suffix)
    - [Inferred types](#inferred-types)
    - [Specify only necessary fields](#specify-only-necessary-fields)
    - [Use `Json`, `Yaml` and `Toml` for string parsing](#use-string-parsing-helpers)
    - [Use `.transform()` method to process parsed data](#use-transform-method)
    - [Separate validation from transformation](#separator-validation-from-transformation)
    - [Try to be permissive](#try-to-be-permissive)
      - [Use `.catch()` to force default values](#use-catch-method)
      - [Use `LooseArray` and `LooseRecord` to filter out incorrect values from collections](#use-loose-collection-helpers)
    - [Combining with `Result` class](#combining-with-result-class)

<a id="#introduction"></a>

# Zod schema guideline

Renovate has adopted Zod for schema validation and it is desirable that any new manager or datasource work uses this approach.
This document describes some guides as to how and why to use Zod features.

The key concept of schema validation is to find the right balance between strictness of contracts between separately developed systems and the permissiveness of the Renovate itself.
We want Renovate to be only as strict as it needs to be (e.g. about optional fields which a public registry might always have but self-hosted implementations may leave off) but not to make _assumptions_ about the presence of fields which could lead to run-time errors when they are missing.

<a id="#when-and-where-to-use"></a>

## When/where to use Zod

We should use Zod for validating:

- Data received from external APIs and data sources, particularly the `lib/modules/datasource/*` section of Renovate
- Data parsed from files in the repository, particularly the `lib/modules/manager/*` section of Renovate

The `cdnjs` datasource is a good example of using Zod schema validations on API responses from external sources.

The `composer` manager is a good example of using Zod schema validation in a manager to validate parsed files in a repository.

<a id="#technical-guide"></a>

## Technical guide

<a id="#use-schema-ts"></a>

### Use `schema.ts` files for Zod schemas

Try to locate/isolate Zod schemas in their own schema.ts files to keep them organized and reusable. [TODO: do our examples follow that?]

<a id="#avoid-schema-suffix"></a>

### Name schemas without any `Schema` suffix

Schemas are distinguished by being named with capital letter:

```ts
const ComplexNumber = z.object({
  re: z.number(),
  im: z.number(),
});
```

Don't use names like `ComplexNumberSchema` for that.

<a id="#inferred-types"></a>

### Inferred types

Create inferred types after schemas if they're needed somewhere in the code.
Place such inferred types just after the schema definition using the same name.

While text editors may confuse schema and type name sometimes, it's obvious which is which from the syntactic context.

Example:

```ts
export const User = z.object({
  firstName: z.string(),
  lastName: z.string(),
});
export type User = z.infer<typeof User>;
```

<a id="#specify-only-necessary-fields"></a>

### Specify only necessary fields

External data being queried by Renovate can be very complex while we may only need a subset of fields for our use cases.
Avoid overspecifying schemas and instead extract only the minimum necessary fields.
If we don't include them, the surface of the contract between external data source is minimal, meaning less errors to fix in the future.

Example of **incorrect** usage if we only care about width, height and length of a box:

```ts
const Box = z.object({
  width: z.number(),
  height: z.number(),
  length: z.number(),
  color: z.object({
    red: z.number(),
    green: z.number(),
    blue: z.number(),
  })
  weight: z.number(),
});

const { width, height, length } = Box.parse(input);
const volume = width * height * length;
```

Example of **correct** usage:

```ts
const Box = z.object({
  width: z.number(),
  height: z.number(),
  length: z.number(),
});

const { width, height, length } = Box.parse(input);
const volume = width * height * length;
```

<a id="#use-string-parsing-helpers"></a>

### Use `Json`, `Yaml` and `Toml` for string parsing

Sometimes we need to perform additional step such as `JSON.parse()` before validation of the data structure.
Use helpers from `schema-utils.ts` for this purpose.

Here is an **incorrect** way to parse from string:

```ts
try {
  const json = JSON.parse(input);
  return ApiResult.parse(json);
} catch (e) {
  return null;
}
```

The **correct** way to parse from string:

```ts
Json.pipe(ApiResult).parse(input);
```

<a id="#use-transform-method"></a>

### Use `.transform()` method to process parsed data

Schema validation helps to be more confident with types during downstream data transformation.

You can go even further and perform some transformations as the part of schema itself.

This is an example of **undesired** data transformation:

```ts
const Box = z.object({
  width: z.number(),
  height: z.number(),
  length: z.number(),
});

const { width, height, length } = Box.parse(input);
const volume = width * height * length;
```

Instead, use more idiomatic `.tranform()` method:

```ts
const Volume = z
  .object({
    width: z.number(),
    height: z.number(),
    length: z.number(),
  })
  .transform(({ width, height, length }) => width * height * length);

Volume.parse({
  width: 10,
  height: 20,
  length: 125,
});
```

<a id="#separator-validation-from-transformation"></a>

### Separate validation from transformation

When parsing third party data, we are typically doing the following:

- Validating that the data is correct/sufficient to use
- Transforming it into a standardized format for internal usage

Although it's not a strict requirement, your code will be cleaner if you perform the validation step first and then follow with transformation.

<a id="#try-to-be-permissive"></a>

### Stick to permissive behavior when possible

Zod schemas are strict, and even some insufficient field is incorrect, the whole data will be treated like malformed.
This could lead to cases when Renovate could've continued processing, but didn't.

Remember: our goal is not to validate that data corresponds to any official specifications, but rather to ensure that the data is enough for Renovate to use.

There are some techniques to make it more permissive to the input data.

<a id="#use-catch-method"></a>

#### Use `.catch()` to force default values

```ts
const Box = z.object({
  width: z.number().catch(10),
  height: z.number().catch(10),
});

const box = Box.parse({ width: 10, height: null });
// => { width: 10, height: 10 }
```

<a id="#use-loose-collection-helpers"></a>

#### Use `LooseArray` and `LooseRecord` to filter out incorrect values from collections

Suppose you want to validate an array and retain only number values in it.
By using only methods provided by `zod` library, you'll have to write something like this:

```ts
const OnlyNumbers = z
  .array(z.union([z.number(), z.null()]).catch(null))
  .transform((xs) => xs.filter((x): x is number => x !== null));
```

While the problem is common, the code is quite complicated.

Instead, you should use `LooseArray` and `LooseRecord` helpers provided in `schema-utils.ts`:

```ts
const OnlyNumbers = LooseArray(z.number());
```

[TODO: more details on how the above would be used]

<a id="#combining-with-result-class"></a>

### Combining with `Result` class

Class `Result` (and also `AsyncResult`) represents result of an operation, e.g. `Result.ok(200)` or `Result.err(404)`.

It supports `.transform()` method, which is similar to `zod`'s one.

Also it supports `.onResult()` and `.onError()` methods for side-effectful result inspection.

Once all result manipulations are done, you may call `.unwrap()`, `.unwrapOrElse()` or `.unwrapOrThrow()` methods to obtain the underlying result value.

You can wrap schema parsing result into the `Result` class:

```ts
const { val, err } = Result.parse(url, z.string().url())
  .transform((url) => http.get(url))
  .transform((res) => res.body);
```

You can use schema parsing in the middle of `Result` transform chain:

```ts
const UserConfig = z.object({
  /* ... */
});

const config = await Result.wrap(readLocalFile('config.json'))
  .transform((content) => Json.pipe(UserConfig).safeParse(content))
  .unwrapOrThrow();
```
