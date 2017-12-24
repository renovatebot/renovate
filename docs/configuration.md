# Configuration

## Configuration Methods

Configuration is supported via any or all of the below:

* Configuration file
* Environment
* CLI
* `renovate.json` in target repository
* `renovate` field of `package.json` in target repository

The above are listed in reverse order of preference. i.e. `package.json`
settings will override `renovate.json` settings, CLI, which overrides env, which
overrides the config file, which overrides defaults.

### Default Configuration

Default configuration values can be found in
[lib/config/definitions.js](../lib/config/definitions.js)

### Configuration File

You can override default configuration using a configuration file, with default
name `config.js` in the working directory. If you need an alternate location or
name, set it in the environment variable `RENOVATE_CONFIG_FILE`.

Using a configuration file gives you very granular configuration options. For
instance, you can override most settings at the global (file), repository, or
package level. e.g. apply one set of labels for `backend/package.json` and a
different set for `frontend/package.json` in the same repository.

```javascript
module.exports = {
  labels: ['upgrade'],
  depTypes: ['dependencies', 'devDependencies'],
  repositories: [
    {
      repository: 'singapore/repo1',
      packageFiles: [
        'package.json',
        {
          packageFile: 'frontend/package.json',
          labels: ['upgrade', 'frontend'],
        },
      ],
    },
    {
      repository: 'singapore/repo2',
      depTypes: [
        'dependencies',
        'devDependencies',
        {
          depType: 'optionalDependencies',
          labels: ['renovate', 'optional'],
        },
      ],
      labels: ['renovate'],
    },
    'singapore/repo3',
  ],
  packages: [
    {
      package: 'jquery',
      labels: ['jquery', 'uhoh'],
    },
  ],
};
```

### CLI

```
$ node renovate --help
```

To configure any `<list>` items, separate with commas. E.g. `renovate --labels=renovate,dependency`.

### renovate.json

If you add a `renovate.json` file to the root of your repository, you can use
this to override default settings. If you leave the `packageFiles` field empty
then `renovate` will still auto-discover all `package.json` files in the
repository.

### package.json

If you add configuration options to your `package.json` then these will override
any other settings above. Obviously, you can't set repository or package file
location with this method.

```json
"renovate": {
  "labels": [
    "upgrade",
    "bot"
  ]
}
```

## Configuration Options

<table>
<tr>
  <th>Name</th>
  <th>Description</th>
  <th>Type</th>
  <th>Default value</th>
  <th>Environment</th>
  <th>CLI</th>
</tr>
<tr>
  <td>`extends`</td>
  <td>Configuration presets to use/extend</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td>`RENOVATE_EXTENDS`</td>
  <td><td>
</tr>
<tr>
  <td>`description`</td>
  <td>Plain text description for a config or preset</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`enabled`</td>
  <td>Enable or disable renovate</td>
  <td>boolean</td>
  <td><pre>true</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`logLevel`</td>
  <td>Logging level</td>
  <td>string</td>
  <td><pre>"info"</pre></td>
  <td>`LOG_LEVEL`</td>
  <td>`--log-level`<td>
</tr>
<tr>
  <td>`logFile`</td>
  <td>Log file path</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_LOG_FILE`</td>
  <td>`--log-file`<td>
</tr>
<tr>
  <td>`logFileLevel`</td>
  <td>Log file log level</td>
  <td>string</td>
  <td><pre>"debug"</pre></td>
  <td>`RENOVATE_LOG_FILE_LEVEL`</td>
  <td>`--log-file-level`<td>
</tr>
<tr>
  <td>`onboarding`</td>
  <td>Require a Configuration PR first</td>
  <td>boolean</td>
  <td><pre>true</pre></td>
  <td>`RENOVATE_ONBOARDING`</td>
  <td>`--onboarding`<td>
</tr>
<tr>
  <td>`renovateFork`</td>
  <td>Whether to renovate a forked repository or not.</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_RENOVATE_FORK`</td>
  <td>`--renovate-fork`<td>
</tr>
<tr>
  <td>`forkMode`</td>
  <td>Set to true if Renovate should fork the source repository and create branches there instead</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_FORK_MODE`</td>
  <td>`--fork-mode`<td>
</tr>
<tr>
  <td>`privateKey`</td>
  <td>Server-side private key</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_PRIVATE_KEY`</td>
  <td>`--private-key`<td>
