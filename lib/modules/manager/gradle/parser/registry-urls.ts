import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import { qApplyFrom } from './apply-from';
import { qAssignments } from './assignments';
import {
  REGISTRY_URLS,
  cleanupTempVars,
  qUri,
  qValueMatcher,
  storeInTokenMap,
  storeVarToken,
} from './common';
import {
  handleCustomRegistryUrl,
  handlePredefinedRegistryUrl,
} from './handlers';
import { qPlugins } from './plugins';
import {
  cleanupTmpRegistryContent,
  qRegistryContent,
} from './registry/content';

// uri("https://foo.bar/baz")
// "https://foo.bar/baz"
const qRegistryUrl = qUri.handler((ctx) => storeInTokenMap(ctx, 'registryUrl'));

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
  .handler(cleanupTmpRegistryContent)
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
    q.sym<Ctx>('url').opt(q.op('=')).join(qRegistryUrl),
    q.sym<Ctx>('setUrl').tree({
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      search: q.begin<Ctx>().join(qRegistryUrl).end(),
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
        search: q
          .begin<Ctx>()
          .opt(q.sym<Ctx>('url').op('='))
          .join(qRegistryUrl)
          .end(),
      })
      .opt(qMavenArtifactRegistry),
    qMavenArtifactRegistry,
  )
  .handler(handleCustomRegistryUrl)
  .handler(cleanupTmpRegistryContent)
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
