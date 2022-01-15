import { lexer as lex, query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import { PackageDependency } from '../../../types';
import { GradleManagerData } from '../../types';
import {
  artifactIdRegexPart,
  cleanupContext,
  groupIdRegexPart,
} from './common';
import { GradleContext } from './types';

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

export const templateStringQuery = q.str<GradleContext>({
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

export const templateStringWithDataTypeQuery = q.str<GradleContext>({
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
