import { GradleContext } from './types';

export const groupIdRegexPart =
  '(?<groupId>[a-zA-Z][-_a-zA-Z0-9]*(?:\\.[a-zA-Z0-9][-_a-zA-Z0-9]*?)*)';

export const artifactIdRegexPart = groupIdRegexPart.replace(
  '<groupId>',
  '<artifactId>'
);

export const versionRegexPart = '(?<version>[-.\\[\\](),a-zA-Z0-9+]+)';

export const dataTypeRegexPart =
  '(?:(?:@(?<dataType>[a-zA-Z][-_a-zA-Z0-9]*))?)';

export function cleanupContext(ctx: GradleContext): GradleContext {
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
