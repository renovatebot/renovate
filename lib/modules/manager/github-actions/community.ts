/**
 * Update readme if new actions are added here.
 */
import { z } from 'zod/v3';

import { escapeRegExp, regEx } from '../../../util/regex.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import * as condaVersioning from '../../versioning/conda/index.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import type { PackageDependency } from '../types.ts';

/**
 * match actions
 */
function matchAction(action: string): z.ZodString {
  return z
    .string()
    .regex(regEx(`(?:https?://[^/]+/)?${escapeRegExp(action)}(?:@.+)?$`));
}

function parseValue(
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
      ...parseValue(val.version),
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
      packageName: 'pnpm',
      ...parseValue(val.version),
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
      packageName: 'bun',
      ...parseValue(val['bun-version']),
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
      packageName: 'deno',
      ...parseValue(val['deno-version']),
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
      packageName: 'ruby',
      ...parseValue(val['ruby-version']),
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
      packageName: 'pdm',
      ...parseValue(val.version),
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
      ...parseValue(val.tag),
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
      ...parseValue(val['pixi-version']),
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
      ...parseValue(val.version),
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
      ...parseValue(val.version),
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
      ...parseValue(val.version),
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
      packageName: 'pyright',
      ...parseValue(val.version, () => val.version === 'PATH'),
    }),
  );

/**
 *  Both actions are used to setup trivy.
 * - https://github.com/aquasecurity/setup-trivy
 * - https://github.com/aquasecurity/trivy-action
 */
const AquaSecurityTrivy = z
  .object({
    uses: z.union([
      matchAction('aquasecurity/setup-trivy'),
      matchAction('aquasecurity/trivy-action'),
    ]),
    with: z.object({ version: z.string().optional() }),
  })
  .transform(
    ({ with: val }): PackageDependency => ({
      datasource: GithubReleasesDatasource.id,
      depName: 'aquasecurity/trivy',
      packageName: 'aquasecurity/trivy',
      ...parseValue(val.version),
    }),
  );

/**
 * schema here should match the whole step,
 * there may be some actions use env as arguments version.
 *
 * each type should return `PackageDependency | undefined`
 */
export const CommunityActions = z.union([
  AquaSecurityTrivy,
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
