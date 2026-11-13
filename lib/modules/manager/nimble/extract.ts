import type { SkipReason } from '../../../types/index.ts';
import { regEx } from '../../../util/regex.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { expandForgeAlias, resolvePackageUrl } from './registry.ts';

export function parseRequiresItems(rawLine: string): string[] {
  const items: string[] = [];
  const regex = regEx('["\']([^"\']*)["\']', 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawLine)) !== null) {
    const rawItem = match[1].trim();
    if (!rawItem) {
      continue;
    }
    for (const subItem of rawItem.split(',')) {
      const trimmed = subItem.trim();
      if (trimmed) {
        items.push(trimmed);
      }
    }
  }
  return items;
}

export function parseDependencyItem(item: string): {
  depName: string;
  currentValue: string;
} {
  const trimmed = item.trim();
  // Strip feature flags like [gui]
  const noFlags = trimmed.replace(regEx('\\[[^\\]]*\\]'), '').trim();

  // For file:// URLs, Nimble treats the entire string as the name (version.nim:378)
  if (noFlags.toLowerCase().startsWith('file://')) {
    return { depName: noFlags, currentValue: '' };
  }

  // In Nimble (version.nim:381), if there is whitespace, the first space
  // separates the package name from the version specification.
  const firstSpace = noFlags.search(regEx('\\s'));
  if (firstSpace !== -1) {
    const depName = noFlags.slice(0, firstSpace).trim();
    const currentValue = noFlags.slice(firstSpace + 1).trim();
    return { depName, currentValue };
  }

  // Check for VCS ref: e.g. pkg#head, pkg#branch, pkg#commit
  const hashIdx = noFlags.indexOf('#');
  if (hashIdx !== -1) {
    const depName = noFlags.slice(0, hashIdx).trim();
    const currentValue = noFlags.slice(hashIdx).trim();
    return { depName, currentValue };
  }

  // Bare package name with no version
  return { depName: noFlags, currentValue: '' };
}

const IGNORED_PATH_SEGMENTS = [
  'nimbledeps',
  'deps',
  '_deps',
  '.atlas',
  '.nimble',
  'nimcache',
  '.nimcache',
  'nimblecache',
];

export function isIgnoredPath(packageFile?: string): boolean {
  if (!packageFile) {
    return false;
  }
  const normalized = packageFile.replace(regEx('\\\\', 'g'), '/');
  return IGNORED_PATH_SEGMENTS.some(
    (seg) =>
      normalized.includes(`/${seg}/`) ||
      normalized.startsWith(`${seg}/`) ||
      normalized.endsWith(`/${seg}`) ||
      normalized === seg,
  );
}

async function createPackageDependency(
  item: string,
  depType: string,
  packageFile?: string,
): Promise<PackageDependency | null> {
  const { depName, currentValue } = parseDependencyItem(item);
  if (!depName) {
    return null;
  }

  const lowerName = depName.toLowerCase();

  if (lowerName.startsWith('file://')) {
    return {
      depName,
      datasource: GitTagsDatasource.id,
      depType,
      skipReason: 'file-dependency',
    };
  }

  const isCompiler =
    lowerName === 'nim' || lowerName === 'nimrod' || lowerName === 'compiler';
  let cleanName = depName;

  const isDirectUrl =
    depName.startsWith('https://') ||
    depName.startsWith('http://') ||
    depName.startsWith('git@');
  const directUrl = isDirectUrl ? depName : undefined;
  const targetUrl = expandForgeAlias(depName) ?? directUrl;

  if (targetUrl) {
    const urlParts = targetUrl.replace(regEx('\\.git$'), '').split('/');
    const lastPart = urlParts.at(-1);
    if (lastPart) {
      cleanName = lastPart;
    }
  }

  let finalDepType = 'dependencies';
  if (depType === 'taskRequires') {
    finalDepType = 'taskRequires';
  } else if (isCompiler) {
    finalDepType = 'compiler';
  }

  const packageName = await resolvePackageUrl(depName, packageFile);

  let skipReason: SkipReason | undefined;
  if (!currentValue || currentValue === 'any' || currentValue === '*') {
    skipReason = 'unspecified-version';
  } else if (currentValue.startsWith('#')) {
    skipReason = 'not-a-version';
  }

  return {
    depName: cleanName,
    packageName,
    currentValue: currentValue || undefined,
    datasource: GitTagsDatasource.id,
    depType: finalDepType,
    replaceString: item,
    ...(skipReason ? { skipReason } : {}),
  };
}