</tr>
<tr>
  <td>`encrypted`</td>
  <td>A configuration object containing configuration encrypted with project key. Valid inside renovate.json only</td>
  <td>json</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_ENCRYPTED`</td>
  <td>`--encrypted`<td>
</tr>
<tr>
  <td>`timezone`</td>
  <td>[IANA Time Zone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_TIMEZONE`</td>
  <td>`--timezone`<td>
</tr>
<tr>
  <td>`schedule`</td>
  <td>Times of day/week to renovate</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`updateNotScheduled`</td>
  <td>Whether to update (but not create) branches when not scheduled</td>
  <td>boolean</td>
  <td><pre>true</pre></td>
  <td>`RENOVATE_UPDATE_NOT_SCHEDULED`</td>
  <td>`--update-not-scheduled`<td>
</tr>
<tr>
  <td>`platform`</td>
  <td>Platform type of repository</td>
  <td>string</td>
  <td><pre>"github"</pre></td>
  <td>`RENOVATE_PLATFORM`</td>
  <td>`--platform`<td>
</tr>
<tr>
  <td>`endpoint`</td>
  <td>Custom endpoint to use</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_ENDPOINT`</td>
  <td>`--endpoint`<td>
</tr>
<tr>
  <td>`token`</td>
  <td>Repository Auth Token</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_TOKEN`</td>
  <td>`--token`<td>
</tr>
<tr>
  <td>`npmrc`</td>
  <td>String copy of npmrc file. Use \n instead of line breaks</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_NPMRC`</td>
  <td>`--npmrc`<td>
</tr>
<tr>
  <td>`yarnrc`</td>
  <td>String copy of yarnrc file. Use \n instead of line breaks</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_YARNRC`</td>
  <td>`--yarnrc`<td>
</tr>
<tr>
  <td>`copyLocalLibs`</td>
  <td>enable copy local libraries found in package.json like `"lib1: file:../path/to/folder"`, warning: feature may be deprecated in future.</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_COPY_LOCAL_LIBS`</td>
  <td>`--copy-local-libs`<td>
</tr>
<tr>
  <td>`ignoreNpmrcFile`</td>
  <td>Whether to ignore any .npmrc file found in repository</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_IGNORE_NPMRC_FILE`</td>
  <td>`--ignore-npmrc-file`<td>
</tr>
<tr>
  <td>`autodiscover`</td>
  <td>Autodiscover all repositories</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_AUTODISCOVER`</td>
  <td>`--autodiscover`<td>
</tr>
<tr>
  <td>`repositories`</td>
  <td>List of Repositories</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td>`RENOVATE_REPOSITORIES`</td>
  <td><td>
</tr>
<tr>
  <td>`baseBranch`</td>
  <td>Base branch to target for Pull Requests. Otherwise default branch is used</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`gitAuthor`</td>
  <td>Author to use for git commits. RFC5322</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_GIT_AUTHOR`</td>
  <td>`--git-author`<td>
</tr>
<tr>
  <td>`gitPrivateKey`</td>
  <td>PGP key to use for signing git commits</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_GIT_PRIVATE_KEY`</td>
  <td><td>
</tr>
<tr>
  <td>`packageFiles`</td>
  <td>Package file paths</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td>`RENOVATE_PACKAGE_FILES`</td>
  <td>`--package-files`<td>
</tr>
<tr>
  <td>`ignorePaths`</td>
  <td>Skip any package.json whose path matches one of these. Can be string or glob pattern</td>
  <td>list</td>
  <td><pre>["**/node_modules/**", "**/bower_components/**"]</pre></td>
  <td>`RENOVATE_IGNORE_PATHS`</td>
  <td>`--ignore-paths`<td>
</tr>
<tr>
  <td>`dependencies`</td>
  <td>Configuration specifically for `package.json`>`dependencies`</td>
  <td>json</td>
  <td><pre>{"semanticCommitType": "fix"}</pre></td>
  <td>`RENOVATE_DEPENDENCIES`</td>
  <td><td>
</tr>
<tr>
  <td>`devDependencies`</td>
  <td>Configuration specifically for `package.json`>`devDependencies`</td>
  <td>json</td>
  <td><pre>{}</pre></td>
  <td>`RENOVATE_DEV_DEPENDENCIES`</td>
  <td><td>
</tr>
<tr>
  <td>`optionalDependencies`</td>
  <td>Configuration specifically for `package.json`>`optionalDependencies`</td>
  <td>json</td>
  <td><pre>{}</pre></td>
  <td>`RENOVATE_OPTIONAL_DEPENDENCIES`</td>
  <td><td>
</tr>
<tr>
  <td>`peerDependencies`</td>
  <td>Configuration specifically for `package.json`>`peerDependencies`</td>
  <td>json</td>
  <td><pre>{"enabled": false}</pre></td>
  <td>`RENOVATE_PEER_DEPENDENCIES`</td>
  <td><td>
</tr>
<tr>
  <td>`ignoreDeps`</td>
  <td>Dependencies to ignore</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td>`RENOVATE_IGNORE_DEPS`</td>
  <td>`--ignore-deps`<td>
</tr>
<tr>
  <td>`packageRules`</td>
  <td>Rules for matching package names</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`packageNames`</td>
  <td>Package names to match. Valid only within `packageRules` object</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`excludePackageNames`</td>
  <td>Package names to exclude. Valid only within `packageRules` object</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`packagePatterns`</td>
  <td>Package name patterns to match. Valid only within `packageRules` object.</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`excludePackagePatterns`</td>
  <td>Package name patterns to exclude. Valid only within `packageRules` object.</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`pinDigests`</td>
  <td>Whether to add digests to Dockerfile source images</td>
  <td>boolean</td>
  <td><pre>true</pre></td>
  <td>`RENOVATE_PIN_DIGESTS`</td>
  <td>`--pin-digests`<td>
</tr>
<tr>
  <td>`pinVersions`</td>
  <td>Convert ranged versions to pinned versions</td>
  <td>boolean</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_PIN_VERSIONS`</td>
  <td>`--pin-versions`<td>
