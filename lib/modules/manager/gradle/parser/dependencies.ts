import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import {
  GRADLE_PLUGINS,
  cleanupTempVars,
  qPropertyAccessIdentifier,
  qStringValue,
  qTemplateString,
  qVariableAccessIdentifier,
  storeInTokenMap,
  storeVarToken,
} from './common';
import {
  handleDepInterpolation,
  handleDepSimpleString,
  handleImplicitGradlePlugin,
  handleKotlinShortNotationDep,
  handleLongFormDep,
} from './handlers';

// "foo:bar:1.2.3"
const qDependenciesSimpleString = qStringValue
  .handler((ctx: Ctx) => storeInTokenMap(ctx, 'stringToken'))
  .handler(handleDepSimpleString)
  .handler(cleanupTempVars);

// "foo:bar:$baz"
const qDependenciesInterpolation = qTemplateString
  .handler((ctx: Ctx) => storeInTokenMap(ctx, 'templateStringTokens'))
  .handler(handleDepInterpolation)
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
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .sym('version')
      .alt(q.op(':'), q.op('='))
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'version'))
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
        qTemplateString,
        qVariableAccessIdentifier,
        q.tree({
          type: 'wrapped-tree',
          maxDepth: 1,
          startsWith: '(',
          endsWith: ')',
          search: q
            .begin<Ctx>()
            .alt(qTemplateString, qVariableAccessIdentifier)
            .end(),
        })
      )
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .handler(handleLongFormDep),
  })
  .handler(cleanupTempVars);

// group: "foo", name: "bar", version: "1.2.3"
const qGroovyMapNotationDependencies = q
  .sym<Ctx>('group')
  .op(':')
  .alt(qTemplateString, qVariableAccessIdentifier)
  .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
  .op(',')
  .sym('name')
  .op(':')
  .alt(qTemplateString, qVariableAccessIdentifier)
  .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
  .op(',')
  .sym('version')
  .op(':')
  .alt(qTemplateString, qVariableAccessIdentifier)
  .handler((ctx) => storeInTokenMap(ctx, 'version'))
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
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'moduleName'))
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
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .sym('name')
      .op('=')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .op(',')
      .sym('version')
      .op('=')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'version')),
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
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'groupId'))
      .op(',')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'artifactId'))
      .op(',')
      .alt(qTemplateString, qVariableAccessIdentifier)
      .handler((ctx) => storeInTokenMap(ctx, 'version'))
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
  qDependenciesSimpleString,
  qDependenciesInterpolation,
  qDependencySet,
  qGroovyMapNotationDependencies,
  qKotlinShortNotationDependencies,
  qKotlinMapNotationDependencies,
  qImplicitGradlePlugin
);
