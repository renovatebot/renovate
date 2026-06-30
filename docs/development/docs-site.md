# Docs site

The [Renovate docs site](https://docs.renovatebot.com) is built from this repository.

The publishing process is triggered automatically on commits to `main`.
If you have submitted a documentation PR and your changes are not published within a day feel free to ping the maintainers, on the PR that introduced the docs change.

## Fenced code blocks

JSON code blocks will be validated to ensure that they are:

- well-formed JSON
- Renovate config which does not need config migration
- valid Renovate configuration (with no warnings or errors)

This is validated through `pnpm run doc-fence-check`.

It is possible to completely ignore this validation check by using a `<!-- schema-validation-disable-next-block -->` comment before the code block.

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
