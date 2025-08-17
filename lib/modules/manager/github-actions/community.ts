import { z } from 'zod';

import type { SkipReason, StageName } from '../../../types';
import { escapeRegExp, regEx } from '../../../util/regex';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { NpmDatasource } from '../../datasource/npm';
import { PypiDatasource } from '../../datasource/pypi';
import * as condaVersioning from '../../versioning/conda';
import * as npmVersioning from '../../versioning/npm';
import * as pep440versioning from '../../versioning/pep440';
import type { PackageDependency } from '../types';

function matchAction(action: string): z.Schema {
  return z
    .string()
    .regex(regEx(`(?:https?://[^/]+/)?${escapeRegExp(action)}(?:@.+)?$`));
}

const SetupUV = z
  .object({
    // https://github.com/astral-sh/setup-uv
    uses: matchAction('astral-sh/setup-uv'),
    with: z.object({ version: z.string().optional() }),
  })
  .transform(({ with: val }): PackageDependency => {
    let skipStage: StageName | undefined;
    let skipReason: SkipReason | undefined;

    if (!val.version) {
      skipStage = 'extract';
      skipReason = 'unspecified-version';
    }

    return {
      datasource: GithubReleasesDatasource.id,
      depName: 'astral-sh/uv',
      versioning: npmVersioning.id,
      packageName: 'astral-sh/uv',
      ...(skipStage && { skipStage }),
      ...(skipReason && { skipReason }),
      currentValue: val.version,
      depType: 'uses-with',
    };
  });

const SetupPnpm = z
  .object({
    uses: matchAction('pnpm/action-setup'),
    with: z.object({
      version: z.string().optional(),
    }),
  })
  .transform(({ with: val }): PackageDependency => {
    let skipStage: StageName | undefined;
    let skipReason: SkipReason | undefined;
    if (!val.version) {
      skipStage = 'extract';
      skipReason = 'unspecified-version';
    }

    return {
      datasource: NpmDatasource.id,
      depName: 'pnpm',
      versioning: npmVersioning.id,
      packageName: 'pnpm',
      ...(skipStage && { skipStage }),
      ...(skipReason && { skipReason }),
      currentValue: val.version,
      depType: 'uses-with',
    };
  });

const SetupPDM = z
  .object({
    uses: matchAction('pdm-project/setup-pdm'),
    with: z.object({ version: z.string().optional() }),
  })
  .transform(({ with: val }): PackageDependency => {
    let skipStage: StageName | undefined;
    let skipReason: SkipReason | undefined;
    if (!val.version) {
      skipStage = 'extract';
      skipReason = 'unspecified-version';
    }

    return {
      datasource: PypiDatasource.id,
      depName: 'pdm',
      versioning: pep440versioning.id,
      packageName: 'pdm',
      currentValue: val.version,
      ...(skipStage && { skipStage }),
      ...(skipReason && { skipReason }),
      depType: 'uses-with',
    };
  });

const InstallBinary = z
  .object({
    uses: z.union([
      matchAction('jaxxstorm/action-install-gh-release'),
      matchAction('sigoden/install-binary'),
    ]),
    with: z.object({ repo: z.string(), tag: z.string() }),
  })
  .transform(({ with: val }): PackageDependency => {
    return {
      datasource: GithubReleasesDatasource.id,
      depName: val.repo,
      packageName: val.repo,
      currentValue: val.tag,
      depType: 'uses-with',
    };
  });

const SetupPixi = z
  .object({
    uses: matchAction('prefix-dev/setup-pixi'),
    with: z.object({ 'pixi-version': z.string() }),
  })
  .transform(({ with: val }): PackageDependency => {
    return {
      datasource: GithubReleasesDatasource.id,
      versioning: condaVersioning.id,
      depName: 'prefix-dev/pixi',
      packageName: 'prefix-dev/pixi',
      currentValue: val['pixi-version'],
      depType: 'uses-with',
    };
  });

/**
 * schema here should match the whole step,
 * there may be some actions use env as arguments version.
 *
 * each type should return `PackageDependency | undefined`
 */
export const CommunityActions = z.union([
  InstallBinary,
  SetupPDM,
  SetupPixi,
  SetupPnpm,
  SetupUV,
]);
