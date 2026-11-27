import { readFile } from 'node:fs/promises';
import { posix as path } from 'node:path';
import { PLATFORM_HOST_TYPES } from '../../../lib/constants/platforms.ts';
import { type Checkout, regularFiles } from '../checkout.ts';
import { compileGlob } from '../glob.ts';
import { createRuleMatcher } from './rules.ts';

const maxTests = 64;

const excludedPaths = [
  '**/node_modules/**',
  'dist/**/*',
  '.worktrees/**/*',
  '.claude/worktrees/**/*',
  '.pnpm-store/**/*',
];

const testSupportDirs = new Set([
  '__fixtures__',
  '__mocks__',
  '__testutil__',
  'test',
  'node_modules',
]);
const platformNames = new Set<string>(PLATFORM_HOST_TYPES);

function isSpec(file: string): boolean {
  return file.endsWith('.spec.ts') || file.endsWith('.spec.mjs');
}

function sameNameSpec(file: string): string | undefined {
  if (isSpec(file)) {
    return file;
  }

  if (file.endsWith('.ts') || file.endsWith('.mjs')) {
    const extension = file.lastIndexOf('.');
    return `${file.slice(0, extension)}.spec${file.slice(extension)}`;
  }

  return undefined;
}

async function eligibleSpecs(files: Set<string>): Promise<Set<string>> {
  const excludes = excludedPaths.map(compileGlob);
  const candidates = [...files].filter(
    (file) => isSpec(file) && !excludes.some((exclude) => exclude.match(file)),
  );
  return new Set(await regularFiles(candidates));
}

function owningModule(
  source: string,
  paths: ReadonlySet<string>,
): string | undefined {
  if (!source.startsWith('lib/modules/') || isSpec(source)) {
    return undefined;
  }

  const extension = path.extname(source);
  if (extension !== '.ts' && extension !== '.mjs' && extension !== '.proto') {
    return undefined;
  }

  const parts = source.split('/');
  const [, , family, name] = parts;
  if (
    family !== 'manager' &&
    family !== 'datasource' &&
    family !== 'versioning' &&
    !(family === 'platform' && platformNames.has(name))
  ) {
    return undefined;
  }

  const depth = family === 'manager' && name === 'custom' ? 5 : 4;
  if (
    parts.length <= depth ||
    parts.slice(3, -1).some((dir) => testSupportDirs.has(dir))
  ) {
    return undefined;
  }

  const root = `${parts.slice(0, depth).join('/')}/`;
  return paths.has(`${root}index.ts`) ? root : undefined;
}

function directoryDistance(source: string, spec: string): number {
  const from = source.split('/').slice(0, -1);
  const to = spec.split('/').slice(0, -1);
  let common = 0;
  while (common < from.length && from[common] === to[common]) {
    common++;
  }

  return from.length + to.length - 2 * common;
}

interface Rank {
  tier: number;
  distance: number;
}

function selectionTier(
  source: string,
  spec: string,
  direct: string | undefined,
  root: string | undefined,
): number {
  if (source === spec) {
    return 0;
  }

  if (direct === spec) {
    return 1;
  }

  return root && spec.startsWith(root) ? 2 : 3;
}

function compareRanks(a: Rank, b: Rank): number {
  return a.tier - b.tier || a.distance - b.distance;
}

interface Selection {
  selected: string[];
  matchCount: number;
}

function selectTests(
  changes: string[],
  files: ReadonlySet<string>,
  specs: ReadonlySet<string>,
  text: string,
): Selection {
  const paths = new Set([...files, ...changes]);
  const match = createRuleMatcher(text, specs);
  const ranks = new Map<string, Rank>();

  for (const source of changes) {
    const direct = sameNameSpec(source);
    const root = owningModule(source, paths);
    const { included, excluded } = match(source);
    if (direct && specs.has(direct)) {
      included.add(direct);
    }

    if (root) {
      for (const spec of specs) {
        if (spec.startsWith(root)) {
          included.add(spec);
        }
      }
    }

    for (const spec of included.difference(excluded)) {
      const rank = {
        tier: selectionTier(source, spec, direct, root),
        distance: directoryDistance(source, spec),
      };
      const previous = ranks.get(spec);
      if (!previous || compareRanks(rank, previous) < 0) {
        ranks.set(spec, rank);
      }
    }
  }

  const limit = Math.max(0, Math.min(maxTests, specs.size - 1));
  const selected = [...ranks]
    .sort(
      ([a, rankA], [b, rankB]) =>
        compareRanks(rankA, rankB) ||
        Buffer.compare(Buffer.from(a), Buffer.from(b)),
    )
    .slice(0, limit)
    .map(([file]) => file);
  return { selected, matchCount: ranks.size };
}

export async function selectChangedTests({
  changes,
  files,
}: Checkout): Promise<Selection> {
  const [specs, text] = await Promise.all([
    eligibleSpecs(files),
    readFile(new URL('deps.txt', import.meta.url), 'utf8'),
  ]);
  return selectTests(changes, files, specs, text);
}
