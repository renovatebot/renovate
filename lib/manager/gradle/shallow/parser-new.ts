import { lang, lexer as lex, query as q } from 'good-enough-parser';
import { regEx } from '../../../util/regex';
import { parseUrl, validateUrl } from '../../../util/url';
import { PackageDependency } from '../../types';
import { GradleManagerData } from '../types';
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
  result: ParseGradleResult;
  varName?: string;
  groupId?: string;
  artifactId?: string;
  dataType?: string;
}

function varNameHandler(
  ctx: GradleContext,
  { value }: lex.SymbolToken | lex.StringValueToken
): GradleContext {
  return {
    ...ctx,
    varName: ctx.varName ? `${ctx.varName}.${value}` : value,
  };
}

function assignHandler(
  ctx: GradleContext,
  { value, offset: fileReplacePosition }: lex.StringValueToken
): GradleContext {
  const { varName: key, packageFile, result } = ctx;

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
  delete ctx.varName;
  return { ...ctx, result };
}

const assignmentQuery = q
  .sym(varNameHandler)
  .many(q.op<GradleContext>('.').sym(varNameHandler), 0, 5)
  .op('=')
  .str(assignHandler);

const assignBySetQuery = q.sym<GradleContext>('set').tree({
  type: 'wrapped-tree',
  search: q.str(varNameHandler).op(',').str(assignHandler),
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

const registryUrlQuery = q.alt<GradleContext>(
  q
    .sym(
      regEx('^(?:mavenCentral|jcenter|google|gradlePluginPortal)$'),
      predefinedRegistryUrl
    )
    .tree(),
  q.sym<GradleContext>('url').alt(
    q.str(handleRegistryUrl),
    q.tree({
      search: q.str(handleRegistryUrl),
    })
  ),
  q.sym<GradleContext>('maven').tree({
    search: q.str(handleRegistryUrl),
  })
);

export const groupIdRegexPart =
  '(?<groupId>[a-zA-Z][-_a-zA-Z0-9]*(?:\\.[a-zA-Z0-9][-_a-zA-Z0-9]*?)*)';

export const artifactIdRegexPart = groupIdRegexPart.replace(
  '<groupId>',
  '<artifactId>'
);

export const versionRegexPart = '(?<version>[-.\\[\\](),a-zA-Z0-9+]+)';

export const dataTypeRegexPart =
  '(?:(?:@(?<dataType>[a-zA-Z][-_a-zA-Z0-9]*))?)';

const depStringRegex = regEx(
  `^${groupIdRegexPart}:${artifactIdRegexPart}:${versionRegexPart}${dataTypeRegexPart}$`
);

function depStringHandler(
  ctx: GradleContext,
  { value }: lex.StringValueToken
): GradleContext {
  const match = value.match(depStringRegex);
  if (match) {
    const {
      groupId,
      artifactId,
      version: currentValue,
      dataType,
    } = match.groups;

    const depName = `${groupId}:${artifactId}`;

    const dep: PackageDependency<GradleManagerData> = {
      depName,
      currentValue,
    };

    if (dataType) {
      dep.dataType = dataType;
    }

    ctx.result.deps.push(dep);
  }

  return ctx;
}

const depStringQuery = q.str<GradleContext>(depStringHandler);

function depTemplateNameHandler(
  ctx: GradleContext,
  { value }: lex.StringValueToken
): GradleContext {
  const [groupId, artifactId] = value.split(':');
  ctx.groupId = groupId;
  ctx.artifactId = artifactId;
  return ctx;
}

function depTemplateVersionHandler(
  ctx: GradleContext,
  { value: varName }: lex.SymbolToken
): GradleContext {
  ctx.varName = ctx.varName ? `${ctx.varName}.${varName}` : varName;
  return ctx;
}

function depTemplateDataTypeHandler(
  ctx: GradleContext,
  { value }: lex.StringValueToken
): GradleContext {
  if (value.startsWith('@')) {
    ctx.dataType = value.slice(1);
  }
  return ctx;
}

function postHandler(ctx: GradleContext): GradleContext {
  const { varName: varName, groupId, artifactId, dataType: depDataType } = ctx;
  if (varName && groupId && artifactId) {
    const varData = ctx.result.vars[varName];
    if (varData) {
      const dep: PackageDependency<GradleManagerData> = {
        depName: `${groupId}:${artifactId}`,
        currentValue: varData.value,
      };

      if (depDataType) {
        dep.dataType = depDataType;
      }

      dep.managerData = {
        packageFile: varData.packageFile,
        fileReplacePosition: varData.fileReplacePosition,
      };

      ctx.result.deps.push(dep);
    }
  }

  delete ctx.varName;
  delete ctx.groupId;
  delete ctx.artifactId;
  delete ctx.dataType;

  return ctx;
}

const depTemplateQuery = q.str<GradleContext>({
  match: [
    q.str(
      regEx(`^${groupIdRegexPart}:${artifactIdRegexPart}:$`),
      depTemplateNameHandler
    ),
    q
      .sym<GradleContext>(depTemplateVersionHandler)
      .many(q.op<GradleContext>('.').sym(depTemplateVersionHandler), 0, 5),
  ],
  postHandler,
});

const depTemplateDataTypeQuery = q.str<GradleContext>({
  match: [
    q.str(
      regEx(`^${groupIdRegexPart}:${artifactIdRegexPart}:$`),
      depTemplateNameHandler
    ),
    q.sym(depTemplateVersionHandler),
    q.str(depTemplateDataTypeHandler),
  ],
  postHandler,
});

// const depKeywordQuery = q
//   .begin()
//   .many(q.sym().alt(q.op(':'), q.op('=')).alt(q.str(), q.sym()), 3, 5)
//   .end();

const query = q.alt<GradleContext>(
  assignmentQuery,
  assignBySetQuery,
  registryUrlQuery,
  depStringQuery,
  depTemplateQuery,
  depTemplateDataTypeQuery
  // depKeywordQuery
);

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
