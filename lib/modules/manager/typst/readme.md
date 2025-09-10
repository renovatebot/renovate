Manages versions of Typst package imports in `.typ` files for update.

## GitHub Token Requirement

The Typst datasource fetches package information from the [typst/packages](https://github.com/typst/packages) repository using GitHub's API.

### When is a GitHub token needed?

- **GitHub users**: No token needed - the Renovate App already has GitHub access
- **Non-GitHub platforms** (Bitbucket, Azure DevOps, GitLab, etc.): A GitHub token is required

### Without a GitHub token

If no GitHub token is provided on non-GitHub platforms:

- Package lookups will fail due to GitHub API rate limiting
- Typst dependency updates will not work

### How to configure

Follow the [GitHub token setup guide](../../../mend-hosted/github-com-token.md) to configure authentication for non-GitHub platforms.
