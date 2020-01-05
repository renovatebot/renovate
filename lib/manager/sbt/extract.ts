import { DEFAULT_MAVEN_REPO } from '../maven/extract';
import { PackageFile, PackageDependency } from '../common';

const isComment = (str: string): boolean => /^\s*\/\//.test(str);

const isSingleLineDep = (str: string): boolean =>
  /^\s*(libraryDependencies|dependencyOverrides)\s*\+=\s*/.test(str);

const isDepsBegin = (str: string): boolean =>
  /^\s*(libraryDependencies|dependencyOverrides)\s*\+\+=\s*/.test(str);

const isPluginDep = (str: string): boolean =>
  /^\s*addSbtPlugin\s*\(.*\)\s*$/.test(str);

const isStringLiteral = (str: string): boolean => /^"[^"]*"$/.test(str);

const isScalaVersion = (str: string): boolean =>
  /^\s*scalaVersion\s*:=\s*"[^"]*"\s*$/.test(str);

const getScalaVersion = (str: string): string =>
  str.replace(/^\s*scalaVersion\s*:=\s*"/, '').replace(/"\s*$/, '');

const isScalaVersionVariable = (str: string): boolean =>
  /^\s*scalaVersion\s*:=\s*[_a-zA-Z][_a-zA-Z0-9]*\s*$/.test(str);

const getScalaVersionVariable = (str: string): string =>
  str.replace(/^\s*scalaVersion\s*:=\s*/, '').replace(/\s*$/, '');

const isResolver = (str: string): boolean =>
  /^\s*(resolvers\s*\+\+?=\s*(Seq\()?)?"[^"]*"\s*at\s*"[^"]*"[\s,)]*$/.test(
    str
  );
