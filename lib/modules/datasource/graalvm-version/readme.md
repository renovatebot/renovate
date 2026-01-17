# graalvm-version

This datasource returns Oracle GraalVM releases from the [mise-java.jdx.dev API](https://mise-java.jdx.dev).

The API provides Java distributions for multiple vendors, operating systems, and architectures.
This datasource specifically focuses on Oracle GraalVM distributions.

## Package Name Format

The package name encodes the vendor and image type:

- `oracle-graalvm-jdk` - Oracle GraalVM JDK
- `oracle-graalvm-jre` - Oracle GraalVM JRE

## Query Parameters

- `system=true` - Auto-detect OS and architecture from the current system
- `os=<os>` - Explicitly specify OS (`linux`, `macosx`, `windows`)
- `architecture=<arch>` - Explicitly specify architecture (`x86_64`, `aarch64`, `arm32`, `i686`)
- `releaseType=<type>` - Specify release type (`ga` for general availability, `ea` for early access)

## Examples

Fetch Oracle GraalVM JDK for the current system:

```json
{ "packageNames": ["oracle-graalvm-jdk?system=true"] }
```

Fetch Oracle GraalVM JRE for macOS on Apple Silicon:

```json
{ "packageNames": ["oracle-graalvm-jre?os=macosx&architecture=aarch64"] }
```

## Supported Platforms

The mise-java API supports:

- **OS**: `linux`, `macosx`, `windows`
- **Architecture**: `x86_64`, `aarch64`, `arm32`, `i686`

Not all vendor/OS/architecture combinations may be available.
