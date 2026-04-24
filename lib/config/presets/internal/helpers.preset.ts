import type { Preset } from '../types.ts';

export const presets: Record<string, Preset> = {
  disableTypesNodeMajor: {
    description: 'Disable `major` updates to `@types/node`.',
    packageRules: [
      {
        enabled: false,
        matchPackageNames: ['@types/node'],
        matchUpdateTypes: ['major'],
      },
    ],
  },
  followTypescriptNext: {
    description: 'Keep `typescript` version in sync with the `next` tag.',
    extends: [':followTag(typescript, next)'],
  },
  followTypescriptRc: {
    description: 'Keep `typescript` version in sync with the `rc` tag.',
    extends: [':followTag(typescript, rc)'],
  },
  forgejoDigestChangelogs: {
    description:
      'Ensure that every dependency pinned by digest and sourced from Forgejo contains a link to the commit-to-commit diff',
    packageRules: [
      {
        changelogUrl: '{{sourceUrl}}/compare/{{currentDigest}}..{{newDigest}}',
        matchDatasources: ['forgejo-releases', 'forgejo-tags'],
        matchUpdateTypes: ['digest'],
      },
      {
        changelogUrl: '{{sourceUrl}}/compare/{{currentDigest}}..{{newDigest}}',
        matchDatasources: ['git-refs', 'git-tags'],
        matchJsonata: ["$detectPlatform(sourceUrl) = 'forgejo'"],
        matchUpdateTypes: ['digest'],
      },
    ],
  },
  giteaDigestChangelogs: {
    description:
      'Ensure that every dependency pinned by digest and sourced from Gitea contains a link to the commit-to-commit diff',
    packageRules: [
      {
        changelogUrl: '{{sourceUrl}}/compare/{{currentDigest}}..{{newDigest}}',
        matchDatasources: ['gitea-releases', 'gitea-tags'],
        matchUpdateTypes: ['digest'],
      },
      {
        changelogUrl: '{{sourceUrl}}/compare/{{currentDigest}}..{{newDigest}}',
        matchDatasources: ['git-refs', 'git-tags'],
        matchJsonata: ["$detectPlatform(sourceUrl) = 'gitea'"],
        matchUpdateTypes: ['digest'],
      },
    ],
  },
  githubDigestChangelogs: {
    description:
      'Ensure that every dependency pinned by digest and sourced from GitHub.com and Github enterprise contains a link to the commit-to-commit diff',
    packageRules: [
      {
        changelogUrl: '{{sourceUrl}}/compare/{{currentDigest}}..{{newDigest}}',
        matchDatasources: ['github-digest', 'github-releases', 'github-tags'],
        matchUpdateTypes: ['digest'],
      },
      {
        changelogUrl: '{{sourceUrl}}/compare/{{currentDigest}}..{{newDigest}}',
        matchDatasources: ['git-refs', 'git-tags'],
        matchJsonata: ["$detectPlatform(sourceUrl) = 'github'"],
        matchUpdateTypes: ['digest'],
      },
    ],
  },
  gitlabDigestChangelogs: {
    description:
      'Ensure that every dependency pinned by digest and sourced from GitLab.com contains a link to the commit-to-commit diff',
    packageRules: [
      {
        changelogUrl:
          '{{sourceUrl}}/-/compare/{{currentDigest}}...{{newDigest}}',
        matchDatasources: ['git-refs', 'git-tags'],
        matchJsonata:  ["$detectPlatform(sourceUrl) = 'gitlab'"],
        matchUpdateTypes: ['digest'],
      },
      {
        changelogUrl:
          '{{sourceUrl}}/-/compare/{{currentDigest}}...{{newDigest}}',
        matchDatasources: ['gitlab-releases', 'gitlab-tags'],
        matchUpdateTypes: ['digest'],
      },
    ],
  },
  goXPackagesChangelogLink: {
    description: 'Correctly link to the source code for golang.org/x packages',
    packageRules: [
      {
        matchManagers: ['gomod'],
        // NOTE that digests are not supported with the below diff view
        matchUpdateTypes: ['major', 'minor', 'patch'],
        prBodyDefinitions: {
          Change:
            "{{#if (containsString depName 'golang.org/x/')}}[`{{{displayFrom}}}` → `{{{displayTo}}}`](https://cs.opensource.google/{{{replace '^golang\\.org' 'go' depName}}}/+/refs/tags/{{{currentValue}}}...refs/tags/{{{newValue}}}){{else}}`{{{displayFrom}}}` → `{{{displayTo}}}`{{/if}}",
        },
      },
    ],
  },
  goXPackagesNameLink: {
    description: "Link to pkg.go.dev/... for golang.org/x packages' title",
    packageRules: [
      {
        matchManagers: ['gomod'],
        prBodyDefinitions: {
          Package:
            "{{#if (containsString depName 'golang.org/x/')}}[{{{depName}}}](https://pkg.go.dev/{{{depName}}}){{else}}{{{depNameLinked}}}{{/if}}",
        },
      },
    ],
  },
  pinGitHubActionDigests: {
    description: 'Pin `github-action` digests.',
    packageRules: [
      {
        matchDepTypes: ['action'],
        pinDigests: true,
      },
    ],
  },
  pinGitHubActionDigestsToSemver: {
    description: 'Convert pinned GitHub Action digests to SemVer.',
    packageRules: [
      {
        extends: ['helpers:pinGitHubActionDigests'],
        extractVersion: '^(?<version>v?\\d+\\.\\d+\\.\\d+)$',
        versioning:
          'regex:^v?(?<major>\\d+)(\\.(?<minor>\\d+)\\.(?<patch>\\d+))?$',
      },
    ],
  },
};
