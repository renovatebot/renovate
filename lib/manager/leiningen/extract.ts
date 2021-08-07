import { ClojureDatasource } from '../../datasource/clojure';
import type { PackageDependency, PackageFile } from '../types';
import type { ExtractContext, ExtractedVariables } from './types';

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
  ctx: ExtractContext = {},
  vars: ExtractedVariables = {}
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
      const depName = expandDepName(cleanStrLiteral(artifactId));
      if (version.startsWith('~')) {
        const currentValue = vars[version.replace(/^~\s*/, '')];
        if (currentValue) {
          result.push({
            ...ctx,
            datasource: ClojureDatasource.id,
            depName,
            currentValue,
          });
        }
      } else {
        result.push({
          ...ctx,
          datasource: ClojureDatasource.id,
          depName,
          currentValue: cleanStrLiteral(version),
        });
      }
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

const defRegex =
  /^[\s,]*\([\s,]*def[\s,]+(?<varName>[-+*=<>.!?#$%&_|a-zA-Z][-+*=<>.!?#$%&_|a-zA-Z0-9']+)[\s,]*"(?<stringValue>[^"]*)"[\s,]*\)[\s,]*$/;

export function extractVariables(content: string): ExtractedVariables {
  const result: ExtractedVariables = {};
  const lines = content.split('\n');
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const match = defRegex.exec(line);
    if (match) {
      const { varName: key, stringValue: val } = match.groups;
      result[key] = val;
    }
  }
  return result;
}

export function extractPackageFile(content: string): PackageFile {
  const collect = (
    key: string,
    registryUrls: string[],
    vars: ExtractedVariables
  ): PackageDependency[] => {
    const ctx = {
      depType: key,
      registryUrls,
    };
    let result: PackageDependency[] = [];
    let restContent = trimAtKey(content, key);
    while (restContent) {
      result = [...result, ...extractFromVectors(restContent, ctx, vars)];
      restContent = trimAtKey(restContent, key);
    }
    return result;
  };

  const registryUrls = extractLeinRepos(content);
  const vars = extractVariables(content);

  const deps: PackageDependency[] = [
    ...collect('dependencies', registryUrls, vars),
    ...collect('managed-dependencies', registryUrls, vars),
    ...collect('plugins', registryUrls, vars),
    ...collect('pom-plugins', registryUrls, vars),
  ];

  return { deps };
}
