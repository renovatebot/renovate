# Enrichment Modules

<!-- prettier-ignore -->
!!! warning "This feature is flagged as experimental"
    Experimental features might be changed at any time.
    <br /> <br />
    This feature is in active development. You can see [the current planned work on the parent epic](https://github.com/renovatebot/renovate/issues/40048).

Enrichment Modules provide a way to enrich Renovate's discovered packages and their updates (through Managers and Datasources), and:

- add additional `packageRules`, for instance to add vulnerability information
- skip dependencies/update(s) using `skipReason`s
- provide additional metadata that can be used with `matchJsonata`
