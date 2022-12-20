import { query as q } from 'good-enough-parser';
import type { Ctx } from '../types';
import {
  cleanupTempVars,
  qStringValue,
  qStringValueAsSymbol,
  qTemplateString,
  qVariableAccessIdentifier,
  storeInTokenMap,
  storeVarToken,
} from './common';
import { handleLibraryDep } from './handlers';

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
      search: q
        .begin<Ctx>()
        .alt(qTemplateString, qVariableAccessIdentifier)
        .end(),
    })
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
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .end(),
  })
  .opt(qVersionCatalogVersion)
  .handler(handleLibraryDep)
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
    search: q
      .begin<Ctx>()
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .end(),
  })
  .opt(qVersionCatalogVersion)
  .handler(handleLibraryDep)
  .handler(cleanupTempVars);

export const qVersionCatalogs = q.alt(
  qVersionCatalogDependencies,
  qVersionCatalogAliasDependencies
);
