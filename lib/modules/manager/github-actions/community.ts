import { z } from 'zod';
import escapeStringRegexp from 'escape-string-regexp';

import { NpmDatasource } from '../../datasource/npm';
import { PypiDatasource } from '../../datasource/pypi';
import * as pep440versioning from '../../versioning/pep440';
import { GithubReleasesDatasource } from '../../datasource/github-releases';

import * as npmVersioning from '../../versioning/npm';
import type { PackageDependency } from '../types';

function matchAction(action: string): z.ZodString {
  return z
    .string()
    .regex(
      new RegExp(
        '^(https://github\.com/)?' + escapeStringRegexp(action) + '(@.+)?$',
      ),
    );
}

export const communityActions = z.union([
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
      // https://github.com/astral-sh/setup-uv
      uses: matchAction('astral-sh/setup-uv'),
      with: z.object({ version: z.string() }),
    })
    .transform(({ with: val }): PackageDependency | undefined => {
      if (val.version === 'latest') {
        return;
      }

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
      // https://github.com/pnpm/action-setup
      uses: matchAction('pnpm/action-setup'),
      with: z.object({
        version: z.union([
          z.string(),
          z.number().transform((s) => s.toString()),
        ]),
      }),
    })
    .transform(({ with: val }): PackageDependency | undefined => {
      if (val.version === 'latest') {
        return;
      }

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
      // https://github.com/astral-sh/setup-uv
      uses: matchAction('pdm-project/setup-pdm'),
      with: z.object({ version: z.string().refine((s) => s !== 'head') }),
    })
    .transform(({ with: val }): PackageDependency | undefined => {
      return {
        datasource: PypiDatasource.id,
        depName: 'pdm',
        versioning: pep440versioning.id,
        packageName: 'pdm',
        currentValue: val.version,
        depType: 'uses-with',
      };
    }),
]);
