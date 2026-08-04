# Docs site

The [Renovate docs site](https://docs.renovatebot.com) is built from this repository.

The publishing process is triggered automatically on commits to `main`.
If you have submitted a documentation PR and your changes are not published within a day feel free to ping the maintainers, on the PR that introduced the docs change.

## Fenced code blocks

`json`, `jsonc`, `js` and `javascript` code blocks will be validated to ensure that they are:

- well-formed JSON, JSONC, or JavaScript (`js`/`javascript` blocks are evaluated the same way Renovate loads a real `config.js` file)
- Renovate config which does not need config migration
- valid Renovate configuration (with no warnings or errors)

`js`/`javascript` blocks default to being validated as [Global Self-Hosted config](../usage/self-hosted-configuration.md), since repository config files cannot be JavaScript. `json`/`jsonc` blocks default to Repository config.

`js`/`javascript` validation only runs on files under `docs/` and `readme.md` files under `lib/`, since other `.md` files in `lib/` may contain arbitrary JavaScript examples unrelated to Renovate config.

This is validated through `pnpm run doc-fence-check`.

There are two comments you can add before a code block to opt out of validation, while still keeping the block's language tag for syntax highlighting:

- `<!-- schema-validation-disable-next-block -->` skips the Renovate config/schema/migration checks, but the block must still be well-formed JSON, JSONC, or JavaScript. Use this when the block is valid but intentionally not Renovate config, for example a cache data structure or extracted dependency data.
- `<!-- doc-fence-check-disable-next-block -->` skips validation entirely, including the well-formedness check. Use this when the block isn't even parseable as a single JSON/JSONC/JavaScript document, for example illustrative pseudocode, truncated examples, or debug log output.

Where a JSON code block is _not_ Renovate config, you can specify:

````markdown
```json {configType=none}
{
  "in": "valid"
}
```
````

By default, the validation treats a JSON code block as [Repository Config](../usage/configuration-options.md).
When writing a JSON snippet for [Global Self-Hosted config](../usage/self-hosted-configuration.md), you will need to note that:

````markdown
```json {configType=global}
{
  "allowedEnv": ["foo"]
}
```
````

It may be the case that there is a configuration warning that appears which may be safe to ignore, which can be done so with:

````markdown
```json {ignoreConfigWarnings=true}
{
  "example-deprecated": true
}
```
````
