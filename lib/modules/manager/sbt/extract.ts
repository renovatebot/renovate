import { lang, parser, query as q } from 'good-enough-parser';
import type { SeqBuilder } from 'good-enough-parser/dist/cjs/query/builder';
import upath from 'upath';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { MavenDatasource } from '../../datasource/maven';
import { SbtPackageDatasource } from '../../datasource/sbt-package';
import {
  SBT_PLUGINS_REPO,
  SbtPluginDatasource,
} from '../../datasource/sbt-plugin';
import { get } from '../../versioning';
import * as mavenVersioning from '../../versioning/maven';
import * as semverVersioning from '../../versioning/semver';
import { REGISTRY_URLS } from '../gradle/parser/common';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type {
  GroupFilenameContent,
  SbtManagerData,
  VariableContext,
  Variables,
} from './types';
import { normalizeScalaVersion } from './util';

interface Ctx {
  localVars?: Variables;
  globalVars?: Variables;
  deps: PackageDependency<SbtManagerData>[];
  registryUrls: string[];

  scalaVersion?: string;
  packageFileVersion?: string;

  groupId?: string;
  artifactId?: string;
  currentValue?: string;
  currentValueInfo?: VariableContext;

  currentVarName?: string;
  depType?: string;
  useScalaVersion?: boolean;
  variableName?: string;

  packageFile: string;
}

const scala = lang.createLang('scala');

const sbtVersionRegex = regEx(
  'sbt\\.version *= *(?<version>\\d+\\.\\d+\\.\\d+)'
);

const resolveVariable = ({
  ctx,
  varName,
}: {
  ctx: Ctx;
  varName: string;
}): VariableContext | undefined =>
  ctx.localVars?.[varName] ?? ctx.globalVars?.[varName];

// var1 or var1.var2.var3
const nestedVariableLiteral = (
  handler: q.SymMatcherHandler<Ctx>
): SeqBuilder<Ctx, parser.Node> =>
  q.sym<Ctx>(handler).opt(q.many(q.op<Ctx>('.').sym(handler)));

const scalaVersionMatch = q
  .sym<Ctx>('scalaVersion')
  .op(':=')
  .alt(
    q.str<Ctx>((ctx, { value: scalaVersion }) => ({ ...ctx, scalaVersion })),
    nestedVariableLiteral((ctx, { value: varName }) => {
      const scalaVersion = resolveVariable({ ctx, varName });
      if (scalaVersion) {
        ctx.scalaVersion = scalaVersion.value;
      }
      return ctx;
    })
  )
  .handler((ctx) => {
    if (ctx.scalaVersion) {
      const version = get(mavenVersioning.id);

      let packageName = 'org.scala-lang:scala-library';
      if (version.getMajor(ctx.scalaVersion) === 3) {
        packageName = 'org.scala-lang:scala3-library_3';
      }

      const dep: PackageDependency<SbtManagerData> = {
        datasource: MavenDatasource.id,
        depName: 'scala',
        packageName,
        currentValue: ctx.scalaVersion,
        separateMinorPatch: true,
      };
      ctx.scalaVersion = normalizeScalaVersion(ctx.scalaVersion);
      ctx.deps.push(dep);
    }
    return ctx;
  });

const packageFileVersionMatch = q
  .sym<Ctx>('version')
  .op(':=')
  .alt(
    q.str<Ctx>((ctx, { value: packageFileVersion }) => ({
      ...ctx,
      packageFileVersion,
    })),
    nestedVariableLiteral((ctx, { value: varName }) => {
      const packageFileVersion = resolveVariable({ ctx, varName });
      if (packageFileVersion) {
        ctx.packageFileVersion = packageFileVersion.value;
      }
      return ctx;
    })
  );

const variableNameMatch = q
  .sym<Ctx>((ctx, { value: varName }) => ({
    ...ctx,
    currentVarName: varName,
  }))
  .opt(q.op<Ctx>(':').sym('String'));

const variableValueMatch = q.str<Ctx>((ctx, { value, line }) => {
  if (ctx.localVars) {
    ctx.localVars[ctx.currentVarName!] = {
      value,
      packageFile: ctx.packageFile,
      lineNumber: line,
    };
  }
  delete ctx.currentVarName;
  return ctx;
});

const assignmentMatch = q
  .alt<Ctx>(q.sym<Ctx>('val'), q.sym('var'))
  .join(variableNameMatch)
  .op('=');

const variableDefinitionMatch = q
  .alt(
    q.sym<Ctx>('lazy').join(assignmentMatch),
    assignmentMatch,
    variableNameMatch.op(':=')
  )
  .join(variableValueMatch);

const groupIdMatch = q.alt<Ctx>(
  nestedVariableLiteral((ctx, { value: varName }) => {
    const currentGroupId = resolveVariable({ ctx, varName });
    if (currentGroupId) {
      ctx.groupId = currentGroupId.value;
    }
    return ctx;
  }),
  q.str<Ctx>((ctx, { value: groupId }) => ({ ...ctx, groupId }))
);

