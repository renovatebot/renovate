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
  result: ParseGradleResult;
  packageFile: string;
  variableName?: string;
  otherPackageFile?: string;
  fileReplacePosition?: number;
  groupId?: string;
  artifactId?: string;
  version?: string;
  dataType?: string;
  paramName?: string;
}

function cleanupContext(ctx: GradleContext): GradleContext {
  delete ctx.variableName;
  delete ctx.otherPackageFile;
  delete ctx.fileReplacePosition;
  delete ctx.groupId;
  delete ctx.artifactId;
  delete ctx.version;
  delete ctx.dataType;
  delete ctx.paramName;
  return ctx;
}

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

const assignmentQuery = q
  .sym(handleVariableName)
  .many(q.op<GradleContext>('.').sym(handleVariableName), 0, 5)
  .op('=')
  .str(handleVariableValue);

const assignmentSetQuery = q.sym<GradleContext>('set').tree({
  maxDepth: 1,
  type: 'wrapped-tree',
  search: q.str(handleVariableName).op(',').str(handleVariableValue),
});

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

const registryUrlQuery = q.alt<GradleContext>(
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

function handleDepString(
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

const depStringQuery = q.str<GradleContext>(handleDepString);

function handleTemplateDepName(
  ctx: GradleContext,
  { value }: lex.StringValueToken
): GradleContext {
  const [groupId, artifactId] = value.split(':');
  ctx.groupId = groupId;
  ctx.artifactId = artifactId;
  return ctx;
}

function handleTemplateVersion(
  ctx: GradleContext,
  { value: varName }: lex.SymbolToken
): GradleContext {
  ctx.variableName = ctx.variableName
    ? `${ctx.variableName}.${varName}`
    : varName;
  return ctx;
}

function handleTemplateDataType(
  ctx: GradleContext,
  { value }: lex.StringValueToken
): GradleContext {
  if (value.startsWith('@')) {
    ctx.dataType = value.slice(1);
  }
  return ctx;
}

function handleTemplate(ctx: GradleContext): GradleContext {
  const {
    variableName: varName,
    groupId,
    artifactId,
    dataType: depDataType,
  } = ctx;
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

  return cleanupContext(ctx);
}

const templateStringQuery = q.str<GradleContext>({
  match: [
    q.str(
      regEx(`^${groupIdRegexPart}:${artifactIdRegexPart}:$`),
      handleTemplateDepName
    ),
    q
      .sym<GradleContext>(handleTemplateVersion)
      .many(q.op<GradleContext>('.').sym(handleTemplateVersion), 0, 5),
  ],
  postHandler: handleTemplate,
});

const templateStringWithDataTypeQuery = q.str<GradleContext>({
  match: [
    q.str(
      regEx(`^${groupIdRegexPart}:${artifactIdRegexPart}:$`),
      handleTemplateDepName
    ),
    q.sym(handleTemplateVersion),
    q.str(handleTemplateDataType),
  ],
  postHandler: handleTemplate,
});

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

const keywordParamsDepQuery = q.many(
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

const tripleStringCallQuery = q.sym<GradleContext>().tree({
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

const query = q.alt<GradleContext>(
  assignmentQuery,
  assignmentSetQuery,
  registryUrlQuery,
  depStringQuery,
  templateStringQuery,
  templateStringWithDataTypeQuery,
  keywordParamsDepQuery,
  tripleStringCallQuery
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