</tr>
<tr>
  <td>`separateMajorReleases`</td>
  <td>If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches</td>
  <td>boolean</td>
  <td><pre>true</pre></td>
  <td>`RENOVATE_SEPARATE_MAJOR_RELEASES`</td>
  <td>`--separate-major-releases`<td>
</tr>
<tr>
  <td>`multipleMajorPrs`</td>
  <td>If set to true, PRs will be raised separately for each available major upgrade version</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_MULTIPLE_MAJOR_PRS`</td>
  <td>`--multiple-major-prs`<td>
</tr>
<tr>
  <td>`separatePatchReleases`</td>
  <td>If set to true, it will separate minor and patch updates into separate branches</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_SEPARATE_PATCH_RELEASES`</td>
  <td>`--separate-patch-releases`<td>
</tr>
<tr>
  <td>`ignoreFuture`</td>
  <td>Ignore versions tagged as "future"</td>
  <td>boolean</td>
  <td><pre>true</pre></td>
  <td>`RENOVATE_IGNORE_FUTURE`</td>
  <td>`--ignore-future`<td>
</tr>
<tr>
  <td>`ignoreUnstable`</td>
  <td>Ignore versions with unstable semver</td>
  <td>boolean</td>
  <td><pre>true</pre></td>
  <td>`RENOVATE_IGNORE_UNSTABLE`</td>
  <td>`--ignore-unstable`<td>
</tr>
<tr>
  <td>`unstablePattern`</td>
  <td>Regex for identifying unstable versions (docker only)</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`respectLatest`</td>
  <td>Ignore versions newer than npm "latest" version</td>
  <td>boolean</td>
  <td><pre>true</pre></td>
  <td>`RENOVATE_RESPECT_LATEST`</td>
  <td>`--respect-latest`<td>
</tr>
<tr>
  <td>`branchPrefix`</td>
  <td>Prefix to use for all branch names</td>
  <td>string</td>
  <td><pre>"renovate/"</pre></td>
  <td>`RENOVATE_BRANCH_PREFIX`</td>
  <td>`--branch-prefix`<td>
</tr>
<tr>
  <td>`major`</td>
  <td>Configuration to apply when an update type is major</td>
  <td>json</td>
  <td><pre>{}</pre></td>
  <td>`RENOVATE_MAJOR`</td>
  <td><td>
</tr>
<tr>
  <td>`minor`</td>
  <td>Configuration to apply when an update type is minor</td>
  <td>json</td>
  <td><pre>{}</pre></td>
  <td>`RENOVATE_MINOR`</td>
  <td><td>
</tr>
<tr>
  <td>`patch`</td>
  <td>Configuration to apply when an update type is patch. Only applies if `separatePatchReleases` is set to true</td>
  <td>json</td>
  <td><pre>{
  "branchName": "{{branchPrefix}}{{depNameSanitized}}-{{newVersionMajor}}.{{newVersionMinor}}.x"
}</pre></td>
  <td>`RENOVATE_PATCH`</td>
  <td><td>
