import * as url from 'url';
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

    lookaheadCount = matcher.lookahead ? lookaheadCount + 1 : 0;

    if (matcher.tokenMapKey) {
      result[matcher.tokenMapKey] = token;
    }
  }

  tokens.splice(0, matchers.length - lookaheadCount);
  return result;
}

const endOfInstruction: SyntaxMatcher = {
  // Ensure we skip assignments of complex expressions (not strings)
  matchType: [
    TokenType.Semicolon,
    TokenType.RightBrace,
    TokenType.Word,
    TokenType.String,
    TokenType.StringInterpolation,
  ],
  lookahead: true,
};

const potentialStringTypes = [TokenType.String, TokenType.Word];

function coercePotentialString(
  token: Token,
  variables: PackageVariables
): string | null {
  const tokenType = token?.type;
  if (tokenType === TokenType.String) {
    return token?.value;
  }
  if (
    tokenType === TokenType.Word &&
    typeof variables[token?.value] !== 'undefined'
  ) {
    return variables[token.value].value;
  }
  return null;
}

function handleAssignment({
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
}

function processDepString({
  packageFile,
  tokenMap,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  const { token } = tokenMap;
  const dep = parseDependencyString(token.value);
  if (dep) {
    dep.managerData = {
      fileReplacePosition: token.offset + dep.depName.length + 1,
      packageFile,
    };
    return { deps: [dep] };
  }
  return null;
}

function processDepInterpolation({
  tokenMap,
  variables,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  const token = tokenMap.depInterpolation as StringInterpolation;
  const interpolationResult = interpolateString(token.children, variables);
  if (interpolationResult && isDependencyString(interpolationResult)) {
    const dep = parseDependencyString(interpolationResult);
    if (dep) {
      const lastChild = token.children[token.children.length - 1];
      const lastChildValue = lastChild?.value;
      const variable = variables[lastChildValue];
      if (
        lastChild?.type === TokenType.Variable &&
        variable &&
        variable?.value === dep.currentValue
      ) {
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
}

function processPlugin({
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
}

function processRegistryUrl({
  tokenMap,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  const registryUrl = tokenMap.registryUrl?.value;
  try {
    if (registryUrl) {
      const { host, protocol } = url.parse(registryUrl);
      if (host && protocol) {
        return { urls: [registryUrl] };
      }
    }
  } catch (e) {
    // no-op
  }
  return null;
}

function processLongFormDep({
  tokenMap,
  variables,
  packageFile,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  const groupId = coercePotentialString(tokenMap.groupId, variables);
  const artifactId = coercePotentialString(tokenMap.artifactId, variables);
  const version = coercePotentialString(tokenMap.version, variables);
  const dep = parseDependencyString([groupId, artifactId, version].join(':'));
  if (dep) {
    const versionToken: Token = tokenMap.version;
    if (versionToken.type === TokenType.Word) {
      const variable = variables[versionToken.value];
      dep.managerData = {
        fileReplacePosition: variable.fileReplacePosition,
        packageFile: variable.packageFile,
      };
    } else {
      dep.managerData = {
        fileReplacePosition: versionToken.offset,
        packageFile,
      };
    }
    return { deps: [dep] };
  }
  return null;
}

const matcherConfigs: SyntaxMatchConfig[] = [
  {
    // foo = 'bar'
    matchers: [
      { matchType: TokenType.Word, tokenMapKey: 'keyToken' },
      { matchType: TokenType.Assignment },
      { matchType: TokenType.String, tokenMapKey: 'valToken' },
      endOfInstruction,
    ],
    handler: handleAssignment,
  },
  {
    // 'foo.bar:baz:1.2.3'
    matchers: [
      {
        matchType: TokenType.String,
        tokenMapKey: 'token',
      },
    ],
    handler: processDepString,
  },
  {
    // "foo.bar:baz:${bazVersion}"
    matchers: [
      {
        matchType: TokenType.StringInterpolation,
        tokenMapKey: 'depInterpolation',
      },
    ],
    handler: processDepInterpolation,
  },
  {
    // id 'foo.bar' version '1.2.3'
    matchers: [
      { matchType: TokenType.Word, matchValue: 'id' },
      { matchType: TokenType.String, tokenMapKey: 'pluginName' },
      { matchType: TokenType.Word, matchValue: 'version' },
      { matchType: TokenType.String, tokenMapKey: 'pluginVersion' },
    ],
    handler: processPlugin,
  },
  {
    // url 'https://repo.spring.io/snapshot/'
    matchers: [
      { matchType: TokenType.Word, matchValue: 'url' },
      { matchType: TokenType.String, tokenMapKey: 'registryUrl' },
      endOfInstruction,
    ],
    handler: processRegistryUrl,
  },
  {
    // url('https://repo.spring.io/snapshot/')
    matchers: [
      { matchType: TokenType.Word, matchValue: 'url' },
      { matchType: TokenType.LeftBrace },
      { matchType: TokenType.String, tokenMapKey: 'registryUrl' },
      { matchType: TokenType.LeftBrace },
      endOfInstruction,
    ],
    handler: processRegistryUrl,
  },
  {
    // group: "com.example", name: "my.dependency", version: "1.2.3"
    matchers: [
      { matchType: TokenType.Word, matchValue: 'group' },
      { matchType: TokenType.Colon },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: TokenType.Comma },
      { matchType: TokenType.Word, matchValue: 'name' },
      { matchType: TokenType.Colon },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: TokenType.Comma },
      { matchType: TokenType.Word, matchValue: 'version' },
      { matchType: TokenType.Colon },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      endOfInstruction,
    ],
    handler: processLongFormDep,
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
      const result = handler({
        packageFile,
        variables,
        tokenMap,
      });
      if (result !== null) {
        return result;
      }
    }
  }
  tokens.shift();
  return null;
}

export function parseGradle(
  input: string,
  initVars: PackageVariables = {},
  packageFile?: string
): { deps: PackageDependency<ManagerData>[]; urls: string[] } {
  const vars = { ...initVars };
  const deps: PackageDependency<ManagerData>[] = [];
  const urls = [];

  const tokens = tokenize(input);
  let prevTokensLength = tokens.length;
  while (tokens.length) {
    const matchResult = tryMatch({ tokens, variables: vars, packageFile });
    if (matchResult?.deps?.length) {
      deps.push(...matchResult.deps);
    }
    if (matchResult?.vars) {
      Object.assign(vars, matchResult.vars);
    }
    if (matchResult?.urls) {
      urls.push(...matchResult.urls);
    }

    // istanbul ignore if
    if (tokens.length >= prevTokensLength) {
      // Should not happen, but it's better to be prepared
      logger.warn(
        { packageFile },
        `${packageFile} parsing error, results can be incomplete`
      );
      break;
    }
    prevTokensLength = tokens.length;
  }

  return { deps, urls };
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
        vars[key] = {
          key,
          value,
          fileReplacePosition: offset + leftPart.length,
          packageFile,
        };
      }
    }
    offset += line.length + 1;
  }
  return { vars, deps };
}
