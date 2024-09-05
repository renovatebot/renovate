# Config Migration

The developers may need to rename user-facing configuration options.
For example to:

- Use a better name for a config option, preset or concept
- Make a experimental configuration option officially supported

When this happens, the developers write "config migration" code to tell Renovate the old name and the new name.

When Renovate runs, it silently swaps old terms for new terms.
By default, Renovate does _not_ update the terms in your Renovate configuration file!

### Enabling config migration pull requests

Renovate can create a config migration pull request, that updates old terms in your configuration file.
To enable config migration pull request from Renovate, set the [`configMigration`](./configuration-options.md#configmigration) config option to `true`.

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
- Config migration needed, but there is a closed migration PR

### No config migration needed

Renovate takes no action.

### Config migration needed, and enabled

Renovate will:

1. Create a Config Migration PR
1. If the Dependency Dashboard issue is enabled: Renovate puts a link to the Config Migration PR on the dashboard

3. **Config migration needed but disabled**

   If config migration is required but disabled:

   We add a checkbox to the Dependency Dashboard (if enabled). We call this "on-demand config migration".

   The checkbox will appear in your Dependency Dashboard issue as:

   ```
   [ ] Config migration needed. Please tick this checkbox to create an automated Config Migration PR.
   ```

   - When the user checks the box, Renovate creates a config migration PR and replaces the checkbox with a link:

   ```
   Config Migration necessary. You can view the Config Migration PR here #1
   ```

### Config migration needed, but there is a closed migration PR

In this case, it does not matter if Config Migration is enabled, or not.
Renovate will:

- Add a checkbox to the Dependency Dashboard issue (if enabled)
- When you select the checkbox on the dashboard, Renovate will:
    1. Delete the _old_ config migration branch
    1. Create a _new_ config migration PR
    1. Replace the checkbox with a link to the _new_ PR in the Dependency Dashboard issue

<!-- prettier-ignore -->
!!! note
    For config migration, Renovate's behavior differs from its usual approach to closed PRs. Instead of commenting on the closed PR that no new PR will be created. Instead Renovate adds a checkbox to the Dependency Dashboard issue, allowing users to request a new config migration PR when needed.
