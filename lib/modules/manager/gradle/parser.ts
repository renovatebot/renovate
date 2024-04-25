import { lang, query as q } from 'good-enough-parser';
import { newlineRegex, regEx } from '../../../util/regex';
import type { PackageDependency } from '../types';
import { qApplyFrom } from './parser/apply-from';
import { qAssignments } from './parser/assignments';
import { qKotlinImport } from './parser/common';
import { qDependencies, qLongFormDep } from './parser/dependencies';
import { setParseGradleFunc } from './parser/handlers';
import { qKotlinMultiObjectVarAssignment } from './parser/objects';
import { qPlugins } from './parser/plugins';
import { qRegistryUrls } from './parser/registry-urls';
import { qVersionCatalogs } from './parser/version-catalogs';
import type {
  Ctx,
  GradleManagerData,
  PackageRegistry,
  PackageVariables,
  ParseGradleResult,
} from './types';
import { isDependencyString, parseDependencyString } from './utils';

const groovy = lang.createLang('groovy');
const ctx: Ctx = {
  packageFile: '',
  fileContents: {},
  recursionDepth: 0,

  globalVars: {},
  deps: [],
  registryUrls: [],

  varTokens: [],
  tmpKotlinImportStore: [],
  tmpNestingDepth: [],
  tmpTokenStore: {},
  tokenMap: {},
};

setParseGradleFunc(parseGradle);

export function parseGradle(
  input: string,
  initVars: PackageVariables = {},
  packageFile = '',
  fileContents: Record<string, string | null> = {},
  recursionDepth = 0,
): ParseGradleResult {
  let vars: PackageVariables = { ...initVars };
  const deps: PackageDependency<GradleManagerData>[] = [];
  const urls: PackageRegistry[] = [];

  const query = q.tree<Ctx>({
    type: 'root-tree',
    maxDepth: 32,
    search: q.alt<Ctx>(
      qKotlinImport,
      qAssignments,
      qDependencies,
      qPlugins,
      qRegistryUrls,
      qVersionCatalogs,
      qLongFormDep,
      qApplyFrom,
    ),
  });

  const parsedResult = groovy.query(input, query, {
    ...ctx,
    packageFile,
    fileContents,
    recursionDepth,
    globalVars: vars,
  });

  if (parsedResult) {
    deps.push(...parsedResult.deps);
    vars = { ...vars, ...parsedResult.globalVars };
    urls.push(...parsedResult.registryUrls);
  }

  return { deps, urls, vars };
}

export function parseKotlinSource(
  input: string,
  initVars: PackageVariables = {},
  packageFile = '',
): { vars: PackageVariables; deps: PackageDependency<GradleManagerData>[] } {
  let vars: PackageVariables = { ...initVars };
  const deps: PackageDependency<GradleManagerData>[] = [];

  const query = q.tree<Ctx>({
    type: 'root-tree',
    maxDepth: 1,
    search: qKotlinMultiObjectVarAssignment,
  });

  const parsedResult = groovy.query(input, query, {
    ...ctx,
    packageFile,
    globalVars: vars,
  });

  if (parsedResult) {
    deps.push(...parsedResult.deps);
    vars = { ...vars, ...parsedResult.globalVars };
  }

  return { deps, vars };
}

const propWord = '[a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*';
const propRegex = regEx(
  `^(?<leftPart>\\s*(?<key>${propWord})\\s*[= :]\\s*['"]?)(?<value>[^\\s'"]+)['"]?\\s*$`,
);

export function parseProps(
  input: string,
  packageFile?: string,
): { vars: PackageVariables; deps: PackageDependency<GradleManagerData>[] } {
  let offset = 0;
  const vars: PackageVariables = {};
  const deps: PackageDependency[] = [];
  for (const line of input.split(newlineRegex)) {
    const lineMatch = propRegex.exec(line);
    if (lineMatch?.groups) {
      const { key, value, leftPart } = lineMatch.groups;
      if (isDependencyString(value)) {
        const dep = parseDependencyString(value);
        if (dep) {
          deps.push({
            ...dep,
            managerData: {
              fileReplacePosition:
                offset + leftPart.length + dep.depName!.length + 1,
              packageFile,
            },
          });
        }
      } else {
        vars[key] = {
          key,
          value,
          fileReplacePosition: offset + leftPart.length,
          packageFile,
        };
      }
    }
    offset += line.length + 1;
  }
  return { vars, deps };
}
