import { lang, lexer as lex, query as q } from 'good-enough-parser';
import type {
  PackageVariables,
  ParseGradleResult,
  VariableData,
} from './types';

interface GradleContext {
  packageFile: string;
  varKey?: string;
  result: ParseGradleResult;
}

function varKeyHandler(
  ctx: GradleContext,
  { value }: lex.SymbolToken
): GradleContext {
  const varKey = ctx.varKey ? `${ctx.varKey}.${value}` : value;
  return { ...ctx, varKey };
}

function assignHandler(
  ctx: GradleContext,
  { value, offset: fileReplacePosition }: lex.StringValueToken
): GradleContext {
  const { varKey: key, packageFile, result } = ctx;

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
  return { ...ctx, result };
}

const assignmentQuery = q
  .sym(varKeyHandler)
  .many(q.op<GradleContext>('.').sym(varKeyHandler), 0, 5)
  .op('=')
  .str(assignHandler);

const query = q.alt(assignmentQuery);

const groovy = lang.createLang('groovy');

export function parseGradle(
  packageFile: string,
  content: string,
  vars: PackageVariables
): ParseGradleResult {
  const emptyResult = { vars, deps: [], urls: [] };
  const initialContext: GradleContext = { packageFile, result: emptyResult };
  const res = groovy.query<GradleContext>(content, query, initialContext);
  return res ? res.result : emptyResult;
}
