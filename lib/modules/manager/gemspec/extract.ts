import { newlineRegex, regEx } from '../../../util/regex.ts';
import { RubygemsDatasource } from '../../datasource/rubygems/index.ts';
import { extractLockFileEntries } from '../bundler/locked-version.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { findGemspecLockFile } from './lockfile.ts';

const methodRegex = regEx(
  `^\\s*[\\w:.]+\\.add_(?<type>runtime_|development_)?dependency\\s*\\(?\\s*` +
    `['"](?<depName>[^'"]+)['"]` +
    `(?<rest>.*)$`,
);

// One or more comma-separated quoted constraint strings, e.g. `, "~> 4.2", "!= 4.2.5"`
const constraintsRegex = regEx(/^(?:\s*,\s*['"][^'"]+['"])+$/);

// The same strings wrapped in an array, e.g. `, ["~> 4.2", "!= 4.2.5"]`
const arrayConstraintsRegex = regEx(/^\s*,\s*\[(?<parts>[^\]]*)\]$/);

function stripTail(rest: string): string {
  return rest
    .replace(regEx(/#.*$/), '') // trailing comment
    .replace(regEx(/\)\s*$/), '') // closing paren of add_dependency(...)
    .trimEnd();
}

/** Returns the quoted constraint list after the gem name, without the leading comma or array brackets. */
function extractConstraints(rest: string): string | null {
  const arrayParts = arrayConstraintsRegex.exec(rest)?.groups?.parts;
  const constraints =
    arrayParts === undefined ? rest : `, ${arrayParts.trim()}`;
  if (!constraintsRegex.test(constraints)) {
    return null;
  }
  // keep the surrounding quotes so ruby versioning can re-quote each part
  return constraints.replace(regEx(/^\s*,\s*/), '').trimEnd();
}

function extractDeps(content: string): PackageDependency[] {
  const deps: PackageDependency[] = [];
  for (const line of content.split(newlineRegex)) {
    const match = methodRegex.exec(line);
    if (!match?.groups) {
      continue;
    }
    const { type, depName } = match.groups;
    const dep: PackageDependency = {
      depName,
      depType: type === 'development_' ? 'development' : 'runtime',
      datasource: RubygemsDatasource.id,
    };
    const constraints = extractConstraints(stripTail(match.groups.rest));
    if (depName.includes('#{')) {
      dep.skipReason = 'contains-variable';
    } else if (constraints) {
      dep.currentValue = constraints;
    } else {
      dep.skipReason = 'unspecified-version';
    }
    deps.push(dep);
  }
  return deps;
}

export async function extractPackageFile(
  content: string,
  packageFile?: string,
): Promise<PackageFileContent | null> {
  const deps = extractDeps(content);
  if (!deps.length) {
    return null;
  }

  const res: PackageFileContent = { deps };
  if (!packageFile) {
    return res;
  }

  const lockFile = await findGemspecLockFile(packageFile, content);
  if (!lockFile) {
    return res;
  }

  res.lockFiles = [lockFile.lockFile];
  const lockedVersions = extractLockFileEntries(lockFile.lockFileContent);
  for (const dep of deps) {
    const lockedVersion = lockedVersions.get(dep.depName!);
    if (lockedVersion) {
      dep.lockedVersion = lockedVersion;
    }
  }
  return res;
}
