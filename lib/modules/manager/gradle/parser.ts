import url from 'url';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import type { PackageDependency } from '../types';
import {
  GOOGLE_REPO,
  GRADLE_PLUGIN_PORTAL_REPO,
  JCENTER_REPO,
  MAVEN_REPO,
  TokenType,
} from './common';
import { tokenize } from './tokenizer';
import type {
  GradleManagerData,
  MatchConfig,
  PackageVariables,
  ParseGradleResult,
  StringInterpolation,
  SyntaxHandlerInput,
  SyntaxHandlerOutput,
  SyntaxMatchConfig,
  SyntaxMatcher,
  Token,
  TokenMap,
  VariableData,
} from './types';
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

    if (
      is.array<string>(matcher.matchValue) &&
      !matcher.matchValue.includes(token.value)
    ) {
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
  const { objectToken, keyToken, valToken } = tokenMap;
  const obj = objectToken?.value;
  const key = obj ? `${obj}.${keyToken.value}` : keyToken.value;

  const dep = parseDependencyString(valToken.value);
  if (dep) {
    dep.groupName = key;
    dep.managerData = {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      fileReplacePosition: valToken.offset + dep.depName!.length + 1,
      packageFile,
    };
  }

  const varData: VariableData = {
    key,
    value: valToken.value,
    fileReplacePosition: valToken.offset,
    packageFile,
  };

  const result: SyntaxHandlerOutput = {
    vars: { [key]: varData },
    deps: dep ? [dep] : [],
  };

  return result;
}

