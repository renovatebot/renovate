# Config Migration

Config migration is necessary when Renovate's configuration options are updated. Users can enable automatic config migration pull requests by setting the [configMigration](./configuration-options.md#configmigration) option to `true`.

While this feature is disabled by default, we strongly recommend enabling it to prevent unexpected behavior due to outdated configurations. Keeping your config up-to-date can significantly reduce debugging time for both users and maintainers when issues arise.

Here are the possible scenarios related to config migration:

1. **No config migration needed**

   Renovate takes no action.

2. **Config migration needed and enabled**

   Renovate creates a Config Migration PR and adds a link to it at the top of the Dependency Dashboard issue (if enabled).

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

4. **Config migration needed, but a closed migration PR exists**

   In this case, regardless of whether config migration is enabled:

   - Renovate adds a checkbox to the Dependency Dashboard issue (if enabled).
   - When checked, Renovate:
     1. Deletes the old config migration branch.
     2. Creates a new config migration PR.
     3. Replaces the checkbox with a link to the new PR in the Dependency Dashboard issue.

<!-- prettier-ignore -->
!!! note
    For config migration, Renovate's behavior differs from its usual approach to closed PRs. Instead of commenting on the closed PR that no new PR will be created. Instead Renovate adds a checkbox to the Dependency Dashboard issue, allowing users to request a new config migration PR when needed.