const getResolverUrl = (str: string): string =>
  str
    .replace(/^\s*(resolvers\s*\+\+?=\s*(Seq\()?)?"[^"]*"\s*at\s*"/, '')
    .replace(/"[\s,)]*$/, '');

const isVarDef = (str: string): boolean =>
  /^\s*val\s+[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*"[^"]*"\s*$/.test(str);

const getVarName = (str: string): string =>
  str.replace(/^\s*val\s+/, '').replace(/\s*=\s*"[^"]*"\s*$/, '');

const isVarName = (str: string): boolean =>
  /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(str);

const getVarInfo = (
  str: string,
  ctx: ParseContext
): { val: string; fileReplacePosition: number } => {
  const { fileOffset } = ctx;
  const rightPart = str.replace(/^\s*val\s+[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*"/, '');
  const fileReplacePosition = str.indexOf(rightPart) + fileOffset;
  const val = rightPart.replace(/"\s*$/, '');
  return { val, fileReplacePosition };
};

interface ParseContext {
  fileOffset: number;
  scalaVersion: string;
  variables: any;
  depType?: string;
}

function parseDepExpr(
  expr: string,
  ctx: ParseContext
): PackageDependency | null {
  const { scalaVersion, fileOffset, variables } = ctx;
  let { depType } = ctx;

  const isValidToken = (str: string): boolean =>
    isStringLiteral(str) || (isVarName(str) && !!variables[str]);

  const resolveToken = (str: string): string =>
    isStringLiteral(str)
      ? str.replace(/^"/, '').replace(/"$/, '')
      : variables[str].val;

  const tokens = expr.trim().split(/\s*(%%?)\s*/);
  const [
    rawGroupId,
    groupOp,
    rawArtifactId,
    artifactOp,
    rawVersion,
    scopeOp,
    rawScope,
  ] = tokens;

  if (!rawGroupId) return null;
  if (!isValidToken(rawGroupId)) return null;

  if (!rawArtifactId) return null;
  if (!isValidToken(rawArtifactId)) return null;
  if (artifactOp !== '%') return null;

  if (!rawVersion) return null;
  if (!isValidToken(rawVersion)) return null;

  if (scopeOp && scopeOp !== '%') return null;

  const groupId = resolveToken(rawGroupId);
  const artifactId =
    groupOp === '%%' && scalaVersion
      ? `${resolveToken(rawArtifactId)}_${scalaVersion}`
      : resolveToken(rawArtifactId);
  const depName = `${groupId}:${artifactId}`;
  const currentValue = resolveToken(rawVersion);

  if (!depType && rawScope) {
    depType = rawScope.replace(/^"/, '').replace(/"$/, '');
  }

  let fileReplacePosition: number;
  if (isStringLiteral(rawVersion)) {
    // Calculate fileReplacePosition incrementally
    // help us to avoid errors in updating phase.
    fileReplacePosition = 0;
    fileReplacePosition +=
      expr.slice(fileReplacePosition).indexOf(rawGroupId) + rawGroupId.length;
    fileReplacePosition +=
      expr.slice(fileReplacePosition).indexOf(rawArtifactId) +
      rawArtifactId.length;
    fileReplacePosition += expr
      .slice(fileReplacePosition)
      .indexOf(currentValue);
    fileReplacePosition += fileOffset;
  } else {
    fileReplacePosition = variables[rawVersion].fileReplacePosition;
  }

  const result: PackageDependency = {
    depName,
    currentValue,
    fileReplacePosition,
  };

  if (depType) {
    result.depType = depType;
  }

  return result;
}
interface ParseOptions {
  fileOffset?: number;
  isMultiDeps?: boolean;
  scalaVersion?: string;
  variables?: Record<string, any>;
}

function parseSbtLine(
  acc: PackageFile & ParseOptions,
  line: string,
  lineIndex: number,
  lines: string[]
): (PackageFile & ParseOptions) | null {
  const { deps, registryUrls, fileOffset, variables } = acc;

  let { isMultiDeps, scalaVersion } = acc;

  const ctx: ParseContext = {
    scalaVersion,
    fileOffset,
    variables,
  };

  let dep: PackageDependency = null;
  let scalaVersionVariable: string = null;
  if (!isComment(line)) {
    if (isScalaVersion(line)) {
      isMultiDeps = false;
      scalaVersion = getScalaVersion(line);
    } else if (isScalaVersionVariable(line)) {
      isMultiDeps = false;
      scalaVersionVariable = getScalaVersionVariable(line);
    } else if (isResolver(line)) {
      isMultiDeps = false;
      const url = getResolverUrl(line);
      registryUrls.push(url);
    } else if (isVarDef(line)) {
      variables[getVarName(line)] = getVarInfo(line, ctx);
    } else if (isSingleLineDep(line)) {
      isMultiDeps = false;
      const depExpr = line.replace(/^.*\+=\s*/, '');
      const expOffset = line.length - depExpr.length;
      dep = parseDepExpr(depExpr, {
        ...ctx,
        fileOffset: fileOffset + expOffset,
      });
    } else if (isPluginDep(line)) {
      isMultiDeps = false;
      const rightPart = line.replace(/^\s*addSbtPlugin\s*\(/, '');
      const expOffset = line.length - rightPart.length;
      const depExpr = rightPart.replace(/\)\s*$/, '');
      dep = parseDepExpr(depExpr, {
        ...ctx,
        depType: 'plugin',
        fileOffset: fileOffset + expOffset,
      });
    } else if (isDepsBegin(line)) {
      isMultiDeps = true;
    } else if (isMultiDeps) {
      const rightPart = line.replace(/^[\s,]*/, '');
      const expOffset = line.length - rightPart.length;
      const depExpr = rightPart.replace(/[\s,]*$/, '');
      dep = parseDepExpr(depExpr, {
        ...ctx,
        fileOffset: fileOffset + expOffset,
      });
    }
  }

  if (dep)
    deps.push({
      datasource: 'sbt',
      registryUrls: registryUrls as string[],
      ...dep,
    });

  if (lineIndex + 1 < lines.length)
    return {
      ...acc,
      fileOffset: fileOffset + line.length + 1, // inc. newline
      isMultiDeps,
      scalaVersion:
        scalaVersion ||
        (scalaVersionVariable &&
          variables[scalaVersionVariable] &&
          variables[scalaVersionVariable].val),
    };
  if (deps.length) return { deps };
  return null;
}

export function extractPackageFile(content: string): PackageFile {
  if (!content) return null;
  const lines = content.split(/\n/);
  return lines.reduce(parseSbtLine, {
    fileOffset: 0,
    registryUrls: [DEFAULT_MAVEN_REPO],
    deps: [],
    isMultiDeps: false,
    scalaVersion: null,
    variables: {},
  });
}
