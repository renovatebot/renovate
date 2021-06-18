import { ClojureDatasource } from '../../datasource/clojure';
import type { PackageDependency, PackageFile } from '../types';
import type { ExtractContext } from './types';

export function trimAtKey(str: string, kwName: string): string | null {
  const regex = new RegExp(`:${kwName}(?=\\s)`);
  const keyOffset = str.search(regex);
  if (keyOffset < 0) {
    return null;
  }
  const withSpaces = str.slice(keyOffset + kwName.length + 1);
  const valueOffset = withSpaces.search(/[^\s]/);
  if (valueOffset < 0) {
    return null;
  }
  return withSpaces.slice(valueOffset);
}

export function expandDepName(name: string): string {
  return name.includes('/') ? name.replace('/', ':') : `${name}:${name}`;
}

export function extractFromVectors(
  str: string,
  ctx: ExtractContext = {}
): PackageDependency[] {
  if (!str.startsWith('[')) {
    return [];
  }
  let balance = 0;
  const result: PackageDependency[] = [];
  let idx = 0;
  let vecPos = 0;
  let artifactId = '';
  let version = '';

  const isSpace = (ch: string): boolean => ch && /[\s,]/.test(ch);

  const cleanStrLiteral = (s: string): string =>
    s.replace(/^"/, '').replace(/"$/, '');

  const yieldDep = (): void => {
    if (artifactId && version) {
      result.push({
        ...ctx,
        datasource: ClojureDatasource.id,
        depName: expandDepName(cleanStrLiteral(artifactId)),
        currentValue: cleanStrLiteral(version),
      });
    }
    artifactId = '';
    version = '';
  };

  let prevChar = null;
  while (idx < str.length) {
    const char = str.charAt(idx);
    if (char === '[') {
      balance += 1;
      if (balance === 2) {
        vecPos = 0;
      }
    } else if (char === ']') {
      balance -= 1;
      if (balance === 1) {
        yieldDep();
      } else if (balance === 0) {
        break;
      }
    } else if (balance === 2) {
      if (isSpace(char)) {
        if (!isSpace(prevChar)) {
          vecPos += 1;
        }
      } else if (vecPos === 0) {
        artifactId += char;
      } else if (vecPos === 1) {
        version += char;
      }
    }
    prevChar = char;
    idx += 1;
  }
  return result;
}

function extractLeinRepos(content: string): string[] {
  const result = [];

  const repoContent = trimAtKey(
    content.replace(/;;.*(?=[\r\n])/g, ''), // get rid of comments
    'repositories'
  );

  if (repoContent) {
    let balance = 0;
    let endIdx = 0;
    for (let idx = 0; idx < repoContent.length; idx += 1) {
      const char = repoContent.charAt(idx);
      if (char === '[') {
        balance += 1;
      } else if (char === ']') {
        balance -= 1;
        if (balance <= 0) {
          endIdx = idx;
          break;
        }
      }
    }
    const repoSectionContent = repoContent.slice(0, endIdx);
    const matches = repoSectionContent.match(/"https?:\/\/[^"]*"/g) || [];
    const urls = matches.map((x) => x.replace(/^"/, '').replace(/"$/, ''));
    urls.forEach((url) => result.push(url));
  }

  return result;
}

export function extractPackageFile(content: string): PackageFile {
  const collect = (
    key: string,
    registryUrls: string[]
  ): PackageDependency[] => {
    const ctx = {
      depType: key,
      registryUrls,
    };
    let result: PackageDependency[] = [];
    let restContent = trimAtKey(content, key);
    while (restContent) {
      result = [...result, ...extractFromVectors(restContent, ctx)];
      restContent = trimAtKey(restContent, key);
    }
    return result;
  };

  const registryUrls = extractLeinRepos(content);

  const deps: PackageDependency[] = [
    ...collect('dependencies', registryUrls),
    ...collect('managed-dependencies', registryUrls),
    ...collect('plugins', registryUrls),
    ...collect('pom-plugins', registryUrls),
  ];

  return { deps };
}
