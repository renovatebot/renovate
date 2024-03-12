import { coerceArray } from '../../../util/array';
import { newlineRegex, regEx } from '../../../util/regex';
import { ClojureDatasource } from '../../datasource/clojure';
import type { PackageDependency, PackageFileContent } from '../types';
import type { ExtractContext, ExtractedVariables } from './types';

export function trimAtKey(str: string, kwName: string): string | null {
  const regex = new RegExp(`:${kwName}(?=\\s)`); // TODO #12872 lookahead
  const keyOffset = str.search(regex);
  if (keyOffset < 0) {
    return null;
  }
  const withSpaces = str.slice(keyOffset + kwName.length + 1);
  const valueOffset = withSpaces.search(regEx(/[^\s]/));
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
  vars: ExtractedVariables = {},
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
  let commentLevel = 0;

  const isSpace = (ch: string | null): boolean =>
    !!ch && regEx(/[\s,]/).test(ch);

  const cleanStrLiteral = (s: string): string =>
    s.replace(regEx(/^"/), '').replace(regEx(/"$/), '');

  const yieldDep = (): void => {
    if (!commentLevel && artifactId && version) {
      const depName = expandDepName(cleanStrLiteral(artifactId));
      if (version.startsWith('~')) {
        const varName = version.replace(regEx(/^~\s*/), '');
        const currentValue = vars[varName];
        if (currentValue) {
          result.push({
            ...ctx,
            datasource: ClojureDatasource.id,
            depName,
            currentValue,
            groupName: varName,
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

  let prevChar: string | null = null;
  while (idx < str.length) {
    const char = str.charAt(idx);

    if (str.substring(idx).startsWith('#_[')) {
      commentLevel = balance;
    }

    if (char === '[') {
      balance += 1;
      if (balance === 2) {
        vecPos = 0;
      }
    } else if (char === ']') {
      balance -= 1;

      if (commentLevel === balance) {
        artifactId = '';
        version = '';
        commentLevel = 0;
      }

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
  const result: string[] = [];

  const repoContent = trimAtKey(
    content.replace(/;;.*(?=[\r\n])/g, ''), // get rid of comments // TODO #12872 lookahead
    'repositories',
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
    const matches = coerceArray(
      repoSectionContent.match(regEx(/"https?:\/\/[^"]*"/g)),
    );
    const urls = matches.map((x) =>
      x.replace(regEx(/^"/), '').replace(regEx(/"$/), ''),
    );
    urls.forEach((url) => result.push(url));
  }

  return result;
}

const defRegex = regEx(
  /^[\s,]*\([\s,]*def[\s,]+(?<varName>[-+*=<>.!?#$%&_|a-zA-Z][-+*=<>.!?#$%&_|a-zA-Z0-9']+)[\s,]*"(?<stringValue>[^"]*)"[\s,]*\)[\s,]*$/,
);

export function extractVariables(content: string): ExtractedVariables {
  const result: ExtractedVariables = {};
  const lines = content.split(newlineRegex);
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const match = defRegex.exec(line);
    if (match?.groups) {
      const { varName: key, stringValue: val } = match.groups;
      result[key] = val;
    }
  }
  return result;
}

function collectDeps(
  content: string,
  key: string,
  registryUrls: string[],
  vars: ExtractedVariables,
): PackageDependency[] {
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
}

export function extractPackageFile(content: string): PackageFileContent {
  const registryUrls = extractLeinRepos(content);
  const vars = extractVariables(content);

  const deps: PackageDependency[] = [
    ...collectDeps(content, 'dependencies', registryUrls, vars),
    ...collectDeps(content, 'managed-dependencies', registryUrls, vars),
    ...collectDeps(content, 'plugins', registryUrls, vars),
    ...collectDeps(content, 'pom-plugins', registryUrls, vars),
  ];

  return { deps };
}
