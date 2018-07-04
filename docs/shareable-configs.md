# Preset configs

Renovate uses the term "presets" to refer to shareable config snippets, similar
to eslint. Unlike eslint though:

- Presets may be as small as a list of package names, or as large as a full
  config
- Shared config files can contain many presets

## Preset config URIs

In human-understandable form, the rules are:

- A full preset URI consists of package name, preset name, and preset
  parameters, such as `package:preset(param)`
- If a package scope is specified and no package, then the package name is
  assumed to be `renovate-config`, e.g. `@rarkins:webapp` is expanded to
  `@rarkins/renovate-config:webapp`
- If a non-scoped package is specified then it is assumed to have prefix
  `renovate-config-`. e.g. `rarkins:webapp` is expanded to
  `renovate-config-rarkins:webapp`
- If a package name is specified and no preset name, then `default` is assumed,
  e.g. `@rarkins` expands in full to `@rarkins/renovate-config:default` and
  `rarkins` expands in full to `renovate-config-rarkins:default`
- There is a special "default" namespace where no package name is necessary.
  e.g. `:webapp` (not the leading `:`) expands to
  `renovate-config-default:webapp`

## Supported config syntax

### Scoped

```
@somescope
```

This will resolve to use the preset `default` in the npm package
`@somescope/renovate-config`.

### Scoped with package name

```
@somescope/somepackagename
```

This will resolve to use the preset `default` in the npm package
`@somescope/somepackagename`.

### Scoped with preset name

```
@somescope:webapp
```

This will resolve to use the preset `webapp` in the npm package
`@somescope/renovate-config`.

### Scoped with params

```
@somescope(eslint, stylelint)
```

This will resolve to use the preset `default` in the npm package
`@somescope/renovate-config` and pass the parameters `eslint` and `stylelint`.

### Scoped with preset name and params

```
@somescope:webapp(eslint, stylelint)
```

This will resolve to use the preset `webapp` in the npm package
`@somescope/renovate-config` and pass the parameters `eslint` and `stylelint`.

### Scoped with package name and preset name

```
@somescope/somepackagename:webapp
```

This will resolve to use the preset `webapp` in the npm package
`@somescope/somepackagename`.

### Scoped with package name and preset name and params

```
@somescope/somepackagename:webapp(eslint, stylelint)
```

This will resolve to use the preset `webapp` in the npm package
`@somescope/somepackagename` and pass the parameters `eslint` and `stylelint`.

### Non-scoped short with preset name

Note: if using non-scoped packages, a preset name is mandatory.

```
somepackagename:default
```

This will resolve to use the preset `default` in the npm package
`renovate-config-somepackagename`.

### Non-scoped short with preset name and params

Note: if using non-scoped packages, a preset name is mandatory.

```
somepackagename:default(eslint)
```

This will resolve to use the preset `default` in the npm package
`renovate-config-somepackagename` with param `eslint`.

### Non-scoped full with preset name

Note: if using non-scoped packages, a preset name is mandatory.

```
renovate-config-somepackagename:default
```

This will resolve to use the preset `default` in the npm package
`renovate-config-somepackagename`.

### Non-scoped full with preset name and params

Note: if using non-scoped packages, a preset name is mandatory.

```
renovate-config-somepackagename:default(eslint)
```

This will resolve to use the preset `default` in the npm package
`renovate-config-somepackagename` and param `eslint`.
