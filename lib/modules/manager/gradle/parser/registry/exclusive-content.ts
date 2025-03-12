import { query as q } from 'good-enough-parser';
import type { Ctx } from '../../types';
import { cleanupTempVars, qUri, storeInTokenMap } from '../common';
import {
  handleCustomRegistryUrlTmp,
  handleExclusiveContentRegistryUrls,
} from '../handlers';
import { cleanupTmpRegistryContent, qContentDescriptor } from './content';

const cleanupTmpExclusiveRegistryUrls = (ctx: Ctx): Ctx => {
  ctx.tmpExclusiveRegistryUrls = [];
  return ctx;
};

// uri("https://foo.bar/baz")
// "https://foo.bar/baz"
const qRegistryUrl = qUri.handler((ctx) => storeInTokenMap(ctx, 'registryUrl'));

// maven(url = uri("https://foo.bar/baz"))
// maven("https://foo.bar/baz") { content { ... } }
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
        .join(qRegistryUrl)
        .end(),
    }),
    // .opt(qMavenArtifactRegistry),
    // qMavenArtifactRegistry,
  )
  .handler(handleCustomRegistryUrlTmp)
  .handler(cleanupTmpRegistryContent)
  .handler(cleanupTempVars);

// forRepository { ... }
const qForRepository = q.sym<Ctx>('forRepository').tree({
  type: 'wrapped-tree',
  maxDepth: 1,
  startsWith: '{',
  endsWith: '}',
  search: q.alt(qCustomRegistryUrl), // TODO: Handle predefined and pluginManagement
});

// filter { ... }
const qFilter = q.sym<Ctx>('filter').tree({
  type: 'wrapped-tree',
  maxDepth: 1,
  startsWith: '{',
  endsWith: '}',
  search: qContentDescriptor('include'),
});

// exclusiveContent { ... }
export const qExclusiveContent = q
  .sym<Ctx>('exclusiveContent')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '{',
    endsWith: '}',
    search: q.alt(qForRepository, qFilter),
  })
  .handler(handleExclusiveContentRegistryUrls)
  .handler(cleanupTmpExclusiveRegistryUrls)
  .handler(cleanupTmpRegistryContent);