</tr>
<tr>
  <td>`pin`</td>
  <td>Configuration to apply when an update type is pin.</td>
  <td>json</td>
  <td><pre>{
  "unpublishSafe": false,
  "recreateClosed": true,
  "rebaseStalePrs": true,
  "groupName": "Pin Dependencies",
  "group": {"commitMessage": "Pin Dependencies", "prTitle": "{{groupName}}"}
}</pre></td>
  <td>`RENOVATE_PIN`</td>
  <td><td>
</tr>
<tr>
  <td>`digest`</td>
  <td>Configuration to apply when updating a Docker digest (same tag)</td>
  <td>json</td>
  <td><pre>{}</pre></td>
  <td>`RENOVATE_DIGEST`</td>
  <td><td>
</tr>
<tr>
  <td>`semanticCommits`</td>
  <td>Enable semantic commit prefixes for commits and PR titles</td>
  <td>boolean</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_SEMANTIC_COMMITS`</td>
  <td>`--semantic-commits`<td>
</tr>
<tr>
  <td>`semanticCommitType`</td>
  <td>Commit type to use if semantic commits is enabled</td>
  <td>string</td>
  <td><pre>"chore"</pre></td>
  <td>`RENOVATE_SEMANTIC_COMMIT_TYPE`</td>
  <td>`--semantic-commit-type`<td>
</tr>
<tr>
  <td>`semanticCommitScope`</td>
  <td>Conmmit scope to use if semantic commits are enabled</td>
  <td>string</td>
  <td><pre>"deps"</pre></td>
  <td>`RENOVATE_SEMANTIC_COMMIT_SCOPE`</td>
  <td>`--semantic-commit-scope`<td>
</tr>
<tr>
  <td>`recreateClosed`</td>
  <td>Recreate PRs even if same ones were closed previously</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_RECREATE_CLOSED`</td>
  <td>`--recreate-closed`<td>
</tr>
<tr>
  <td>`rebaseStalePrs`</td>
  <td>Rebase stale PRs (GitHub only)</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_REBASE_STALE_PRS`</td>
  <td>`--rebase-stale-prs`<td>
</tr>
<tr>
  <td>`unpublishSafe`</td>
  <td>Set a status check for unpublish-safe upgrades</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_UNPUBLISH_SAFE`</td>
  <td>`--unpublish-safe`<td>
</tr>
<tr>
  <td>`prCreation`</td>
  <td>When to create the PR for a branch. Values: immediate, not-pending, status-success.</td>
  <td>string</td>
  <td><pre>"immediate"</pre></td>
  <td>`RENOVATE_PR_CREATION`</td>
  <td>`--pr-creation`<td>
</tr>
<tr>
  <td>`prNotPendingHours`</td>
  <td>Timeout in hours for when prCreation=not-pending</td>
  <td>integer</td>
  <td><pre>24</pre></td>
  <td>`RENOVATE_PR_NOT_PENDING_HOURS`</td>
  <td>`--pr-not-pending-hours`<td>
</tr>
<tr>
  <td>`automerge`</td>
  <td>Whether to automerge branches/PRs automatically, without human intervention</td>
  <td>boolean</td>
  <td><pre>false</pre></td>
  <td>`RENOVATE_AUTOMERGE`</td>
  <td>`--automerge`<td>
</tr>
<tr>
  <td>`automergeType`</td>
  <td>How to automerge - "branch-merge-commit", "branch-push" or "pr". Branch support is GitHub-only</td>
  <td>string</td>
  <td><pre>"pr"</pre></td>
  <td>`RENOVATE_AUTOMERGE_TYPE`</td>
  <td>`--automerge-type`<td>
</tr>
<tr>
  <td>`requiredStatusChecks`</td>
  <td>List of status checks that must pass before automerging. Set to null to enable automerging without tests.</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`branchName`</td>
  <td>Branch name template</td>
  <td>string</td>
  <td><pre>"{{branchPrefix}}{{depNameSanitized}}-{{newVersionMajor}}.x"</pre></td>
  <td>`RENOVATE_BRANCH_NAME`</td>
  <td><td>
</tr>
<tr>
  <td>`commitMessage`</td>
  <td>Commit message template</td>
  <td>string</td>
  <td><pre>"Update dependency {{depName}} to {{#unless isRange}}v{{/unless}}{{newVersion}}"</pre></td>
  <td>`RENOVATE_COMMIT_MESSAGE`</td>
  <td><td>
