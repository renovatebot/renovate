Manages versions of Typst package imports in `.typ` files for update.

The Typst datasource fetches package information from the [typst/packages](https://github.com/typst/packages) repository using GitHub's API.
GitHub users don't need a token since the Renovate App already has access.
Non-GitHub platforms (Bitbucket, Azure DevOps, GitLab, etc.) require a GitHub token or package lookups will fail due to API rate limiting.

<!-- prettier-ignore -->
!!! note
  Follow the [GitHub token setup guide](../../../mend-hosted/github-com-token.md) to configure authentication for non-GitHub platforms.
