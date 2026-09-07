import type { lexer, parser } from '@renovatebot/good-enough-parser';
import { lang, query as q } from '@renovatebot/good-enough-parser';
import { pypiDependency, rangePattern } from '../../../util/pep508.ts';
import { regEx } from '../../../util/regex.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';

interface ManagerData {
  lineNumber: number;
}

type Context = PackageFileContent<ManagerData>;

const python = lang.createLang('python');

// Optimize regex memory usage when we don't need named groups
function cleanupNamedGroups(regexSource: string): string {
  return regexSource.replace(regEx(/\(\?<\w+>/g), '(?:');
}

const versionPattern = `(?:${rangePattern}(?:\\s*,\\s*${rangePattern})*)`;
// Stricter than the shared `packagePattern`: names must start with a letter
// and be at least two characters long.
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
    ...pypiDependency(depName, currentValue),
    managerData: {
      lineNumber: token.line - 1,
    },
  };

  return { ...ctx, deps: [...ctx.deps, dep] };
}

// Add `skip-reason` for dependencies annotated
// with "# renovate: ignore" comment
function depSkipHandler(ctx: Context): Context {
  const dep = ctx.deps.at(-1);
  const deps = ctx.deps.slice(0, -1);
  deps.push({ ...dep, skipReason: 'ignored' });
  return { ...ctx, deps };
}

const incompleteDepString = q
  .str<Context>(regEx(cleanupNamedGroups(depPattern)))
  .op(regEx(/^\+|\*$/));

const depString = q
  .str<Context>(regEx(cleanupNamedGroups(depPattern)), depStringHandler)
  .opt(
    q
      .opt(q.op<Context>(','))
      .comment(regEx(/^#\s*renovate\s*:\s*ignore\s*$/), depSkipHandler),
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