</tr>
<tr>
  <td>`prTitle`</td>
  <td>Pull Request title template</td>
  <td>string</td>
  <td><pre>"{{#if isPin}}Pin{{else}}{{#if isRollback}}Roll back{{else}}Update{{/if}}{{/if}} dependency {{depName}} to {{#if isRange}}{{newVersion}}{{else}}{{#if isMajor}}v{{newVersionMajor}}{{else}}v{{newVersion}}{{/if}}{{/if}}"</pre></td>
  <td>`RENOVATE_PR_TITLE`</td>
  <td><td>
</tr>
<tr>
  <td>`prBody`</td>
  <td>Pull Request body template</td>
  <td>string</td>
  <td><pre>"This Pull Request {{#if isRollback}}rolls back{{else}}updates{{/if}} dependency {{#if repositoryUrl}}[{{depName}}]({{repositoryUrl}}){{else}}{{depName}}{{/if}} from `{{#unless isRange}}{{#unless isPin}}v{{/unless}}{{/unless}}{{currentVersion}}` to `{{#unless isRange}}v{{/unless}}{{newVersion}}`{{#if isRollback}}. This is necessary and important because `v{{currentVersion}}` cannot be found in the npm registry - probably because of it being unpublished.{{/if}}\n{{#if releases.length}}\n\n{{#if schedule}}\n**Note**: This PR was created on a configured schedule (\"{{schedule}}\"{{#if timezone}} in timezone `{{timezone}}`{{/if}}) and will not receive updates outside those times.\n{{/if}}\n\n### Commits\n\n<details>\n<summary>{{githubName}}</summary>\n\n{{#each releases as |release|}}\n#### {{release.version}}\n{{#each release.commits as |commit|}}\n-   [`{{commit.shortSha}}`]({{commit.url}}) {{commit.message}}\n{{/each}}\n{{/each}}\n\n</details>\n{{/if}}\n\n{{#if hasErrors}}\n\n---\n\n### Errors\n\nRenovate encountered some errors when processing your repository, so you are being notified here even if they do not directly apply to this PR.\n\n{{#each errors as |error|}}\n-   `{{error.depName}}`: {{error.message}}\n{{/each}}\n{{/if}}\n\n{{#if hasWarnings}}\n\n---\n\n### Warnings\n\nPlease make sure the following warnings are safe to ignore:\n\n{{#each warnings as |warning|}}\n-   `{{warning.depName}}`: {{warning.message}}\n{{/each}}\n{{/if}}\n\n---\n\nThis PR has been generated by [Renovate Bot](https://renovateapp.com)."</pre></td>
  <td>`RENOVATE_PR_BODY`</td>
  <td><td>
</tr>
<tr>
  <td>`lockFileMaintenance`</td>
  <td>Configuration for lock file maintenance</td>
  <td>json</td>
  <td><pre>{
  "enabled": false,
  "recreateClosed": true,
  "branchName": "{{branchPrefix}}lock-file-maintenance",
  "commitMessage": "Update lock file",
  "prTitle": "Lock file maintenance",
  "prBody": "This Pull Request updates `package.json` lock files to use the latest dependency versions.\n\n{{#if schedule}}\n**Note**: This PR was created on a configured schedule (\"{{schedule}}\"{{#if timezone}} in timezone `{{timezone}}`{{/if}}) and will not receive updates outside those times.\n{{/if}}\n\n{{#if hasErrors}}\n\n---\n\n### Errors\n\nRenovate encountered some errors when processing your repository, so you are being notified here even if they do not directly apply to this PR.\n\n{{#each errors as |error|}}\n-   `{{error.depName}}`: {{error.message}}\n{{/each}}\n{{/if}}\n\n{{#if hasWarnings}}\n\n---\n\n### Warnings\n\nPlease make sure the following warnings are safe to ignore:\n\n{{#each warnings as |warning|}}\n-   `{{warning.depName}}`: {{warning.message}}\n{{/each}}\n{{/if}}\n\n---\n\nThis PR has been generated by [Renovate Bot](https://renovateapp.com).",
  "schedule": ["before 5am on monday"],
  "groupName": null
}</pre></td>
  <td>`RENOVATE_LOCK_FILE_MAINTENANCE`</td>
  <td><td>
</tr>
<tr>
  <td>`lazyGrouping`</td>
  <td>Use group names only when multiple dependencies upgraded</td>
  <td>boolean</td>
  <td><pre>true</pre></td>
  <td>`RENOVATE_LAZY_GROUPING`</td>
  <td>`--lazy-grouping`<td>
</tr>
<tr>
  <td>`groupName`</td>
  <td>Human understandable name for the dependency group</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td>`RENOVATE_GROUP_NAME`</td>
  <td>`--group-name`<td>