const artifactIdMatch = q.alt<Ctx>(
  nestedVariableLiteral((ctx, { value: varName }) => {
    const artifactId = resolveVariable({ ctx, varName });
    if (artifactId) {
      ctx.artifactId = artifactId.value;
    }
    return ctx;
  }),
  q.str<Ctx>((ctx, { value: artifactId }) => ({ ...ctx, artifactId }))
);

const versionMatch = q.alt<Ctx>(
  nestedVariableLiteral((ctx, { value: varName }) => {
    const currentValue = resolveVariable({ ctx, varName });
    if (currentValue) {
      ctx.currentValue = currentValue.value;
      ctx.currentValueInfo = currentValue;
      ctx.variableName = varName;
    }
    return ctx;
  }), // support var1, var1.var2.var3
  q.str<Ctx>((ctx, { value: currentValue }) => ({ ...ctx, currentValue })) // String literal "1.23.4"
);

const simpleDependencyMatch = groupIdMatch
  .op('%')
  .join(artifactIdMatch)
  .op('%')
  .join(versionMatch);

const versionedDependencyMatch = groupIdMatch
  .op('%%')
  .join(artifactIdMatch)
  .handler((ctx) => ({ ...ctx, useScalaVersion: true }))
  .op('%')
  .join(versionMatch);

const crossDependencyMatch = groupIdMatch
  .op('%%%')
  .join(artifactIdMatch)
  .handler((ctx) => ({ ...ctx, useScalaVersion: true }))
  .op('%')
  .join(versionMatch);

function depHandler(ctx: Ctx): Ctx {
  const {
    scalaVersion,
    groupId,
    artifactId,
    currentValue,
    useScalaVersion,
    depType,
    variableName,
    currentValueInfo,
  } = ctx;

  delete ctx.groupId;
  delete ctx.artifactId;
  delete ctx.currentValue;
  delete ctx.useScalaVersion;
  delete ctx.depType;
  delete ctx.variableName;
  delete ctx.currentValueInfo;

  const depName = `${groupId!}:${artifactId!}`;

  const dep: PackageDependency<SbtManagerData> = {
    datasource: SbtPackageDatasource.id,
    depName,
    packageName:
      scalaVersion && useScalaVersion ? `${depName}_${scalaVersion}` : depName,
    currentValue,
  };

  if (depType) {
    dep.depType = depType;
  }

  if (depType === 'plugin') {
    dep.datasource = SbtPluginDatasource.id;
  }

  if (variableName) {
    dep.groupName = variableName;
    if (currentValueInfo) {
      dep.managerData ??= {};
      dep.managerData.lineNumber = currentValueInfo.lineNumber;
      dep.managerData.packageFile = currentValueInfo.packageFile;
    }
  }

  ctx.deps.push(dep);

  return ctx;
}

function depTypeHandler(ctx: Ctx, { value: depType }: { value: string }): Ctx {
  return { ...ctx, depType };
}

const sbtPackageMatch = q
  .opt<Ctx>(q.opt(q.sym<Ctx>('lazy')).sym('val').sym().op('='))
  .alt(crossDependencyMatch, simpleDependencyMatch, versionedDependencyMatch)
  .opt(
    q.alt<Ctx>(
      q.sym<Ctx>('classifier').str(depTypeHandler),
      q.op<Ctx>('%').sym(depTypeHandler),
      q.op<Ctx>('%').str(depTypeHandler)
    )
  )
  .handler(depHandler);

const sbtPluginMatch = q
  .sym<Ctx>(regEx(/^(?:addSbtPlugin|addCompilerPlugin)$/))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    search: q
      .begin<Ctx>()
      .alt(simpleDependencyMatch, versionedDependencyMatch)
      .end(),
  })
  .handler((ctx) => ({ ...ctx, depType: 'plugin' }))
  .handler(depHandler);

const resolverMatch = q
  .str<Ctx>()
  .sym('at')
  .str((ctx, { value }) => {
    if (parseUrl(value)) {
      ctx.registryUrls.push(value);
    }
    return ctx;
  });

const addResolverMatch = q.sym<Ctx>('resolvers').alt(
  q.op<Ctx>('+=').join(resolverMatch),
  q.alt<Ctx>(q.op<Ctx>('++='), q.op<Ctx>('=')).sym('Seq').tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    search: resolverMatch,
  })
);

function registryUrlHandler(ctx: Ctx): Ctx {
  for (const dep of ctx.deps) {
    dep.registryUrls = [...new Set(ctx.registryUrls)];
    if (dep.depType === 'plugin') {
      dep.registryUrls.push(SBT_PLUGINS_REPO);
    }
  }
  return ctx;
}

