import type { parser } from '@renovatebot/good-enough-parser';
import { query as q } from '@renovatebot/good-enough-parser';
import { regEx } from '../../../../util/regex.ts';
import type { Ctx } from '../types.ts';
import {
  GRADLE_PLUGINS,
  GRADLE_TEST_SUITES,
  cleanupTempVars,
  qArtifactId,
  qDotOrBraceExpr,
  qGroupId,
  qTemplateString,
  qValueMatcher,
  qVersion,
  storeInTokenMap,
  storeVarToken,
} from './common.ts';
import {
  handleDepString,
  handleImplicitDep,
  handleKotlinShortNotationDep,
  handleLongFormDep,
  handleRichVersionDep,
} from './handlers.ts';

// "foo:bar:1.2.3"
// "foo:bar:$baz"
// "foo" + "${bar}" + baz
export const qDependencyStrings = qTemplateString
  .opt(q.op<Ctx>('+').join(qValueMatcher))
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
        }),
      )
      .handler(handleLongFormDep),
  })
  .handler(cleanupTempVars);

// group: "foo", name: "bar", version: "1.2.3"
export const qGroovyMapNotationDependencies = q
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
      .join(qVersion)
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
    q.sym(storeVarToken).handler((ctx) => storeInTokenMap(ctx, 'methodName')),
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

// strictly '1.2.3'
// strictly("1.2.3")
function qRichVersionValue(
  tokenMapKey: string,
): q.QueryBuilder<Ctx, parser.Node> {
  return q
    .alt<Ctx>(
      q.tree({
        type: 'wrapped-tree',
        maxDepth: 1,
        maxMatches: 1,
        startsWith: '(',
        endsWith: ')',
        search: q.begin<Ctx>().join(qValueMatcher).end(),
      }),
      qValueMatcher,
    )
    .handler((ctx) => storeInTokenMap(ctx, tokenMapKey));
}

// version { strictly '[1.7, 1.8['; prefer '1.7.25' }
// version { strictly("[1.7, 1.8["); prefer("1.7.25") }
const qRichVersion = q.sym<Ctx>('version').tree({
  type: 'wrapped-tree',
  maxDepth: 1,
  startsWith: '{',
  endsWith: '}',
  search: q.alt<Ctx>(
    q.sym<Ctx>('strictly').join(qRichVersionValue('strictly')),
    q.sym<Ctx>('require').join(qRichVersionValue('require')),
    q.sym<Ctx>('prefer').join(qRichVersionValue('prefer')),
    // the rejected versions themselves are irrelevant: their mere presence
    // means Renovate cannot reason about the constraint
    q
      .sym<Ctx>(regEx(/^reject(?:All)?$/), storeVarToken)
      .handler((ctx) => storeInTokenMap(ctx, 'reject')),
  ),
});

// implementation('foo:bar') { version { strictly '1.2.3' } }
// implementation("foo:bar") { version { strictly("1.2.3") } }
// implementation(group: 'foo', name: 'bar') { version { strictly '1.2.3' } }
const qRichVersionDep = q
  .opt<Ctx>(
    q.sym(storeVarToken).handler((ctx) => storeInTokenMap(ctx, 'methodName')),
  )
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    maxMatches: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .begin<Ctx>()
      .alt(
        qTemplateString.handler((ctx) =>
          storeInTokenMap(ctx, 'templateStringTokens'),
        ),
        q
          .sym<Ctx>('group')
          .alt(q.op(':'), q.op('='))
          .join(qGroupId)
          .op(',')
          .sym('name')
          .alt(q.op(':'), q.op('='))
          .join(qArtifactId),
      )
      .end(),
  })
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    maxMatches: 1,
    startsWith: '{',
    endsWith: '}',
    search: qRichVersion,
  })
  .handler(handleRichVersionDep)
  .handler(cleanupTempVars);

