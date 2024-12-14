![Renovate banner](./assets/images/mend-renovate-cli-banner.jpg){ loading=lazy }

# Renovate documentation

Automated dependency updates.
Multi-platform and multi-language.

## Why use Renovate?

<!-- markdownlint-disable list-marker-space -->
<!-- prettier-ignore-start -->

<div class="grid cards" markdown>

-   :octicons-git-pull-request-24:{ .lg .middle } __Automatic updates__

    ---

    Get pull requests to update your dependencies and lock files.

-   :octicons-calendar-24:{ .lg .middle } __On your schedule__

    ---

    Reduce noise by scheduling when Renovate creates PRs.

-   :octicons-package-24:{ .lg .middle } __Works out of the box__

    ---

    Renovate finds relevant package files automatically, including in monorepos.

-   :octicons-goal-24:{ .lg .middle } __How you like it__

    ---

    You can customize the bot's behavior with configuration files.

-   :octicons-share-24:{ .lg .middle } __Share your configuration__

    ---

    Share your configuration with ESLint-like config presets.

-   :octicons-sync-24:{ .lg .middle } __Out with the old, in with the new__

    ---

    Get replacement PRs to migrate from a deprecated dependency to the community suggested replacement, works with _most_ managers, see [issue 14149](https://github.com/renovatebot/renovate/issues/14149) for exceptions.

-   :octicons-tools-24:{ .lg .middle } __Open source__

    ---

    Renovate is licensed under the [GNU Affero General Public License](https://github.com/renovatebot/renovate/blob/main/license).

</div>

<!-- prettier-ignore-end -->
<!-- markdownlint-enable list-marker-space -->

## Supported Platforms

Renovate works on these platforms:

- [GitHub (.com and Enterprise Server)](./modules/platform/github/index.md)
- [GitLab (.com and CE/EE)](./modules/platform/gitlab/index.md)
- [Bitbucket Cloud](./modules/platform/bitbucket/index.md)
- [Bitbucket Server](./modules/platform/bitbucket-server/index.md)
- [Azure DevOps](./modules/platform/azure/index.md)
- [AWS CodeCommit](./modules/platform/codecommit/index.md)
- [Gitea and Forgejo](./modules/platform/gitea/index.md)
- [Gerrit (experimental)](./modules/platform/gerrit/index.md)

## Who Uses Renovate?

Renovate is used by:

![Logos of companies and projects that use Renovate](./assets/images/matrix.png){ loading=lazy }

<details>
<summary>List of companies and projects that use Renovate</summary>
<ul>
  <li>Prisma</li>
  <li>Netlify</li>
  <li>Envoy</li>
  <li>Condé Nast</li>
  <li>Microsoft</li>
  <li>Atlassian</li>
  <li>Sourcegraph</li>
  <li>Mozilla</li>
  <li>Deloitte</li>
  <li>Telus</li>
  <li>Yarn</li>
  <li>HashiCorp</li>
  <li>Automattic</li>
  <li>Algolia</li>
  <li>eBay</li>
  <li>Cypress</li>
  <li>Red Hat</li>
  <li>Financial Times</li>
  <li>Uber</li>
  <li>Buildkite</li>
</ul>
</details>

## Ways to run Renovate

You can run Renovate as:

- an [Open Source npm package](https://www.npmjs.com/package/renovate)
- a [pre-built Open Source image on Docker Hub](https://hub.docker.com/r/renovate/renovate)

Or you can use [the Mend Renovate App](https://github.com/marketplace/renovate) which is hosted by [Mend](https://www.mend.io/).

[Install the Mend Renovate app for GitHub](https://github.com/marketplace/renovate){ .md-button .md-button--primary }
[Check out our tutorial](https://github.com/renovatebot/tutorial){ .md-button }
