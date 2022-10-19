import { lang, query as q } from 'good-enough-parser';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import { MavenDatasource } from '../../datasource/maven';
import { SbtPackageDatasource } from '../../datasource/sbt-package';
import {
  SBT_PLUGINS_REPO,
  SbtPluginDatasource,
} from '../../datasource/sbt-plugin';
import { MAVEN_REPO } from '../gradle/common';
import type { PackageDependency, PackageFile } from '../types';
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
  groupName?: string;
}

const scala = lang.createLang('scala');

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
    })
  )
  .handler((ctx) => {
    if (ctx.scalaVersion) {
      const dep: PackageDependency = {
        datasource: MavenDatasource.id,
        depName: 'scala',
        packageName: 'org.scala-lang:scala-library',
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
    })
  );

const variableNameMatch = q.sym<Ctx>((ctx, { value: varName }) => ({
  ...ctx,
  currentVarName: varName,
}));

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
    variableNameMatch.op(':=')
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
  q.str<Ctx>((ctx, { value: groupId }) => ({ ...ctx, groupId }))
);

const artifactIdMatch = q.alt<Ctx>(
  q.sym<Ctx>((ctx, { value: varName }) => {
    const artifactId = ctx.vars[varName];
    if (artifactId) {
      ctx.artifactId = artifactId;
    }
    return ctx;
  }),
  q.str<Ctx>((ctx, { value: artifactId }) => ({ ...ctx, artifactId }))
);

const versionMatch = q.alt<Ctx>(
  q.sym<Ctx>((ctx, { value: varName }) => {
    const currentValue = ctx.vars[varName];
    if (currentValue) {
      ctx.currentValue = currentValue;
      ctx.groupName = varName;
    }
    return ctx;
  }),
  q.str<Ctx>((ctx, { value: currentValue }) => ({ ...ctx, currentValue }))
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

function depHandler(ctx: Ctx): Ctx {
  const {
    scalaVersion,
    groupId,
    artifactId,
    currentValue,
    useScalaVersion,
    depType,
    groupName,
  } = ctx;

  delete ctx.groupId;
  delete ctx.artifactId;
  delete ctx.currentValue;
  delete ctx.useScalaVersion;
  delete ctx.depType;
  delete ctx.groupName;

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

  if (groupName) {
    dep.groupName = groupName;
  }

  ctx.deps.push(dep);

  return ctx;
}

function depTypeHandler(ctx: Ctx, { value: depType }: { value: string }): Ctx {
  return { ...ctx, depType };
}

const sbtPackageMatch = q
  .opt<Ctx>(q.opt(q.sym<Ctx>('lazy')).sym('val').sym().op('='))
  .alt(simpleDependencyMatch, versionedDependencyMatch)
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

export function extractPackageFile(
  content: string,
  _packageFile: string
): PackageFile | null {
  let parsedResult: Ctx | null = null;

  try {
    parsedResult = scala.query(content, query, {
      vars: {},
      deps: [],
      registryUrls: [MAVEN_REPO],
    });
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Sbt parsing error');
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