// pmd { toolVersion = "1.2.3" }
const qImplicitGradlePlugin = q
  .alt(
    ...Object.keys(GRADLE_PLUGINS).map((implicitDepName) =>
      q
        .sym<Ctx>(implicitDepName, storeVarToken)
        .handler((ctx) => storeInTokenMap(ctx, 'implicitDepName'))
        .tree({
          type: 'wrapped-tree',
          maxDepth: 1,
          maxMatches: 1,
          startsWith: '{',
          endsWith: '}',
          search: q
            .sym<Ctx>(
              GRADLE_PLUGINS[implicitDepName as keyof typeof GRADLE_PLUGINS][0],
            )
            .alt(
              // toolVersion = "1.2.3"
              q.opt<Ctx>(q.op('=')).join(qVersion),
              // toolVersion.set("1.2.3"), toolVersion.value("1.2.3")
              q
                .op<Ctx>('.')
                .sym(regEx(/^(?:set|value)$/))
                .tree({
                  maxDepth: 1,
                  startsWith: '(',
                  endsWith: ')',
                  search: q.begin<Ctx>().join(qVersion).end(),
                }),
            ),
        }),
    ),
  )
  .handler(handleImplicitDep)
  .handler(cleanupTempVars);

// Match the use* method call with version parameter
const qTestSuiteMethod = q
  .sym(
    regEx(`^(?:${Object.keys(GRADLE_TEST_SUITES).join('|')})$`),
    storeVarToken,
  )
  .handler((ctx) => storeInTokenMap(ctx, 'implicitDepName'))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    maxMatches: 1,
    startsWith: '(',
    endsWith: ')',
    search: q.begin<Ctx>().join(qVersion).end(),
  });

// testing { suites { test { useSpock("1.2.3") } } }
// testing.suites.test { useJunit("1.2.3") }
// testing { suites.withType(JvmTestSuite).configureEach { useJUnitJupiter("5.13.4") } }
// testing { suites.withType(JvmTestSuite::class).configureEach { useSpock("2.3") } }
const qImplicitTestSuites = qDotOrBraceExpr(
  'testing',
  qDotOrBraceExpr(
    'suites',
    q.alt(
      qDotOrBraceExpr('test', qTestSuiteMethod),
      q
        .sym<Ctx>('withType')
        .tree({
          type: 'wrapped-tree',
          maxDepth: 1,
          startsWith: '(',
          endsWith: ')',
        })
        .op('.')
        .sym('configureEach')
        .tree({
          type: 'wrapped-tree',
          maxDepth: 1,
          startsWith: '{',
          endsWith: '}',
          search: qTestSuiteMethod,
        }),
    ),
  ),
)
  .handler(handleImplicitDep)
  .handler(cleanupTempVars);

// substitute module("foo:bar:1.2.3") using "baz:qux:4.5.6"
// substitute(module("foo:bar:1.2.3")).using("baz:qux:4.5.6")
const qIgnoreSubstitutedDependencies = q.sym<Ctx>('substitute').alt(
  q.sym<Ctx>('module').tree(),
  q.tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q.sym<Ctx>('module').tree(),
  }),
);

// buildConfigField("type", "name", "value")
// resValue("type", "name", "value")
const qIgnoreAndroidBuildValues = q.alt(
  q.sym<Ctx>('buildConfigField').tree(),
  q.sym<Ctx>('resValue').tree(),
);

export const qDependencies = q.alt(
  qDependencyStrings,
  qDependencySet,
  qRichVersionDep,
  qGroovyMapNotationDependencies,
  qKotlinShortNotationDependencies,
  qKotlinMapNotationDependencies,
  qImplicitGradlePlugin,
  qImplicitTestSuites,
  // avoid heuristic matching of gradle feature variant capabilities
  qDotOrBraceExpr('java', q.sym<Ctx>('registerFeature').tree()),
  // avoid matching substituted dependency modules
  qIgnoreSubstitutedDependencies,
  // avoid heuristic matching of Android build values
  qIgnoreAndroidBuildValues,
);
