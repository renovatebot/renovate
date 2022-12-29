import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../types';
import { qApplyFrom } from './apply-from';
import { qAssignments } from './assignments';
import {
  REGISTRY_URLS,
  cleanupTempVars,
  qTemplateString,
  qVariableAccessIdentifier,
  storeInTokenMap,
  storeVarToken,
} from './common';
import {
  handleCustomRegistryUrl,
  handlePredefinedRegistryUrl,
} from './handlers';
import { qPlugins } from './plugins';

// mavenCentral()
// mavenCentral { ... }
const qPredefinedRegistries = q
  .sym(regEx(`^(?:${Object.keys(REGISTRY_URLS).join('|')})$`), storeVarToken)
  .alt(
    q.tree({
      type: 'wrapped-tree',
      startsWith: '(',
      endsWith: ')',
      search: q.begin<Ctx>().end(),
    }),
    q.tree({
      type: 'wrapped-tree',
      startsWith: '{',
      endsWith: '}',
    })
  )
  .handler((ctx) => storeInTokenMap(ctx, 'registryUrl'))
  .handler(handlePredefinedRegistryUrl)
  .handler(cleanupTempVars);

// maven(url = uri("https://foo.bar/baz"))
// maven { name = some; url = "https://foo.bar/${name}" }
const qCustomRegistryUrl = q
  .sym<Ctx>('maven')
  .alt(
    q.tree<Ctx>({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '(',
      endsWith: ')',
      search: q
        .begin<Ctx>()
        .opt(q.sym<Ctx>('url').op('='))
        .alt(
          q.sym<Ctx>('uri').tree({
            maxDepth: 1,
            search: q.alt<Ctx>(qTemplateString, qVariableAccessIdentifier),
          }),
          q.alt(qTemplateString, qVariableAccessIdentifier)
        )
        .end(),
    }),
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      startsWith: '{',
      endsWith: '}',
      search: q.alt(
        q
          .sym<Ctx>('name')
          .opt(q.op('='))
          .alt(qTemplateString, qVariableAccessIdentifier)
          .handler((ctx) => storeInTokenMap(ctx, 'name')),
        q
          .sym<Ctx>('url')
          .opt(q.op('='))
          .alt(
            q.sym<Ctx>('uri').tree({
              maxDepth: 1,
              search: q.alt<Ctx>(qTemplateString, qVariableAccessIdentifier),
            }),
            q.alt(qTemplateString, qVariableAccessIdentifier)
          ),
        q.sym<Ctx>('setUrl').tree({
          maxDepth: 1,
          startsWith: '(',
          endsWith: ')',
          search: q
            .begin<Ctx>()
            .alt(qTemplateString, qVariableAccessIdentifier)
            .end(),
        })
      ),
    })
  )
  .handler((ctx) => storeInTokenMap(ctx, 'registryUrl'))
  .handler(handleCustomRegistryUrl)
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
      qCustomRegistryUrl
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
  qCustomRegistryUrl
);
