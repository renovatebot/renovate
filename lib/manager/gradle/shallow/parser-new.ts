import { lang, lexer as lex, query as q } from 'good-enough-parser';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash, parseUrl, validateUrl } from '../../../util/url';
import {
  GOOGLE_REPO,
  GRADLE_PLUGIN_PORTAL_REPO,
  JCENTER_REPO,
  MAVEN_REPO,
} from './common';
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
  { value }: lex.SymbolToken | lex.StringValueToken
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

const assignBySetQuery = q.sym<GradleContext>('set').tree({
  type: 'wrapped-tree',
  search: q.str(varKeyHandler).op(',').str(assignHandler),
});

const predefinedUrls = {
  mavenCentral: MAVEN_REPO,
  jcenter: JCENTER_REPO,
  google: GOOGLE_REPO,
  gradlePluginPortal: GRADLE_PLUGIN_PORTAL_REPO,
};

function predefinedRegistryUrl(
  ctx: GradleContext,
  { value }: lex.SymbolToken
): GradleContext {
  const url = predefinedUrls[value];
  if (url && !ctx.result.urls.includes(url)) {
    ctx.result.urls.push(url);
  }
  return ctx;
}

function handleRegistryUrl(
  ctx: GradleContext,
  { value }: lex.StringValueToken
): GradleContext {
  if (validateUrl(value)) {
    const url = parseUrl(value);
    if (url.host && url.protocol) {
      if (!ctx.result.urls.includes(value)) {
        ctx.result.urls.push(value);
      }
    }
  }
  return ctx;
}

const registryUrlQuery = q.alt(
  q
    .sym(
      regEx('^(?:mavenCentral|jcenter|google|gradlePluginPortal)$'),
      predefinedRegistryUrl
    )
    .tree(),
  q.sym('url').alt(
    q.str(handleRegistryUrl),
    q.tree({
      search: q.str(handleRegistryUrl),
    })
  ),
  q.sym('maven').tree({
    search: q.str(handleRegistryUrl),
  })
);

const query = q.alt(assignmentQuery, assignBySetQuery, registryUrlQuery);

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