</tr>
<tr>
  <td>`groupSlug`</td>
  <td>Slug to use for group (e.g. in branch name). Will be calculated from groupName if null</td>
  <td>string</td>
  <td><pre>null</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`group`</td>
  <td>Config if groupName is enabled</td>
  <td>json</td>
  <td><pre>{
  "branchName": "{{branchPrefix}}{{groupSlug}}",
  "commitMessage": "Update {{groupName}} packages",
  "prTitle": "Update {{groupName}} packages{{#if singleVersion}} to {{#unless isRange}}v{{/unless}}{{singleVersion}}{{/if}}",
  "prBody": "This Pull Request renovates the package group \"{{groupName}}\".\n\n{{#if schedule}}\n**Note**: This PR was created on a configured schedule (\"{{schedule}}\"{{#if timezone}} in timezone `{{timezone}}`{{/if}}) and will not receive updates outside those times.\n{{/if}}\n\n{{#each upgrades as |upgrade|}}\n-   {{#if repositoryUrl}}[{{upgrade.depName}}]({{upgrade.repositoryUrl}}){{else}}{{depName}}{{/if}}: from `{{upgrade.currentVersion}}` to `{{upgrade.newVersion}}`\n{{/each}}\n\n{{#unless isPin}}\n### Commits\n\n{{#each upgrades as |upgrade|}}\n{{#if upgrade.releases.length}}\n<details>\n<summary>{{upgrade.githubName}}</summary>\n{{#each upgrade.releases as |release|}}\n\n#### {{release.version}}\n{{#each release.commits as |commit|}}\n-   [`{{commit.shortSha}}`]({{commit.url}}){{commit.message}}\n{{/each}}\n{{/each}}\n\n</details>\n{{/if}}\n{{/each}}\n{{/unless}}\n<br />\n\n{{#if hasErrors}}\n\n---\n\n### Errors\n\nRenovate encountered some errors when processing your repository, so you are being notified here even if they do not directly apply to this PR.\n\n{{#each errors as |error|}}\n-   `{{error.depName}}`: {{error.message}}\n{{/each}}\n{{/if}}\n\n{{#if hasWarnings}}\n\n---\n\n### Warnings\n\nPlease make sure the following warnings are safe to ignore:\n\n{{#each warnings as |warning|}}\n-   `{{warning.depName}}`: {{warning.message}}\n{{/each}}\n{{/if}}\n\n---\n\nThis PR has been generated by [Renovate Bot](https://renovateapp.com)."
}</pre></td>
  <td></td>
  <td><td>
</tr>
<tr>
  <td>`labels`</td>
  <td>Labels to add to Pull Request</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td>`RENOVATE_LABELS`</td>
  <td>`--labels`<td>
</tr>
<tr>
  <td>`assignees`</td>
  <td>Assignees for Pull Request (user name in GitHub/GitLab, email address in VSTS)</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td>`RENOVATE_ASSIGNEES`</td>
  <td>`--assignees`<td>
</tr>
<tr>
  <td>`reviewers`</td>
  <td>Requested reviewers for Pull Requests (user name in GitHub/GitLab, email or user name in VSTS)</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td>`RENOVATE_REVIEWERS`</td>
  <td>`--reviewers`<td>
</tr>
<tr>
  <td>`npm`</td>
  <td>Configuration object for npm package.json renovation</td>
  <td>json</td>
  <td><pre>{"enabled": true}</pre></td>
  <td>`RENOVATE_NPM`</td>
  <td>`--npm`<td>
</tr>
<tr>
  <td>`meteor`</td>
  <td>Configuration object for meteor package.js renovation</td>
  <td>json</td>
  <td><pre>{"enabled": true}</pre></td>
  <td>`RENOVATE_METEOR`</td>
  <td>`--meteor`<td>
</tr>
<tr>
  <td>`bazel`</td>
  <td>Configuration object for bazel WORKSPACE renovation</td>
  <td>json</td>
  <td><pre>{"enabled": true}</pre></td>
  <td>`RENOVATE_BAZEL`</td>
  <td>`--bazel`<td>
</tr>
<tr>
  <td>`supportPolicy`</td>
  <td>Dependency support policy, e.g. used for LTS vs non-LTS etc (node-only)</td>
  <td>list</td>
  <td><pre>[]</pre></td>
  <td>`RENOVATE_SUPPORT_POLICY`</td>
  <td>`--support-policy`<td>
