import { newlineRegex, regEx } from '../../../util/regex.ts';
import { RubygemsDatasource } from '../../datasource/rubygems/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

const methodRegex = regEx(
  `\\.add_(?<type>runtime_|development_)?dependency\\s*\\(?\\s*` +
    `(['"])(?<depName>[^'"]+)['"]` +
    `(?<rest>.*)$`,
);

// One or more comma-separated quoted constraint strings, e.g. `, "~> 4.2", "!= 4.2.5"`
const constraintsRegex = regEx(/^(?:\s*,\s*['"][^'"]+['"])+$/);

function stripTail(rest: string): string {
  return rest
    .replace(regEx(/#.*$/), '') // trailing comment
    .replace(regEx(/\)\s*$/), '') // closing paren of add_dependency(...)
    .trimEnd();
}

export function extractPackageFile(
  content: string,
  _packageFile?: string,
): PackageFileContent | null {
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
    const rest = stripTail(match.groups.rest);
    if (rest !== '' && constraintsRegex.test(rest)) {
      // keep the surrounding quotes so ruby versioning can re-quote each part
      dep.currentValue = rest.replace(regEx(/^\s*,\s*/), '');
    } else {
      dep.skipReason = 'unspecified-version';
    }
    deps.push(dep);
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
