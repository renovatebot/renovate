# Config Migration

As part of continuous improvement and refinement, the Renovate maintainers often rename, remove or combine configuration options.

When the Renovate maintainers change configuration options, they add "config migration" code.
The migration code allows "legacy" config from users to keep working.
Config migration works by migrating legacy config internally, before the config is used.
If done right, config migration "just works" silently and legacy configs continue working indefinitely.
The only sign that "config migration" is needed is the debug message in the Renovate logs, noting the old and newly migrated configs.

## Enabling config migration pull requests

Even though Renovate allows you to keep using "legacy config", we recommend you update the configuration names in your config regularly.
Using the latest names:

- makes it easier for you to understand the config
- helps you find the documentation for the config

Renovate can create a config migration Pull Request, to migrate legacy config in your configuration file.
To get automated config migration Pull Requests from Renovate: set the [`configMigration`](./configuration-options.md#configmigration) config option to `true`.

Config migration PRs are disabled by default.
But we recommend you enable config migration PRs, because:

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
1. If the Dependency Dashboard issue is enabled, then Renovate puts a link to the Config Migration PR on the dashboard

### Config migration needed, but disabled

If config migration is needed, but disabled then Renovate adds a checkbox to the Dependency Dashboard (if the dashboard exists).
This is known as "on-demand" config migration, because migration PRs are only created at the request of the user by ticking the checkbox.

The checkbox looks like this:

```
- [ ] Select this checkbox to let Renovate create an automated Config Migration PR.
```

When you select the checkbox:

1. Renovate creates a config migration PR
2. Renovate replaces the checkbox with a link to the Config Migration PR

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
