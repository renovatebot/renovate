Renovate supports updating PKGBUILD files used in Arch Linux packaging.

Renovate will:

1. Extract the `pkgver` and `source` URL from PKGBUILD files
2. Parse source URLs to identify the package and current version
3. Check for new versions using the appropriate datasource
4. Update the `pkgver`, source URL, and checksums when new versions are available

**Supported Features:**

- **Version Detection**: Extracts version from `pkgver` field
- **Source URL Parsing**: Supports multiple package sources (see below)
- **Checksum Updates**: Automatically updates `sha256sums`, `sha512sums`, `b2sums`, and `md5sums`
- **Variable Expansion**: Handles `${pkgver}` and `$pkgver` in source URLs
- **Self-hosted Instances**: Supports self-hosted GitLab and Git repositories

**Supported Datasources:**

The PKGBUILD manager automatically detects and uses the appropriate datasource based on the source URL:

### GitHub

```bash
# Archive URLs
source=("https://github.com/owner/repo/archive/v${pkgver}.tar.gz")
source=("https://github.com/owner/repo/archive/refs/tags/v${pkgver}.tar.gz")

# Release URLs
source=("https://github.com/owner/repo/releases/download/v${pkgver}/archive.tar.gz")
```

### GitLab

```bash
# GitLab.com
source=("https://gitlab.com/owner/repo/-/archive/v${pkgver}/repo-v${pkgver}.tar.gz")

# Self-hosted GitLab
source=("https://gitlab.example.com/owner/repo/-/archive/v${pkgver}/repo-v${pkgver}.tar.gz")
```

### PyPI (Python packages)

```bash
source=("https://files.pythonhosted.org/packages/source/p/package/package-${pkgver}.tar.gz")
source=("https://pypi.org/packages/source/p/package/package-${pkgver}.tar.gz")
```

### npm (Node.js packages)

```bash
# Regular packages
source=("https://registry.npmjs.org/typescript/-/typescript-${pkgver}.tgz")

# Scoped packages
source=("https://registry.npmjs.org/@angular/core/-/core-${pkgver}.tgz")
```

### CPAN (Perl packages)

```bash
source=("https://cpan.metacpan.org/authors/id/L/LE/LEONT/Module-Build-${pkgver}.tar.gz")
```

### Generic Git Repositories

For Gitea, Forgejo, cgit, or other Git hosting platforms:

```bash
# Archive URLs
source=("https://git.example.com/owner/repo/archive/v${pkgver}.tar.gz")

# Direct Git URLs
source=("https://gitea.example.com/org/repo.git")
```

**Examples:**

GitHub Package:

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

Python Package:

```bash
pkgname=python-requests
pkgver=2.31.0
pkgrel=1
pkgdesc="Python HTTP library"
arch=('any')
url="https://requests.readthedocs.io"
license=('Apache')
depends=('python')
source=("https://files.pythonhosted.org/packages/source/r/requests/requests-${pkgver}.tar.gz")
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
- For sources not automatically detected, use Renovate's [custom regex manager](https://docs.renovatebot.com/modules/manager/regex/) instead
