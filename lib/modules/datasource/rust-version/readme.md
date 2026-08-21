This datasource fetches available Rust compiler versions from the official Rust distribution infrastructure at <https://static.rust-lang.org/manifests.txt>.

## How it works

The datasource retrieves version information from a single source file (`manifests.txt`) which contains chronological URLs to manifest files for all Rust releases.
Rather than fetching each individual manifest TOML file, version information is extracted directly from the URL patterns using regex parsing.

## Supported Versions

The datasource only returns versions that correspond to specific Rust releases:

- **Stable releases**: `1.81.0`, `1.82.0`, etc.
- **Beta releases**: `1.83.0-beta.4`, `1.83.0-beta.5`, etc.
- **Dated nightlies**: `nightly-2025-11-23`, `nightly-2025-11-24`, etc.

## Version Extraction

Manifest URLs follow this pattern:

```
static.rust-lang.org/dist/YYYY-MM-DD/channel-rust-{identifier}.toml
```

Examples:

- `static.rust-lang.org/dist/2025-11-24/channel-rust-nightly.toml`
  → Version: `nightly-2025-11-24`
- `static.rust-lang.org/dist/2024-10-17/channel-rust-1.82.0.toml`
  → Version: `1.82.0`
- `static.rust-lang.org/dist/2025-01-15/channel-rust-1.83.0-beta.5.toml`
  → Version: `1.83.0-beta.5`

## Release Timestamps

Release timestamps are derived from the date in the manifest URL and set to midnight UTC (`YYYY-MM-DDTHH:MM:SS.000Z`). This provides day-level precision for release timing.

## Versioning Scheme

This datasource uses the `rust-release-channel` versioning scheme, which understands Rust's release channels, dated nightlies, and semantic versioning for stable and beta releases.
