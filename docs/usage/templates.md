---
title: Template fields
description: Explain Renovate template fields
---

# Template fields

In order to provide flexible configuration, Renovate supports using "templates" for certain fields like `addLabels`, `branchName`, `extractVersionTemplate`, `labels`.

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

### decodeURIComponent

If you want to decode a percent-encoded string, use the built-in function `decodeURIComponent` like this:

`{{{decodeURIComponent depName}}}`

In the example above `depName` is the string you want to decode.

Read the [MDN Web Docs, decodeURIComponent()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/decodeURIComponent) to learn more.

### encodeBase64

If you want to convert a string to Base64, use the built-in function `encodeBase64` like this:

`{{{encodeBase64 body}}}`

In the example above `body` is the string you want to transform into a Base64-encoded value.

### replace

The `replace` helper replaces _all_ found strings matching the given regex with the replacement string.
If you want to replace some characters in a string, use the built-in function `replace` like this:

`{{{replace '[a-z]+\.github\.com' 'ghc' depName}}}`

In the example above all matches of the regex `[a-z]+\.github\.com` will be replaced by `ghc` in `depName`.

Read the [MDN Web Docs, String.prototype.replace()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace) to learn more.

### lowercase

The `lowercase` helper converts a given string to lower case.

`{{{ lowercase depName }}}`

### containsString

Returns `true` if a given string is a substring.

`{{#if (containsString depName 'python')}}Python{{else}}Other{{/if}}`

### equals

Returns `true` if two values equals (checks strict equality, i.e. `===`).

`{{#if (equals datasource 'git-refs')}}git-refs{{else}}Other{{/if}}`

### and

Returns `true` only if all expressions are `true`.

`{{#if (and isMajor hasReleaseNotes)}}Backwards Incompatible release! Check out the Release notes.{{/if}}`

In the example above, it will only show a text if `isMajor=true` and `hasReleaseNotes=true`.

### or

Returns `true` if at least one expression is `true`.

`{{#if (or isPatch isSingleVersion}}Small update, safer to merge and release.{{else}}Check out the changelog for all versions before merging!{{/if}}`

### includes

Returns `true` if the value is included on the list given.

`{{#if (includes labels 'dependencies')}}Production Dependencies{{else}}Not Production Dependencies{{/if}}`

## Environment variables

By default, you can only access a handful of basic environment variables like `HOME` or `PATH`.
This is for security reasons.

`HOME is {{env.HOME}}`

If you're self-hosting Renovate, you can expose more variables with the [`customEnvVariables`](./self-hosted-configuration.md#customenvvariables) config option.

You can also use the [`exposeAllEnv`](./self-hosted-configuration.md#exposeallenv) config option to allow all environment variables in templates, but make sure to consider the security implications of giving the scripts unrestricted access to all variables.
