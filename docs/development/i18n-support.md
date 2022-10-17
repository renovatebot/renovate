# I18n Support

This document aims the developers who do not directly work on translation and i18n relevant jobs, but want to ensure anything they contributed is compatible.

Please also read [i18n guide](i18n-guide.md) if you are interest in improving i18n or creating your own translations.

Renovate uses [GNU Gettext](https://www.gnu.org/software/gettext/) to support i18n.

Gettext provides three functions to wrap user-facing strings for making them translatable:

## \_ (an alias of gettext)

The `_()` function is the basic function of Gettext.

When you wrap a string with this function that means you expect that string to be translate at some point.

For example:

```typescript

\_("I should be translated");

```

Please always use the single underscore instead of `gettext` for readability and consistency.

## pgettext

The `pgettext` function is to resolve ambiguities in translations.

For example, in English, the word "sin" could be used both 'to break a religious or moral law' as well as 'written abbreviation for sine specialized'.
You could have a 'religion' context and a 'math' context as to avoid ambiguity.

You can use `pgettext()` for this situations.

For example:

```typescript
pgettext('religion', 'sin');

pgettext('mathletics', 'sin');
```

We used the package path from 'lib' directory to name a context, for example, when a translatable string is containd in file `lib/workers/repository/update/pr/body/config-description.ts`, we will use `'workers/repository/update/pr/body'` as the context:

```typescript
pgettext('worker/repository/update/pr/body', 'Never');
```

The "p" stands for "particular", by the way.

## ngettext

The `ngettext` function is for plural forms. It is similar to the `gettext` function, but it takes two extract arguments:

1. The 1st argument `msgid` contain the sigular form of the string to be translated.
2. The 2nd argument `msgidPlural` is the plural form.
3. The 3ird argument `count` is a number, which is used to determine the plural form.

For example:

```typescript
let log = util.format(ngettext('%d file deleted', '%d files deleted', n), n);
```

when n === 1, log will be '1 file deleted', otherwise 'x files deleted'.
