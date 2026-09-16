import { z } from 'zod/v4';
import { GithubReleasesDatasource } from '../../../datasource/github-releases/index.ts';
import * as npmVersioning from '../../../versioning/npm/index.ts';
import type { PackageDependency } from '../../types.ts';
import type { ActionSchema, KnownActionConfig } from '../types.ts';
import {
  actionsVersionsExtractVersion,
  parsePartialValue,
  parseValue,
} from './utils.ts';

const InstallBinaryWith: ActionSchema = z
  .object({ repo: z.string(), tag: z.string() })
  .transform(({ repo, tag }) => [{ packageName: repo, ...parseValue(tag) }]);

// `erlef/setup-beam` can yield up to 4 dependencies from a single step: OTP,
// Elixir, Gleam, and rebar3. All inputs are optional, so only emit a
// dependency for the ones a workflow actually sets.
//
// All 4 inputs accept "values like `22.x`, or even `>22`", so they need a
// versioning which understands ranges. OTP is the exception: it releases
// 4-component versions (e.g. `26.2.5.3`) which aren't valid semver, so it
// keeps the default versioning and stays unfixed for now.
const ErlefSetupBeamWith: ActionSchema = z
  .object({
    'otp-version': z.string().optional(),
    'elixir-version': z.string().optional(),
    'gleam-version': z.string().optional(),
    'rebar3-version': z.string().optional(),
  })
  .transform(
    ({
      'otp-version': otpVersion,
      'elixir-version': elixirVersion,
      'gleam-version': gleamVersion,
      'rebar3-version': rebar3Version,
    }) => {
      const deps: PackageDependency[] = [];

      if (otpVersion) {
        deps.push({
          packageName: 'erlang/otp',
          // erlang/otp tags releases like `OTP-27.1.2`
          extractVersion: '^OTP-(?<version>.+)$',
          ...parseValue(otpVersion),
        });
      }

      if (elixirVersion) {
        deps.push({
          packageName: 'elixir-lang/elixir',
          versioning: npmVersioning.id,
          ...parseValue(elixirVersion),
        });
      }

      if (gleamVersion) {
        deps.push({
          packageName: 'gleam-lang/gleam',
          versioning: npmVersioning.id,
          ...parseValue(gleamVersion),
        });
      }

      if (rebar3Version) {
        deps.push({
          packageName: 'erlang/rebar3',
          versioning: npmVersioning.id,
          ...parseValue(rebar3Version),
        });
      }

      return deps;
    },
  );

// `moonrepo/setup-toolchain` can yield up to 2 dependencies from a single
// step: the `moon` binary and the `proto` binary. Both inputs are optional,
// so only emit a dependency for the ones a workflow actually sets.
const MoonrepoSetupToolchainWith: ActionSchema = z
  .object({
    'moon-version': z.string().optional(),
    'proto-version': z.string().optional(),
  })
  .transform(
    ({ 'moon-version': moonVersion, 'proto-version': protoVersion }) => {
      const deps: PackageDependency[] = [];

      if (moonVersion) {
        deps.push({
          packageName: 'moonrepo/moon',
          ...parseValue(moonVersion),
        });
      }

      if (protoVersion) {
        deps.push({
          packageName: 'moonrepo/proto',
          ...parseValue(protoVersion),
        });
      }

      return deps;
    },
  );

// `crystal-lang/install-crystal` can yield up to 2 dependencies from a
// single step: the Crystal compiler itself, and the shards package manager.
// Both inputs are optional, so only emit a dependency for the ones a
// workflow actually sets.
//
// Both install "a particular release (if the full version is specified), or
// the latest patch version of a release series", so a partial version such as
// `1.2` needs to keep its precision.
const InstallCrystalWith: ActionSchema = z
  .object({
    crystal: z.string().optional(),
    shards: z.string().optional(),
  })
  .transform(({ crystal, shards }) => {
    const deps: PackageDependency[] = [];

    if (crystal) {
      deps.push({
        packageName: 'crystal-lang/crystal',
        ...parsePartialValue(crystal),
      });
    }

    if (shards) {
      deps.push({
        packageName: 'crystal-lang/shards',
        ...parsePartialValue(shards),
      });
    }

    return deps;
  });

// `conda-incubator/setup-miniconda` exposes 6 separate version inputs
// (`miniconda-version`, `miniforge-version`, `conda-version`,
// `conda-build-version`, `python-version`, `mamba-version`), but only 2 map
// onto a datasource we can reliably use: `miniforge-version` (GitHub
// releases of `conda-forge/miniforge`) and `python-version` (the same
// `actions/python-versions` releases already used for `actions/setup-python`).
// The other 4 are versioned via anaconda.org channels or an installer
// archive with no clean Renovate datasource, so they're intentionally not
// tracked. Both supported inputs are optional, so only emit a dependency
// for the ones a workflow actually sets.
const SetupMinicondaWith: ActionSchema = z
  .object({
    'miniforge-version': z.string().optional(),
    'python-version': z.string().optional(),
  })
  .transform(
    ({
      'miniforge-version': miniforgeVersion,
      'python-version': pythonVersion,
    }) => {
      const deps: PackageDependency[] = [];

      if (miniforgeVersion) {
        deps.push({
          datasource: GithubReleasesDatasource.id,
          depName: 'miniforge',
          packageName: 'conda-forge/miniforge',
          ...parseValue(miniforgeVersion),
        });
      }

      if (pythonVersion) {
        deps.push({
          datasource: GithubReleasesDatasource.id,
          depName: 'python',
          packageName: 'actions/python-versions',
          versioning: npmVersioning.id,
          extractVersion: actionsVersionsExtractVersion,
          ...parseValue(pythonVersion),
        });
      }

      return deps;
    },
  );

// `'latest'` is a valid, documented value for `tflint_version` (it's also the
// action's own default), but it isn't a version we can pin/bump, so treat it
// as present-but-unsupported rather than as an invalid value.
const TflintWith: ActionSchema = z
  .object({ tflint_version: z.string().optional() })
  .transform(({ tflint_version: version }) => {
    if (version === 'latest') {
      return [
        {
          currentValue: version,
          depType: 'uses-with',
          skipStage: 'extract',
          skipReason: 'unsupported-version',
        },
      ];
    }
    return [parseValue(version)];
  });

export const githubReleasesDynamicActions: Record<string, KnownActionConfig> = {
  // https://github.com/conda-incubator/setup-miniconda
  'conda-incubator/setup-miniconda': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: miniforge-version, python-version
    withSchema: SetupMinicondaWith,
  },
  // https://github.com/crystal-lang/install-crystal
  'crystal-lang/install-crystal': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: crystal, shards
    withSchema: InstallCrystalWith,
  },
  // https://github.com/erlef/setup-beam
  'erlef/setup-beam': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: OTP, Elixir, Gleam, rebar3
    withSchema: ErlefSetupBeamWith,
  },
  'jaxxstorm/action-install-gh-release': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined from `repo` input
    withSchema: InstallBinaryWith,
  },
  // https://github.com/moonrepo/setup-toolchain
  'moonrepo/setup-toolchain': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: moon-version, proto-version
    withSchema: MoonrepoSetupToolchainWith,
  },
  'sigoden/install-binary': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined from `repo` input
    withSchema: InstallBinaryWith,
  },
  // https://github.com/terraform-linters/setup-tflint
  'terraform-linters/setup-tflint': {
    datasource: GithubReleasesDatasource.id,
    depName: 'tflint',
    packageName: 'terraform-linters/tflint',
    withSchema: TflintWith,
  },
};
