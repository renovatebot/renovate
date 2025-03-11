import { type parser, query as q } from 'good-enough-parser';
import { regEx } from '../../../../../util/regex';
import type { Ctx } from '../../types';
import {
  qArtifactId,
  qGroupId,
  qVersion,
  storeInTokenMap,
  storeVarToken,
} from '../common';
import { handleRegistryContent } from '../handlers';

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
export const qRegistryContent = q.sym<Ctx>('content').tree({
  type: 'wrapped-tree',
  maxDepth: 1,
  startsWith: '{',
  endsWith: '}',
  search: q.alt(qContentDescriptor('include'), qContentDescriptor('exclude')),
});

export const cleanupTmpRegistryContent = (ctx: Ctx): Ctx => {
  ctx.tmpRegistryContent = [];
  return ctx;
};
