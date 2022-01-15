import { lexer as lex, query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import { parseUrl, validateUrl } from '../../../../util/url';
import {
  GOOGLE_REPO,
  GRADLE_PLUGIN_PORTAL_REPO,
  JCENTER_REPO,
  MAVEN_REPO,
} from '../common';
import { GradleContext } from './types';

const predefinedUrls = {
  mavenCentral: MAVEN_REPO,
  jcenter: JCENTER_REPO,
  google: GOOGLE_REPO,
  gradlePluginPortal: GRADLE_PLUGIN_PORTAL_REPO,
};

function handlePredefinedRegistry(
  ctx: GradleContext,
  { value }: lex.SymbolToken
): GradleContext {
  const url = predefinedUrls[value];
  if (url && !ctx.result.urls.includes(url)) {
    ctx.result.urls.push(url);
  }
  return ctx;
}

function handleCustomRegistry(
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

export const registryUrlQuery = q.alt<GradleContext>(
  q
    .sym(
      regEx('^(?:mavenCentral|jcenter|google|gradlePluginPortal)$'),
      handlePredefinedRegistry
    )
    .tree(),
  q
    .sym<GradleContext>('url')
    .alt(
      q.str(handleCustomRegistry),
      q.tree({ search: q.str(handleCustomRegistry) })
    ),
  q.sym<GradleContext>('maven').tree({ search: q.str(handleCustomRegistry) })
);
