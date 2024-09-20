# Config Migration

Renovate maintainers often need to rename, remove or combine configuration options to improve the user experience and mature the product.

When they do so, "config migration" code is added at the same time so that any "legacy" config from users continues to work.
Config migration works by migrating legacy config internally before the config is used.
If done right, it "just works" silently and legacy configs continue working indefinitely.
The only sign when this is necessary is a debug message in logs noting the old and newly migrated configs.

By default, none of these changes are applied to Renovate config files (e.g. `renovate.json`)

## Enabling config migration pull requests

Although legacy config should continue to "just work", it's better for users if their config file uses the latest/correct configuration names.
Using the latest names makes it easier to understand the config and look up documentation for it.

Renovate can create a config migration pull request, that migrates legacy config in your configuration file.
To get config migration pull requests from Renovate: set the [`configMigration`](./configuration-options.md#configmigration) config option to `true`.

Config migration PRs are disabled by default.
But we _strongly_ recommend you enable config migration PRs, because:

- the config migration PR "tells" you something changed
- up-to-date terms help you search the Renovate documentation
- up-to-date terms help you, and us, debug problems quicker

## Config migration scenarios

The scenarios for config migration are:

- No config migration needed
- Config migration needed, and enabled
- Config migration needed, but disabled
- Config migration needed, but there is a previously closed migration PR

### No config migration needed

Renovate takes no action.

### Config migration needed, and enabled

Renovate will:

1. Create a Config Migration PR
1. If the Dependency Dashboard issue is enabled then Renovate puts a link to the Config Migration PR on the dashboard

### Config migration needed, but disabled

If config migration is needed, but disabled then Renovate adds a checkbox to the Dependency Dashboard if one exists.
This is known as "on-demand" config migration because migration PRs are only created at the request of the user by ticking the checkbox.

The checkbox looks like this:

```
- [ ] Select this checkbox to let Renovate create an automated Config Migration PR.
```

When you select the checkbox:

Renovate creates a config migration PR.
Renovate replaces the checkbox with a link to the Config Migration PR.

For example:

```
See Config Migration PR: #1.
```

### Config migration needed, but there is a closed migration PR

In this case, it does not matter if Config Migration is enabled, or not.
Renovate will:

- Add a checkbox to the Dependency Dashboard issue (if enabled)
- When you select the checkbox on the dashboard, Renovate will:
  1. Delete the _old_ config migration branch
  1. Create a _new_ config migration PR
  1. Replace the checkbox with a link to the _new_ PR in the Dependency Dashboard issue
