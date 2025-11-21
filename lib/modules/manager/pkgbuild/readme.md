Renovate supports updating PKGBUILD files used in Arch Linux packaging.

Renovate will:

1. Extract the `pkgver` and `source` URL from PKGBUILD files
2. Parse GitHub and GitLab URLs to identify the repository and current version
3. Check for new versions using the appropriate datasource (GitHub Tags or GitLab Tags)
4. Update the `pkgver`, source URL, and checksums when new versions are available

**Supported Features:**

- **Version Detection**: Extracts version from `pkgver` field
- **Source URL Parsing**: Supports GitHub and GitLab archive and release URLs
- **Checksum Updates**: Automatically updates `sha256sums`, `sha512sums`, `b2sums`, and `md5sums`
- **Variable Expansion**: Handles `${pkgver}` and `$pkgver` in source URLs
- **Self-hosted GitLab**: Supports self-hosted GitLab instances
- **Custom Datasources**: Configure any Renovate datasource using comments

**Supported Source URL Formats:**

GitHub Archive URLs:

```bash
source=("https://github.com/owner/repo/archive/v${pkgver}.tar.gz")
source=("https://github.com/owner/repo/archive/refs/tags/v${pkgver}.tar.gz")
```

GitHub Release URLs:

```bash
source=("https://github.com/owner/repo/releases/download/v${pkgver}/archive.tar.gz")
```

GitLab Archive URLs:

```bash
source=("https://gitlab.com/owner/repo/-/archive/v${pkgver}/repo-v${pkgver}.tar.gz")
```

Self-hosted GitLab:

```bash
source=("https://gitlab.example.com/owner/repo/-/archive/v${pkgver}/repo-v${pkgver}.tar.gz")
```

**Custom Datasource Configuration:**

For sources that aren't GitHub or GitLab, use a comment to specify custom datasource configuration. This allows you to use any Renovate datasource.

Syntax:

```bash
# renovate: datasource=<datasource-name> depName=<package-name> [registryUrl=<url>] [packageName=<package>] [versioning=<versioning>]
```

Supported fields:

- `datasource` (required): The Renovate datasource to use (e.g., `forgejo-releases`, `cpan`, `pypi`, `npm`, etc.)
- `depName` (required): The dependency name to display and track
- `registryUrl` (optional): Custom registry URL
- `packageName` (optional): Override the package name used for lookups
- `versioning` (optional): Custom versioning scheme

**Examples:**

Forgejo/Gitea Releases:

```bash
# Maintainer: Your Name <you@example.com>
# renovate: datasource=forgejo-releases depName=goern/forgejo-mcp registryUrl=https://codeberg.org
pkgname=forgejo-mcp
pkgver=1.0.0
pkgrel=1
source=("https://codeberg.org/goern/forgejo-mcp/releases/download/v${pkgver}/forgejo-mcp-${pkgver}.tar.gz")
sha256sums=('...')
```

CPAN (Perl):

```bash
# Maintainer: Your Name <you@example.com>
# renovate: datasource=cpan depName=Mojolicious
pkgname=perl-mojolicious
pkgver=9.36
pkgrel=1
source=("https://cpan.metacpan.org/authors/id/S/SR/SRI/Mojolicious-${pkgver}.tar.gz")
sha256sums=('...')
```

PyPI (Python):

```bash
# Maintainer: Your Name <you@example.com>
# renovate: datasource=pypi packageName=Django depName=python-django
pkgname=python-django
pkgver=4.2.7
pkgrel=1
source=("https://pypi.io/packages/source/D/Django/Django-${pkgver}.tar.gz")
sha256sums=('...')
```

npm:

```bash
# renovate: datasource=npm depName=typescript
pkgname=typescript
pkgver=5.3.3
source=("https://registry.npmjs.org/typescript/-/typescript-${pkgver}.tgz")
sha256sums=('...')
```

Automatic Detection (GitHub/GitLab):

```bash
pkgname=mypackage
pkgver=1.2.3
pkgrel=1
pkgdesc="My awesome package"
arch=('x86_64')
url="https://github.com/owner/repo"
license=('MIT')
source=("https://github.com/owner/repo/archive/v${pkgver}.tar.gz")
sha256sums=('abc123def456...')
```

**Configuration:**

The PKGBUILD manager is enabled by default and requires no special configuration. However, you can customize its behavior:

```json
{
  "pkgbuild": {
    "enabled": true
  }
}
```

For AUR package maintainers, a typical configuration might look like:

```json
{
  "extends": ["config:recommended"],
  "pkgbuild": {
    "automerge": false,
    "commitMessagePrefix": "upgpkg: ",
    "commitMessageTopic": "{{depName}}",
    "commitMessageExtra": "{{currentVersion}} -> {{newVersion}}"
  }
}
```

**Checksum Support:**

Renovate will automatically update the following checksum types if present:

- `sha256sums`
- `sha512sums`
- `b2sums` (BLAKE2)
- `md5sums`

The manager downloads the new source archive and computes all checksums automatically.

**Limitations:**

- Architecture-specific checksums (e.g., `sha256sums_x86_64`) are supported but all must use the same source URL
- Multiple sources in a single PKGBUILD are not yet supported
