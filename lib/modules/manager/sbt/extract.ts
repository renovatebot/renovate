import { lang, query as q } from 'good-enough-parser';
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
  ParseOptions,
  VariableContext,
  Variables,
} from './types';
import { normalizeScalaVersion } from './util';

// type Vars = Record<string, string>;

interface Ctx {
  globalVars: Variables;
  localVars: Variables;
  deps: PackageDependency[];
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const nestedVariableLiteral = (handler: q.SymMatcherHandler<Ctx>) =>
  q.sym<Ctx>(handler).alt(q.many(q.op<Ctx>('.').sym(handler)));

const scalaVersionMatch = q
  .sym<Ctx>('scalaVersion')
  .op(':=')
  .alt(
    q.str<Ctx>((ctx, { value: scalaVersion }) => ({ ...ctx, scalaVersion })),
    nestedVariableLiteral((ctx, { value: varName }) => {
      const scalaVersion = ctx.localVars[varName] ?? ctx.globalVars[varName];
      if (scalaVersion) {
        ctx.scalaVersion = scalaVersion.val;
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

      const dep: PackageDependency = {
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
      const packageFileVersion =
        ctx.localVars[varName] ?? ctx.globalVars[varName];
      if (packageFileVersion) {
        ctx.packageFileVersion = packageFileVersion.val;
      }
      return ctx;
    }) // support var1, var1.var2.var3
  );

const variableNameMatch = q
  .sym<Ctx>((ctx, { value: varName }) => ({
    ...ctx,
    currentVarName: varName,
  }))
  .opt(q.op<Ctx>(':').sym('String'));

const variableValueMatch = q.str<Ctx>((ctx, { value, line }) => {
  ctx.localVars[ctx.currentVarName!] = {
    val: value,
    sourceFile: ctx.packageFile,
    lineIndex: line - 1,
  };
  delete ctx.currentVarName;
  return ctx;
});

const assignmentMatch = q.sym<Ctx>('val').join(variableNameMatch).op('=');

const variableDefinitionMatch = q
  .alt(
    q.sym<Ctx>('lazy').join(assignmentMatch),
    assignmentMatch,
    variableNameMatch.op(':=')
  )
  .join(variableValueMatch);

const groupIdMatch = q.alt<Ctx>(
  nestedVariableLiteral((ctx, { value: varName }) => {
    const currentGroupId = ctx.localVars[varName] ?? ctx.globalVars[varName];
    if (currentGroupId) {
      ctx.groupId = currentGroupId.val;
    }
    return ctx;
  }),
  q.str<Ctx>((ctx, { value: groupId }) => ({ ...ctx, groupId }))
);

const artifactIdMatch = q.alt<Ctx>(
  nestedVariableLiteral((ctx, { value: varName }) => {
    const artifactId = ctx.localVars[varName] ?? ctx.globalVars[varName];
    if (artifactId) {
      ctx.artifactId = artifactId.val;
    }
    return ctx;
  }),
  q.str<Ctx>((ctx, { value: artifactId }) => ({ ...ctx, artifactId }))
);

const resolveVariable: q.SymMatcherHandler<Ctx> = (ctx, { value: varName }) => {
  const currentValue = ctx.localVars[varName] ?? ctx.globalVars[varName];
  if (currentValue) {
    ctx.currentValue = currentValue.val;
    ctx.currentValueInfo = currentValue;
    ctx.variableName = varName;
  }
  return ctx;
};

const versionMatch = q.alt<Ctx>(
  nestedVariableLiteral(resolveVariable), // support var1, var1.var2.var3
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

  const dep: PackageDependency = {
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
    dep.variableName = variableName;
    if (currentValueInfo) {
      dep.fileReplacePosition = currentValueInfo.lineIndex;
      dep.editFile = currentValueInfo.sourceFile;
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
  q.op<Ctx>('++=').sym('Seq').tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    search: resolverMatch,
  })
);

function registryUrlHandler(ctx: Ctx): Ctx {
  for (const dep of ctx.deps) {
    dep.registryUrls = [...ctx.registryUrls];
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

// Extract 1 file
export function extractPackageFile(
  content: string,
  {
    packageFile,
    registryUrls,
    localVars,
    globalVars,
    scalaVersion,
  }: PackageFile & ParseOptions
): Ctx | null {
  if (
    packageFile &&
    (packageFile === 'project/build.properties' ||
      packageFile.endsWith('/project/build.properties'))
  ) {
    const regexResult = sbtVersionRegex.exec(content);
    const sbtVersion = regexResult?.groups?.version;
    const matchString = regexResult?.[0];
    if (sbtVersion) {
      const sbtDependency: PackageDependency = {
        datasource: GithubReleasesDatasource.id,
        depName: 'sbt/sbt',
        packageName: 'sbt/sbt',
        versioning: semverVersioning.id,
        currentValue: sbtVersion,
        replaceString: matchString,
        extractVersion: '^v(?<version>\\S+)',
        editFile: packageFile,
      };

      return {
        deps: [sbtDependency],
        globalVars: {},
        localVars: {},
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
      registryUrls: [REGISTRY_URLS.mavenCentral, ...(registryUrls ?? [])],
      packageFile,
      scalaVersion,
    });
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, packageFile }, 'Sbt parsing error');
  }

  if (!parsedResult) {
    return null;
  }

  return parsedResult;
}

function prepareLoadPackageFiles(
  packageFilesContent: { packageFile: string; content: string }[]
): {
  globalVars: ParseOptions['globalVars'];
  registryUrls: string[];
  scalaVersion: ParseOptions['scalaVersion'];
} {
  // Return variable
  let globalVars: Variables = {};
  const registryUrls: string[] = [REGISTRY_URLS.mavenCentral];
  let scalaVersion: string | undefined = undefined;

  for (const { packageFile, content } of packageFilesContent) {
    const acc: PackageFile & ParseOptions = {
      deps: [],
      registryUrls,
      localVars: globalVars,
      globalVars: {},
      packageFile,
    };
    const res = extractPackageFile(content, acc);

    if (res) {
      globalVars = { ...globalVars, ...res.localVars };
      if (res.registryUrls) {
        registryUrls.push(...res.registryUrls);
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
  // 3. Project's scalaVersion - use in parseDepExpr to add suffix eg. "_2.13"
  const { globalVars, registryUrls, scalaVersion } = prepareLoadPackageFiles([
    ...(groupPackageFileContent['project'] ?? []), // in project/ folder
    ...(groupPackageFileContent['.'] ?? []), // root
  ]);

  const mapDepsToPackageFile: Record<string, PackageDependency[]> = {};
  // Start extract all package files
  for (const packageFileContents of Object.values(groupPackageFileContent)) {
    // Extract package file by its group
    // local variable is share within its group
    for (const { packageFile, content } of packageFileContents) {
      const res = extractPackageFile(content, {
        registryUrls,
        deps: [],
        packageFile,
        scalaVersion,
        localVars: {},
        globalVars,
      });
      if (res) {
        if (res?.deps) {
          for (const dep of res.deps) {
            const variableSourceFile = dep?.editFile ?? packageFile;
            dep.registryUrls = [...new Set(dep.registryUrls)];
            mapDepsToPackageFile[variableSourceFile] ??= [];
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
  logger.debug('finalPackages ' + JSON.stringify(finalPackages));

  return finalPackages.length > 0 ? finalPackages : null;
}
