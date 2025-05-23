## Purpose

The `templateStrings` object in Renovate config allows customization of user-facing string content in Renovate PRs, Issues, Check runs, etc.
By modifying the content of `templateStrings` values you can customize Renovate's content exactly as you like it, but you could also risk breaking it too, so be careful.

## Customization

You can customize `templateStrings` similarly to other Renovate config, for example:

```json
{
  "templateStrings": {
    "prBody": "Hello World!\n\n{{{header}}}{{{table}}}{{{warnings}}}{{{notes}}}{{{controls}}}{{{footer}}}"
  }
}
```

The config is "mergeable", so you only need to include what you want to change and not copy/paste the entire defaults.

## Available fields

### dashboardFooter

Any text added here will be placed last in the Dependency Dashboard issue body, with a divider separator before it.

### dashboardHeader

Any text added here will be placed first in the Dependency Dashboard issue body.

### dashboardTitle

### prBody

This field is used to control which sections are present in Renovate's regular update/pin/etc Pull Requests.
i.e. not for special PRs like Onboarding or Config Migration.

We recommend that you avoid changing this template if possible and instead see if you can satisfy your needs by changing e.g. the `header` or `footer` content via other template strings.

The available sections are:

- `header`
- `table`
- `warnings`
- `notes`
- `changelogs`
- `configDescription`
- `controls`
- `footer`

Previously known as `prBodyTemplate`.

## prFooter

Text added here will be placed last in the PR body, with a divider separator before it.

## prHeader

Text added here will be placed first in the PR body.
