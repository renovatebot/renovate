This manager updates the Maven dependencies of a [Kotlin Toolchain](https://kotlin-toolchain.org) project, which are declared in `module.yaml`, `project.yaml`, `*.module-template.yaml` and `libs.versions.toml` files.

It extracts:

- coordinates from the `dependencies` and `test-dependencies` sections, including their platform-qualified variants such as `dependencies@jvm`
- versions of the built-in technologies from the `settings` sections, which are reported under their Maven coordinate
- annotation processors, KSP processors and Kotlin compiler plugins from the `settings` sections
- Maven plugins and their dependencies from the `mavenPlugins` sections
- libraries and their shared versions from the project version catalog

The `repositories` section of the file is used as the registry list for the dependencies of that same file, so a project that resolves from a private repository is looked up there.
Renovate cannot read the `credentials` file that a Kotlin Toolchain repository entry points at, so credentials for a private repository must be configured separately as a `hostRules` entry with `hostType` `maven`.

Dependencies that Renovate cannot look up are still reported, with a `skipReason`: a reference to a version catalog such as `$libs.ktor` or to a built-in catalog such as `$ktor.server.core` gets `contains-variable`, a local module such as `//ui/utils` gets `local-dependency`, and a coordinate whose version comes from a BOM gets `unspecified-version`.
Project catalog references are updated at their declaration in `libs.versions.toml`; their YAML references stay unchanged.
A version that YAML parses as a number instead of a string, such as `version: 3.5`, gets `invalid-value`: quote it to make it updatable.
A value that is not a Maven coordinate at all, such as one with an invalid group or artifact, or with more parts than `group:artifact:version:classifier`, is not reported.

### Built-in technology versions

| Setting                                  | Maven coordinate                                          |
| ---------------------------------------- | --------------------------------------------------------- |
| `kotlin.version`                         | `org.jetbrains.kotlin:kotlin-stdlib`                      |
| `kotlin.serialization.version`           | `org.jetbrains.kotlinx:kotlinx-serialization-core`        |
| `kotlin.rpc.version`                     | `org.jetbrains.kotlinx:kotlinx-rpc-bom`                   |
| `kotlin.ksp.version`                     | `com.google.devtools.ksp:symbol-processing-api`           |
| `kotlin.dataframe.version`               | `org.jetbrains.kotlinx:dataframe-core`                    |
| `compose.version`                        | `org.jetbrains.compose.runtime:runtime`                   |
| `compose.experimental.hotReload.version` | `org.jetbrains.compose.hot-reload:hot-reload-runtime-api` |
| `jvm.test.junitPlatformVersion`          | `org.junit.platform:junit-platform-console-standalone`    |
| `ktor.version`                           | `io.ktor:ktor-bom`                                        |
| `lombok.version`                         | `org.projectlombok:lombok`                                |
| `springBoot.version`                     | `org.springframework.boot:spring-boot-dependencies`       |

Use these coordinates in `matchPackageNames`, and the `depType` `settings` in `matchDepTypes`.
`compose.experimental.hotReload.version` is additionally looked up in the JetBrains Compose Hot Reload repository, because the toolchain adds that repository to a module which uses the technology.

### Recognizing a Kotlin Toolchain file

The file patterns of this manager are broad, so a file is only treated as a Kotlin Toolchain file when its top-level keys look like one.
A `project.yaml` needs a `modules` or a `mavenPlugins` key.
Any other file needs `product`, `apply`, `mavenPlugins`, or a `dependencies` or `settings` section.
A file that passes this check but holds no coordinates is reported with an empty dependency list.

### Version catalogs

The manager reads one project catalog at `libs.versions.toml` or `gradle/libs.versions.toml`, relative to the Kotlin Toolchain project root.
A `project.yaml` defines a project root; without one, a `module.yaml` defines a standalone project.
Catalogs outside those locations are left to other managers.
If both locations exist in the same project, the manager skips them because Kotlin Toolchain permits only one project catalog.

The supported sections are `[libraries]` and `[versions]`.
Libraries can use `group:artifact:version` strings, inline `module` or `group`/`name` declarations, literal versions and `version.ref` references.
Libraries that share a `version.ref` are grouped using that shared version.
Version updates preserve comments, formatting and other entries with the same version value.
Rich version constraints are reported with `unsupported-version`; Kotlin Toolchain does not support them.
`[plugins]` and `[bundles]` are ignored.

Catalog dependencies use Maven Central and Google Maven, plus the repositories declared in YAML files within the same project that reference the corresponding `$libs` alias.
Unreferenced catalog entries use the default repositories.

The Gradle manager is not required for a Kotlin Toolchain project, including one whose catalog is still under `gradle/`.
When `build.gradle`, `build.gradle.kts`, `settings.gradle` or `settings.gradle.kts` exists at the project root, the catalog remains owned by Gradle so its plugin updates are preserved.
For catalogs owned by Kotlin Toolchain, duplicate Gradle extraction is suppressed.

For a repository that uses only Kotlin Toolchain, an optional manager allowlist is:

```json
{
  "extends": ["config:recommended"],
  "enabledManagers": ["kotlin-toolchain"]
}
```

The Kotlin Toolchain manager is enabled by default.
The Gradle manager is also enabled by default, but this allowlist disables all other managers, including Gradle.
The Kotlin Toolchain manager does not enable Gradle itself.

### Known limitations

Repositories declared in a `*.module-template.yaml` are not merged into the modules that `apply` the template.
Each file is looked up against the repositories that it declares itself.

Maven Central and Google Maven are always part of the registry list.
A repository entry with `resolve: false` only drops that entry.
It does not disable a default repository.
A repository entry that redirects a default by declaring `id: mavenCentral` or `id: mavenGoogle` with another URL is added to the list instead of replacing the default.

Dependencies taken from a `settings` section all get the `depType` `settings`, even when they come from `test-settings` or from a platform-qualified `settings@jvm`.
Only the `dependencies` sections keep their qualifier in the `depType`.
`mavenPlugins` is read as an exact key.
It has no `test-` or `@<platform>` variants.

The Kotlin Toolchain file format is in Alpha and may still change between releases.

### Disabling dependency updates

To disable dependency updates performed by the Kotlin Toolchain manager:

```json
{
  "kotlin-toolchain": {
    "enabled": false
  }
}
```

This setting disables YAML and version catalog updates by the Kotlin Toolchain manager.
If the Gradle manager remains enabled, it can still update `libs.versions.toml` and `gradle/libs.versions.toml`.
The `enabledManagers` allowlist above excludes Gradle, so disabling the Kotlin Toolchain manager with that allowlist also stops version catalog updates.