const query = q.tree<Ctx>({
  type: 'root-tree',
  maxDepth: 32,
  search: q.alt<Ctx>(
    scalaVersionMatch,
    packageFileVersionMatch,
    sbtPackageMatch,
    sbtPluginMatch,
    addResolverMatch,
    variableDefinitionMatch
  ),
  postHandler: registryUrlHandler,
});

export function extractDependency(
  content: string,
  {
    packageFile,
    registryUrls = [REGISTRY_URLS.mavenCentral],
    localVars = {},
    globalVars = {},
    scalaVersion,
  }: PackageFile & Pick<Ctx, 'localVars' | 'globalVars' | 'scalaVersion'>
): Ctx | null {
  if (
    packageFile === 'project/build.properties' ||
    packageFile.endsWith('/project/build.properties')
  ) {
    const regexResult = sbtVersionRegex.exec(content);
    const sbtVersion = regexResult?.groups?.version;
    const matchString = regexResult?.[0];
    if (sbtVersion) {
      const sbtDependency: PackageDependency<SbtManagerData> = {
        datasource: GithubReleasesDatasource.id,
        depName: 'sbt/sbt',
        packageName: 'sbt/sbt',
        versioning: semverVersioning.id,
        currentValue: sbtVersion,
        replaceString: matchString,
        extractVersion: '^v(?<version>\\S+)',
      };

      return {
        deps: [sbtDependency],
        packageFile,
        registryUrls: [REGISTRY_URLS.mavenCentral],
      };
    } else {
      return null;
    }
  }

  let parsedResult: Ctx | null = null;

  try {
    parsedResult = scala.query(content, query, {
      globalVars,
      localVars,
      deps: [],
      registryUrls,
      packageFile,
      scalaVersion,
    });
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, packageFile }, 'Sbt parsing error');
  }

  if (!parsedResult) {
    return null;
  }

  delete parsedResult?.globalVars;
  return parsedResult;
}

function prepareLoadPackageFiles(
  packageFilesContent: { packageFile: string; content: string }[]
): Pick<Ctx, 'globalVars' | 'registryUrls' | 'scalaVersion'> {
  // Return variable
  let globalVars: Ctx['globalVars'] = {};
  let registryUrls: Ctx['registryUrls'] = [REGISTRY_URLS.mavenCentral];
  let scalaVersion: Ctx['scalaVersion'] = undefined;

  for (const { packageFile, content } of packageFilesContent) {
    const res = extractDependency(content, {
      deps: [],
      registryUrls,
      localVars: globalVars,
      packageFile,
    });

    if (res) {
      globalVars = { ...globalVars, ...res.localVars };
      if (res.registryUrls) {
        registryUrls = [...registryUrls, ...res.registryUrls];
      }
      if (res.scalaVersion) {
        scalaVersion = res.scalaVersion;
      }
    }
  }

  return {
    globalVars,
    registryUrls,
    scalaVersion,
  };
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  // Read packages and store in groupPackageFileContent
  // group package file by its folder
  const groupPackageFileContent: GroupFilenameContent = {};
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.trace({ packageFile }, 'packageFile has no content');
      continue;
    }
    const group = upath.dirname(packageFile);
    groupPackageFileContent[group] ??= [];
    groupPackageFileContent[group].push({ packageFile, content });
  }

  // 1. globalVariables from project/ and root package file
  // 2. registry from all package file
  // 3. Project's scalaVersion - to add suffix eg. "_2.13"
  const { globalVars, registryUrls, scalaVersion } = prepareLoadPackageFiles([
    ...(groupPackageFileContent['project'] ?? []), // in project/ folder
    ...(groupPackageFileContent['.'] ?? []), // root
  ]);

  const mapDepsToPackageFile: Record<
    string,
    PackageDependency<SbtManagerData>[]
  > = {};
  // Start extract all package files
  for (const packageFileContents of Object.values(groupPackageFileContent)) {
    for (const { packageFile, content } of packageFileContents) {
      const res = extractDependency(content, {
        registryUrls,
        deps: [],
        packageFile,
        scalaVersion,
        globalVars,
      });
      for (const dep of res?.deps ?? []) {
        const variableSourceFile = dep?.managerData?.packageFile ?? packageFile;
        delete res?.globalVars;
        delete res?.localVars;
        delete res?.scalaVersion;
        delete dep.managerData?.packageFile;

        mapDepsToPackageFile[variableSourceFile] ??= [];
        const notFound = !mapDepsToPackageFile[variableSourceFile].find(
          (d) =>
            d.packageName === dep.packageName &&
            d.currentValue === dep.currentValue
        );
        if (notFound) {
          mapDepsToPackageFile[variableSourceFile].push(dep);
        }
      }
    }
  }

  const finalPackages: PackageFile[] = [];
  for (const [packageFile, deps] of Object.entries(mapDepsToPackageFile)) {
    finalPackages.push({ packageFile, deps });
  }

  return finalPackages.length > 0 ? finalPackages : null;
}
