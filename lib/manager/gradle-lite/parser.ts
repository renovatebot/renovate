import is from '@sindresorhus/is';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import { PackageDependency } from '../common';
import {
  ManagerData,
  PackageVariables,
  StringInterpolation,
  Token,
  TokenType,
  VariableData,
} from './common';
import { tokenize } from './tokenizer';

const depArtifactRegex = regEx(
  '^[a-zA-Z][-_a-zA-Z0-9]*(?:.[a-zA-Z][-_a-zA-Z0-9]*)*$'
);
export const depVersionRegex = regEx('^(?<version>[-.\\[\\](),a-zA-Z0-9+]+)');

export function isDependencyString(input: string): boolean {
  const split = input.split(':');
  if (split.length !== 3) {
    return false;
  }
  const [groupId, artifactId, version] = split;
  return (
    groupId &&
    artifactId &&
    version &&
    depArtifactRegex.test(groupId) &&
    depArtifactRegex.test(artifactId) &&
    depVersionRegex.test(version)
  );
}

export function parseDependencyString(
  input: string
): PackageDependency<ManagerData> | null {
  const [groupId, artifactId, currentValue] = input?.split(':');
  if (groupId && artifactId) {
    return {
      depName: `${groupId}:${artifactId}`,
      currentValue,
    };
  }
  return null;
}

interface Matcher {
  type: TokenType | TokenType[];
  key?: string;
  value?: string;
  lookahead?: boolean;
  testFn?: (string) => boolean;
}

type MatcherSeq = Matcher[];

type MatcherSeqMap = Record<string, MatcherSeq>;

type Match = Record<string, Token>;

type MatchOneOf = [string, Match] | [null, null];

function matchSeq(tokens: Token[], matcherSeq: MatcherSeq): Match | null {
  let lookaheadCount = 0;
  const result: Match = {};
  for (let idx = 0; idx < matcherSeq.length; idx += 1) {
    const token = tokens[idx];
    const matcher = matcherSeq[idx];

    if (!token) {
      if (matcher.lookahead) {
        break;
      }
      return null;
    }

    const typeMatches = is.string(matcher.type)
      ? matcher.type === token.type
      : matcher.type.includes(token.type);
    if (!typeMatches) {
      return null;
    }

    if (is.string(matcher.value) && token.value !== matcher.value) {
      return null;
    }

    if (matcher.testFn && !matcher.testFn(token.value)) {
      return null;
    }

    lookaheadCount = matcher.lookahead ? lookaheadCount + 1 : 0;

    if (matcher.key) {
      result[matcher.key] = token;
    }
  }

  tokens.splice(0, matcherSeq.length - lookaheadCount);
  return result;
}

function matchOneOfSeq(
  tokens: Token[],
  matcherSeqMap: MatcherSeqMap
): MatchOneOf {
  let match: Match = null;
  for (const [matcherKey, matcherSeq] of Object.entries(matcherSeqMap)) {
    match = matchSeq(
      tokens,
      matcherSeq.length === 1
        ? [{ key: matcherKey, ...matcherSeq[0] }]
        : matcherSeq
    );
    if (match) {
      return [matcherKey, match];
    }
  }
  return [null, null];
}

const matcherMap: MatcherSeqMap = {
  assignment: [
    { type: TokenType.Word, key: 'key' },
    { type: TokenType.Assignment },
    { type: TokenType.String, key: 'value' },
    { type: [TokenType.RightBrace, TokenType.Word, null], lookahead: true },
  ],
  depString: [{ type: TokenType.String, testFn: isDependencyString }],
  depInterpolation: [{ type: TokenType.StringInterpolation }],
  plugin: [
    { type: TokenType.Word, value: 'id' },
    { type: TokenType.String, key: 'pluginName' },
    { type: TokenType.Word, value: 'version' },
    { type: TokenType.String, key: 'pluginVersion' },
  ],
};

