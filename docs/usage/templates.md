---
title: Template fields
description: Explain Renovate template fields
---

# Template fields

In order to provide flexible configuration, Renovate supports using "templates" for certain fields like `branchName`.

Renovate's templates use [handlebars](https://handlebarsjs.com/) under the hood.
You can recognize templates when you see strings like `{{depName}}` in configuration fields.

Below you can find lists of fields/values that you can use in templates.
Some are configuration options passed through, while others are generated as part of Renovate's run.

`logJSON` and `releases` are only allowed in `commitBody` template.

## Exposed config options

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->

<!-- Automatically insert exposed configuration options here -->

## Other available fields

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->

<!-- Insert runtime fields here -->

## Additional Handlebars helpers

### stringToPrettyJSON

If you want to print pretty JSON with Handlebars you can use the built-in function `stringToPrettyJSON` like this:

`{{{stringToPrettyJSON myvar}}}`

In the example above `myvar` is a variable/field, that has valid JSON.

### encodeURIComponent

If you want to convert a string to a valid URI, use the built-in function `encodeURIComponent` like this:

`{{{encodeURIComponent baseDir}}}`

In the example above `baseDir` is the string you want to transform into a valid URI.

Read the [MDN Web Docs, encodeURIComponent()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent) to learn more.

### replace

The `replace` helper replaces _all_ found strings with the replacement string.
If you want to replace some characters in a string, use the built-in function `replace` like this:

`{{{replace 'github.com' 'ghc' depName}}}`

In the example above all matches of `github.com` will be replaced by `ghc` in `depName`.

Read the [MDN Web Docs, String.prototype.replace()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace) to learn more.

### lowercase

The `lowercase` helper converts a given string to lower case.

`{{{ lowercase depName }}}`

### containsString

Returns `true` if a given string is a substring.

`{{#if (containsString depName 'python')}}Python{{else}}Other{{/if}}`

### and

Returns `true` only if all expressions are `true`.

`{{#if (and isMajor hasReleaseNotes)}}Backwards Incompatible release! Check out the Release notes.{{/if}}`

In the example above, it will only show a text if `isMajor=true` and `hasReleaseNotes=true`.

### or

Returns `true` if at least one expression is `true`.

`{{#if (or isPatch isSingleVersion}}Small update, safer to merge and release.{{else}}Check out the changelog for all versions before merging!{{/if}}`
