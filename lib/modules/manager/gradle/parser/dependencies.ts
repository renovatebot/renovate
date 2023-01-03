import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import {
  GRADLE_PLUGINS,
  cleanupTempVars,
  qConcatExpr,
  qPropertyAccessIdentifier,
  qTemplateString,
  qVariableAccessIdentifier,
  storeInTokenMap,
  storeVarToken,
} from './common';
import {
  handleDepString,
  handleImplicitGradlePlugin,
  handleKotlinShortNotationDep,
  handleLongFormDep,
} from './handlers';

const qGroupId = qConcatExpr(
  qTemplateString,
  qVariableAccessIdentifier
).handler((ctx) => storeInTokenMap(ctx, 'groupId'));

const qArtifactId = qConcatExpr(
  qTemplateString,
  qVariableAccessIdentifier
).handler((ctx) => storeInTokenMap(ctx, 'artifactId'));

const qVersion = q
  .alt(qTemplateString, qVariableAccessIdentifier)
  .handler((ctx) => storeInTokenMap(ctx, 'version'));

// "foo:bar:1.2.3"
// "foo:bar:$baz"
// "foo" + "${bar}" + baz
const qDependencyStrings = qTemplateString
  .many(
    q
      .op<Ctx>('+')
      .alt(
        qTemplateString,
        qPropertyAccessIdentifier,
        qVariableAccessIdentifier
      ),
    0,
    32
  )
  .handler((ctx: Ctx) => storeInTokenMap(ctx, 'templateStringTokens'))
  .handler(handleDepString)
  .handler(cleanupTempVars);

// dependencySet(group: 'foo', version: bar) { entry 'baz' }
const qDependencySet = q
  .sym<Ctx>('dependencySet', storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'methodName'))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .sym('group')
      .alt(q.op(':'), q.op('='))
      .join(qGroupId)
      .op(',')
      .sym('version')
      .alt(q.op(':'), q.op('='))
      .join(qVersion)
      .end(),
  })
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '{',
    endsWith: '}',
    search: q
      .sym<Ctx>('entry')
      .alt(
        qArtifactId,
        q.tree({
          type: 'wrapped-tree',
          maxDepth: 1,
          startsWith: '(',
          endsWith: ')',
          search: q.begin<Ctx>().join(qArtifactId).end(),
        })
      )
      .handler(handleLongFormDep),
  })
  .handler(cleanupTempVars);

// group: "foo", name: "bar", version: "1.2.3"
const qGroovyMapNotationDependencies = q
  .sym<Ctx>('group')
  .op(':')
  .join(qGroupId)
  .op(',')
  .sym('name')
  .op(':')
  .join(qArtifactId)
  .op(',')
  .sym('version')
  .op(':')
  .join(qVersion)
  .handler(handleLongFormDep)
  .handler(cleanupTempVars);

// kotlin("bom", "1.7.21")
const qKotlinShortNotationDependencies = q
  .sym<Ctx>('kotlin')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qArtifactId)
      .op(',')
      .opt(q.sym<Ctx>('version').op('='))
      .alt(
        qTemplateString,
        qPropertyAccessIdentifier,
        qVariableAccessIdentifier
      )
      .handler((ctx) => storeInTokenMap(ctx, 'version'))
      .end(),
  })
  .handler(handleKotlinShortNotationDep)
  .handler(cleanupTempVars);

// (group = "foo", name = "bar", version = "1.2.3")
const qKotlinMapNotationDependencies = q
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .sym('group')
      .op('=')
      .join(qGroupId)
      .op(',')
      .sym('name')
      .op('=')
      .join(qArtifactId)
      .op(',')
      .sym('version')
      .op('=')
      .join(qVersion),
  })
  .handler(handleLongFormDep)
  .handler(cleanupTempVars);

// someMethod("foo", "bar", "1.2.3")
export const qLongFormDep = q
  .opt<Ctx>(
    q.sym(storeVarToken).handler((ctx) => storeInTokenMap(ctx, 'methodName'))
  )
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    maxMatches: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .join(qGroupId)
      .op(',')
      .join(qArtifactId)
      .op(',')
      .join(qVersion)
      .end(),
  })
  .handler(handleLongFormDep)
  .handler(cleanupTempVars);

// pmd { toolVersion = "1.2.3" }
const qImplicitGradlePlugin = q
  .sym(regEx(`^(?:${Object.keys(GRADLE_PLUGINS).join('|')})$`), storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'pluginName'))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    maxMatches: 1,
    startsWith: '{',
    endsWith: '}',
    search: q
      .sym<Ctx>(regEx(/^(?:toolVersion|version)$/))
      .op('=')
      .alt(
        qTemplateString,
        qPropertyAccessIdentifier,
        qVariableAccessIdentifier
      ),
  })
  .handler((ctx) => storeInTokenMap(ctx, 'version'))
  .handler(handleImplicitGradlePlugin)
  .handler(cleanupTempVars);

export const qDependencies = q.alt(
  qDependencyStrings,
  qDependencySet,
  qGroovyMapNotationDependencies,
  qKotlinShortNotationDependencies,
  qKotlinMapNotationDependencies,
  qImplicitGradlePlugin
);
