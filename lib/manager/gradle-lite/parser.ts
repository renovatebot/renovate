import is from '@sindresorhus/is';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import { PackageDependency } from '../common';
import {
  ManagerData,
  PackageVariables,
  StringInterpolation,
  SyntaxHandlerInput,
  SyntaxHandlerOutput,
  SyntaxMatchConfig,
  SyntaxMatcher,
  Token,
  TokenMap,
  TokenType,
  VariableData,
} from './common';
import { tokenize } from './tokenizer';
import {
  interpolateString,
  isDependencyString,
  parseDependencyString,
} from './utils';

function matchTokens(
  tokens: Token[],
  matchers: SyntaxMatcher[]
): TokenMap | null {
  let lookaheadCount = 0;
  const result: TokenMap = {};
  for (let idx = 0; idx < matchers.length; idx += 1) {
    const token = tokens[idx];
    const matcher = matchers[idx];

    if (!token) {
      if (matcher.lookahead) {
        break;
      }
      return null;
    }

    const typeMatches = is.string(matcher.matchType)
      ? matcher.matchType === token.type
      : matcher.matchType.includes(token.type);
    if (!typeMatches) {
      return null;
    }

    if (is.string(matcher.matchValue) && token.value !== matcher.matchValue) {
      return null;
    }

    if (matcher.testValue && !matcher.testValue(token.value)) {
      return null;
    }

    lookaheadCount = matcher.lookahead ? lookaheadCount + 1 : 0;

    if (matcher.tokenMapKey) {
      result[matcher.tokenMapKey] = token;
    }
  }

  tokens.splice(0, matchers.length - lookaheadCount);
  return result;
}

const matcherConfigs: SyntaxMatchConfig[] = [
  {
    // foo = 'bar'
    matchers: [
      { matchType: TokenType.Word, tokenMapKey: 'keyToken' },
      { matchType: TokenType.Assignment },
      { matchType: TokenType.String, tokenMapKey: 'valToken' },
      {
        matchType: [TokenType.RightBrace, TokenType.Word],
        lookahead: true,
      },
    ],
    handler: function handleAssignment({
      packageFile,
      tokenMap,
    }: SyntaxHandlerInput): SyntaxHandlerOutput {
      const { keyToken, valToken } = tokenMap;
      const variableData: VariableData = {
        key: keyToken.value,
        value: valToken.value,
        fileReplacePosition: valToken.offset,
        packageFile,
      };
      return { vars: { [variableData.key]: variableData } };
    },
  },
  {
    // 'foo.bar:baz:1.2.3'
    matchers: [
      {
        matchType: TokenType.String,
        testValue: isDependencyString,
        tokenMapKey: 'token',
      },
    ],
    handler: function processDepString({
      packageFile,
      tokenMap,
    }: SyntaxHandlerInput): SyntaxHandlerOutput {
      const { token } = tokenMap;
      const dep = parseDependencyString(token.value);
      return dep
        ? {
            deps: [
              {
                ...dep,
                managerData: {
                  fileReplacePosition: token.offset + dep.depName.length + 1,
                  packageFile,
                },
              },
            ],
          }
        : null;
    },
  },
  {
    // "foo.bar:baz:${bazVersion}"
    matchers: [
      {
        matchType: TokenType.StringInterpolation,
        tokenMapKey: 'depInterpolation',
      },
    ],
    handler: function processDepInterpolation({
      tokenMap,
      variables,
    }: SyntaxHandlerInput): SyntaxHandlerOutput {
      const token = tokenMap.depInterpolation as StringInterpolation;
      const interpolationResult = interpolateString(token.children, variables);
      if (interpolationResult && isDependencyString(interpolationResult)) {
        const dep = parseDependencyString(interpolationResult);
        if (dep) {
          const versionPlaceholder = [...token.children]
            .reverse()
            .find(({ type }) => type === TokenType.Variable);
          const variable = variables[versionPlaceholder?.value];
          if (variable?.value === dep.currentValue) {
            dep.managerData = {
              fileReplacePosition: variable.fileReplacePosition,
              packageFile: variable.packageFile,
            };
            dep.groupName = variable.key;
            return { deps: [dep] };
          }
        }
      }
      return null;
    },
  },
  {
    // id 'foo.bar' version '1.2.3'
    matchers: [
      { matchType: TokenType.Word, matchValue: 'id' },
      { matchType: TokenType.String, tokenMapKey: 'pluginName' },
      { matchType: TokenType.Word, matchValue: 'version' },
      { matchType: TokenType.String, tokenMapKey: 'pluginVersion' },
    ],
    handler: function processPlugin({
      tokenMap,
      packageFile,
    }: SyntaxHandlerInput): SyntaxHandlerOutput {
      const { pluginName, pluginVersion } = tokenMap;
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
      return { deps: [dep] };
    },
  },
];

interface MatchConfig {
  tokens: Token[];
  variables: PackageVariables;
  packageFile: string;
}

function tryMatch({
  tokens,
  variables,
  packageFile,
}: MatchConfig): SyntaxHandlerOutput {
  for (const { matchers, handler } of matcherConfigs) {
    const tokenMap = matchTokens(tokens, matchers);
    if (tokenMap) {
      return handler({
        packageFile,
        variables,
        tokenMap,
      });
    }
  }
  tokens.shift();
  return null;
}

export function parseGradle(
  input: string,
  initVars: PackageVariables = {},
  packageFile?: string
): PackageDependency<ManagerData>[] {
  logger.trace({ packageFile }, `Gradle parsing ${packageFile} start`);
  const variables = { ...initVars };
  const dependencies: PackageDependency<ManagerData>[] = [];

  const startTime = Date.now();
  const tokens = tokenize(input);
  let remainingIterations = 1024 * 1024;
  while (tokens.length) {
    const matchResult = tryMatch({ tokens, variables, packageFile });
    if (matchResult?.deps?.length) {
      dependencies.push(...matchResult.deps);
    }
    if (matchResult?.vars) {
      Object.assign(variables, matchResult?.vars);
    }

    remainingIterations -= 1;
    if (remainingIterations < 1) {
      logger.warn({ packageFile }, `${packageFile} parsing took too long`);
      break;
    }
  }
  const durationMs = Math.round(Date.now() - startTime);
  logger.trace(
    { packageFile, durationMs },
    `Gradle parsing ${packageFile} finish`
  );
  return dependencies;
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
    const lineMatch = propRegex.exec(line);
    if (lineMatch) {
      const { key, value, leftPart } = lineMatch.groups;
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
