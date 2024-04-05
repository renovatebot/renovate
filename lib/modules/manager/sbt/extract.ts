import { lang, query as q } from 'good-enough-parser';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
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
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';
import { normalizeScalaVersion } from './util';

type Vars = Record<string, string>;

interface Ctx {
  vars: Vars;
  deps: PackageDependency[];
  registryUrls: string[];

  scalaVersion?: string;
  packageFileVersion?: string;

  groupId?: string;
  artifactId?: string;
  currentValue?: string;

  currentVarName?: string;
  depType?: string;
  useScalaVersion?: boolean;
  variableName?: string;
}

const SBT_MVN_REPO = 'https://repo1.maven.org/maven2';

const scala = lang.createLang('scala');

const sbtVersionRegex = regEx(
  'sbt\\.version *= *(?<version>\\d+\\.\\d+\\.\\d+)',
);

const sbtProxyUrlRegex = regEx(
  /^\s*(?<repoName>\S+):\s+(?<proxy>https?:\/\/[\w./-]+)/,
);

const scalaVersionMatch = q
  .sym<Ctx>('scalaVersion')
  .op(':=')
  .alt(
    q.str<Ctx>((ctx, { value: scalaVersion }) => ({ ...ctx, scalaVersion })),
    q.sym<Ctx>((ctx, { value: varName }) => {
      const scalaVersion = ctx.vars[varName];
      if (scalaVersion) {
        ctx.scalaVersion = scalaVersion;
      }
      return ctx;
    }),
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
    q.sym<Ctx>((ctx, { value: varName }) => {
      const packageFileVersion = ctx.vars[varName];
      if (packageFileVersion) {
        ctx.packageFileVersion = packageFileVersion;
      }
      return ctx;
    }),
  );

const variableNameMatch = q
  .sym<Ctx>((ctx, { value: varName }) => ({
    ...ctx,
    currentVarName: varName,
  }))
  .opt(q.op<Ctx>(':').sym('String'));

const variableValueMatch = q.str<Ctx>((ctx, { value }) => {
  ctx.vars[ctx.currentVarName!] = value;
  delete ctx.currentVarName;
  return ctx;
});

const assignmentMatch = q.sym<Ctx>('val').join(variableNameMatch).op('=');

const variableDefinitionMatch = q
  .alt(
    q.sym<Ctx>('lazy').join(assignmentMatch),
    assignmentMatch,
    variableNameMatch.op(':='),
  )
  .join(variableValueMatch);

const groupIdMatch = q.alt<Ctx>(
  q.sym<Ctx>((ctx, { value: varName }) => {
    const currentGroupId = ctx.vars[varName];
    if (currentGroupId) {
      ctx.groupId = currentGroupId;
    }
    return ctx;
  }),
  q.str<Ctx>((ctx, { value: groupId }) => ({ ...ctx, groupId })),
);

const artifactIdMatch = q.alt<Ctx>(
  q.sym<Ctx>((ctx, { value: varName }) => {
    const artifactId = ctx.vars[varName];
    if (artifactId) {
      ctx.artifactId = artifactId;
    }
    return ctx;
  }),
  q.str<Ctx>((ctx, { value: artifactId }) => ({ ...ctx, artifactId })),
);

const versionMatch = q.alt<Ctx>(
  q.sym<Ctx>((ctx, { value: varName }) => {
    const currentValue = ctx.vars[varName];
    if (currentValue) {
      ctx.currentValue = currentValue;
      ctx.variableName = varName;
    }
    return ctx;
  }),
  q.str<Ctx>((ctx, { value: currentValue }) => ({ ...ctx, currentValue })),
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
  } = ctx;

  delete ctx.groupId;
  delete ctx.artifactId;
  delete ctx.currentValue;
  delete ctx.useScalaVersion;
  delete ctx.depType;
  delete ctx.variableName;

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
      q.op<Ctx>('%').str(depTypeHandler),
    ),
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
  }),
);

function registryUrlHandler(ctx: Ctx): Ctx {
  for (const dep of ctx.deps) {
    dep.registryUrls = [...ctx.registryUrls];
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
    variableDefinitionMatch,
  ),
  postHandler: registryUrlHandler,
});

export function extractProxyUrls(
  content: string,
  packageFile: string,
): string[] {
  const extractedProxyUrls: string[] = [];
  logger.debug(`Parsing proxy repository file ${packageFile}`);
  for (const line of content.split(newlineRegex)) {
    const extraction = sbtProxyUrlRegex.exec(line);
    if (extraction?.groups?.proxy) {
      extractedProxyUrls.push(extraction.groups.proxy);
    } else if (line.trim() === 'maven-central') {
      extractedProxyUrls.push(SBT_MVN_REPO);
    }
  }
  return extractedProxyUrls;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  if (
    packageFile === 'project/build.properties' ||
    packageFile.endsWith('/project/build.properties')
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
        registryUrls: [],
      };

      return {
        deps: [sbtDependency],
      };
    } else {
      return null;
    }
  }

  let parsedResult: Ctx | null = null;

  try {
    parsedResult = scala.query(content, query, {
      vars: {},
      deps: [],
      registryUrls: [],
    });
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Sbt parsing error');
  }

  if (!parsedResult) {
    return null;
  }

  const { deps, packageFileVersion } = parsedResult;

  if (!deps.length) {
    return null;
  }

  return { deps, packageFileVersion };
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[]> {
  const packages: PackageFile[] = [];
  const proxyUrls: string[] = [];

  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.debug({ packageFile }, 'packageFile has no content');
      continue;
    }
    if (packageFile === 'repositories') {
      const urls = extractProxyUrls(content, packageFile);
      proxyUrls.push(...urls);
    } else {
      const pkg = extractPackageFile(content, packageFile);
      if (pkg) {
        packages.push({ deps: pkg.deps, packageFile });
      }
    }
  }
  for (const pkg of packages) {
    for (const dep of pkg.deps) {
      if (dep.datasource !== GithubReleasesDatasource.id) {
        if (proxyUrls.length > 0) {
          dep.registryUrls!.unshift(...proxyUrls);
        } else if (dep.depType === 'plugin') {
          dep.registryUrls!.unshift(SBT_PLUGINS_REPO, SBT_MVN_REPO);
        } else {
          dep.registryUrls!.unshift(SBT_MVN_REPO);
        }
      }
    }
  }
  return packages;
}
