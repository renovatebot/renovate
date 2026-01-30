import { query as q } from '@renovatebot/good-enough-parser';
import type { Ctx } from '../types.ts';
import {
  cleanupTempVars,
  qArtifactId,
  qGroupId,
  qStringValue,
  qStringValueAsSymbol,
  qValueMatcher,
  storeInTokenMap,
  storeVarToken,
} from './common.ts';
import { handleLibraryDep, handlePlugin } from './handlers.ts';

const qAlias = qStringValue.handler((ctx) => storeInTokenMap(ctx, 'alias'));

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
  .sym<Ctx>('library')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qAlias)
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
      .join(qAlias)
      .op(',')
      .alt(qValueMatcher)
      .handler((ctx) => storeInTokenMap(ctx, 'pluginName'))
      .end(),
  })
  .join(qVersionCatalogVersion)
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
    search: q.begin<Ctx>().join(qAlias).end(),
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
