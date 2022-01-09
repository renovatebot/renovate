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

## Exposed config options

<!-- Autogenerate in https://github.com/renovatebot/renovatebot.github.io -->
<!-- Autogenerate end -->

<!-- Automatically insert exposed configuration options here -->

## Other available fields

<!-- Autogenerate in https://github.com/renovatebot/renovatebot.github.io -->
<!-- Autogenerate end -->

<!-- Insert runtime fields here -->

## Additional Handlebars helpers

### stringToPrettyJSON

If you want to print pretty JSON with Handlebars you can use the built-in function `stringToPrettyJSON` like this:

`{{{stringToPrettyJSON myvar}}}`

In the example above `myvar` is a variable/field, that contains valid JSON.

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
