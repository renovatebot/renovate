import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import { MavenDatasource } from '../../datasource/maven';
import { MAVEN_REPO } from '../../datasource/maven/common';
import { SbtPackageDatasource } from '../../datasource/sbt-package';
import {
  SbtPluginDatasource,
  defaultRegistryUrls as sbtPluginDefaultRegistries,
} from '../../datasource/sbt-plugin';
import { get } from '../../versioning';
import * as mavenVersioning from '../../versioning/maven';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type { ParseContext, ParseOptions } from './types';

const stripComment = (str: string): string =>
  str.replace(regEx(/(^|\s+)\/\/.*$/), '');

const isSingleLineDep = (str: string): boolean =>
  regEx(/^\s*(libraryDependencies|dependencyOverrides)\s*\+=\s*/).test(str);

const isDepsBegin = (str: string): boolean =>
  regEx(/^\s*(libraryDependencies|dependencyOverrides)\s*\+\+=\s*/).test(str);

const isPluginDep = (str: string): boolean =>
  regEx(/^\s*addSbtPlugin\s*\(.*\)\s*$/).test(str);

const isStringLiteral = (str: string): boolean => regEx(/^"[^"]*"$/).test(str);

const isScalaVersion = (str: string): boolean =>
  regEx(/^\s*(?:ThisBuild\s*\/\s*)?scalaVersion\s*:=\s*"[^"]*"[\s,]*$/).test(
    str
  );

