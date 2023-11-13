import { query as q } from 'good-enough-parser';
import type { Ctx } from '../types';
import {
  cleanupTempVars,
  qStringValue,
  qStringValueAsSymbol,
  qValueMatcher,
  storeInTokenMap,
  storeVarToken,
} from './common';
import { handleLibraryDep, handlePlugin } from './handlers';

const qGroupId = qValueMatcher.handler((ctx) =>
  storeInTokenMap(ctx, 'groupId'),
);

const qArtifactId = qValueMatcher.handler((ctx) =>
  storeInTokenMap(ctx, 'artifactId'),
);

const qVersionCatalogVersion = q
  .op<Ctx>('.')
  .alt(
    // library("kotlin-reflect", "org.jetbrains.kotlin", "kotlin-reflect").versionRef("kotlin")
    q.sym<Ctx>('versionRef').tree({
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      search: q.begin<Ctx>().join(qStringValueAsSymbol).end(),
    }),
    // library("android-gradle", "com.android.tools.build", "gradle").version("${agp}")
    q.sym<Ctx>('version').tree({
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      search: q.begin<Ctx>().join(qValueMatcher).end(),
    }),
  )
  .handler((ctx) => storeInTokenMap(ctx, 'version'));

// library("foo.bar", "foo", "bar")
const qVersionCatalogDependencies = q
  .sym<Ctx>('library', storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'methodName'))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'alias'))
      .op(',')
      .join(qGroupId)
      .op(',')
      .join(qArtifactId)
      .end(),
  })
  .opt(qVersionCatalogVersion)
  .handler(handleLibraryDep)
  .handler(cleanupTempVars);

// plugin("foo.bar", "foo:bar")
const qVersionCatalogPlugins = q
  .sym<Ctx>('plugin', storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'methodName'))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'alias'))
      .op(',')
      .alt(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'pluginName'))
      .end(),
  })
  .opt(qVersionCatalogVersion)
  .handler(handlePlugin)
  .handler(cleanupTempVars);

// alias("foo.bar").to("foo", "bar").version("1.2.3")
const qVersionCatalogAliasDependencies = q
  .sym<Ctx>('alias')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qStringValue)
      .handler((ctx) => storeInTokenMap(ctx, 'alias'))
      .end(),
  })
  .op('.')
  .sym('to')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q.begin<Ctx>().join(qGroupId).op(',').join(qArtifactId).end(),
  })
  .opt(qVersionCatalogVersion)
  .handler(handleLibraryDep)
  .handler(cleanupTempVars);

export const qVersionCatalogs = q.alt(
  qVersionCatalogDependencies,
  qVersionCatalogPlugins,
  qVersionCatalogAliasDependencies,
);
