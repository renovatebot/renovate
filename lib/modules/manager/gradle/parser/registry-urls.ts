import type { parser } from 'good-enough-parser';
import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import { qApplyFrom } from './apply-from';
import { qAssignments } from './assignments';
import {
  REGISTRY_URLS,
  cleanupTempVars,
  qArtifactId,
  qGroupId,
  qValueMatcher,
  qVersion,
  storeInTokenMap,
  storeVarToken,
} from './common';
import {
  handleCustomRegistryUrl,
  handlePredefinedRegistryUrl,
  handleRegistryContent,
} from './handlers';
import { qPlugins } from './plugins';

const cleanupTmpContentSpec = (ctx: Ctx): Ctx => {
  ctx.tmpRegistryContent = [];
  return ctx;
};

const qContentDescriptorSpec = (
  methodName: RegExp,
  matcher: q.QueryBuilder<Ctx, parser.Node>,
): q.QueryBuilder<Ctx, parser.Node> => {
  return q
    .sym<Ctx>(methodName, storeVarToken)
    .handler((ctx) => storeInTokenMap(ctx, 'methodName'))
    .alt(
      // includeGroup "foo.bar"
      matcher,
      // includeGroup("foo.bar")
      q.tree({
        type: 'wrapped-tree',
        maxDepth: 1,
        startsWith: '(',
        endsWith: ')',
        search: q.begin<Ctx>().join(matcher).end(),
      }),
    );
};

// includeModule('foo')
// excludeModuleByRegex('bar')
const qContentDescriptor = (
  mode: 'include' | 'exclude',
): q.QueryBuilder<Ctx, parser.Node> => {
  return q
    .alt<Ctx>(
      qContentDescriptorSpec(
        regEx(
          `^(?:${mode}Group|${mode}GroupByRegex|${mode}GroupAndSubgroups)$`,
        ),
        qGroupId,
      ),
      qContentDescriptorSpec(
        regEx(`^(?:${mode}Module|${mode}ModuleByRegex)$`),
        q.join(qGroupId, q.op(','), qArtifactId),
      ),
      qContentDescriptorSpec(
        regEx(`^(?:${mode}Version|${mode}VersionByRegex)$`),
        q.join(qGroupId, q.op(','), qArtifactId, q.op(','), qVersion),
      ),
    )
    .handler(handleRegistryContent);
};

// content { includeModule('foo'); excludeModule('bar') }
const qRegistryContent = q.sym<Ctx>('content').tree({
  type: 'wrapped-tree',
  maxDepth: 1,
  startsWith: '{',
  endsWith: '}',
  search: q.alt(qContentDescriptor('include'), qContentDescriptor('exclude')),
});

// uri("https://foo.bar/baz")
// "https://foo.bar/baz"
const qUri = q
  .alt(
    q.sym<Ctx>('uri').tree({
      maxDepth: 1,
      search: qValueMatcher,
    }),
    qValueMatcher,
  )
  .handler((ctx) => storeInTokenMap(ctx, 'registryUrl'));

// mavenCentral()
// mavenCentral { ... }
const qPredefinedRegistries = q
  .sym(regEx(`^(?:${Object.keys(REGISTRY_URLS).join('|')})$`), storeVarToken)
  .handler((ctx) => storeInTokenMap(ctx, 'registryUrl'))
  .alt(
    q
      .tree({
        type: 'wrapped-tree',
        startsWith: '(',
        endsWith: ')',
        search: q.begin<Ctx>().end(),
      })
      .opt(q.op<Ctx>('.').join(qRegistryContent)),
    q.tree({
      type: 'wrapped-tree',
      startsWith: '{',
      endsWith: '}',
      search: q.opt(qRegistryContent),
    }),
  )
  .handler(handlePredefinedRegistryUrl)
  .handler(cleanupTmpContentSpec)
  .handler(cleanupTempVars);

// { url = "https://some.repo"; content { ... } }
const qMavenArtifactRegistry = q.tree({
  type: 'wrapped-tree',
  maxDepth: 1,
  startsWith: '{',
  endsWith: '}',
  search: q.alt(
    q
      .sym<Ctx>('name')
      .opt(q.op('='))
      .join(qValueMatcher)
      .handler((ctx) => storeInTokenMap(ctx, 'name')),
    q.sym<Ctx>('url').opt(q.op('=')).join(qUri),
    q.sym<Ctx>('setUrl').tree({
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      search: q.begin<Ctx>().join(qUri).end(),
    }),
    qRegistryContent,
  ),
});

// maven(url = uri("https://foo.bar/baz"))
// maven("https://foo.bar/baz") { content { ... } }
// maven { name = some; url = "https://foo.bar/${name}" }
const qCustomRegistryUrl = q
  .sym<Ctx>('maven')
  .alt(
    q
      .tree<Ctx>({
        type: 'wrapped-tree',
        maxDepth: 1,
        startsWith: '(',
        endsWith: ')',
        search: q.begin<Ctx>().opt(q.sym<Ctx>('url').op('=')).join(qUri).end(),
      })
      .opt(qMavenArtifactRegistry),
    qMavenArtifactRegistry,
  )
  .handler(handleCustomRegistryUrl)
  .handler(cleanupTmpContentSpec)
  .handler(cleanupTempVars);

const qPluginManagement = q.sym<Ctx>('pluginManagement', storeVarToken).tree({
  type: 'wrapped-tree',
  startsWith: '{',
  endsWith: '}',
  preHandler: (ctx) => {
    ctx.tmpTokenStore.registryScope = ctx.varTokens;
    ctx.varTokens = [];
    return ctx;
  },
  search: q
    .handler<Ctx>((ctx) => {
      if (ctx.tmpTokenStore.registryScope) {
        ctx.tokenMap.registryScope = ctx.tmpTokenStore.registryScope;
      }
      return ctx;
    })
    .alt(
      qAssignments,
      qApplyFrom,
      qPlugins,
      qPredefinedRegistries,
      qCustomRegistryUrl,
    ),
  postHandler: (ctx) => {
    delete ctx.tmpTokenStore.registryScope;
    return ctx;
  },
});

export const qRegistryUrls = q.alt<Ctx>(
  q.sym<Ctx>('publishing').tree(),
  qPluginManagement,
  qPredefinedRegistries,
  qCustomRegistryUrl,
);
