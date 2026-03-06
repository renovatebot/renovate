import { query as q } from '@renovatebot/good-enough-parser';
import { regEx } from '../../../util/regex.ts';
import type { PackageDependency } from '../types.ts';
import { packageSwift } from './language.ts';
import {
  emptyCtx,
  handlePackageDependency,
  resetState,
  storeUrl,
  storeVersionOffset,
  storeVersionValue,
} from './parser/handlers.ts';
import type { Ctx } from './types.ts';

const qUrlLabel = q
  .sym<Ctx>('url')
  .op(':')
  .str((ctx, { value }) => storeUrl(ctx, value));

// `.exact("1.0.0")`, `.branch("main")`, `.revision("abc123")`
const qVersionEnum = q.op<Ctx>('.').alt(
  q.sym<Ctx>('exact').tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q.str<Ctx>((ctx, { value }) => storeVersionValue(ctx, value)),
  }),
  q.sym<Ctx>(regEx(/^(branch|revision)$/)).tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q.str<Ctx>((ctx, { value }) =>
      storeVersionValue(ctx, `"${value}"`),
    ),
  }),
);

// `exact: "1.0.0"`
const qVersionExact = q
  .sym<Ctx>('exact')
  .op(':')
  .str((ctx, { value }) => storeVersionValue(ctx, value));

// `branch: "main"`, `revision: "abc123"`
const qVersionBranchOrRevision = q
  .sym<Ctx>(regEx(/^(branch|revision)$/))
  .op(':')
  .str((ctx, { value }) => storeVersionValue(ctx, `"${value}"`));

// `from: "1.0.0"`
const qVersionFrom = q
  .sym<Ctx>('from', (ctx, { offset }) =>
    storeVersionOffset(ctx, { start: offset }),
  )
  .op(':')
  .str()
  .handler((ctx, { endsWith }) =>
    storeVersionOffset(ctx, { end: endsWith.offset + endsWith.value.length }),
  );

// `"1.0.0" ..< "2.0.0"`
const qVersionRange = q
  .opt(
    q
      .str<Ctx>()
      .handler((ctx, { startsWith }) =>
        storeVersionOffset(ctx, { start: startsWith.offset }),
      ),
  )
  .join(
    q.alt<Ctx>(q.op('...'), q.op('..<')).handler((ctx, node) => {
      // istanbul ignore if
      if (node.type !== 'operator') {
        return ctx;
      }

      return storeVersionOffset(ctx, {
        start: node.offset,
        end: node.offset + node.value.length,
        overwritesStart: false,
      });
    }),
  )
  .opt(
    q.str<Ctx>().handler((ctx, { endsWith }) =>
      storeVersionOffset(ctx, {
        end: endsWith.offset + endsWith.value.length,
      }),
    ),
  );

const qVersion = q.alt<Ctx>(
  qVersionEnum,
  qVersionExact,
  qVersionBranchOrRevision,
  qVersionFrom,
  qVersionRange,
);

// `.package(...)`
const qPackage = q
  .op<Ctx>('.')
  .sym('package')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q
      .join<Ctx>(qUrlLabel, q.op(','), qVersion)
      .handler(handlePackageDependency)
      .handler(resetState),
  });

// `dependencies: [ ... ]`
const qDependencies = q
  .sym<Ctx>('dependencies')
  .op(':')
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '[',
    endsWith: ']',
    search: q.many(qPackage),
  });

export function parsePackageSwift(input: string): PackageDependency[] | null {
  const query = q.tree<Ctx>({
    type: 'root-tree',
    maxDepth: 4,
    search: qDependencies,
  });
  const result = packageSwift.query(input, query, emptyCtx(input));

  return result?.deps ?? null;
}