</tr>
<tr>
  <td>`node`</td>
  <td>Configuration object for node version renovation</td>
  <td>json</td>
  <td><pre>{
  "enabled": false,
  "supportPolicy": ["lts"],
  "branchName": "{{branchPrefix}}node-{{depNameSanitized}}",
  "prBody": "This Pull Request updates {{depName}} versions from `{{currentVersions}}` to `{{newVersions}}`. This is according to the configured node.js support policy \"{{supportPolicy}}\".\n\n{{#if schedule}}\n**Note**: This PR was created on a configured schedule (\"{{schedule}}\"{{#if timezone}} in timezone `{{timezone}}`{{/if}}) and will not receive updates outside those times.\n{{/if}}\n\n{{#if hasErrors}}\n\n---\n\n### Errors\n\nRenovate encountered some errors when processing your repository, so you are being notified here even if they do not directly apply to this PR.\n\n{{#each errors as |error|}}\n-   `{{error.depName}}`: {{error.message}}\n{{/each}}\n{{/if}}\n\n{{#if hasWarnings}}\n\n---\n\n### Warnings\n\nPlease make sure the following warnings are safe to ignore:\n\n{{#each warnings as |warning|}}\n-   `{{warning.depName}}`: {{warning.message}}\n{{/each}}\n{{/if}}\n\n---\n\nThis PR has been generated by [Renovate Bot](https://renovateapp.com).",
  "prTitle": "Update {{depName}} versions to [{{newVersions}}]"
}</pre></td>
  <td>`RENOVATE_NODE`</td>
  <td>`--node`<td>
