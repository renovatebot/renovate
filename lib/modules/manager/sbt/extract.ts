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
import type {
  GroupFilenameContent,
  ParseContext,
  ParseOptions,
  VariableContext,
} from './types';

const stripComment = (str: string): string =>
  str.replace(regEx(/(^|\s+)\/\/.*$/), '');

const isSingleLineDep = (str: string): boolean =>
  regEx(/^\s*(libraryDependencies|dependencyOverrides)\s*\+=\s*/).test(str);

const isDepsBegin = (str: string): boolean =>
  regEx(/^\s*(libraryDependencies|dependencyOverrides)\s*\+\+=\s*/).test(str) ||
  regEx(/\s*Seq\(\s*$/).test(str);

const isPluginDep = (str: string): boolean =>
  regEx(/^\s*(addSbtPlugin|addCompilerPlugin)\s*\(.*\)\s*$/).test(str);

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
  { lookupVariableFile, lineIndex }: ParseContext
): VariableContext => {
  const rightPart = str.replace(
    regEx(/^\s*(private\s*)?(lazy\s*)?val\s+[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*"/),
    ''
  );
  const val = rightPart.replace(regEx(/"\s*$/), '');
  return { val, sourceFile: lookupVariableFile!, lineIndex };
};

function parseDepExpr(
  expr: string,
  ctx: ParseContext
): PackageDependency | null {
  const { scalaVersion, variables, lineIndex, globalVariables } = ctx;
  let { depType } = ctx;

  const getLastDotAnnotation = (longVar: string): string =>
    longVar?.match('.') ? longVar.split('.').pop() ?? '' : '';

  const isValidToken = (str: string): boolean =>
    isStringLiteral(str) ||
    (isVarName(str) &&
      (Boolean(variables[getLastDotAnnotation(str)]) ||
        Boolean(globalVariables[getLastDotAnnotation(str)])));

  const resolveToken = (str: string): string => {
    if (isStringLiteral(str)) {
      return str.replace(regEx(/^"/), '').replace(regEx(/"$/), '');
    }
    const varName = getLastDotAnnotation(str);
    if (variables[varName]) {
      ctx.lookupVariableFile = variables[varName].sourceFile;
      return variables[varName].val;
    }
    if (globalVariables[varName]) {
      ctx.lookupVariableFile = globalVariables[varName].sourceFile;
      return globalVariables[varName].val;
    }
    return str;
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
    const actualVar = getLastDotAnnotation(rawVersion);
    result.fileReplacePosition = variables[actualVar].lineIndex;
    result.groupName = actualVar;
    result.editFile = variables[actualVar].sourceFile;
  } else if (globalVariables[getLastDotAnnotation(rawVersion)]) {
    const actualVar = getLastDotAnnotation(rawVersion);
    result.fileReplacePosition = globalVariables[actualVar].lineIndex;
    result.groupName = actualVar;
    result.editFile = globalVariables[actualVar].sourceFile;
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
  const { deps, registryUrls = [], variables = {}, globalVariables = {} } = acc;

  let { isMultiDeps, scalaVersion, packageFileVersion } = acc;

  const ctx: ParseContext = {
    scalaVersion,
    variables,
    lookupVariableFile: acc.packageFile!,
    lineIndex,
    globalVariables,
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
      const depExpr = line.replace(
        regEx(
          /^\s*(addSbtPlugin|addCompilerPlugin)\s*\(+(.*(%%?).*(%)\s*(\w+|".*")\s*)\)+.*/
        ),
        '$2'
      );
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
      });
    }
  }

  if (dep) {
    if (!dep.datasource) {
      if (dep.depType === 'plugin') {
        dep.datasource = SbtPluginDatasource.id;
        dep.registryUrls = [...registryUrls, ...sbtPluginDefaultRegistries];
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
    scalaVersion,
  };
}

export function extractFile(
  content: string,
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
    variables: {},
    globalVariables: {},
    ...defaultAcc,
  };

  // TODO: needs major refactoring?
  const res = lines.reduce(parseSbtLine, acc);
  return res.deps.length ? res : null;
}

function prepareLoadPackageFiles(
  _config: ExtractConfig,
  packageFilesContent: { packageFile: string; content: string }[]
): {
  globalVariables: ParseOptions['variables'];
  registryUrls: string[];
  scalaVersion: ParseOptions['scalaVersion'];
} {
  // Return variable
  let globalVariables: ParseOptions['variables'] = {};
  const registryUrls: string[] = [MAVEN_REPO];
  let scalaVersion: string | null = null;

  for (const { packageFile, content } of packageFilesContent) {
    const acc: PackageFile & ParseOptions = {
      registryUrls,
      deps: [],
      variables: globalVariables,
      packageFile,
    };
    const res = extractFile(content, acc);
    if (res) {
      globalVariables = { ...globalVariables, ...res.variables };
      if (res.registryUrls) {
        registryUrls.push(...res.registryUrls);
      }
      if (res.scalaVersion) {
        scalaVersion = res.scalaVersion;
      }
    }
  }

  return {
    globalVariables,
    registryUrls,
    scalaVersion,
  };
}

function getLocalBaseDir(packageFiles: string[]): string {
  packageFiles.sort();
  return packageFiles[0].split('/').slice(0, -1).join('/');
}

function folderGroup(baseDir: string, packageFile: string): string {
  let group = '';
  let dirs: string[] = [];
  if (baseDir === '') {
    dirs = packageFile.split('/');
  } else {
    dirs = packageFile.replace(baseDir, '').split('/').slice(1);
  }
  if (dirs.length > 1) {
    group = dirs[0];
  }
  return group;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  // baseDir will group folder to lookup in it's scope
  const baseDir = getLocalBaseDir(packageFiles);

  // Read packages and store in groupPackageFileContent
  // group package file by its folder
  const groupPackageFileContent: GroupFilenameContent = {};
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.trace({ packageFile }, 'packageFile has no content');
      continue;
    }
    const group = folderGroup(baseDir, packageFile);
    if (!groupPackageFileContent[group]) {
      groupPackageFileContent[group] = [];
    }
    groupPackageFileContent[group].push({ packageFile, content });
  }

  // 1. globalVariables from project/ and root package file
  // 2. registry from all package file
  // 3. Project's scalaVersion - use in parseDepExpr to add suffix eg. "_2.13"
  const { globalVariables, registryUrls, scalaVersion } =
    prepareLoadPackageFiles(_config, [
      ...groupPackageFileContent[''], // root
      ...(groupPackageFileContent['project']
        ? groupPackageFileContent['project']
        : []), // in project/ folder
    ]);

  const mapDepsToPackageFile: Record<string, PackageDependency[]> = {};
  // Start extract all package files
  for (const [, packageFileContents] of Object.entries(
    groupPackageFileContent
  )) {
    // Extract package file by its group
    // local variable is share within its group
    for (const { packageFile, content } of packageFileContents) {
      const res = extractFile(content, {
        registryUrls,
        deps: [],
        packageFile,
        scalaVersion,
        globalVariables,
      });
      if (res) {
        if (res?.deps) {
          for (const dep of res.deps) {
            const variableSourceFile = dep?.editFile ?? packageFile;
            dep.registryUrls = [...new Set(dep.registryUrls)];
            if (!mapDepsToPackageFile[variableSourceFile]) {
              mapDepsToPackageFile[variableSourceFile] = [];
            }
            // merge dep by file
            mapDepsToPackageFile[variableSourceFile].push(dep);
          }
        }
      }
    }
  }

  // Filter unique package
  // As we merge all package to single package file
  // Packages are counted in submodule but it's the same one
  // by packageName and currentValue
  const finalPackages = Object.entries(mapDepsToPackageFile).map(
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
