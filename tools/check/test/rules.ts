import assert from 'node:assert/strict';
import { posix as path } from 'node:path';
import { Minimatch, escape } from 'minimatch';

interface Rule {
  scope: Pattern[];
  sources: Pattern[];
  targets: { path: string; exclude: boolean }[];
}

interface Pattern {
  glob: Minimatch;
  exclude: boolean;
  rooted: boolean;
}

function splitPatterns(list: string): string[] {
  const patterns: string[] = [];
  let start = 0;
  let braces = 0;
  let inClass = false;

  for (let i = 0; i < list.length; i++) {
    const char = list[i];
    if (char === '\\') {
      i++;
    } else if (inClass) {
      inClass = char !== ']';
    } else if (char === '[') {
      inClass = true;
    } else if (char === '{') {
      braces++;
    } else if (char === '}') {
      braces--;
      assert(braces >= 0, `Unmatched brace: ${list}`);
    } else if (char === ',' && braces === 0) {
      patterns.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }

  patterns.push(list.slice(start).trim());
  assert(
    !inClass && braces === 0 && patterns.every((p) => p !== ''),
    `Invalid pattern list: ${list}`,
  );
  return patterns;
}

function parsePattern(
  pattern: string,
  aliases: ReadonlyMap<string, string>,
): {
  path: string;
  exclude: boolean;
} {
  const exclude = pattern.startsWith('!');
  const glob = exclude ? pattern.slice(1) : pattern;
  return { path: expandAlias(glob, aliases), exclude };
}

export function compileGlob(pattern: string): Minimatch {
  return new Minimatch(pattern, {
    dot: true,
    nocomment: true,
    nonegate: true,
    noext: true,
    platform: 'linux',
  });
}

function expandAlias(
  pattern: string,
  aliases: ReadonlyMap<string, string>,
): string {
  if (!pattern.startsWith('@')) {
    return pattern;
  }

  const [alias, ...rest] = pattern.split('/');
  const root = aliases.get(alias);
  assert(root, `Unknown lookup alias: ${alias}`);
  return `/${path.join(root, ...rest)}`;
}

function compileList(
  patterns: string[],
  aliases: ReadonlyMap<string, string>,
): Pattern[] {
  const result = patterns.map((pattern) => {
    const { path: anchored, exclude } = parsePattern(pattern, aliases);
    const rooted = anchored.startsWith('/');
    return {
      glob: compileGlob(path.normalize(rooted ? anchored.slice(1) : anchored)),
      exclude,
      rooted,
    };
  });
  assert(
    result.some(({ exclude }) => !exclude),
    'Expected a positive lookup pattern',
  );
  return result;
}

function matches(
  patterns: Pattern[],
  relative: string,
  rootRelative = relative,
): boolean {
  let included = false;
  for (const { glob, exclude, rooted } of patterns) {
    if (glob.match(rooted ? rootRelative : relative)) {
      if (exclude) {
        return false;
      }

      included = true;
    }
  }

  return included;
}

function parseRules(text: string): Rule[] {
  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'));
  const aliases = new Map<string, string>();
  const rules: Rule[] = [];
  let scope: Pattern[] | undefined;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    assert(line === line.trimStart(), `Unexpected lookup indentation: ${line}`);
    while (line.endsWith(',')) {
      const next = lines[++i];
      assert(
        next && next !== next.trimStart(),
        `Missing lookup continuation: ${line}`,
      );
      line = `${line} ${next.trimStart()}`;
    }

    if (line.startsWith('[') && line.endsWith(']') && !line.includes(' ->')) {
      const directories = line.slice(1, -1);
      scope = compileList(splitPatterns(directories), aliases);
      continue;
    }

    if (!scope) {
      const [alias, root] = line.split(' = ');
      assert(
        alias.startsWith('@') && root,
        `Expected lookup scope or alias: ${line}`,
      );
      aliases.set(alias, root);
      continue;
    }

    const arrow = line.indexOf(' ->');
    assert(arrow > 0, `Expected lookup rule: ${line}`);
    const right = line.slice(arrow + 3).trim();
    const targets = right ? splitPatterns(right) : [];
    if (!right) {
      while (lines[i + 1] !== lines[i + 1]?.trimStart()) {
        const target = splitPatterns(lines[++i].trim());
        assert(target.length === 1, 'Expected one lookup target per line');
        targets.push(target[0]);
      }
    }

    assert(targets.length, `Missing lookup targets: ${line}`);
    rules.push({
      scope,
      sources: compileList(splitPatterns(line.slice(0, arrow)), aliases),
      targets: targets.map((target) => parsePattern(target, aliases)),
    });
  }

  return rules;
}

export function createRuleMatcher(
  text: string,
  specs: ReadonlySet<string>,
): (source: string) => { included: Set<string>; excluded: Set<string> } {
  const rules = parseRules(text);
  const targetCache = new Map<string, string[]>();

  function resolveTarget(dir: string, target: string): string[] {
    const pattern = target.startsWith('/')
      ? path.normalize(target.slice(1))
      : path.join(escape(dir, { magicalBraces: true }), target);
    let files = targetCache.get(pattern);
    if (!files) {
      const glob = compileGlob(pattern);
      files = [...specs].filter((file) => glob.match(file));
      targetCache.set(pattern, files);
    }

    return files;
  }

  return (source) => {
    const included = new Set<string>();
    const excluded = new Set<string>();

    for (let dir = path.dirname(source); ; dir = path.dirname(dir)) {
      const relative = path.relative(dir, source);
      for (const rule of rules) {
        if (
          !matches(rule.scope, dir) ||
          !matches(rule.sources, relative, source)
        ) {
          continue;
        }

        for (const target of rule.targets) {
          const output = target.exclude ? excluded : included;
          for (const spec of resolveTarget(dir, target.path)) {
            output.add(spec);
          }
        }
      }

      if (dir === '.') {
        return { included, excluded };
      }
    }
  };
}