const getScalaVersion = (str: string): string =>
  str
    .replace(regEx(/^\s*(?:ThisBuild\s*\/\s*)?scalaVersion\s*:=\s*"/), '')
    .replace(regEx(/"[\s,]*$/), '');

const isPackageFileVersion = (str: string): boolean =>
  regEx(/^(version\s*:=\s*).*$/).test(str);

const getPackageFileVersion = (str: string): string =>
  str
    .replace(regEx(/^\s*version\s*:=\s*/), '')
    .replace(regEx(/[\s,]*$/), '')
    .replace(regEx(/"/g), '');

/*
  https://www.scala-sbt.org/release/docs/Cross-Build.html#Publishing+conventions
 */
const normalizeScalaVersion = (str: string): string => {
  // istanbul ignore if
  if (!str) {
    return str;
  }
  const versioning = get(mavenVersioning.id);
  if (versioning.isVersion(str)) {
    // Do not normalize unstable versions
    if (!versioning.isStable(str)) {
      return str;
    }
    // Do not normalize versions prior to 2.10
    if (!versioning.isGreaterThan(str, '2.10.0')) {
      return str;
    }
  }
  if (regEx(/^\d+\.\d+\.\d+$/).test(str)) {
    return str.replace(regEx(/^(\d+)\.(\d+)\.\d+$/), '$1.$2');
  }
  // istanbul ignore next
  return str;
};

const isScalaVersionVariable = (str: string): boolean =>
  regEx(
    /^\s*(?:ThisBuild\s*\/\s*)?scalaVersion\s*:=\s*[_a-zA-Z][_a-zA-Z0-9]*[\s,]*$/
  ).test(str);

const getScalaVersionVariable = (str: string): string =>
  str
    .replace(regEx(/^\s*(?:ThisBuild\s*\/\s*)?scalaVersion\s*:=\s*/), '')
    .replace(regEx(/[\s,]*$/), '');

const isResolver = (str: string): boolean =>
  regEx(
    /^\s*(resolvers\s*\+\+?=\s*((Seq|List|Stream)\()?)?"[^"]*"\s*at\s*"[^"]*"[\s,)]*$/
  ).test(str);
const getResolverUrl = (str: string): string =>
  str
    .replace(
      regEx(
        /^\s*(resolvers\s*\+\+?=\s*((Seq|List|Stream)\()?)?"[^"]*"\s*at\s*"/
      ),
      ''
    )
    .replace(regEx(/"[\s,)]*$/), '');

const isVarDependency = (str: string): boolean =>
  regEx(
    /^\s*(private\s*)?(lazy\s*)?val\s[_a-zA-Z][_a-zA-Z0-9]*\s*=.*(%%?).*%.*/
  ).test(str);

const isVarDef = (str: string): boolean =>
  regEx(
    /^\s*(private\s*)?(lazy\s*)?val\s+[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*"[^"]*"\s*$/
  ).test(str);

const isVarSeqSingleLine = (str: string): boolean =>
  regEx(
    /^\s*(private\s*)?(lazy\s*)?val\s+[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*(Seq|List|Stream)\(.*\).*\s*$/
  ).test(str);

const isVarSeqMultipleLine = (str: string): boolean =>
  regEx(
    /^\s*(private\s*)?(lazy\s*)?val\s+[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*(Seq|List|Stream)\(.*[^)]*.*$/
  ).test(str);

const getVarName = (str: string): string =>
  str
    .replace(regEx(/^\s*(private\s*)?(lazy\s*)?val\s+/), '')
    .replace(regEx(/\s*=\s*"[^"]*"\s*$/), '');

const isVarName = (str: string): boolean =>
  // allow dot annotation
  regEx(/^[_a-zA-Z][_a-zA-Z0-9]*(\.[_a-zA-Z][_a-zA-Z0-9]*)*$/).test(str);

const getVarInfo = (
  str: string,
  ctx: ParseContext
): { val: string; sourceFile: string; lineIndex: number } => {
  const rightPart = str.replace(
    regEx(/^\s*(private\s*)?(lazy\s*)?val\s+[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*"/),
    ''
  );
  const val = rightPart.replace(regEx(/"\s*$/), '');
  return { val, sourceFile: ctx.lookupVariableFile!, lineIndex: ctx.lineIndex };
};

function parseDepExpr(
  expr: string,
  ctx: ParseContext
): PackageDependency | null {
  const { scalaVersion, variables, lineIndex } = ctx;
  let { depType } = ctx;

  const getLastDotAnnotation = (longVar: string): string =>
    longVar?.match('.') ? longVar.split('.').pop() ?? '' : '';

  const isValidToken = (str: string): boolean =>
    isStringLiteral(str) ||
    (isVarName(str) && !!variables[getLastDotAnnotation(str)]);

  const resolveToken = (str: string): string => {
    if (isStringLiteral(str)) {
      return str.replace(regEx(/^"/), '').replace(regEx(/"$/), '');
    }
    const variable = variables[getLastDotAnnotation(str)];
    ctx.lookupVariableFile = variable.sourceFile;
    return variable.val;
  };

  const tokens = expr
    .trim()
    .split(regEx(/("[^"]*")/g))
    .map((x) => (regEx(/"[^"]*"/).test(x) ? x : x.replace(regEx(/[()]+/g), '')))
    .join('')
    .split(regEx(/\s*(%%?)\s*|\s*classifier\s*/));

  const [
    rawGroupId,
    groupOp,
    rawArtifactId,
    artifactOp,
    rawVersion,
    scopeOp,
    rawScope,
  ] = tokens;

  if (!rawGroupId) {
    return null;
  }
  if (!isValidToken(rawGroupId)) {
    return null;
  }

  if (!rawArtifactId) {
    return null;
  }
  if (!isValidToken(rawArtifactId)) {
    return null;
  }
  if (artifactOp !== '%') {
    return null;
  }

  if (!rawVersion) {
    return null;
  }
  if (!isValidToken(rawVersion)) {
    return null;
  }

  if (scopeOp && scopeOp !== '%') {
    return null;
  }

  const groupId = resolveToken(rawGroupId);
  const depName = `${groupId}:${resolveToken(rawArtifactId)}`;
  const artifactId =
    groupOp === '%%' && scalaVersion
      ? `${resolveToken(rawArtifactId)}_${scalaVersion}`
      : resolveToken(rawArtifactId);
  const packageName = `${groupId}:${artifactId}`;
  const currentValue = resolveToken(rawVersion);

  if (!depType && rawScope) {
    depType = rawScope.replace(regEx(/^"/), '').replace(regEx(/"$/), '');
  }

  const result: PackageDependency = {
    depName,
    packageName,
    currentValue,
    fileReplacePosition: lineIndex,
  };

  if (variables[rawVersion]) {
    result.groupName = `${rawVersion}`;
  }
  if (variables[getLastDotAnnotation(rawVersion)]) {
    result.fileReplacePosition =
      variables[getLastDotAnnotation(rawVersion)].lineIndex;
    result.groupName = `${getLastDotAnnotation(rawVersion)}`;
    result.editFile = variables[getLastDotAnnotation(rawVersion)].sourceFile;
  }

  if (depType) {
    result.depType = depType;
  }

  return result;
}

function parseSbtLine(
  acc: PackageFile & ParseOptions,
  line: string,
  lineIndex: number,
  lines: string[]
): PackageFile & ParseOptions {
  const { deps, registryUrls = [], variables = {} } = acc;

  let { isMultiDeps, scalaVersion, packageFileVersion } = acc;

  const ctx: ParseContext = {
    scalaVersion,
    variables,
    lookupVariableFile: acc.packageFile!,
    lineIndex,
  };

  let dep: PackageDependency | null = null;
  let scalaVersionVariable: string | null = null;
  if (line !== '') {
    if (isScalaVersion(line)) {
      isMultiDeps = false;
      const rawScalaVersion = getScalaVersion(line);
      scalaVersion = normalizeScalaVersion(rawScalaVersion);
      dep = {
        datasource: MavenDatasource.id,
        depName: 'scala',
        packageName: 'org.scala-lang:scala-library',
        currentValue: rawScalaVersion,
        separateMinorPatch: true,
      };
    } else if (isScalaVersionVariable(line)) {
      isMultiDeps = false;
      scalaVersionVariable = getScalaVersionVariable(line);
    } else if (isPackageFileVersion(line)) {
      packageFileVersion = getPackageFileVersion(line);
    } else if (isResolver(line)) {
      isMultiDeps = false;
      const url = getResolverUrl(line);
      registryUrls.push(url);
    } else if (isVarSeqSingleLine(line)) {
      isMultiDeps = false;
      const depExpr = line
        .replace(regEx(/^.*(Seq|List|Stream)\(\s*/), '')
        .replace(regEx(/\).*$/), '');
      dep = parseDepExpr(depExpr, {
        ...ctx,
      });
    } else if (isVarSeqMultipleLine(line)) {
      isMultiDeps = true;
      const depExpr = line.replace(regEx(/^.*(Seq|List|Stream)\(\s*/), '');
      dep = parseDepExpr(depExpr, {
        ...ctx,
      });
    } else if (isVarDef(line)) {
      variables[getVarName(line)] = getVarInfo(line, ctx);
    } else if (isVarDependency(line)) {
      isMultiDeps = false;
      const depExpr = line.replace(
        regEx(/^\s*(private\s*)?(lazy\s*)?val\s[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*/),
        ''
      );
      dep = parseDepExpr(depExpr, {
        ...ctx,
      });
    } else if (isSingleLineDep(line)) {
      isMultiDeps = false;
      const depExpr = line.replace(regEx(/^.*\+=\s*/), '');
      dep = parseDepExpr(depExpr, {
        ...ctx,
      });
    } else if (isPluginDep(line)) {
      isMultiDeps = false;
      const rightPart = line.replace(regEx(/^\s*addSbtPlugin\s*\(/), '');
      const depExpr = rightPart.replace(regEx(/\)\s*$/), '');
      dep = parseDepExpr(depExpr, {
        ...ctx,
        depType: 'plugin',
      });
    } else if (isDepsBegin(line)) {
      isMultiDeps = true;
    } else if (isMultiDeps) {
      const rightPart = line.replace(regEx(/^[\s,]*/), '');
      const depExpr = rightPart.replace(regEx(/[\s,]*$/), '');
      dep = parseDepExpr(depExpr, {
        ...ctx,
        // depType: 'plugin',
      });
    }
  }

  if (dep) {
    if (!dep.datasource) {
      if (dep.depType === 'plugin') {
        dep.datasource = SbtPluginDatasource.id;
        dep.registryUrls = Array.from(
          new Set([...registryUrls, ...sbtPluginDefaultRegistries])
        );
      } else {
        dep.datasource = SbtPackageDatasource.id;
      }
    }
    deps.push({
      registryUrls,
      ...dep,
    });
  }

  if (lineIndex + 1 < lines.length) {
    return {
      ...acc,
      isMultiDeps,
      scalaVersion:
        scalaVersion ||
        (scalaVersionVariable &&
          variables[scalaVersionVariable] &&
          normalizeScalaVersion(variables[scalaVersionVariable].val)),
      packageFileVersion,
    };
  }
  return {
    deps,
    packageFileVersion,
  };
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
  defaultAcc?: PackageFile & ParseOptions
): (PackageFile & ParseOptions) | null {
  if (!content) {
    return null;
  }
  const equalsToNewLineRe = regEx(/=\s*\n/, 'gm');
  const goodContentForParsing = content.replace(equalsToNewLineRe, '=');
  const lines = goodContentForParsing.split(newlineRegex).map(stripComment);

  const acc: PackageFile & ParseOptions = {
    registryUrls: [MAVEN_REPO],
    deps: [],
    isMultiDeps: false,
    scalaVersion: null,
    packageFile,
    ...defaultAcc,
  };

  // TODO: needs major refactoring?
  const res = lines.reduce(parseSbtLine, acc);
  return res.deps.length ? res : null;
}

async function prepareLoadPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<{
  variables: Record<
    string,
    { val: string; sourceFile: string; lineIndex: number }
  >;
  registryUrls: string[];
}> {
  let variables: ParseOptions['variables'] = {};
  let registryUrls: string[] = [MAVEN_REPO];
  const acc: PackageFile & ParseOptions = {
    registryUrls,
    deps: [],
    variables,
  };

  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.trace({ packageFile }, 'packageFile has no content');
      continue;
    }
    const res = extractPackageFile(content, packageFile, acc);
    if (res) {
      variables = { ...variables, ...res.variables };
      if (res.registryUrls) {
        registryUrls = Array.from(
          new Set([...registryUrls, ...res.registryUrls])
        );
      }
    }
  }
  return { variables, registryUrls };
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  const packages: PackageFile[] = [];
  const mapDepsToVariableFile: Record<string, PackageDependency[]> = {};

  // Start parsing file in project/ folder first to get variable
  packageFiles.sort((a, b) => (a.match('project/.*\\.scala$') ? -1 : 1));

  const { variables, registryUrls } = await prepareLoadPackageFiles(
    _config,
    packageFiles
  );

  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.trace({ packageFile }, 'packageFile has no content');
      continue;
    }
    const res = extractPackageFile(content, packageFile, {
      variables,
      registryUrls,
      deps: [],
    });
    if (res) {
      res.packageFile = packageFile;
      if (res?.deps) {
        for (const dep of res.deps) {
          const variableSourceFile = dep?.editFile ?? packageFile;
          if (!mapDepsToVariableFile[variableSourceFile]) {
            mapDepsToVariableFile[variableSourceFile] = [];
          }
          mapDepsToVariableFile[variableSourceFile].push(dep);
        }
        packages.push(res);
      }
    }
  }

  // Filter unique package
  // Packages are counted in submodule but it's the same one
  // by packageName and currentValue
  const finalPackages = Object.entries(mapDepsToVariableFile).map(
    ([packageFile, deps]) => ({
      packageFile,
      deps: deps.filter(
        (val, idx, self) =>
          idx ===
          self.findIndex(
            (dep) =>
              dep.packageName === val.packageName &&
              dep.currentValue === val.currentValue
          )
      ),
    })
  );

  return finalPackages.length > 0 ? finalPackages : null;
}
