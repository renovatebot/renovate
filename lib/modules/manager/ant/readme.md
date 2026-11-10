Extracts Apache Ant dependencies from `build.xml` files that use the `maven-resolver-ant-tasks` or `maven-ant-tasks` library.
Dependencies are looked up using the Maven datasource.

### Supported syntax

Renovate extracts dependencies from `<dependency>` elements in two formats:

- Separate attributes: `groupId`, `artifactId`, `version`, and optional `scope`
- Coords attribute: `coords="group:artifact:version"` or `coords="group:artifact:version:scope"`

### Property resolution

Version values can reference Ant properties defined via `<property name="..." value="..."/>` or loaded from external `.properties` files via `<property file="..."/>`.
Ant's first-definition-wins semantics are respected.

### File traversal

Renovate follows `<import file="..."/>` elements to extract dependencies from imported build files.
Properties defined before an `<import>` are available in the imported file.

### Registry URLs

Renovate discovers Maven registry URLs from:

- `settingsFile` attribute on `<artifact:dependencies>` elements (parsed as a Maven `settings.xml`)
- Inline `<remoteRepository url="..." />` elements within dependency blocks

Discovered registries are scoped to their dependency block.
