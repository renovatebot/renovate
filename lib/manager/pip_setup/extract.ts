import { RANGE_PATTERN } from '@renovate/pep440/lib/specifier.js';
import { lang, lexer, query as q } from 'good-enough-parser';
import { PypiDatasource } from '../../datasource/pypi';
import { SkipReason } from '../../types';
import { regEx } from '../../util/regex';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

interface ManagerData {
  lineNumber: number;
}

type Context = PackageFile<ManagerData>;

const python = lang.createLang('python');

// Optimize regex memory usage when we don't need named groups
function cleanupNamedGroups(regexSource: string): string {
  return regexSource.replace(/\(\?<\w+>/g, '(?:');
}

const rangePattern = cleanupNamedGroups(RANGE_PATTERN);
const versionPattern = `(?:${rangePattern}(?:\\s*,\\s*${rangePattern})*)`;
const depNamePattern = '(?:[a-zA-Z][-_a-zA-Z0-9]*[a-zA-Z0-9])';
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
  token: lexer.StringValueToken
): Context {
  const depStr = token.value;
  const match = extractRegex.exec(depStr);
  const { depName, currentValue } = match.groups;

  const dep: PackageDependency<ManagerData> = {
    depName,
    currentValue,
    managerData: {
      lineNumber: token.line - 1,
    },
    datasource: PypiDatasource.id,
  };

  return { ...ctx, deps: [...ctx.deps, dep] };
}

// Add `skip-reason` for dependencies annotated
// with "# renovate: ignore" comment
function depSkipHandler(ctx: Context): Context {
  const dep = ctx.deps[ctx.deps.length - 1];
  const deps = ctx.deps.slice(0, -1);
  deps.push({ ...dep, skipReason: SkipReason.Ignored });
  return { ...ctx, deps };
}

const incompleteDepString = q
  .str<Context>(new RegExp(cleanupNamedGroups(depPattern)))
  .op(/^\+|\*$/);

const depString = q
  .str<Context>(new RegExp(cleanupNamedGroups(depPattern)), depStringHandler)
  .opt(
    q
      .opt(q.op<Context>(','))
      .comment(/^#\s*renovate\s*:\s*ignore\s*$/, depSkipHandler)
  );

const query = q.alt(incompleteDepString, depString);

export function extractPackageFile(
  content: string,
  _packageFile: string,
  _config: ExtractConfig
): PackageFile | null {
  const res = python.query<Context>(content, query, { deps: [] });
  return res?.deps?.length ? res : null;
}
