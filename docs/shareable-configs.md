# Shareable configs

Renovate uses the term "presets" to refer to shareable config snippets, similar to eslint.

## Supported config syntax

### Scoped

```
@somescope
```

This will resolve to use the preset `default` in the npm package `@somescope/renovate-config`.

### Scoped with package name

```
@somescope/somepackagename
```

This will resolve to use the preset `default` in the npm package `@somescope/somepackagename`.

### Scoped with preset name

```
@somescope:webapp
```

This will resolve to use the preset `webapp` in the npm package `@somescope/renovate-config`.

### Scoped with params

```
@somescope(eslint, stylelint)
```

This will resolve to use the preset `default` in the npm package `@somescope/renovate-config` and pass the parameters `eslint` and `stylelint`.

### Scoped with preset name and params

```
@somescope:webapp(eslint, stylelint)
```

This will resolve to use the preset `webapp` in the npm package `@somescope/renovate-config` and pass the parameters `eslint` and `stylelint`.

### Scoped with package name and preset name

```
@somescope/somepackagename:webapp
```

This will resolve to use the preset `webapp` in the npm package `@somescope/somepackagename`.

### Scoped with package name and preset name and params

```
@somescope/somepackagename:webapp(eslint, stylelint)
```

This will resolve to use the preset `webapp` in the npm package `@somescope/somepackagename` and pass the parameters `eslint` and `stylelint`.

### Non-scoped short with preset name

Note: if using non-scoped packages, a preset name is mandatory.

```
somepackagename:default
```

This will resolve to use the preset `default` in the npm package `renovate-config-somepackagename`.

### Non-scoped short with preset name and params

Note: if using non-scoped packages, a preset name is mandatory.

```
somepackagename:default(eslint)
```

This will resolve to use the preset `default` in the npm package `renovate-config-somepackagename` with param `eslint`.

### Non-scoped full with preset name

Note: if using non-scoped packages, a preset name is mandatory.

```
renovate-config-somepackagename:default
```

This will resolve to use the preset `default` in the npm package `renovate-config-somepackagename`.

### Non-scoped full with preset name and params

Note: if using non-scoped packages, a preset name is mandatory.

```
renovate-config-somepackagename:default(eslint)
```

This will resolve to use the preset `default` in the npm package `renovate-config-somepackagename` and param `eslint`.