function processDepString({
  packageFile,
  tokenMap,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  const { token } = tokenMap;
  const dep = parseDependencyString(token.value);
  if (dep) {
    dep.managerData = {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      fileReplacePosition: token.offset + dep.depName!.length + 1,
      packageFile,
    };
    return { deps: [dep] };
  }
  return null;
}

function processDepInterpolation({
  tokenMap,
  variables,
  packageFile: packageFileOrig,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  const token = tokenMap.depInterpolation as StringInterpolation;
  const interpolationResult = interpolateString(token.children, variables);
  if (interpolationResult && isDependencyString(interpolationResult)) {
    const dep = parseDependencyString(interpolationResult);
    if (dep) {
      let packageFile: string | undefined;
      let fileReplacePosition: number | undefined;
      token.children.forEach((child) => {
        const variable = variables[child.value];
        if (child?.type === TokenType.Variable && variable) {
          packageFile = variable.packageFile;
          fileReplacePosition = variable.fileReplacePosition;
          if (variable?.value === dep.currentValue) {
            dep.managerData = { fileReplacePosition, packageFile };
            dep.groupName = variable.key;
          }
        }
      });
      if (!dep.managerData) {
        const lastToken = token.children[token.children.length - 1];
        if (
          lastToken.type === TokenType.String &&
          lastToken.value.startsWith(`:${dep.currentValue}`)
        ) {
          packageFile = packageFileOrig;
          fileReplacePosition = lastToken.offset + 1;
          delete dep.groupName;
        } else {
          dep.skipReason = 'contains-variable';
        }
        dep.managerData = { fileReplacePosition, packageFile };
      }
      return { deps: [dep] };
    }
  }
  return null;
}

function processPlugin({
  tokenMap,
  packageFile,
  variables,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  const { pluginName, pluginVersion, methodName } = tokenMap;
  const plugin = pluginName.value;
  const depName =
    methodName.value === 'kotlin' ? `org.jetbrains.kotlin.${plugin}` : plugin;
  const packageName =
    methodName.value === 'kotlin'
      ? `org.jetbrains.kotlin.${plugin}:org.jetbrains.kotlin.${plugin}.gradle.plugin`
      : `${plugin}:${plugin}.gradle.plugin`;

  const dep: PackageDependency<GradleManagerData> = {
    depType: 'plugin',
    depName,
    packageName,
    registryUrls: ['https://plugins.gradle.org/m2/'],
    commitMessageTopic: `plugin ${depName}`,
  };

  if (pluginVersion.type === TokenType.Word) {
    const varData = variables[pluginVersion.value];
    if (varData) {
      const currentValue = varData.value;
      const fileReplacePosition = varData.fileReplacePosition;
      dep.currentValue = currentValue;
      dep.managerData = { fileReplacePosition, packageFile };
    } else {
      const currentValue = pluginVersion.value;
      const fileReplacePosition = pluginVersion.offset;
      dep.currentValue = currentValue;
      dep.managerData = { fileReplacePosition, packageFile };
      dep.skipReason = 'unknown-version';
    }
  } else if (pluginVersion.type === TokenType.StringInterpolation) {
    const versionTpl = pluginVersion as StringInterpolation;
    const children = versionTpl.children;
    const [child] = children;
    if (child?.type === TokenType.Variable && children.length === 1) {
      const varData = variables[child.value];
      if (varData) {
        const currentValue = varData.value;
        const fileReplacePosition = varData.fileReplacePosition;
        dep.currentValue = currentValue;
        dep.managerData = {
          fileReplacePosition,
          packageFile: varData.packageFile,
        };
      } else {
        const currentValue = child.value;
        const fileReplacePosition = child.offset;
        dep.currentValue = currentValue;
        dep.managerData = { fileReplacePosition, packageFile };
        dep.skipReason = 'unknown-version';
      }
    } else {
      const fileReplacePosition = versionTpl.offset;
      dep.managerData = { fileReplacePosition, packageFile };
      dep.skipReason = 'unknown-version';
    }
  } else {
    const currentValue = pluginVersion.value;
    const fileReplacePosition = pluginVersion.offset;
    dep.currentValue = currentValue;
    dep.managerData = { fileReplacePosition, packageFile };
  }

  return { deps: [dep] };
}

function processCustomRegistryUrl({
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

function processPredefinedRegistryUrl({
  tokenMap,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  const registryName = tokenMap.registryName?.value;
  const registryUrl = {
    mavenCentral: MAVEN_REPO,
    jcenter: JCENTER_REPO,
    google: GOOGLE_REPO,
    gradlePluginPortal: GRADLE_PLUGIN_PORTAL_REPO,
  }[registryName];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return { urls: [registryUrl!] };
}

const annoyingMethods = new Set([
  'createXmlValueRemover',
  'events',
  'args',
  'arrayOf',
  'listOf',
  'mutableListOf',
  'setOf',
  'mutableSetOf',
]);

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
      dep.groupName = variable.key;
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
    const methodName = tokenMap.methodName?.value;
    if (annoyingMethods.has(methodName)) {
      dep.skipReason = 'ignored';
    }

    return { deps: [dep] };
  }
  return null;
}

const matcherConfigs: SyntaxMatchConfig[] = [
  {
    // foo.bar = 'baz'
    matchers: [
      { matchType: TokenType.Word, tokenMapKey: 'objectToken' },
      { matchType: TokenType.Dot },
      { matchType: TokenType.Word, tokenMapKey: 'keyToken' },
      { matchType: TokenType.Assignment },
      { matchType: TokenType.String, tokenMapKey: 'valToken' },
      endOfInstruction,
    ],
    handler: handleAssignment,
  },
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
    // set('foo', 'bar')
    matchers: [
      { matchType: TokenType.Word, matchValue: 'set' },
      { matchType: TokenType.LeftParen },
      { matchType: TokenType.String, tokenMapKey: 'keyToken' },
      { matchType: TokenType.Comma },
      { matchType: TokenType.String, tokenMapKey: 'valToken' },
      { matchType: TokenType.RightParen },
      endOfInstruction,
    ],
    handler: handleAssignment,
  },
  {
    // 'foo.bar:baz:1.2.3'
    // 'foo.bar:baz:1.2.3@ext'
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
    // "foo.bar:baz:${bazVersion}@ext"
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
    // id 'foo.bar' version fooBarVersion
    // id 'foo.bar' version "$fooBarVersion"
    matchers: [
      {
        matchType: TokenType.Word,
        matchValue: ['id', 'kotlin'],
        tokenMapKey: 'methodName',
      },
      { matchType: TokenType.String, tokenMapKey: 'pluginName' },
      { matchType: TokenType.Word, matchValue: 'version' },
      {
        matchType: [
          TokenType.String,
          TokenType.Word,
          TokenType.StringInterpolation,
        ],
        tokenMapKey: 'pluginVersion',
      },
      endOfInstruction,
    ],
    handler: processPlugin,
  },
  {
    // id('foo.bar') version '1.2.3'
    // id('foo.bar') version fooBarVersion
    // id('foo.bar') version "$fooBarVersion"
    matchers: [
      {
        matchType: TokenType.Word,
        matchValue: ['id', 'kotlin'],
        tokenMapKey: 'methodName',
      },
      { matchType: TokenType.LeftParen },
      { matchType: TokenType.String, tokenMapKey: 'pluginName' },
      { matchType: TokenType.RightParen },
      { matchType: TokenType.Word, matchValue: 'version' },
      {
        matchType: [
          TokenType.String,
          TokenType.Word,
          TokenType.StringInterpolation,
        ],
        tokenMapKey: 'pluginVersion',
      },
      endOfInstruction,
    ],
    handler: processPlugin,
  },
  {
    // mavenCentral()
    matchers: [
      {
        matchType: TokenType.Word,
        matchValue: ['mavenCentral', 'jcenter', 'google', 'gradlePluginPortal'],
        tokenMapKey: 'registryName',
      },
      { matchType: TokenType.LeftParen },
      { matchType: TokenType.RightParen },
      endOfInstruction,
    ],
    handler: processPredefinedRegistryUrl,
  },
  {
    // mavenCentral { content {
    matchers: [
      {
        matchType: TokenType.Word,
        matchValue: ['mavenCentral', 'jcenter', 'google', 'gradlePluginPortal'],
        tokenMapKey: 'registryName',
      },
      { matchType: TokenType.LeftBrace },
      {
        matchType: TokenType.Word,
        matchValue: ['content'],
      },
      {
        matchType: TokenType.LeftBrace,
        lookahead: true,
      },
    ],
    handler: processPredefinedRegistryUrl,
  },
  {
    // maven("https://repository.mycompany.com/m2/repository")
    matchers: [
      {
        matchType: TokenType.Word,
        matchValue: 'maven',
      },
      { matchType: TokenType.LeftParen },
      { matchType: TokenType.String, tokenMapKey: 'registryUrl' },
      { matchType: TokenType.RightParen },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // maven { url = "https://maven.springframework.org/release"
    matchers: [
      {
        matchType: TokenType.Word,
        matchValue: 'maven',
      },
      { matchType: TokenType.LeftBrace },
      {
        matchType: TokenType.Word,
        matchValue: 'url',
      },
      { matchType: TokenType.Assignment },
      { matchType: TokenType.String, tokenMapKey: 'registryUrl' },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // maven { url = uri("https://maven.springframework.org/release")
    matchers: [
      {
        matchType: TokenType.Word,
        matchValue: 'maven',
      },
      { matchType: TokenType.LeftBrace },
      {
        matchType: TokenType.Word,
        matchValue: 'url',
      },
      { matchType: TokenType.Assignment },
      {
        matchType: TokenType.Word,
        matchValue: 'uri',
      },
      { matchType: TokenType.LeftParen },
      { matchType: TokenType.String, tokenMapKey: 'registryUrl' },
      { matchType: TokenType.RightParen },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // maven { url "https://maven.springframework.org/release"
    matchers: [
      {
        matchType: TokenType.Word,
        matchValue: 'maven',
      },
      { matchType: TokenType.LeftBrace },
      {
        matchType: TokenType.Word,
        matchValue: 'url',
      },
      { matchType: TokenType.String, tokenMapKey: 'registryUrl' },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // url 'https://repo.spring.io/snapshot/'
    matchers: [
      { matchType: TokenType.Word, matchValue: ['uri', 'url'] },
      { matchType: TokenType.String, tokenMapKey: 'registryUrl' },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // url('https://repo.spring.io/snapshot/')
    matchers: [
      { matchType: TokenType.Word, matchValue: ['uri', 'url'] },
      { matchType: TokenType.LeftParen },
      { matchType: TokenType.String, tokenMapKey: 'registryUrl' },
      { matchType: TokenType.RightParen },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
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
  {
    // (group: "com.example", name: "my.dependency", version: "1.2.3")
    matchers: [
      { matchType: TokenType.LeftParen },
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
      { matchType: TokenType.RightParen },
      endOfInstruction,
    ],
    handler: processLongFormDep,
  },
  {
    // fooBarBaz("com.example", "my.dependency", "1.2.3")
    matchers: [
      { matchType: TokenType.Word, tokenMapKey: 'methodName' },
      { matchType: TokenType.LeftParen },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: TokenType.Comma },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: TokenType.Comma },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: TokenType.RightParen },
    ],
    handler: processLongFormDep,
  },
  {
    // ("com.example", "my.dependency", "1.2.3")
    matchers: [
      { matchType: TokenType.LeftParen },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: TokenType.Comma },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: TokenType.Comma },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: TokenType.RightParen },
    ],
    handler: processLongFormDep,
  },
  {
    // (group = "com.example", name = "my.dependency", version = "1.2.3")
    matchers: [
      { matchType: TokenType.LeftParen },
      { matchType: TokenType.Word, matchValue: 'group' },
      { matchType: TokenType.Assignment },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: TokenType.Comma },
      { matchType: TokenType.Word, matchValue: 'name' },
      { matchType: TokenType.Assignment },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: TokenType.Comma },
      { matchType: TokenType.Word, matchValue: 'version' },
      { matchType: TokenType.Assignment },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: TokenType.RightParen },
    ],
    handler: processLongFormDep,
  },
];

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
): ParseGradleResult {
  let vars: PackageVariables = { ...initVars };
  const deps: PackageDependency<GradleManagerData>[] = [];
  const urls: string[] = [];

  const tokens = tokenize(input);
  let prevTokensLength = tokens.length;
  while (tokens.length) {
    const matchResult = tryMatch({ tokens, variables: vars, packageFile });
    if (matchResult?.deps?.length) {
      deps.push(...matchResult.deps);
    }
    if (matchResult?.vars) {
      vars = { ...vars, ...matchResult.vars };
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

  return { deps, urls, vars };
}

const propWord = '[a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)*';
const propRegex = regEx(
  `^(?<leftPart>\\s*(?<key>${propWord})\\s*=\\s*['"]?)(?<value>[^\\s'"]+)['"]?\\s*$`
);

export function parseProps(
  input: string,
  packageFile?: string
): { vars: PackageVariables; deps: PackageDependency<GradleManagerData>[] } {
  let offset = 0;
  const vars: PackageVariables = {};
  const deps: PackageDependency[] = [];
  for (const line of input.split(newlineRegex)) {
    const lineMatch = propRegex.exec(line);
    if (lineMatch?.groups) {
      const { key, value, leftPart } = lineMatch.groups;
      if (isDependencyString(value)) {
        const dep = parseDependencyString(value);
        if (dep) {
          deps.push({
            ...dep,
            managerData: {
              fileReplacePosition:
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                offset + leftPart.length + dep.depName!.length + 1,
              packageFile,
            },
          });
        }
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
