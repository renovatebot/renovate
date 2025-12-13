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
- **SHA256 checksums**: Automatically computed for new versions

### How It Works

When a new version is available, Renovate:

1. Downloads the new tarball from GitHub
2. Calculates the SHA256 checksum
3. Updates both the `url` and `sha256` fields in the Formula file

### Limitations

- **Only GitHub-hosted packages**: Currently only supports packages hosted on `github.com`
- **Only tar.gz archives**: Only `.tar.gz` format is supported
- **GitHub Tags datasource**: Uses the `github-tags` datasource to fetch available versions

### Example Formula

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

### Unsupported Formulas

Formulas with the following characteristics will be skipped:

- Non-GitHub URLs (e.g., SourceForge, custom domains)
- Missing or invalid `sha256` field
- Git repository URLs (e.g., `url "https://github.com/owner/repo.git"`)
- Invalid class definitions

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.
