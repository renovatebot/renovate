import { lang, query as q } from '@renovate/parser-utils';
import { RANGE_PATTERN } from '@renovate/pep440/lib/specifier';
import { StringValueToken } from '../../../../parser-utils/lib/lexer/types';
import { PypiDatasource } from '../../datasource/pypi';
import { SkipReason } from '../../types';
import { ExtractConfig, PackageDependency, PackageFile } from '../types';

interface ManagerData {
  lineNumber: number;
}

type Context = PackageFile<ManagerData>;

const python = lang.createLang('python');

function cleanupNamedGroups(regexSource: string): string {
  return regexSource.replace(/\(\?<\w+>/g, '(?:');
}

const rangePattern = cleanupNamedGroups(RANGE_PATTERN);
const versionPattern = `(?:${rangePattern}(?:\\s*,\\s*${rangePattern})*)`;
const depNamePattern = '(?:[a-zA-Z][-_a-zA-Z0-9]+[a-zA-Z0-9])';
const depPattern = [
  '^',
  `(?<depName>${depNamePattern})`,
  `(?<extra>(?:\\[\\s*(?:${depNamePattern}(?:\\s*,\\s*${depNamePattern})*\\s*)\\])?)`,
  `(?<currentValue>${versionPattern})`,
].join('\\s*');

const extractRegex = new RegExp(depPattern);

function handler(ctx: Context, token: StringValueToken): Context {
  const depStr = token.value;
  const match = extractRegex.exec(depStr);
  if (match) {
    const { depName, currentValue } = match.groups ?? {};
    if (depName) {
      const dep: PackageDependency<ManagerData> = {
        datasource: PypiDatasource.id,
        depName,
        currentValue,
        managerData: {
          lineNumber: token.line - 1,
        },
      };

      return {
        ...ctx,
        deps: [...ctx.deps, dep],
      };
    }
  }

  return ctx;
}

function skipHandler(ctx: Context): Context {
  const dep = ctx.deps[ctx.deps.length - 1];
  if (dep) {
    const deps = ctx.deps.slice(0, -1);
    deps.push({ ...dep, skipReason: SkipReason.Ignored });
    return { ...ctx, deps };
  }

  return ctx;
}

const incompleteDepString = q
  .str<Context>(new RegExp(cleanupNamedGroups(depPattern)))
  .op(/^\+|\*$/);

const depString = q
  .str<Context>(new RegExp(cleanupNamedGroups(depPattern)), handler)
  .opt(
    q
      .opt(q.op<Context>(','))
      .comment(/^#\s*renovate\s*:\s*ignore\s*$/, skipHandler)
  );

const query = q.alt(incompleteDepString, depString);

export function extractPackageFile(
  content: string,
  _packageFile: string,
  _config: ExtractConfig
): PackageFile | null {
  const res = python.query<Context>(content, query, { deps: [] });
  return res.deps.length ? res : null;
}
