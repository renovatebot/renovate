import { lexer as lex, query as q } from 'good-enough-parser';
import { PackageDependency } from '../../../types';
import { GradleManagerData } from '../../types';
import { cleanupContext } from './common';
import { GradleContext } from './types';

function handleKeywordParam(
  ctx: GradleContext,
  token: lex.StringValueToken | lex.SymbolToken
): GradleContext {
  const value =
    token.type === 'string-value'
      ? token.value
      : ctx.result.vars[token.value]?.value;

  if (value) {
    const { paramName } = ctx;

    if (paramName === 'group') {
      ctx.groupId = value;
    } else if (paramName === 'name') {
      ctx.artifactId = value;
    } else if (paramName === 'version') {
      ctx.version = value;
      if (token.type === 'symbol') {
        const varData = ctx.result.vars[token.value];
        if (varData) {
          ctx.otherPackageFile = varData.packageFile;
          ctx.fileReplacePosition = varData.fileReplacePosition;
        }
      } else {
        ctx.fileReplacePosition = token.offset;
      }
    }
  }

  return handleKeywordParamsDep(ctx);
}

function handleKeywordParamsDep(ctx: GradleContext): GradleContext {
  const {
    groupId,
    artifactId,
    version: currentValue,
    fileReplacePosition,
  } = ctx;

  const packageFile = ctx.otherPackageFile ?? ctx.packageFile;

  if (groupId && artifactId && currentValue && fileReplacePosition) {
    const depName = `${groupId}:${artifactId}`;

    const dep: PackageDependency<GradleManagerData> = {
      depName,
      currentValue,
      managerData: {
        packageFile,
        fileReplacePosition,
      },
    };

    ctx.result.deps.push(dep);
    return cleanupContext(ctx);
  }

  return ctx;
}

export const keywordParamsDepQuery = q.many(
  q
    .sym<GradleContext>((ctx: GradleContext, { value }) => ({
      ...ctx,
      paramName: value,
    }))
    .alt(q.op(':'), q.op('='))
    .alt(q.str(handleKeywordParam), q.sym(handleKeywordParam)),
  3,
  3
);

export const tripleStringCallQuery = q.sym<GradleContext>().tree({
  type: 'wrapped-tree',
  maxDepth: 1,
  search: q
    .begin<GradleContext>()
    .str((ctx, { value: groupId }) => {
      return { ...ctx, groupId };
    })
    .op(',')
    .str((ctx, { value: artifactId }) => {
      return { ...ctx, artifactId };
    })
    .op(',')
    .alt(
      q.str((ctx, { value: version, offset: fileReplacePosition }) => {
        return { ...ctx, version, fileReplacePosition };
      }),
      q.sym((ctx, { value }) => {
        const varData = ctx.result.vars[value];
        if (varData) {
          ctx.version = varData.value;
          ctx.otherPackageFile = varData.packageFile;
          ctx.fileReplacePosition = varData.fileReplacePosition;
        }
        return ctx;
      })
    )
    .end(),
  postHandler: handleKeywordParamsDep,
});
