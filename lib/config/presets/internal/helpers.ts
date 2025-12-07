import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

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
  githubDigestChangelogs: {
    description:
      'Ensure that every dependency pinned by digest and sourced from GitHub.com contains a link to the commit-to-commit diff',
    packageRules: [
      {
        changelogUrl: '{{sourceUrl}}/compare/{{currentDigest}}..{{newDigest}}',
        matchSourceUrls: ['https://github.com/**'],
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
            "{{#if (containsString depName 'golang.org/x/')}}[`{{{displayFrom}}}` -> `{{{displayTo}}}`](https://cs.opensource.google/{{{replace '^golang\\.org' 'go' depName}}}/+/refs/tags/{{{currentValue}}}...refs/tags/{{{newValue}}}){{else}}`{{{displayFrom}}}` -> `{{{displayTo}}}`{{/if}}",
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
