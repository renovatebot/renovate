The `homebrew` manager extracts dependencies from Homebrew Formula Ruby files.

### Supported Files

Renovate supports Formula files that follow the Homebrew naming convention:

- Files must be located in a `Formula/` directory
- Files must have a `.rb` extension
- Example: `Formula/my-package.rb`

### Supported Dependencies

The manager extracts and updates:

- **GitHub releases**: URLs in the format `https://github.com/owner/repo/releases/download/v1.2.3/repo-1.2.3.tar.gz`
- **GitHub archives**: URLs in the format `https://github.com/owner/repo/archive/refs/tags/v1.2.3.tar.gz`
- **NPM packages**: URLs in the format `https://registry.npmjs.org/package/-/package-1.2.3.tgz` or `https://registry.npmjs.org/@scope/package/-/package-1.2.3.tgz`
- **SHA256 checksums**: Automatically computed for new versions

### How It Works

When a new version is available, Renovate:

1. Downloads the new tarball from GitHub or NPM registry
2. Calculates the SHA256 checksum
3. Updates both the `url` and `sha256` fields in the Formula file

### Limitations

- **GitHub packages**: Only supports packages hosted on `github.com`
- **NPM packages**: Only supports packages from `registry.npmjs.org` (custom registries are not supported)

### Example Formulas

#### GitHub Package

```ruby
class MyPackage < Formula
  desc "My awesome package"
  homepage "https://github.com/owner/repo"
  url "https://github.com/owner/repo/releases/download/v1.2.3/repo-1.2.3.tar.gz"
  sha256 "abc123def456..."

  def install
    # installation steps
  end
end
```

#### npm Package

```ruby
class ClaudeCode < Formula
  desc "Anthropic's official CLI for Claude"
  homepage "https://www.anthropic.com/claude-code"
  url "https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-1.0.0.tgz"
  sha256 "abc123def456..."
  license "Proprietary"
end
```

### Unsupported Formulas

Formulas with the following characteristics will be skipped:

- Non-GitHub and non-NPM URLs (e.g., SourceForge, custom domains)
- NPPM packages from custom registries (only `registry.npmjs.org` is supported)
- Missing or invalid `sha256` field
- Git repository URLs (e.g., `url "https://github.com/owner/repo.git"`)
- Invalid class definitions

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
