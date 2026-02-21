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

### Packagist (PHP packages)

```bash
source=("https://packagist.org/packages/vendor/package/${pkgver}.tar.gz")
```

### Gitea

```bash
# Gitea.com
source=("https://gitea.com/owner/repo/archive/v${pkgver}.tar.gz")

# Codeberg (runs Gitea/Forgejo)
source=("https://codeberg.org/owner/repo/archive/v${pkgver}.tar.gz")

# Self-hosted Gitea
source=("https://gitea.example.com/owner/repo/archive/v${pkgver}.tar.gz")
```

**Note:** Hostname must contain "gitea" or be a known instance (gitea.com, codeberg.org) for automatic detection.

### Forgejo

```bash
# Forgejo official instance
source=("https://code.forgejo.org/owner/repo/archive/v${pkgver}.tar.gz")

# Self-hosted Forgejo
source=("https://forgejo.example.com/owner/repo/archive/v${pkgver}.tar.gz")
```

**Note:** Hostname must contain "forgejo" or be code.forgejo.org for automatic detection.

### Generic Git Repositories

For other Git hosting platforms (cgit, etc.) that don't match the above patterns:

```bash
# Archive URLs (falls back to git-tags datasource)
source=("https://git.example.com/owner/repo/archive/v${pkgver}.tar.gz")

# Direct Git URLs
source=("https://git.example.com/org/repo.git")
```

### Custom Datasource Configuration

When automatic source URL detection doesn't work correctly (e.g., CPAN packages with non-standard naming, or packages needing a specific Repology repository), you can override the datasource and dependency name using a comment:

```bash
# renovate: datasource=cpan depName=LWP
pkgname=perl-libwww
pkgver=6.81
source=("https://cpan.metacpan.org/authors/id/O/OA/OALDERS/libwww-perl-${pkgver}.tar.gz")
```

You can also specify additional properties like `extractVersion`, `versioning`, and `registryUrl`:

```bash
# renovate: datasource=github-tags depName=nginx/nginx extractVersion=^release-(?<version>.+)$ versioning=semver
pkgname=nginx
pkgver=1.28.0
source=("https://nginx.org/download/nginx-${pkgver}.tar.gz")
```

```bash
# renovate: datasource=gitlab-tags depName=amavis/amavis registryUrl=https://gitlab.com
pkgname=amavisd
pkgver=2.14.0
source=("https://gitlab.com/amavis/amavis/-/archive/v${pkgver}/amavis-v${pkgver}.tar.gz")
```

This custom configuration takes priority over automatic URL detection and Repology fallbacks.

### Repology (Fallback)

For sources that don't match any of the above patterns, Renovate automatically uses [Repology](https://repology.org/) as a fallback datasource. Repology aggregates package information from many repositories.

**Automatic Detection:**

When a source URL doesn't match any known pattern, Renovate will automatically use Repology with the AUR (Arch User Repository):

```bash
pkgname=custom-package
pkgver=1.5.0
source=("https://example.com/downloads/custom-package-${pkgver}.tar.gz")
# Will automatically use repology datasource with "aur/custom-package"
```

**Manual Configuration (Legacy):**

You can explicitly specify a Repology repository using a comment:

```bash
# renovate: repology=arch_linux_stable/nginx
pkgname=nginx
pkgver=1.24.0
source=("https://nginx.org/download/nginx-${pkgver}.tar.gz")
```

!!! note
The `# renovate: repology=` format is a legacy shorthand.
For new configurations, prefer the general `# renovate: datasource=repology depName=arch_linux_stable/nginx` format.

Available Repology repositories include:

- `aur` - Arch User Repository
- `arch_linux_stable` - Arch Linux official repositories
- `debian_stable` - Debian Stable
- `freebsd` - FreeBSD ports
- `gentoo` - Gentoo
- And many more - see [Repology repositories list](https://repology.org/repositories/statistics)

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

Custom Source with Repology:

```bash
# renovate: repology=arch_linux_stable/nginx
pkgname=nginx
pkgver=1.24.0
pkgrel=1
pkgdesc="HTTP and reverse proxy server"
arch=('x86_64')
url="https://nginx.org"
license=('BSD')
source=("https://nginx.org/download/nginx-${pkgver}.tar.gz")
sha256sums=('abc123def456...')
```

Architecture-Specific Checksums:

```bash
pkgname=mypackage
pkgver=2.0.0
pkgrel=1
pkgdesc="Multi-architecture package"
arch=('x86_64' 'aarch64')
url="https://github.com/owner/repo"
license=('MIT')
source=("https://github.com/owner/repo/archive/v${pkgver}.tar.gz")
# Renovate will automatically update all architecture-specific checksums
sha256sums_x86_64=('abc123def456...')
sha256sums_aarch64=('def456abc123...')
```

Automatic Filename-Based Fallback:

```bash
# No pkgname needed - Renovate extracts "custom-tool" from the filename
pkgver=1.5.0
source=("https://downloads.example.com/custom-tool-${pkgver}.tar.gz")
sha256sums=('abc123def456...')
# Will use Repology datasource with "aur/custom-tool"
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

- When using Repology, version updates depend on the accuracy of the Repology database
