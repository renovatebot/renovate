import { z } from 'zod/v3';

import { escapeRegExp, regEx } from '../../../util/regex.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import * as condaVersioning from '../../versioning/conda/index.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import * as pep440versioning from '../../versioning/pep440/index.ts';
import * as rubyVersioning from '../../versioning/ruby/index.ts';
import type { PackageDependency } from '../types.ts';

function matchAction(action: string): z.ZodString {
  return z
    .string()
    .regex(regEx(`(?:https?://[^/]+/)?${escapeRegExp(action)}(?:@.+)?$`));
}

function validateValue(
  currentValue: string | undefined,
  validator?: () => boolean,
): PackageDependency {
  if (!currentValue) {
    return {
      skipStage: 'extract',
      skipReason: 'unspecified-version',
      depType: 'uses-with',
    };
  }
  if (validator?.() === true) {
    return {
      skipStage: 'extract',
      skipReason: 'invalid-version',
      depType: 'uses-with',
      currentValue,
    };
  }
  return { currentValue, depType: 'uses-with' };
}

const SetupUV = z
  .object({
    // https://github.com/astral-sh/setup-uv
    uses: matchAction('astral-sh/setup-uv'),
    with: z.object({ version: z.string().optional() }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: GithubReleasesDatasource.id,
      depName: 'astral-sh/uv',
      versioning: npmVersioning.id,
      packageName: 'astral-sh/uv',
      ...validateValue(val.version),
    }),
  );

const SetupPnpm = z
  .object({
    uses: matchAction('pnpm/action-setup'),
    with: z.object({
      version: z.string().optional(),
    }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: NpmDatasource.id,
      depName: 'pnpm',
      versioning: npmVersioning.id,
      packageName: 'pnpm',
      ...validateValue(val.version),
    }),
  );

const SetupBun = z
  .object({
    uses: matchAction('oven-sh/setup-bun'),
    with: z.object({
      'bun-version': z.string().optional(),
    }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: NpmDatasource.id,
      depName: 'bun',
      versioning: npmVersioning.id,
      packageName: 'bun',
      ...validateValue(val['bun-version']),
    }),
  );

const SetupDeno = z
  .object({
    uses: matchAction('denoland/setup-deno'),
    with: z.object({
      'deno-version': z.string().optional(),
    }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: NpmDatasource.id,
      depName: 'deno',
      versioning: npmVersioning.id,
      packageName: 'deno',
      ...validateValue(val['deno-version']),
    }),
  );

const SetupRuby = z
  .object({
    uses: matchAction('ruby/setup-ruby'),
    with: z.object({
      'ruby-version': z.string().optional(),
    }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: RubyVersionDatasource.id,
      depName: 'ruby',
      versioning: rubyVersioning.id,
      packageName: 'ruby',
      ...validateValue(val['ruby-version']),
    }),
  );

const SetupPDM = z
  .object({
    uses: matchAction('pdm-project/setup-pdm'),
    with: z.object({ version: z.string().optional() }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: PypiDatasource.id,
      depName: 'pdm',
      versioning: pep440versioning.id,
      packageName: 'pdm',
      ...validateValue(val.version),
    }),
  );

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
      ...validateValue(val.tag),
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
      ...validateValue(val['pixi-version']),
    };
  });

const SetupHatch = z
  .object({
    // https://github.com/pypa/hatch/tree/install
    uses: matchAction('pypa/hatch'),
    with: z.object({ version: z.string().optional() }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: GithubReleasesDatasource.id,
      depName: 'pypa/hatch',
      packageName: 'pypa/hatch',
      ...validateValue(val.version),
      // Strip hatch- prefix from release tags
      extractVersion: '^hatch-(?<version>.+)$',
    }),
  );

const SetupGolangciLint = z
  .object({
    uses: matchAction('golangci/golangci-lint-action'),
    with: z.object({ version: z.string().optional() }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: GithubReleasesDatasource.id,
      depName: 'golangci/golangci-lint',
      packageName: 'golangci/golangci-lint',
      ...validateValue(val.version),
    }),
  );

const ZizmorcoreZizmorAction = z
  .object({
    uses: matchAction('zizmorcore/zizmor-action'),
    with: z.object({ version: z.string().optional() }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: DockerDatasource.id,
      depName: 'ghcr.io/zizmorcore/zizmor',
      packageName: 'ghcr.io/zizmorcore/zizmor',
      ...validateValue(val.version),
    }),
  );

const SetupPyright = z
  .object({
    uses: matchAction('jakebailey/pyright-action'),
    with: z.object({ version: z.string().optional() }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: NpmDatasource.id,
      depName: 'pyright',
      versioning: npmVersioning.id,
      packageName: 'pyright',
      ...validateValue(val.version, () => val.version === 'PATH'),
    }),
  );

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
  SetupPyright,
  SetupUV,
  SetupBun,
  SetupDeno,
  SetupRuby,
  SetupHatch,
  SetupGolangciLint,
  ZizmorcoreZizmorAction,
]);
