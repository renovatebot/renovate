const { DEFAULT_MAVEN_REPO } = require('../maven/extract');

const isComment = str => /^\s*\/\//.test(str);

const isSingleLineDep = str =>
  /^\s*(libraryDependencies|dependencyOverrides)\s*\+=\s*/.test(str);

const isDepsBegin = str =>
  /^\s*(libraryDependencies|dependencyOverrides)\s*\+\+=\s*/.test(str);

const isPluginDep = str => /^\s*addSbtPlugin\s*\(.*\)\s*$/.test(str);

const isStringLiteral = str => /^"[^"]*"$/.test(str);

const isScalaVersion = str => /^\s*scalaVersion\s*:=\s*"[^"]*"\s*$/.test(str);
const getScalaVersion = str =>
  str.replace(/^\s*scalaVersion\s*:=\s*"/, '').replace(/"\s*$/, '');

const isResolver = str =>
  /^\s*(resolvers\s*\+\+?=\s*(Seq\()?)?"[^"]*"\s*at\s*"[^"]*"[\s,)]*$/.test(
    str
  );
const getResolverUrl = str =>
  str
    .replace(/^\s*(resolvers\s*\+\+?=\s*(Seq\()?)?"[^"]*"\s*at\s*"/, '')
    .replace(/"[\s,)]*$/, '');

const isVarDef = str =>
  /^\s*val\s+[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*"[^"]*"\s*$/.test(str);
const getVarName = str =>
  str.replace(/^\s*val\s+/, '').replace(/\s*=\s*"[^"]*"\s*$/, '');
const isVarName = str => /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(str);
const getVarInfo = (str, ctx) => {
  const { fileOffset } = ctx;
  const rightPart = str.replace(/^\s*val\s+[_a-zA-Z][_a-zA-Z0-9]*\s*=\s*"/, '');
  const fileReplacePosition = str.search(rightPart) + fileOffset;
  const val = rightPart.replace(/"\s*$/, '');
  return { val, fileReplacePosition };
};

function parseDepExpr(expr, ctx) {
  const { scalaVersion, fileOffset, variables } = ctx;
  let { depType } = ctx;

  const isValidToken = str =>
    isStringLiteral(str) || (isVarName(str) && !!variables[str]);

  const resolveToken = str =>
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

  let skipReason = null;

  const groupId = resolveToken(rawGroupId);
  let artifactId = resolveToken(rawArtifactId);
  if (groupOp === '%%') {
    if (scalaVersion) {
      artifactId = `${resolveToken(rawArtifactId)}_${scalaVersion}`;
    } else {
      skipReason = 'unsupported';
    }
  }
  const depName = `${groupId}:${artifactId}`;
  const currentValue = resolveToken(rawVersion);

  if (!depType && rawScope) {
    depType = rawScope.replace(/^"/, '').replace(/"$/, '');
  }

  let fileReplacePosition;
  if (isStringLiteral(rawVersion)) {
    // Calculate fileReplacePosition incrementally
    // help us to avoid errors in updating phase.
    fileReplacePosition = 0;
    fileReplacePosition +=
      expr.slice(fileReplacePosition).search(rawGroupId) + rawGroupId.length;
    fileReplacePosition +=
      expr.slice(fileReplacePosition).search(rawArtifactId) +
      rawArtifactId.length;
    fileReplacePosition += expr.slice(fileReplacePosition).search(currentValue);
    fileReplacePosition += fileOffset;
  } else {
    fileReplacePosition = variables[rawVersion].fileReplacePosition;
  }

  const result = {
    depName,
    currentValue,
    fileReplacePosition,
  };

  if (depType) result.depType = depType;
  if (skipReason) result.skipReason = skipReason;

  return result;
}

function parseSbtLine(acc, line, lineIndex, lines) {
  const { deps, registryUrls, fileOffset, variables } = acc;

  let { isMultiDeps, scalaVersion } = acc;

  const ctx = {
    scalaVersion,
    fileOffset,
    variables,
  };

  let dep = null;
  if (!isComment(line)) {
    if (isScalaVersion(line)) {
      isMultiDeps = false;
      scalaVersion = getScalaVersion(line);
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
      datasource: 'maven',
      registryUrls,
      ...dep,
    });

  if (lineIndex + 1 < lines.length)
    return {
      ...acc,
      fileOffset: fileOffset + line.length + 1, // inc. newline
      isMultiDeps,
      scalaVersion,
    };
  if (deps.length) return { deps };
  return null;
}

function extractPackageFile(content) {
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

module.exports = {
  extractPackageFile,
};
