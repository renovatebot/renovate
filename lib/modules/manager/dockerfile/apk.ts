import { split } from 'shlex';
import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { ApkDatasource } from '../../datasource/apk/index.ts';
import { api as apkVersioning } from '../../versioning/apk/index.ts';
import type { PackageDependency } from '../types.ts';

/** Shell operators which start a new command */
const commandSeparators = ['&&', '||', ';', '|', '&', '(', ')', '{', '}'];

/**
 * Tokens which may precede the command in a shell command, e.g. the `do` of
 * `for i in 1 2 3; do apk add ...; done`.
 *
 * Variable assignments such as `DEBUG=1 apk add ...` are skipped separately.
 */
const commandPrefixes = ['do', 'then', 'else', 'elif', '!', 'time', 'command'];

const assignmentRegex = regEx(/^[a-zA-Z_]\w*=/);

/**
 * `apk` options which consume the following argument, so that the argument is
 * not mistaken for a package name.
 *
 * Options given as `--opt=value` are a single token, so they need no entry here.
 */
const optionsWithValue = new Set([
  '-X',
  '--repository',
  '-t',
  '--virtual',
  '-p',
  '--root',
  '--arch',
  '--cache-dir',
  '--cache-max-age',
  '--keys-dir',
  '--repositories-file',
  '--progress-fd',
  '--timeout',
  '--wait',
]);

/**
 * An `apk` package specification, e.g. `bash`, `bash=5.2.37-r2`, `bash>5.2` or
 * `nodejs@edge=22.13.1-r0`.
 *
 * `apk` builds the constraint operator from its characters, so they may be
 * given in any order and may repeat - see the `apk` versioning module.
 *
 * The `@repoTag` suffix pins the package to a tagged repository from
 * `/etc/apk/repositories`, and is part of the spec rather than of the name.
 */
const apkSpecRegex = regEx(
  /^(?<name>[a-zA-Z0-9][\w.+-]*)(?:@(?<repoTag>[\w.-]+))?(?:(?<operator>[<>=~]+)(?<version>.+))?$/,
);

function parseSpec(spec: string): PackageDependency | null {
  const groups = apkSpecRegex.exec(spec)?.groups;
  if (!groups) {
    logger.trace({ spec }, 'Skipping unparseable apk package spec');
    return null;
  }

  const { name, operator, version } = groups;
  // the `apk` datasource defaults to `apk` versioning, so the constraint is
  // read the same way here as it is during the lookup
  const dep: PackageDependency = {
    datasource: ApkDatasource.id,
    depName: name,
  };

  if (!operator) {
    // Renovate has nothing to update until the user constrains the version
    dep.skipReason = 'unspecified-version';
    return dep;
  }

  if (version.includes('$')) {
    dep.skipReason = 'contains-variable';
    return dep;
  }

  // Rejects an unparseable version and the `><` identity hash operator, as
  // well as the range constraints, which a follow-up change will extract
  const constraint = operator + version;
  if (!apkVersioning.isSingleVersion(constraint)) {
    dep.skipReason = 'unsupported-version';
    return dep;
  }

  // An exact pin reads better as a plain version, so the `=` stays in the
  // replaceString rather than becoming part of the value we report
  dep.currentValue = version;
  dep.replaceString = spec;
  // Only the version is templated, so a `@repoTag` in the spec is preserved
  dep.autoReplaceStringTemplate = `${spec.slice(0, -version.length)}{{{newValue}}}`;
  return dep;
}

/** Package specs which are not registry lookups, and so are silently ignored */
function isIgnoredSpec(spec: string): boolean {
  return (
    // conflict markers, e.g. `apk add foo !bar`
    spec.startsWith('!') ||
    // virtual package names, e.g. `apk add .build-deps`
    spec.startsWith('.') ||
    // local or remote `.apk` files, e.g. `apk add ./foo-1.2.3-r0.apk`
    spec.includes('/') ||
    // provider dependencies, e.g. `so:libc.musl-x86_64.so.1`, `cmd:node`
    spec.includes(':')
  );
}

function extractApkAddArgs(tokens: string[]): PackageDependency[] {
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
      // `apk` accepts global options before the sub-command, so the first
      // non-option token is the sub-command
      if (token !== 'add') {
        return [];
      }
      subCommandFound = true;
      continue;
    }

    if (isIgnoredSpec(token)) {
      logger.trace({ spec: token }, 'Skipping apk package spec');
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
 * The `RUN` keyword and its flags, e.g. `RUN --mount=type=cache,target=/x `.
 *
 * Stripping these leaves the shell command that the instruction runs.
 */
const runPrefixRegex = regEx(
  /^[ \t]*(?:ONBUILD[ \t]+)?RUN[ \t]+(?:--[a-z]\S*[ \t]+)*/i,
);

/**
 * Extracts APK packages pinned by `apk add` in a `RUN` instruction, e.g.
 *
 * ```dockerfile
 * RUN apk add --no-cache \
 *       bash=5.2.37-r2 \
 *       rsyslog=8.2412.0-r1
 * ```
 *
 * @param instruction the full `RUN` instruction, including any line continuations
 * @param escapeChar the Dockerfile escape character, already regex-escaped
 */
export function extractApkDeps(
  instruction: string,
  escapeChar: string,
): PackageDependency[] {
  // A `#` line inside a line continuation is a Dockerfile comment, and is
  // dropped before the shell ever sees it
  const joined = instruction
    .split(newlineRegex)
    .filter((line) => !regEx(/^[ \t]*#/).test(line))
    .join('\n')
    .replace(regEx(`${escapeChar}[ \\t]*\\r?\\n`, 'g'), ' ');

  const runPrefix = runPrefixRegex.exec(joined)?.[0];
  if (!runPrefix) {
    return [];
  }

  const command = joined.slice(runPrefix.length);
  if (!command.includes('apk')) {
    return [];
  }

  let tokens: string[];
  try {
    tokens = split(command);
  } catch (err) {
    logger.debug({ err, command }, 'Failed to tokenize Dockerfile RUN command');
    return [];
  }

  const deps: PackageDependency[] = [];
  // Split the shell command into the individual commands it runs, so that only
  // the arguments of an `apk` invocation are considered
  let current: string[] = [];
  for (const token of tokens) {
    if (token.startsWith('#')) {
      // the rest of the command is a shell comment
      break;
    }
    if (commandSeparators.includes(token)) {
      deps.push(...extractApkCommand(current));
      current = [];
      continue;
    }
    // e.g. the `{1..10};` of `for iter in {1..10}; do apk add ...`, which shlex
    // keeps as one token because no whitespace precedes the `;`
    if (token.endsWith(';')) {
      current.push(token.slice(0, -1));
      deps.push(...extractApkCommand(current));
      current = [];
      continue;
    }
    current.push(token);
  }
  deps.push(...extractApkCommand(current));

  return deps;
}

function extractApkCommand(tokens: string[]): PackageDependency[] {
  let start = 0;
  while (
    start < tokens.length &&
    (commandPrefixes.includes(tokens[start]) ||
      assignmentRegex.test(tokens[start]))
  ) {
    start += 1;
  }

  const command = tokens[start];
  if (command !== 'apk' && !command?.endsWith('/apk')) {
    return [];
  }
  return extractApkAddArgs(tokens.slice(start + 1));
}
