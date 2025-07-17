import { RANGE_PATTERN } from '@renovatebot/pep440';
import type { lexer, parser } from 'good-enough-parser';
import { lang, query as q } from 'good-enough-parser';
import { regEx } from '../../../util/regex';
import { PypiDatasource } from '../../datasource/pypi';
import { normalizePythonDepName } from '../../datasource/pypi/common';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';

interface ManagerData {
  lineNumber: number;
}

type Context = PackageFileContent<ManagerData>;

const python = lang.createLang('python');

// Optimize regex memory usage when we don't need named groups
function cleanupNamedGroups(regexSource: string): string {
  return regexSource.replace(/\(\?<\w+>/g, '(?:');
}

const rangePattern = cleanupNamedGroups(RANGE_PATTERN);
const versionPattern = `(?:${rangePattern}(?:\\s*,\\s*${rangePattern})*)`;
const depNamePattern = '(?:[a-zA-Z][-_a-zA-Z0-9\\.]*[a-zA-Z0-9])';
const depPattern = [
  '^',
  `(?<depName>${depNamePattern})`,
  `(?<extra>(?:\\[\\s*(?:${depNamePattern}(?:\\s*,\\s*${depNamePattern})*\\s*)\\])?)`,
  `(?<currentValue>${versionPattern})`,
].join('\\s*');

const extractRegex = regEx(depPattern);

// Extract dependency string
function depStringHandler(
  ctx: Context,
  token: lexer.StringValueToken,
): Context {
  const depStr = token.value;
  const match = extractRegex.exec(depStr);
  // TODO #22198
  const { depName, currentValue } = match!.groups!;

  const dep: PackageDependency<ManagerData> = {
    depName,
    packageName: normalizePythonDepName(depName),
    currentValue,
    managerData: {
      lineNumber: token.line - 1,
    },
    datasource: PypiDatasource.id,
  };

  if (currentValue?.startsWith('==')) {
    dep.currentVersion = currentValue.replace(regEx(/^==\s*/), '');
  }

  return { ...ctx, deps: [...ctx.deps, dep] };
}

// Add `skip-reason` for dependencies annotated
// with "# renovate: ignore" comment
function depSkipHandler(ctx: Context): Context {
  const dep = ctx.deps[ctx.deps.length - 1];
  const deps = ctx.deps.slice(0, -1);
  deps.push({ ...dep, skipReason: 'ignored' });
  return { ...ctx, deps };
}

const incompleteDepString = q
  .str<Context>(new RegExp(cleanupNamedGroups(depPattern)))
  .op(regEx(/^\+|\*$/));

const depString = q
  .str<Context>(new RegExp(cleanupNamedGroups(depPattern)), depStringHandler)
  .opt(
    q
      .opt(q.op<Context>(','))
      .comment(/^#\s*renovate\s*:\s*ignore\s*$/, depSkipHandler),
  );

const query = q.alt(incompleteDepString, depString);

export function extractPackageFile(
  content: string,
  _packageFile: string,
  _config: ExtractConfig,
): PackageFileContent | null {
  const res = python.query<Context, parser.Node>(content, query, { deps: [] });
  return res?.deps?.length ? res : null;
}