export async function extractPackageFile(
  content: string,
  packageFile?: string,
): Promise<PackageFileContent | null> {
  if (!content || isIgnoredPath(packageFile)) {
    return null;
  }

  const deps: PackageDependency[] = [];
  const lines = content.split(regEx('\\r?\\n'));
  let inTaskBlock = false;
  let inRequiresContinuation = false;
  let inRequiresParen = false;
  let inTaskRequiresContinuation = false;
  let inTaskRequiresParen = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Ignore commented lines
    if (trimmed.startsWith('#')) {
      continue;
    }

    const codeWithoutComment = trimmed.replace(regEx('#.*$'), '').trim();

    const isTaskRequiresStart = regEx('^taskRequires(?:\\s+|\\s*\\()').test(
      trimmed,
    );
    if (
      isTaskRequiresStart ||
      inTaskRequiresParen ||
      inTaskRequiresContinuation
    ) {
      let items: string[] = [];
      if (isTaskRequiresStart) {
        const hasOpenParen = regEx('^taskRequires\\s*\\(').test(trimmed);
        const hasCloseParen = trimmed.includes(')');
        if (hasOpenParen && !hasCloseParen) {
          inTaskRequiresParen = true;
          inTaskRequiresContinuation = false;
        } else {
          inTaskRequiresParen = false;
          inTaskRequiresContinuation = codeWithoutComment.endsWith(',');
        }

        const taskReqMatch = regEx(
          '^taskRequires(?:\\s*\\(|\\s+)(?:["\'](?<taskNameQuoted>[^"\']+)["\']|(?<taskNameBare>[a-zA-Z0-9_]+))\\s*(?:,\\s*(?<deps>.*))?$',
        ).exec(trimmed);
        const depsStr = taskReqMatch?.groups?.deps;
        if (depsStr) {
          items = parseRequiresItems(depsStr);
        }
      } else {
        items = parseRequiresItems(line);
        if (inTaskRequiresParen) {
          if (trimmed.includes(')')) {
            inTaskRequiresParen = false;
          }
        } else {
          inTaskRequiresContinuation = codeWithoutComment.endsWith(',');
        }
      }

      for (const item of items) {
        const dep = await createPackageDependency(
          item,
          'taskRequires',
          packageFile,
        );
        if (dep) {
          deps.push(dep);
        }
      }
      continue;
    }

    // Check if line begins or exits a task block
    if (regEx('^task\\s+[a-zA-Z0-9_]+').test(trimmed)) {
      inTaskBlock = true;
      inRequiresContinuation = false;
      inRequiresParen = false;
      continue;
    }

    // Unindented non-empty line exits task block
    if (inTaskBlock && line.length > 0 && !regEx('^\\s').test(line)) {
      inTaskBlock = false;
    }

    if (inTaskBlock) {
      continue;
    }

    const isRequiresStart = regEx('^requires(?:\\s+|\\s*\\()').test(trimmed);
    if (isRequiresStart || inRequiresParen || inRequiresContinuation) {
      if (isRequiresStart) {
        const hasOpenParen = regEx('^requires\\s*\\(').test(trimmed);
        const hasCloseParen = trimmed.includes(')');
        if (hasOpenParen && !hasCloseParen) {
          inRequiresParen = true;
          inRequiresContinuation = false;
        } else {
          inRequiresParen = false;
          inRequiresContinuation = codeWithoutComment.endsWith(',');
        }
      } else if (inRequiresParen) {
        if (trimmed.includes(')')) {
          inRequiresParen = false;
        }
      } else {
        inRequiresContinuation = codeWithoutComment.endsWith(',');
      }

      const items = parseRequiresItems(line);
      for (const item of items) {
        const dep = await createPackageDependency(
          item,
          'dependencies',
          packageFile,
        );
        if (dep) {
          deps.push(dep);
        }
      }
    }
  }

  if (deps.length === 0) {
    return null;
  }

  return {
    deps,
  };
}
