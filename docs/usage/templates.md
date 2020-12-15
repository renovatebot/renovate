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

<!-- Automatically insert exposed configuration options here -->

## Other available fields

<!-- Insert runtime fields here -->
