Renovate supports updating [Shareable Config Presets](../../../config-presets.md) for Renovate configuration.

The preset versions are only updated if the version is already pinned.
For example, `github>user/renovate-config#1.2.3` will be updated to `github>user/renovate-config#1.2.4` if the `1.2.4` version is available, but `github>user/renovate-config` will not be pinned.

```json
{
  "extends": [
    "github>user/renovate-config#1.2.3",
    "github>user/renovate-config:group"
  ]
}
```

### Unsupported Config

- [Local presets](../../../config-presets.md#local-presets)
- [HTTP URLs presets](../../../config-presets.md#fetching-presets-from-an-http-server)
- [`package.json` file config](../../../configuration-options.md) (deprecated)
- [`npm` hosted presets](../../../config-presets.md#npm-hosted-presets) (deprecated)
- `extends` inside sub objects, like `packageRules`
