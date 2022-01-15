import { lexer as lex, query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import { PackageDependency } from '../../../types';
import { GradleManagerData } from '../../types';
import {
  artifactIdRegexPart,
  dataTypeRegexPart,
  groupIdRegexPart,
  versionRegexPart,
} from './common';
import { GradleContext } from './types';

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

export const depStringQuery = q.str<GradleContext>(handleDepString);
