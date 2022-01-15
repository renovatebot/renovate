import { lexer as lex, query as q } from 'good-enough-parser';
import { VariableData } from '../types';
import { cleanupContext } from './common';
import { GradleContext } from './types';

function handleVariableName(
  ctx: GradleContext,
  { value }: lex.SymbolToken | lex.StringValueToken
): GradleContext {
  return {
    ...ctx,
    variableName: ctx.variableName ? `${ctx.variableName}.${value}` : value,
  };
}

function handleVariableValue(
  ctx: GradleContext,
  { value, offset: fileReplacePosition }: lex.StringValueToken
): GradleContext {
  const { variableName: key, packageFile, result } = ctx;

  if (!key) {
    return ctx;
  }

  const varData: VariableData = {
    key,
    value,
    packageFile,
    fileReplacePosition,
  };

  result.vars[key] = varData;

  return cleanupContext({ ...ctx, result });
}

export const assignmentQuery = q
  .sym(handleVariableName)
  .many(q.op<GradleContext>('.').sym(handleVariableName), 0, 5)
  .op('=')
  .str(handleVariableValue);

export const assignmentSetQuery = q.sym<GradleContext>('set').tree({
  maxDepth: 1,
  type: 'wrapped-tree',
  search: q.str(handleVariableName).op(',').str(handleVariableValue),
});
