# Zod schema guideline

The basic idea behind schema validation is to find the right balance between strictness of contracts between separately developed systems and the permissiveness of the Renovate itself.

## Don't use `Schema` suffix for naming

Schemas are distinguished by being named with capital letter:

```ts
const ComplexNumber = z.object({
  re: z.number(),
  im: z.number(),
});
```

Don't use names like `ComplexNumberSchema` for that.

## Inferred types

Create inferred types only when they're used somewhere in the code.
Place inferred types just after the schema definition using the same name.

While text editors may confuse schema and type name sometimes, it's obvious which is which from the syntactic context.

Example:

```ts
export const User = z.object({
  firstName: z.string(),
  lastName: z.string(),
});
export type User = z.infer<typeof User>;
```

## Avoid specifying unused fields

External data being queried by Renovate can be very complex.
However, often we need just a couple fields.

If we include unrelated fields in our schemas, we're responsible for them to always be correct.
If we don't include them, the surface of the contract between external data source is minimal, meaning less errors to fix in the future.

Example of **incorrect** usage:

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

## Use `Json`, `Yaml` and `Toml` for string parsing

Sometimes we need to perform additional step such as `JSON.parse()` before validation of the data structure.

Instead, helpers from `schema-utils.ts` should be used.

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

## Use `.transform()` method to process parsed data

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

## Stick to permissive behavior when possible

Zod schemas are strict, and even some insufficient field is incorrect, the whole data will be treated like malformed.
This could lead to cases when Renovate could've continued processing, but didn't.

There are some techniques to make it more permissive to the input data.

### Use `.catch()` to force default values

```ts
const Box = z.object({
  width: z.number().catch(10),
  height: z.number().catch(10),
});

const box = Box.parse({ width: 10, height: null });
// => { width: 10, height: 10 }
```

### Use `LooseArray` and `LooseRecord` to filter out incorrect values from collections

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

## Combining with `Result` class

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
