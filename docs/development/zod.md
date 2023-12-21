### Table of Contents

- [Zod schema guideline](#zod-schema-guideline)
  - [When and where to use Zod](#when-and-where-to-use-zod)
  - [Technical guide](#technical-guide)
    - [Use `schema.ts` files for Zod schemas](#use-schemats-files-for-zod-schemas)
    - [Name schemas without any `Schema` suffix](#name-schemas-without-any-schema-suffix)
    - [Inferred types](#inferred-types)
    - [Specify only necessary fields](#specify-only-necessary-fields)
    - [Use `Json`, `Yaml` and `Toml` for string parsing](#use-json-yaml-and-toml-for-string-parsing)
    - [Use `.transform()` method to process parsed data](#use-transform-method-to-process-validated-data)
      - [Rename and move fields at the top level transform](#rename-and-move-fields-at-the-top-level-transform)
    - [Stick to permissive behavior when possible](#stick-to-permissive-behavior-when-possible)
      - [Use `.catch()` to force default values](#use-catch-to-force-default-values)
      - [Use `LooseArray` and `LooseRecord` to filter out incorrect values from collections](#use-loosearray-and-looserecord-to-filter-out-incorrect-values-from-collections)
    - [Combining with `Result` class](#combining-with-result-class)
    - [Combining with `Http` class](#combining-with-http-class)

# Zod schema guideline

We decided that Renovate should use [Zod](https://github.com/colinhacks/zod) for schema validation.
This means that any new manager or datasource should use Zod as well.
This document explains _how_ and _why_ you should use Zod features.

When writing schema validation you're aiming for a balance between strictness of explicit contracts between separately developed systems, and the permissiveness of Renovate.
We want Renovate to be only as strict as it _needs_ to be.

Renovate should _not_ assume a field is always present.
Such assumptions may lead to run-time errors when a field turns out to be missing.
For example: if Renovate assumes an _optional_ field from a public registry will always be used, it may run into trouble when a self-hosted implementation does not use this field.

## When and where to use Zod

You should use Zod to validate:

- Data received from external APIs and data sources, particularly the `lib/modules/datasource/*` section of Renovate
- Data parsed from files in the repository, particularly the `lib/modules/manager/*` section of Renovate

[The `cdnjs` datasource](https://github.com/renovatebot/renovate/blob/main/lib/modules/datasource/cdnjs/index.ts) is a good example of using Zod schema validations on API responses from external sources.

[The `composer` manager](https://github.com/renovatebot/renovate/blob/main/lib/modules/manager/composer/schema.ts) is a good example of using Zod schema validation in a manager to validate parsed files in a repository.

## Technical guide

### Use `schema.ts` files for Zod schemas

Following well-known refactoring principles, you should put Zod schema code in the correct place.
The Zod schema usually goes in the `schema.ts` files, and the tests go in the `schema.spec.ts` files.
You should write tests for Zod schemas.

Creating or extending Zod schemas on the fly reduces Renovate's performance.
Only create or extend Zod schemas in this way if you _really_ need to.

### Name schemas without any `Schema` suffix

Schema names must start with a capital letter:

```ts
const ComplexNumber = z.object({
  re: z.number(),
  im: z.number(),
});
```

Do _not_ add `Schema` to the end of the schema name.
Avoid names like `ComplexNumberSchema`.

### Inferred types

Create inferred types after schemas if they're needed somewhere in the code.
Place such inferred types just after the schema definition using the same name.

While IDEs may confuse schema and type name sometimes, it's obvious which is which from the syntactic context.

Example:

```ts
export const User = z.object({
  firstName: z.string(),
  lastName: z.string(),
});
export type User = z.infer<typeof User>;
```

### Specify only necessary fields

The external data that Renovate queries can be very complex, but Renovate may only need some of those fields.
Avoid over-specifying schemas, only extract fields Renovate really needs.
This reduces the surface of the contract between the external data source and Renovate, which means less errors to fix in the future.

For example, say you want Renovate to know about the width, height and length of a box.
You should _avoid_ code like this:

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

The code above refers to the `color` and `weight` fields, which Renovate does _not_ need to do its job.
Here's the **correct** code:

```ts
const Box = z.object({
  width: z.number(),
  height: z.number(),
  length: z.number(),
});

const { width, height, length } = Box.parse(input);
const volume = width * height * length;
```

### Use `Json`, `Yaml` and `Toml` for string parsing

You may need to perform extra steps like `JSON.parse()` before you can validate the data structure.
Use the helpers in `schema-utils.ts` for this purpose.

The **wrong** to parse from string:

```ts
const ApiResults = z.array(
  z.object({
    id: z.number(),
    value: z.string(),
  }),
);
type ApiResults = z.infer<typeof ApiResults>;

let results: ApiResults | null = null;
try {
  const json = JSON.parse(input);
  results = ApiResults.parse(json);
} catch (e) {
  results = null;
}
```

The **correct** way to parse from string:

```ts
const ApiResults = Json.pipe(
  z.array(
    z.object({
      id: z.number(),
      value: z.string(),
    }),
  ),
);

const results = ApiResults.parse(input);
```

### Use `.transform()` method to process validated data

Schema validation helps to be more confident with types during downstream data transformation.

If the validated data contains everything you need to transform it, you can apply transformations as the part of the schema itself.

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

Instead, use the idiomatic `.tranform()` method:

```ts
const BoxVolume = z
  .object({
    width: z.number(),
    height: z.number(),
    length: z.number(),
  })
  .transform(({ width, height, length }) => width * height * length);

const volume = BoxVolume.parse({
  width: 10,
  height: 20,
  length: 125,
}); // => 25000
```

#### Rename and move fields at the top level transform

When you need to rename or move object fields, place the code to the top-level transform.

The **wrong** way is to make cascading transformations:

```ts
const SourceUrl = z
  .object({
    meta: z
      .object({
        links: z.object({
          Github: z.string().url(),
        }),
      })
      .transform(({ links }) => links.Github),
  })
  .transform(({ meta: sourceUrl }) => sourceUrl);
```

The **correct** way is to rename at the top-level:

```ts
const SourceUrl = z
  .object({
    meta: z.object({
      links: z.object({
        Github: z.string().url(),
      }),
    }),
  })
  .transform(({ meta }) => meta.links.Github);
```

### Stick to permissive behavior when possible

Zod schemas are strict, which means that if some field is wrong, or missing data, then the whole dataset is considered malformed.
Because Renovate uses Zod, it would then abort processing, even if we want Renovate to continue processing!

Remember: we want to make sure the incoming data is good enough for Renovate to work.
We do _not_ need to validate the data corresponds to any official specification.

Here are some techniques to make Zod more permissive about the input data.

#### Use `.catch()` to force default values

```ts
const Box = z.object({
  width: z.number().catch(10),
  height: z.number().catch(10),
});

const box = Box.parse({ width: 20, height: null });
// => { width: 20, height: 10 }
```

#### Use `LooseArray` and `LooseRecord` to filter out incorrect values from collections

Suppose you want to parse a list of package releases, with elements that may or may not contain `version` field.
In case of missing `version` field, you want to filter out such elements.
If you only use methods from the `zod` library, you would need to write something like this:

```ts
const Versions = z
  .array(
    z
      .object({
        version: z.string(),
      })
      .nullable()
      .catch(null),
  )
  .transform((releases) =>
    releases.filter((x): x is { version: string } => x !== null),
  );
```

When trying to achieve permissive behavior, this pattern will emerge quite frequently, but filtering part of the code is not very readable.

Instead, you should use the `LooseArray` and `LooseRecord` helpers from `schema-utils.ts` to write simpler code:

```ts
const Versions = LooseArray(
  z.object({
    version: z.string(),
  }),
);
```

### Combining with `Result` class

The `Result` (and `AsyncResult`) class represents the result of an operation, like `Result.ok(200)` or `Result.err(404)`.

It supports the `.transform()` method, which is similar to `zod`'s.

It also supports `.onResult()` and `.onError()` methods for side-effectful result inspection.

After all result manipulations are done, you may call `.unwrap()`, `.unwrapOrElse()` or `.unwrapOrThrow()` methods to get the underlying result value.

You can wrap the schema parsing result into the `Result` class:

```ts
const { val, err } = Result.parse(url, z.string().url())
  .transform((url) => http.get(url))
  .onError((err) => {
    logger.warn({ err }, 'Failed to fetch something important');
  })
  .transform((res) => res.body);
```

You can use schema parsing in the middle of the `Result` transform chain:

```ts
const UserConfig = z.object({
  /* ... */
});

const config = await Result.wrap(readLocalFile('config.json'))
  .transform((content) => Json.pipe(UserConfig).safeParse(content))
  .unwrapOrThrow();
```

### Combining with `Http` class

`Http` class supports schema validation for the JSON results of methods like `.getJson()`, `.postJson()`, etc.
Under the hood, `.parseAsync()` method is used (**important consequence**: in case of invalid data, it will throw).

Provide schema in the last argument of the method:

```ts
const Users = z.object({
  users: z.object({
    id: z.number(),
    firstName: z.string(),
    lastName: z.string(),
  }),
});

const { body: users } = await http.getJson(
  'https://dummyjson.com/users',
  LooseArray(User),
);
```

For GET requests, use the `.getJsonSafe()` method which returns a `Result` instance:

```ts
const users = await http
  .getJsonSafe('https://dummyjson.com/users', LooseArray(User))
  .onError((err) => {
    logger.warn({ err }, 'Failed to fetch users');
  })
  .unwrapOrElse([]);
```
