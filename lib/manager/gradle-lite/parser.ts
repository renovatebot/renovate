import moo from 'moo';
import { regEx } from '../../util/regex';
import { PackageDependency } from '../common';
import { ManagerData, PackageVariables, VariableData } from './common';

type VariablePlaceholder = Pick<VariableData, 'key'>;
type Interpolation = (string | VariablePlaceholder)[];

type Token = moo.Token & {
  interpolation?: Interpolation;
  isComplete?: boolean;
  isValid?: boolean;
};

const wordRegex = /[a-zA-Z$_][a-zA-Z0-9$_]+/;

const states = {
  main: {
    space: { match: /[ \t\r]+/ },
    lineComment: { match: /\/\/.*?$/ },
    multiComment: { match: /\/\*(?:.|[^])*?\*\// },
    newline: { match: /\n/, lineBreaks: true },
    colon: { match: ';' },
    dot: '.',
    operator: /(?:==|\+=?|-=?|\/=?|\*\*?|\.+|:)/,
    assignment: '=',
    word: { match: wordRegex },
    leftParen: { match: '(' },
    rightParen: { match: ')' },
    leftBracket: { match: '[' },
    rightBracket: { match: ']' },
    leftBrace: { match: '{', push: 'main' },
    rightBrace: { match: '}', pop: 1 },
    singleQuotedStart: { match: "'", push: 'singleQuotedString' },
    doubleQuotedStart: { match: '"', push: 'doubleQuotedString' },
    tripleQuotedStart: { match: "'''", push: 'tripleQuotedString' },
    unknown: { match: /./, value: () => null },
  },
  singleQuotedString: {
    singleQuotedFinish: { match: "'", pop: 1 },
    char: { match: /\\['"bfnrst\\]|.|[^]/, lineBreaks: true },
  },
  doubleQuotedString: {
    doubleQuotedFinish: { match: '"', pop: 1 },
    variable: {
      match: /\${\s*[a-zA-Z_][a-zA-Z0-9_]+(?:\s*\.\s*[a-zA-Z_][a-zA-Z0-9_]+)*\s*}|\$[a-zA-Z_][a-zA-Z0-9_]+(?:\.[a-zA-Z_][a-zA-Z0-9_]+)*/,
      value: (x) => x.replace(/^\${?\s*/, '').replace(/\s*}$/, ''),
    },
    ignoredInterpolation: {
      match: /\${/,
      push: 'ignoredInterpolation',
      value: () => null,
    },
    char: { match: /\\[$'"bfnrst\\]|.|[^]/, lineBreaks: true },
  },
  ignoredInterpolation: {
    leftBrace: { match: '{', push: 'ignoredInterpolation' },
    rightBrace: { match: '}', pop: 1 },
    unknown: { match: /.|[^]/, lineBreaks: true },
  },
  tripleQuotedString: {
    tripleQuotedFinish: { match: "'''", pop: 1 },
    char: { match: /\\['"bfnrst\\]|.|[^]/, lineBreaks: true },
  },
};

function foldNullValues(acc: Token[], token: Token): Token[] {
  if (token.value === null) {
    const prevToken: Token = acc[acc.length - 1];
    if (prevToken?.value !== null) {
      // TODO: preserve ignored text for debugging?
      acc.push({ ...token, type: 'null', value: null });
    }
  } else {
    acc.push(token);
  }
  return acc;
}

function foldCharValues(acc: Token[], token: Token): Token[] {
  const tokenType = token.type;
  const prevToken: Token = acc[acc.length - 1];
  const prevTokenType = prevToken?.type;
  if (tokenType === 'char') {
    if (prevTokenType === 'string') {
      prevToken.value += token.value;
      prevToken.text += token.text;
    } else {
      acc.push({ ...token, type: 'string' });
    }
  } else {
    acc.push(token);
  }
  return acc;
}

function foldInterpolations(acc: Token[], token: Token): Token[] {
  const tokenType = token.type;
  const prevToken: Token = acc[acc.length - 1];
  const prevTokenType = prevToken?.type;
  if (tokenType === 'doubleQuotedStart') {
    acc.push({
      ...token,
      type: 'interpolation',
      interpolation: [],
      isValid: true,
      offset: token.offset + 1,
    });
  } else if (prevTokenType === 'interpolation' && !prevToken.isComplete) {
    if (tokenType === 'string') {
      prevToken.interpolation.push(token.value);
    } else if (tokenType === 'variable') {
      prevToken.interpolation.push({ key: token.value });
    } else if (tokenType === 'doubleQuotedFinish') {
      if (prevToken.interpolation.every((elem) => typeof elem === 'string')) {
        prevToken.type = 'string';
        prevToken.value = prevToken.interpolation.join('');
        delete prevToken.interpolation;
        delete prevToken.isComplete;
        return acc;
      }
      prevToken.isComplete = true;
    } else {
      // TODO: save ignored fragments for debug or something
      prevToken.isValid = false;
    }
  } else {
    acc.push(token);
  }
  return acc;
}

const filteredTokens = [
  'space',
  'lineComment',
  'multiComment',
  'newline',
  'colon',
  'singleQuotedStart',
  'singleQuotedFinish',
  'doubleQuotedFinish',
  'tripleQuotedStart',
  'tripleQuotedFinish',
];
const filterTokens = ({ type }: Token): boolean =>
  !filteredTokens.includes(type);

export function extractTokens(input: string): Token[] {
  const lexer = moo.states(states);
  lexer.reset(input);
  return Array.from(lexer)
    .reduce(foldNullValues, [])
    .reduce(foldCharValues, [])
    .reduce(foldInterpolations, [])
    .filter(filterTokens);
}

const depArtifactRegex = regEx(
  '[a-zA-Z][-_a-zA-Z0-9]*(?:.[a-zA-Z][-_a-zA-Z0-9]*)*'
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

function isEndToken(token: Token): boolean {
  return !token || ['rightBrace', 'word'].includes(token.type);
}

function getAssignments(
  tokens: Token[],
  variables: PackageVariables,
  packageFile?: string
): PackageVariables | null {
  const [wordToken, opToken, valToken, endToken] = tokens;
  if (
    wordToken?.type === 'word' &&
    opToken?.type === 'assignment' &&
    valToken?.type === 'string' &&
    isEndToken(endToken)
  ) {
    tokens.splice(0, 3);
    const variableData: VariableData = {
      key: wordToken.value,
      value: valToken.value,
      fileReplacePosition: valToken.offset,
    };
    if (packageFile) {
      variableData.packageFile = packageFile;
    }
    return {
      ...variables,
      [variableData.key]: variableData,
    };
  }
  return null;
}

function interpolateString(
  input: Interpolation,
  variables: PackageVariables
): string | null {
  const results = [];
  for (const val of input) {
    if (typeof val === 'string') {
      results.push(val);
    } else {
      const varName = val.key;
      const varValue = variables[varName];
      if (varValue) {
        results.push(varValue.value);
      } else {
        return null;
      }
    }
  }
  return results.join('');
}

export function parseGradle(
  input: string,
  vars: PackageVariables = {},
  packageFile?: string
): PackageDependency<ManagerData>[] {
  const deps: PackageDependency<ManagerData>[] = [];
  const tokens = extractTokens(input);
  let variables = { ...vars };
  while (tokens.length) {
    let newVariables = getAssignments(tokens, variables, packageFile);
    while (newVariables) {
      variables = newVariables;
      newVariables = getAssignments(tokens, variables, packageFile);
    }

    const token = tokens.shift();
    if (!token) {
      break;
    }

    const tokenValue = token.value;
    const tokenType = token.type;
    if (tokenType === 'string' && isDependencyString(tokenValue)) {
      const dep = parseDependencyString(tokenValue);
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
    } else if (tokenType === 'interpolation' && token.isComplete) {
      const interpolationResult = interpolateString(
        token.interpolation,
        variables
      );
      if (interpolationResult && isDependencyString(interpolationResult)) {
        const dep = parseDependencyString(interpolationResult);
        if (dep) {
          const variablePlaceholder = [...token.interpolation]
            .reverse()
            .find((x) => typeof x !== 'string') as VariablePlaceholder;
          const variableData = variables[variablePlaceholder?.key];
          if (variableData?.value === dep.currentValue) {
            const managerData: ManagerData = {
              fileReplacePosition: variableData.fileReplacePosition,
            };
            if (variableData.packageFile) {
              managerData.packageFile = variableData.packageFile;
            }
            dep.managerData = managerData;
            dep.groupName = variableData.key;
          }
          deps.push(dep);
        }
      }
    }
  }
  return deps;
}

const propWord = '[a-zA-Z_][a-zA-Z0-9_]+(?:\\.[a-zA-Z_][a-zA-Z0-9_]+)*';
const propRegex = regEx(
  `^(?<leftPart>\\s*(?<key>${propWord})\\s*=\\s*['"]?)(?<value>[^\\s'"]+)['"]?\\s*$`
);

export function parseProps(
  input: string,
  packageFile?: string
): PackageVariables {
  let offset = 0;
  const result = {};
  for (const line of input.split('\n')) {
    const match = propRegex.exec(line);
    if (match) {
      const { key, value, leftPart } = match.groups;
      const variableData: VariableData = {
        key,
        value,
        fileReplacePosition: offset + leftPart.length,
      };
      if (packageFile) {
        variableData.packageFile = packageFile;
      }
      result[key] = variableData;
    }
    offset += line.length + 1;
  }
  return result;
}
