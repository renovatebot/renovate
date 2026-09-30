import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { DebDatasource } from '../../datasource/deb/index.ts';
import { api as debVersioning } from '../../versioning/deb/index.ts';
import type { PackageDependency } from '../types.ts';
import { parseRunCommands } from './run-command.ts';

/**
 * `apt` options which consume the following argument, so that the argument is
 * not mistaken for a package name.
 *
 * Options given as `--opt=value` are a single token, so they need no entry here.
 */
const optionsWithValue = new Set([
  '-o',
  '--option',
  '-c',
  '--config-file',
  '-t',
  '--target-release',
  '--default-release',
  '-a',
  '--host-architecture',
  '--build-profiles',
]);

/**
 * An `apt` package specification, e.g. `curl`, `curl=8.5.0-2ubuntu10.6`,
 * `curl:amd64=8.5.0-2ubuntu10.6` or `curl/bookworm-backports`.
 *
 * The `:arch` qualifier selects the architecture to install for, and the
 * `/release` suffix picks the suite to install from - both are part of the
 * spec rather than of the package name.
 */
const debSpecRegex = regEx(
  /^(?<name>[a-z0-9][a-z0-9+.-]*)(?::(?<arch>[a-z0-9][a-z0-9-]*))?(?:=(?<version>.+)|\/(?<release>[a-z0-9][\w.-]*))?$/,
);

function parseSpec(spec: string): PackageDependency | null {
  const groups = debSpecRegex.exec(spec)?.groups;
  if (!groups) {
    logger.trace({ spec }, 'Skipping unparseable apt package spec');
    return null;
  }

  const { name, version } = groups;
  const dep: PackageDependency = {
    datasource: DebDatasource.id,
    depName: name,
  };

  if (!version) {
    // a bare name, or one only pinned to a suite, leaves Renovate nothing to
    // update
    dep.skipReason = 'unspecified-version';
    return dep;
  }

  if (version.includes('$')) {
    dep.skipReason = 'contains-variable';
    return dep;
  }

  // `apt` also accepts a wildcard such as `curl=8.5.*`, which is not a version
  // we can compare against the releases we find
  if (!debVersioning.isSingleVersion(version)) {
    dep.skipReason = 'unsupported-version';
    return dep;
  }

  dep.currentValue = version;
  dep.replaceString = spec;
  // Only the version is templated, so an `:arch` in the spec is preserved
  dep.autoReplaceStringTemplate = `${spec.slice(0, -version.length)}{{{newValue}}}`;
  return dep;
}

/** Package specs which are not registry lookups, and so are silently ignored */
function isIgnoredSpec(spec: string): boolean {
  return (
    // local or remote `.deb` files, e.g. `apt install ./curl_8.5.0-2_amd64.deb`
    spec.endsWith('.deb') ||
    spec.startsWith('.') ||
    spec.startsWith('/') ||
    // the `-` removes a package and the `+` installs one, e.g.
    // `apt install curl vim-`
    spec.endsWith('-') ||
    spec.endsWith('+')
  );
}

function extractAptInstallArgs(tokens: string[]): PackageDependency[] {
  const deps: PackageDependency[] = [];
  let subCommandFound = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.startsWith('-')) {
      if (optionsWithValue.has(token)) {
        i += 1;
      }
      continue;
    }

    if (!subCommandFound) {
      // `apt` accepts global options before the sub-command, so the first
      // non-option token is the sub-command
      if (token !== 'install') {
        return [];
      }
      subCommandFound = true;
      continue;
    }

    if (isIgnoredSpec(token)) {
      logger.trace({ spec: token }, 'Skipping apt package spec');
      continue;
    }

    const dep = parseSpec(token);
    if (dep) {
      deps.push(dep);
    }
  }

  return deps;
}

/**
 * Extracts Debian packages pinned by `apt install` or `apt-get install` in a
 * `RUN` instruction, e.g.
 *
 * ```dockerfile
 * RUN apt-get update && apt-get install -y --no-install-recommends \
 *       curl=8.5.0-2ubuntu10.6 \
 *       git=1:2.43.0-1ubuntu7.3
 * ```
 *
 * @param instruction the full `RUN` instruction, including any line continuations
 * @param escapeChar the Dockerfile escape character, already regex-escaped
 */
export function extractDebDeps(
  instruction: string,
  escapeChar: string,
): PackageDependency[] {
  return parseRunCommands(instruction, escapeChar, ['apt', 'apt-get']).flatMap(
    extractAptInstallArgs,
  );
}
