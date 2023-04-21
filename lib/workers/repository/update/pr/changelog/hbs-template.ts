export default `### Release Notes

{{#each upgrades as |upgrade|}}

{{#if upgrade.hasReleaseNotes}}

<details>
<summary>{{upgrade.releaseNotesSummaryTitle}}</summary>

{{#each upgrade.releases as |release|}}

{{#if release.releaseNotes}}

### [\`v{{{release.version}}}\`]({{{release.releaseNotes.url}}}){{#if release.releaseNotes.name}}: {{release.releaseNotes.name}}{{/if}}

{{#if release.compare.url}}

[Compare Source]({{release.compare.url}})

{{/if}}

{{{release.releaseNotes.body}}}

{{/if}}

{{/each}}

</details>

{{/if}}

{{/each}}`;
