import { z } from 'zod';

import { escapeRegExp, regEx } from '../../../util/regex';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { NpmDatasource } from '../../datasource/npm';
import { PypiDatasource } from '../../datasource/pypi';
import * as condaVersioning from '../../versioning/conda';
import * as npmVersioning from '../../versioning/npm';
import * as pep440versioning from '../../versioning/pep440';

import type { PackageDependency } from '../types';

function matchFullUrl(domain: string, action: string): z.ZodString {
  return z
    .string()
    .regex(
      regEx(
        escapeRegExp('https://' + domain + '/') +
          escapeRegExp(action) +
          '(@.+)?$',
      ),
    );
}

function matchAction(action: string): z.Schema {
  return z.union([
    z.string().regex(regEx(escapeRegExp(action) + '(@.+)?$')),
    matchFullUrl('github.com', action),
    matchFullUrl('code.forgejo.org', action),
    matchFullUrl('data.forgejo.org', action),
  ]);
}

/**
 * schema here should match the whole step,
 * there may be some actions use env as arguments version.
 *
 * each type should return `PackageDependency | undefined`
 */
export const communityActions = z.union([
  z
    .object({
      // https://github.com/astral-sh/setup-uv
      uses: matchAction('astral-sh/setup-uv'),
      with: z.object({ version: z.string().refine((s) => s !== 'latest') }),
    })
    .transform(({ with: val }): PackageDependency => {
      return {
        datasource: GithubReleasesDatasource.id,
        depName: 'astral-sh/uv',
        versioning: npmVersioning.id,
        packageName: 'astral-sh/uv',
        currentValue: val.version,
        depType: 'uses-with',
      };
    }),
  z
    .object({
      uses: matchAction('pnpm/action-setup'),
      with: z.object({
        version: z.string().refine((s) => s !== 'latest'),
      }),
    })
    .transform(({ with: val }): PackageDependency => {
      return {
        datasource: NpmDatasource.id,
        depName: 'pnpm',
        versioning: npmVersioning.id,
        packageName: 'pnpm',
        currentValue: val.version,
        depType: 'uses-with',
      };
    }),
  z
    .object({
      uses: matchAction('pdm-project/setup-pdm'),
      with: z.object({ version: z.string().refine((s) => s !== 'head') }),
    })
    .transform(({ with: val }): PackageDependency => {
      return {
        datasource: PypiDatasource.id,
        depName: 'pdm',
        versioning: pep440versioning.id,
        packageName: 'pdm',
        currentValue: val.version,
        depType: 'uses-with',
      };
    }),
  z
    .object({
      uses: matchAction('jaxxstorm/action-install-gh-release'),
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
    }),
  z
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
    }),
]);
