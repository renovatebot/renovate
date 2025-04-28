import type { Category } from '../../../constants/index.ts';
import { GiteaTagsDatasource } from '../../datasource/gitea-tags/index.ts';
import { GithubRunnersDatasource } from '../../datasource/github-runners/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'GitHub Actions';
export const url = 'https://docs.github.com/en/actions';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)(workflow-templates|\\.(?:github|gitea|forgejo)/(?:workflows|actions))/.+\\.ya?ml$/',
    '/(^|/)action\\.ya?ml$/',
  ],
  prBodyDefinitions: {
    Change:
      '[{{#if displayFrom}}{{{displayFrom}}}{{else}}{{{currentValue}}}{{/if}} -> {{#if displayTo}}{{{displayTo}}}{{else}}{{{newValue}}}{{/if}}]({{#if sourceUrl}}{{{sourceUrl}}}/compare/{{#if currentDigest}}{{{currentDigestShort}}}{{else}}{{{currentValue}}}{{/if}}...{{#if newDigest}}{{{newDigestShort}}}{{else}}{{{newValue}}}{{/if}}{{else}}{{#if depName}}https://github.com/{{replace "/" "%2F" depName}}/compare/{{#if currentDigest}}{{{currentDigestShort}}}{{else}}{{{currentValue}}}{{/if}}...{{#if newDigest}}{{{newDigestShort}}}{{else}}{{{newValue}}}{{/if}}{{/if}}{{/if}})',
  },
};

export const supportedDatasources = [
  GiteaTagsDatasource.id,
  GithubTagsDatasource.id,
  GithubRunnersDatasource.id,
];