function interpolateString(
  childTokens: Token[],
  variables: PackageVariables
): string | null {
  const resolvedSubstrings = [];
  for (const childToken of childTokens) {
    const type = childToken.type;
    if (type === TokenType.String) {
      resolvedSubstrings.push(childToken.value);
    } else if (type === TokenType.Variable) {
      const varName = childToken.value;
      const varData = variables[varName];
      if (varData) {
        resolvedSubstrings.push(varData.value);
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  return resolvedSubstrings.join('');
}

export function parseGradle(
  input: string,
  vars: PackageVariables = {},
  packageFile?: string
): PackageDependency<ManagerData>[] {
  logger.trace({ packageFile }, `Gradle parsing ${packageFile} start`);
  const startTime = Date.now();
  const deps: PackageDependency<ManagerData>[] = [];
  const tokens = tokenize(input);
  const variables = { ...vars };
  let tokenLimit = 10000000;
  while (tokens.length) {
    const [matchKey, match] = matchOneOfSeq(tokens, matcherMap);
    if (matchKey === 'assignment') {
      const { key: keyToken, value: valToken } = match;
      const variableData: VariableData = {
        key: keyToken.value,
        value: valToken.value,
        fileReplacePosition: valToken.offset,
      };
      if (packageFile) {
        variableData.packageFile = packageFile;
      }
      variables[variableData.key] = variableData;
    } else if (matchKey === 'depString') {
      const token = match.depString;
      const dep = parseDependencyString(token.value);
      if (dep) {
        const managerData: ManagerData = {
          fileReplacePosition: token.offset + dep.depName.length + 1,
        };
        if (packageFile) {
          managerData.packageFile = packageFile;
        }
        dep.managerData = managerData;
        deps.push(dep);
      }
    } else if (matchKey === 'depInterpolation') {
      const token = match.depInterpolation as StringInterpolation;
      const interpolationResult = interpolateString(token.children, variables);
      if (interpolationResult && isDependencyString(interpolationResult)) {
        const dep = parseDependencyString(interpolationResult);
        if (dep) {
          const versionPlaceholder = [...token.children]
            .reverse()
            .find(({ type }) => type === TokenType.Variable);
          const variable = variables[versionPlaceholder?.value];
          if (variable?.value === dep.currentValue) {
            const managerData: ManagerData = {
              fileReplacePosition: variable.fileReplacePosition,
            };
            if (variable.packageFile) {
              managerData.packageFile = variable.packageFile;
            }
            dep.managerData = managerData;
            dep.groupName = variable.key;
            deps.push(dep);
          }
        }
      }
    } else if (matchKey === 'plugin') {
      const { pluginName, pluginVersion } = match;
      const dep = {
        depType: 'plugin',
        depName: pluginName.value,
        lookupName: `${pluginName.value}:${pluginName.value}.gradle.plugin`,
        registryUrls: ['https://plugins.gradle.org/m2/'],
        currentValue: pluginVersion.value,
        commitMessageTopic: `plugin ${pluginName.value}`,
        managerData: {
          fileReplacePosition: pluginVersion.offset,
          packageFile,
        },
      };
      deps.push(dep);
    }

    if (!match) {
      tokens.shift();
    }

    tokenLimit -= 1;
    if (tokenLimit < 1) {
      logger.trace({ packageFile }, `${packageFile} parsing took too long`);
      break;
    }
  }
  const durationMs = Math.round(Date.now() - startTime);
  logger.trace(
    { packageFile, durationMs },
    `Gradle parsing ${packageFile} finish`
  );
  return deps;
}

const propWord = '[a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*';
const propRegex = regEx(
  `^(?<leftPart>\\s*(?<key>${propWord})\\s*=\\s*['"]?)(?<value>[^\\s'"]+)['"]?\\s*$`
);

export function parseProps(
  input: string,
  packageFile?: string
): { vars: PackageVariables; deps: PackageDependency<ManagerData>[] } {
  let offset = 0;
  const vars = {};
  const deps = [];
  for (const line of input.split('\n')) {
    const match = propRegex.exec(line);
    if (match) {
      const { key, value, leftPart } = match.groups;
      if (isDependencyString(value)) {
        const dep = parseDependencyString(value);
        deps.push({
          ...dep,
          managerData: {
            fileReplacePosition:
              offset + leftPart.length + dep.depName.length + 1,
            packageFile,
          },
        });
      } else {
        const variableData: VariableData = {
          key,
          value,
          fileReplacePosition: offset + leftPart.length,
        };
        if (packageFile) {
          variableData.packageFile = packageFile;
        }
        vars[key] = variableData;
      }
    }
    offset += line.length + 1;
  }
  return { vars, deps };
}
