import url from 'url';
import is from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import type { PackageDependency } from '../types';
import {
  GOOGLE_REPO,
  GRADLE_PLUGIN_PORTAL_REPO,
  JCENTER_REPO,
  MAVEN_REPO,
} from './common';
import type { TokenType } from './common';
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
  matchType: ['semicolon', 'rightBrace', 'word', 'string', 'interpolation'],
  lookahead: true,
};

const potentialStringTypes: TokenType[] = ['string', 'word'];

function coercePotentialString(
  token: Token,
  variables: PackageVariables
): string | null {
  const tokenType = token?.type;
  if (tokenType === 'string') {
    return token?.value;
  }
  if (tokenType === 'word' && typeof variables[token?.value] !== 'undefined') {
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
        if (child?.type === 'variable' && variable) {
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
          lastToken.type === 'string' &&
          // TODO: types (#7154)
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
  return {};
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

  if (pluginVersion.type === 'word') {
    const varData = variables[pluginVersion.value];
    if (varData) {
      const currentValue = varData.value;
      const fileReplacePosition = varData.fileReplacePosition;
      dep.currentValue = currentValue;
      dep.managerData = {
        fileReplacePosition,
        packageFile: varData.packageFile,
      };
    } else {
      const currentValue = pluginVersion.value;
      const fileReplacePosition = pluginVersion.offset;
      dep.currentValue = currentValue;
      dep.managerData = { fileReplacePosition, packageFile };
      dep.skipReason = 'unknown-version';
    }
  } else if (pluginVersion.type === 'interpolation') {
    const versionTpl = pluginVersion as StringInterpolation;
    const children = versionTpl.children;
    const [child] = children;
    if (child?.type === 'variable' && children.length === 1) {
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
  variables,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  let localVariables = variables;
  if (tokenMap.keyToken?.value === 'name') {
    localVariables = {
      ...variables,
      name: {
        key: 'name',
        value: tokenMap.valToken.value,
      },
    };
  }

  let registryUrl: string | null = tokenMap.registryUrl?.value;
  if (tokenMap.registryUrl?.type === 'interpolation') {
    const token = tokenMap.registryUrl as StringInterpolation;
    registryUrl = interpolateString(token.children, localVariables);
  }

  try {
    if (registryUrl) {
      registryUrl = registryUrl.replace(regEx(/\\/g), '');
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
  'stages', // https://github.com/ajoberstar/reckon
  'mapScalar', // https://github.com/apollographql/apollo-kotlin
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
    if (versionToken.type === 'word') {
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

function processLibraryDep(input: SyntaxHandlerInput): SyntaxHandlerOutput {
  const { tokenMap } = input;

  const varNameToken = tokenMap.varName;
  const key = `libs.${varNameToken.value.replace(regEx(/[-_]/g), '.')}`;
  const fileReplacePosition = varNameToken.offset;
  const packageFile = input.packageFile;

  const groupId = tokenMap.groupId?.value;
  const artifactId = tokenMap.artifactId?.value;
  const value = `${groupId}:${artifactId}`;
  const res: SyntaxHandlerOutput = {};

  if (groupId && artifactId) {
    res.vars = { [key]: { key, value, fileReplacePosition, packageFile } };
    const version = tokenMap.version;
    if (version) {
      if (tokenMap.versionType?.value === 'versionRef') {
        version.type = 'word';
      }
      const depRes = processLongFormDep({
        ...input,
        tokenMap: { ...input.tokenMap, version },
      });
      return { ...depRes, ...res };
    }
  }
  return res;
}

function processApplyFrom({
  tokenMap,
  variables,
}: SyntaxHandlerInput): SyntaxHandlerOutput {
  let scriptFile: string | null = tokenMap.scriptFile?.value ?? null;
  if (tokenMap.scriptFile?.type === 'interpolation') {
    const token = tokenMap.scriptFile as StringInterpolation;
    scriptFile = interpolateString(token.children, variables);
  }

  if (tokenMap.parentPath) {
    let parentPath: string | null = tokenMap.parentPath.value ?? null;
    if (tokenMap.parentPath.type === 'word') {
      parentPath = coercePotentialString(tokenMap.parentPath, variables);
    } else if (tokenMap.parentPath.type === 'interpolation') {
      const token = tokenMap.parentPath as StringInterpolation;
      parentPath = interpolateString(token.children, variables);
    }
    if (parentPath && scriptFile) {
      scriptFile = upath.join(parentPath, scriptFile);
    }
  }

  return { scriptFile };
}

const matcherConfigs: SyntaxMatchConfig[] = [
  {
    // ext.foo = 'baz'
    // project.foo = 'baz'
    // rootProject.foo = 'baz'
    matchers: [
      {
        matchType: 'word',
        matchValue: ['ext', 'project', 'rootProject'],
      },
      { matchType: 'dot' },
      { matchType: 'word', tokenMapKey: 'keyToken' },
      { matchType: 'assignment' },
      { matchType: 'string', tokenMapKey: 'valToken' },
      endOfInstruction,
    ],
    handler: handleAssignment,
  },
  {
    // foo.bar = 'baz'
    matchers: [
      { matchType: 'word', tokenMapKey: 'objectToken' },
      { matchType: 'dot' },
      { matchType: 'word', tokenMapKey: 'keyToken' },
      { matchType: 'assignment' },
      { matchType: 'string', tokenMapKey: 'valToken' },
      endOfInstruction,
    ],
    handler: handleAssignment,
  },
  {
    // foo = 'bar'
    matchers: [
      { matchType: 'word', tokenMapKey: 'keyToken' },
      { matchType: 'assignment' },
      { matchType: 'string', tokenMapKey: 'valToken' },
      endOfInstruction,
    ],
    handler: handleAssignment,
  },
  {
    // set('foo', 'bar')
    matchers: [
      { matchType: 'word', matchValue: ['set', 'version'] },
      { matchType: 'leftParen' },
      { matchType: 'string', tokenMapKey: 'keyToken' },
      { matchType: 'comma' },
      { matchType: 'string', tokenMapKey: 'valToken' },
      { matchType: 'rightParen' },
      endOfInstruction,
    ],
    handler: handleAssignment,
  },
  {
    // 'foo.bar:baz:1.2.3'
    // 'foo.bar:baz:1.2.3@ext'
    matchers: [
      {
        matchType: 'string',
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
        matchType: 'interpolation',
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
        matchType: 'word',
        matchValue: ['id', 'kotlin'],
        tokenMapKey: 'methodName',
      },
      { matchType: 'string', tokenMapKey: 'pluginName' },
      { matchType: 'word', matchValue: 'version' },
      {
        matchType: ['string', 'word', 'interpolation'],
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
        matchType: 'word',
        matchValue: ['id', 'kotlin'],
        tokenMapKey: 'methodName',
      },
      { matchType: 'leftParen' },
      { matchType: 'string', tokenMapKey: 'pluginName' },
      { matchType: 'rightParen' },
      { matchType: 'word', matchValue: 'version' },
      {
        matchType: ['string', 'word', 'interpolation'],
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
        matchType: 'word',
        matchValue: ['mavenCentral', 'jcenter', 'google', 'gradlePluginPortal'],
        tokenMapKey: 'registryName',
      },
      { matchType: 'leftParen' },
      { matchType: 'rightParen' },
      endOfInstruction,
    ],
    handler: processPredefinedRegistryUrl,
  },
  {
    // mavenCentral { content {
    matchers: [
      {
        matchType: 'word',
        matchValue: ['mavenCentral', 'jcenter', 'google', 'gradlePluginPortal'],
        tokenMapKey: 'registryName',
      },
      { matchType: 'leftBrace' },
      {
        matchType: 'word',
        matchValue: ['content'],
      },
      {
        matchType: 'leftBrace',
        lookahead: true,
      },
    ],
    handler: processPredefinedRegistryUrl,
  },
  {
    // maven("https://repository.mycompany.com/m2/repository")
    matchers: [
      {
        matchType: 'word',
        matchValue: 'maven',
      },
      { matchType: 'leftParen' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'registryUrl',
      },
      { matchType: 'rightParen' },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // maven { name = "baz"; url = "https://maven.springframework.org/${name}" }
    matchers: [
      {
        matchType: 'word',
        matchValue: 'maven',
      },
      { matchType: 'leftBrace' },
      {
        matchType: 'word',
        matchValue: 'name',
        tokenMapKey: 'keyToken',
      },
      { matchType: 'assignment' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'valToken',
      },
      {
        matchType: 'word',
        matchValue: 'url',
      },
      { matchType: 'assignment' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'registryUrl',
      },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // maven { url = "https://maven.springframework.org/release"
    matchers: [
      {
        matchType: 'word',
        matchValue: 'maven',
      },
      { matchType: 'leftBrace' },
      {
        matchType: 'word',
        matchValue: 'url',
      },
      { matchType: 'assignment' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'registryUrl',
      },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // maven { url = uri("https://maven.springframework.org/release")
    matchers: [
      {
        matchType: 'word',
        matchValue: 'maven',
      },
      { matchType: 'leftBrace' },
      {
        matchType: 'word',
        matchValue: 'url',
      },
      { matchType: 'assignment' },
      {
        matchType: 'word',
        matchValue: 'uri',
      },
      { matchType: 'leftParen' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'registryUrl',
      },
      { matchType: 'rightParen' },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // maven { url "https://maven.springframework.org/release"
    matchers: [
      {
        matchType: 'word',
        matchValue: 'maven',
      },
      { matchType: 'leftBrace' },
      {
        matchType: 'word',
        matchValue: 'url',
      },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'registryUrl',
      },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // url 'https://repo.spring.io/snapshot/'
    matchers: [
      { matchType: 'word', matchValue: ['uri', 'url'] },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'registryUrl',
      },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // url('https://repo.spring.io/snapshot/')
    matchers: [
      { matchType: 'word', matchValue: ['uri', 'url'] },
      { matchType: 'leftParen' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'registryUrl',
      },
      { matchType: 'rightParen' },
      endOfInstruction,
    ],
    handler: processCustomRegistryUrl,
  },
  {
    // library("foobar", "foo", "bar").versionRef("foo.bar")
    // library("foobar", "foo", "bar").version("1.2.3")
    matchers: [
      { matchType: 'word', matchValue: 'library' },
      { matchType: 'leftParen' },
      { matchType: 'string', tokenMapKey: 'varName' },
      { matchType: 'comma' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'rightParen' },
      { matchType: 'dot' },
      {
        matchType: 'word',
        matchValue: ['versionRef', 'version'],
        tokenMapKey: 'versionType',
      },
      { matchType: 'leftParen' },
      { matchType: 'string', tokenMapKey: 'version' },
      { matchType: 'rightParen' },
    ],
    handler: processLibraryDep,
  },
  {
    // library("foobar", "foo", "bar")
    matchers: [
      { matchType: 'word', matchValue: 'library' },
      { matchType: 'leftParen' },
      { matchType: 'string', tokenMapKey: 'varName' },
      { matchType: 'comma' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'rightParen' },
    ],
    handler: processLibraryDep,
  },
  {
    // group: "com.example", name: "my.dependency", version: "1.2.3"
    matchers: [
      { matchType: 'word', matchValue: 'group' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'name' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'version' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      endOfInstruction,
    ],
    handler: processLongFormDep,
  },
  {
    // (group: "com.example", name: "my.dependency", version: "1.2.3")
    matchers: [
      { matchType: 'leftParen' },
      { matchType: 'word', matchValue: 'group' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'name' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'version' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: 'rightParen' },
      endOfInstruction,
    ],
    handler: processLongFormDep,
  },
  {
    // group: "com.example", name: "my.dependency", version: "1.2.3", classifier:"class"
    matchers: [
      { matchType: 'word', matchValue: 'group' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'name' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'version' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'classifier' },
      { matchType: 'colon' },
      endOfInstruction,
    ],
    handler: processLongFormDep,
  },
  {
    // (group: "com.example", name: "my.dependency", version: "1.2.3", classifier:"class")
    matchers: [
      { matchType: 'leftParen' },
      { matchType: 'word', matchValue: 'group' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'name' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'version' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'classifier' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'classifier' },
      { matchType: 'rightParen' },
      endOfInstruction,
    ],
    handler: processLongFormDep,
  },
  {
    // group: "com.example", name: "my.dependency", version: "1.2.3"{
    //        exclude module: 'exclude'
    //     }
    matchers: [
      { matchType: 'word', matchValue: 'group' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'name' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'version' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: 'leftBrace' },
      { matchType: 'word', matchValue: 'exclude' },
      { matchType: 'word', matchValue: 'module' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'exclude' },
      { matchType: 'rightBrace' },
      endOfInstruction,
    ],
    handler: processLongFormDep,
  },
  {
    // (group: "com.example", name: "my.dependency", version: "1.2.3"){
    //        exclude module: 'exclude'
    //     }
    matchers: [
      { matchType: 'leftParen' },
      { matchType: 'word', matchValue: 'group' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'name' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'version' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: 'rightParen' },
      { matchType: 'leftBrace' },
      { matchType: 'word', matchValue: 'exclude' },
      { matchType: 'word', matchValue: 'module' },
      { matchType: 'colon' },
      { matchType: potentialStringTypes, tokenMapKey: 'exclude' },
      { matchType: 'rightBrace' },
      endOfInstruction,
    ],
    handler: processLongFormDep,
  },
  {
    // fooBarBaz("com.example", "my.dependency", "1.2.3")
    matchers: [
      { matchType: 'word', tokenMapKey: 'methodName' },
      { matchType: 'leftParen' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'comma' },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: 'rightParen' },
    ],
    handler: processLongFormDep,
  },
  {
    // ("com.example", "my.dependency", "1.2.3")
    matchers: [
      { matchType: 'leftParen' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'comma' },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: 'rightParen' },
    ],
    handler: processLongFormDep,
  },
  {
    // (group = "com.example", name = "my.dependency", version = "1.2.3")
    matchers: [
      { matchType: 'leftParen' },
      { matchType: 'word', matchValue: 'group' },
      { matchType: 'assignment' },
      { matchType: potentialStringTypes, tokenMapKey: 'groupId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'name' },
      { matchType: 'assignment' },
      { matchType: potentialStringTypes, tokenMapKey: 'artifactId' },
      { matchType: 'comma' },
      { matchType: 'word', matchValue: 'version' },
      { matchType: 'assignment' },
      { matchType: potentialStringTypes, tokenMapKey: 'version' },
      { matchType: 'rightParen' },
    ],
    handler: processLongFormDep,
  },
  {
    // apply from: 'foo.gradle'
    // apply from: "${somedir}/foo.gradle"
    matchers: [
      { matchType: 'word', matchValue: 'apply' },
      { matchType: 'word', matchValue: 'from' },
      { matchType: 'colon' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'scriptFile',
      },
    ],
    handler: processApplyFrom,
  },
  {
    // apply from: file("${somedir}/foo.gradle")
    matchers: [
      { matchType: 'word', matchValue: 'apply' },
      { matchType: 'word', matchValue: 'from' },
      { matchType: 'colon' },
      { matchType: 'word', matchValue: 'file' },
      { matchType: 'leftParen' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'scriptFile',
      },
      { matchType: 'rightParen' },
    ],
    handler: processApplyFrom,
  },
  {
    // apply from: new File("${somedir}/foo.gradle")
    matchers: [
      { matchType: 'word', matchValue: 'apply' },
      { matchType: 'word', matchValue: 'from' },
      { matchType: 'colon' },
      { matchType: 'word', matchValue: 'new' },
      { matchType: 'word', matchValue: 'File' },
      { matchType: 'leftParen' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'scriptFile',
      },
      { matchType: 'rightParen' },
    ],
    handler: processApplyFrom,
  },
  {
    // apply from: new File(somedir, "${otherdir}/foo.gradle")
    // apply from: new File("${somedir}", "${otherdir}/foo.gradle")
    matchers: [
      { matchType: 'word', matchValue: 'apply' },
      { matchType: 'word', matchValue: 'from' },
      { matchType: 'colon' },
      { matchType: 'word', matchValue: 'new' },
      { matchType: 'word', matchValue: 'File' },
      { matchType: 'leftParen' },
      {
        matchType: ['word', 'string', 'interpolation'],
        tokenMapKey: 'parentPath',
      },
      { matchType: 'comma' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'scriptFile',
      },
      { matchType: 'rightParen' },
    ],
    handler: processApplyFrom,
  },
  {
    // apply from: project.file("${somedir}/foo.gradle")
    // apply from: rootProject.file("${somedir}/foo.gradle")
    matchers: [
      { matchType: 'word', matchValue: 'apply' },
      { matchType: 'word', matchValue: 'from' },
      { matchType: 'colon' },
      { matchType: 'word', matchValue: ['project', 'rootProject'] },
      { matchType: 'dot' },
      { matchType: 'word', matchValue: 'file' },
      { matchType: 'leftParen' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'scriptFile',
      },
      { matchType: 'rightParen' },
    ],
    handler: processApplyFrom,
  },
  {
    // apply(from = 'foo.gradle')
    // apply(from = "${somedir}/foo.gradle")
    matchers: [
      { matchType: 'word', matchValue: 'apply' },
      { matchType: 'leftParen' },
      { matchType: 'word', matchValue: 'from' },
      { matchType: 'assignment' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'scriptFile',
      },
      { matchType: 'rightParen' },
    ],
    handler: processApplyFrom,
  },
  {
    // apply(from = File("${somedir}/foo.gradle"))
    matchers: [
      { matchType: 'word', matchValue: 'apply' },
      { matchType: 'leftParen' },
      { matchType: 'word', matchValue: 'from' },
      { matchType: 'assignment' },
      { matchType: 'word', matchValue: 'File' },
      { matchType: 'leftParen' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'scriptFile',
      },
      { matchType: 'rightParen' },
    ],
    handler: processApplyFrom,
  },
  {
    // apply(from = File(somedir, "${otherdir}/foo.gradle"))
    // apply(from = File("${somedir}", "${otherdir}/foo.gradle")
    matchers: [
      { matchType: 'word', matchValue: 'apply' },
      { matchType: 'leftParen' },
      { matchType: 'word', matchValue: 'from' },
      { matchType: 'assignment' },
      { matchType: 'word', matchValue: 'File' },
      { matchType: 'leftParen' },
      {
        matchType: ['word', 'string', 'interpolation'],
        tokenMapKey: 'parentPath',
      },
      { matchType: 'comma' },
      {
        matchType: ['string', 'interpolation'],
        tokenMapKey: 'scriptFile',
      },
      { matchType: 'rightParen' },
    ],
    handler: processApplyFrom,
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

async function parseInlineScriptFile(
  scriptFile: string,
  variables: PackageVariables,
  recursionDepth: number,
  packageFile = ''
): Promise<SyntaxHandlerOutput> {
  if (recursionDepth > 2) {
    logger.debug(`Max recursion depth reached in script file: ${scriptFile}`);
    return null;
  }

  if (!regEx(/\.gradle(\.kts)?$/).test(scriptFile)) {
    logger.warn({ scriptFile }, `Only Gradle files can be included`);
    return null;
  }

  const scriptFilePath = getSiblingFileName(packageFile, scriptFile);
  const scriptFileContent = await readLocalFile(scriptFilePath, 'utf8');
  if (!scriptFileContent) {
    logger.debug(`Failed to process included Gradle file ${scriptFilePath}`);
    return null;
  }

  return parseGradle(
    scriptFileContent,
    variables,
    scriptFilePath,
    recursionDepth + 1
  );
}

export async function parseGradle(
  input: string,
  initVars: PackageVariables = {},
  packageFile?: string,
  recursionDepth = 0
): Promise<ParseGradleResult> {
  let vars: PackageVariables = { ...initVars };
  const deps: PackageDependency<GradleManagerData>[] = [];
  const urls: string[] = [];

  const tokens = tokenize(input);
  let prevTokensLength = tokens.length;
  while (tokens.length) {
    let matchResult = tryMatch({ tokens, variables: vars, packageFile });
    if (matchResult?.scriptFile) {
      matchResult = await parseInlineScriptFile(
        matchResult.scriptFile,
        vars,
        recursionDepth,
        packageFile
      );
    }
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
        // TODO: types (#7154)
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
  `^(?<leftPart>\\s*(?<key>${propWord})\\s*[= :]\\s*['"]?)(?<value>[^\\s'"]+)['"]?\\s*$`
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
