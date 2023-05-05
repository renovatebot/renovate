import type { ReleaseType } from 'semver';
import type { ProgrammingLanguage } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { NpmDatasource } from '../../datasource/npm';
import * as npmVersioning from '../../versioning/npm';
import type {
  BumpPackageVersionResult,
  ExtractConfig,
  GlobalManagerConfig,
  PackageFile,
  UpdateDependencyConfig,
  UpdateLockedConfig,
  UpdateLockedResult,
} from '../types';

export { getRangeStrategy } from './range';

export const language: ProgrammingLanguage = 'js';
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)package\\.json$'],
  rollbackPrs: true,
  versioning: npmVersioning.id,
  digest: {
    prBodyDefinitions: {
      Change:
        '{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}',
    },
  },
  prBodyDefinitions: {
    Change:
      "[{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}]({{#if depName}}https://renovatebot.com/diffs/npm/{{replace '/' '%2f' depName}}/{{{currentVersion}}}/{{{newVersion}}}{{/if}})",
  },
};

export const supportedDatasources = [GithubTagsDatasource.id, NpmDatasource.id];

export function detectGlobalConfig(): Promise<GlobalManagerConfig> {
  return import('./detect').then((m) => m.detectGlobalConfig());
}

export function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  return import('./extract').then((m) =>
    m.extractAllPackageFiles(config, packageFiles)
  );
}

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType | string
): Promise<BumpPackageVersionResult> {
  return import('./update').then((m) =>
    m.bumpPackageVersion(content, currentValue, bumpVersion)
  );
}

export function updateDependency(
  config: UpdateDependencyConfig
): Promise<string | null> {
  return import('./update').then((m) => m.updateDependency(config));
}
export function updateLockedDependency(
  config: UpdateLockedConfig
): Promise<UpdateLockedResult> {
  return import('./update').then((m) => m.updateLockedDependency(config));
}