</tr>
<tr>
  <td>`docker`</td>
  <td>Configuration object for Dockerfile renovation</td>
  <td>json</td>
  <td><pre>{
  "enabled": true,
  "branchName": "{{branchPrefix}}docker-{{depNameSanitized}}-{{newVersionMajor}}.x",
  "commitMessage": "Update {{depName}} to tag {{newTag}}",
  "prTitle": "Update {{depName}} Dockerfile tag to {{#if isMajor}}v{{newVersionMajor}}{{else}}v{{newTag}}{{/if}}",
  "prBody": "This Pull Request updates Docker base image {{depName}} from tag `{{currentTag}}` to new tag `{{newTag}}`. For details on Renovate's Docker support, please visit https://renovateapp.com/docs/language-support/docker\n\n{{#if schedule}}\n**Note**: This PR was created on a configured schedule (\"{{schedule}}\"{{#if timezone}} in timezone `{{timezone}}`{{/if}}) and will not receive updates outside those times.\n{{/if}}\n\n{{#if hasErrors}}\n\n---\n\n### Errors\n\nRenovate encountered some errors when processing your repository, so you are being notified here even if they do not directly apply to this PR.\n\n{{#each errors as |error|}}\n-   `{{error.depName}}`: {{error.message}}\n{{/each}}\n{{/if}}\n\n{{#if hasWarnings}}\n\n---\n\n### Warnings\n\nPlease make sure the following warnings are safe to ignore:\n\n{{#each warnings as |warning|}}\n-   `{{warning.depName}}`: {{warning.message}}\n{{/each}}\n{{/if}}\n\n---\n\nThis PR has been generated by [Renovate Bot](https://renovateapp.com).",
  "major": {"enabled": false},
  "digest": {
    "branchName": "{{branchPrefix}}docker-{{depNameSanitized}}-{{currentTag}}",
    "commitMessage": "Update {{depName}}:{{currentTag}} digest",
    "prBody": "This Pull Request updates Docker base image `{{depName}}:{{currentTag}}` to the latest digest (`{{newDigest}}`). For details on Renovate's Docker support, please visit https://renovateapp.com/docs/language-support/docker\n\n{{#if schedule}}\n**Note**: This PR was created on a configured schedule (\"{{schedule}}\"{{#if timezone}} in timezone `{{timezone}}`{{/if}}) and will not receive updates outside those times.\n{{/if}}\n\n{{#if hasErrors}}\n\n---\n\n### Errors\n\nRenovate encountered some errors when processing your repository, so you are being notified here even if they do not directly apply to this PR.\n\n{{#each errors as |error|}}\n-   `{{error.depName}}`: {{error.message}}\n{{/each}}\n{{/if}}\n\n{{#if hasWarnings}}\n\n---\n\n### Warnings\n\nPlease make sure the following warnings are safe to ignore:\n\n{{#each warnings as |warning|}}\n-   `{{warning.depName}}`: {{warning.message}}\n{{/each}}\n{{/if}}\n\n---\n\nThis PR has been generated by [Renovate Bot](https://renovateapp.com).",
    "prTitle": "Update Dockerfile {{depName}} image {{currentTag}} digest ({{newDigestShort}})"
  },
  "pin": {
    "branchName": "{{branchPrefix}}docker-pin-{{depNameSanitized}}-{{currentTag}}",
    "prTitle": "Pin Dockerfile {{depName}}:{{currentTag}} image digest",
    "prBody": "This Pull Request pins Docker base image `{{depName}}:{{currentTag}}` to use a digest (`{{newDigest}}`).\nThis digest will then be kept updated via Pull Requests whenever the image is updated on the Docker registry. For details on Renovate's Docker support, please visit https://renovateapp.com/docs/language-support/docker\n\n{{#if schedule}}\n**Note**: This PR was created on a configured schedule (\"{{schedule}}\"{{#if timezone}} in timezone `{{timezone}}`{{/if}}) and will not receive updates outside those times.\n{{/if}}\n\n{{#if hasErrors}}\n\n---\n\n### Errors\n\nRenovate encountered some errors when processing your repository, so you are being notified here even if they do not directly apply to this PR.\n\n{{#each errors as |error|}}\n-   `{{error.depName}}`: {{error.message}}\n{{/each}}\n{{/if}}\n\n{{#if hasWarnings}}\n\n---\n\n### Warnings\n\nPlease make sure the following warnings are safe to ignore:\n\n{{#each warnings as |warning|}}\n-   `{{warning.depName}}`: {{warning.message}}\n{{/each}}\n{{/if}}\n\n---\n\nThis PR has been generated by [Renovate Bot](https://renovateapp.com).",
    "groupName": "Pin Docker Digests",
    "group": {
      "prTitle": "Pin Docker digests",
      "prBody": "This Pull Request pins Dockerfiles to use image digests. For details on Renovate's Docker support, please visit https://renovateapp.com/docs/language-support/docker\n\n{{#if schedule}}\n**Note**: This PR was created on a configured schedule (\"{{schedule}}\"{{#if timezone}} in timezone `{{timezone}}`{{/if}}) and will not receive updates outside those times.\n{{/if}}\n\n{{#each upgrades as |upgrade|}}\n-   {{#if repositoryUrl}}[{{upgrade.depName}}]({{upgrade.repositoryUrl}}){{else}}{{depName}}{{/if}}: `{{upgrade.newDigest}}`\n{{/each}}\n\n{{#if hasErrors}}\n\n---\n\n### Errors\n\nRenovate encountered some errors when processing your repository, so you are being notified here even if they do not directly apply to this PR.\n\n{{#each errors as |error|}}\n-   `{{error.depName}}`: {{error.message}}\n{{/each}}\n{{/if}}\n\n{{#if hasWarnings}}\n\n---\n\n### Warnings\n\nPlease make sure the following warnings are safe to ignore:\n\n{{#each warnings as |warning|}}\n-   `{{warning.depName}}`: {{warning.message}}\n{{/each}}\n{{/if}}\n\n---\n\nThis PR has been generated by [Renovate Bot](https://renovateapp.com)."
    }
  },
  "group": {
    "prTitle": "Update Docker {{groupName}} digests",
    "prBody": "This Pull Request updates Dockerfiles to use image digests.\n\n{{#if schedule}}\n**Note**: This PR was created on a configured schedule (\"{{schedule}}\"{{#if timezone}} in timezone `{{timezone}}`{{/if}}) and will not receive updates outside those times.\n{{/if}}\n\n{{#each upgrades as |upgrade|}}\n-   {{#if repositoryUrl}}[{{upgrade.depName}}]({{upgrade.repositoryUrl}}){{else}}{{depName}}{{/if}}: `{{upgrade.newDigest}}`\n{{/each}}\n\n{{#if hasErrors}}\n\n---\n\n### Errors\n\nRenovate encountered some errors when processing your repository, so you are being notified here even if they do not directly apply to this PR.\n\n{{#each errors as |error|}}\n-   `{{error.depName}}`: {{error.message}}\n{{/each}}\n{{/if}}\n\n{{#if hasWarnings}}\n\n---\n\n### Warnings\n\nPlease make sure the following warnings are safe to ignore:\n\n{{#each warnings as |warning|}}\n-   `{{warning.depName}}`: {{warning.message}}\n{{/each}}\n{{/if}}\n\n---\n\nThis PR has been generated by [Renovate Bot](https://renovateapp.com)."
  }
}</pre></td>
  <td>`RENOVATE_DOCKER`</td>
  <td><td>
</tr>
