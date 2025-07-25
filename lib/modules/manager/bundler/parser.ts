import ruby from '@ast-grep/lang-ruby';
import type { SgNode } from '@ast-grep/napi';
import { parseAsync, registerDynamicLanguage } from '@ast-grep/napi';
import is from '@sindresorhus/is';
import * as astGrep from '../../../util/ast-grep';
import { regEx } from '../../../util/regex';
import { uniq } from '../../../util/uniq';
import type { PackageDependency, PackageFileContent } from '../types';

registerDynamicLanguage({ ruby });

function namedChildren(node: SgNode): SgNode[] {
  return node.children().filter((child) => child.isNamed());
}

function extractPlainString(node: SgNode | null): string | null {
  if (node?.kind() === 'string') {
    const children = namedChildren(node);
    if (children.length === 1 && children[0].kind() === 'string_content') {
      return children[0].text();
    }
  }

  return null;
}

function coerceToString(node: SgNode | null): string | null {
  if (!node) {
    return null;
  }

  if (node.kind() === 'identifier') {
    return node.text();
  }

  if (node.kind() === 'hash_key_symbol') {
    return node.text();
  }

  if (node.kind() === 'simple_symbol') {
    return node.text().replace(regEx(/^:/), '');
  }

  if (node.kind() === 'float' || node.kind() === 'integer') {
    return node.text();
  }

  return extractPlainString(node);
}

function coerceToStringOrSymbol(node: SgNode | null): string | symbol | null {
  if (!node) {
    return null;
  }

  if (node.kind() === 'identifier') {
    return Symbol(node.text());
  }

  return coerceToString(node);
}

function extractDepNameData(
  gemDefNode: SgNode,
): Pick<PackageDependency, 'depName' | 'skipReason'> {
  const node = gemDefNode.getMatch('DEP_NAME');
  if (!node) {
    return { skipReason: 'missing-depname' };
  }

  if (node.kind() === 'string') {
    const children = namedChildren(node);
    if (children.length === 0 || children.length > 1) {
      const depName = children.map((child) => child.text()).join('');
      return {
        depName,
        skipReason: 'invalid-name',
      };
    }

    const [child] = children;
    const depName = child.text();
    if (child.kind() !== 'string_content') {
      return { depName, skipReason: 'invalid-name' };
    }

    return { depName };
  }

  if (node.kind() === 'simple_symbol') {
    const depName = node.text().replace(regEx(/^:/), '');
    return { depName };
  }

  const depName = node.text();
  return { depName, skipReason: 'invalid-name' };
}

const gemSingularVersionPattern = astGrep.rule`
  rule:
    kind: call
    pattern: $_
    has:
      field: arguments
      pattern: $_
      has:
        nthChild: 2
        pattern: $VERSION
        any:
          - kind: string
          - kind: float
          - kind: integer
`;

const gemDoubleRangePattern = astGrep.rule`
  rule:
    kind: call
    pattern: $_
    has:
      field: arguments
      pattern: $_
      all:
        - has:
            kind: string
            nthChild: 2
            pattern: $LOWER
        - has:
            kind: string
            nthChild: 3
            pattern: $HIGHER
`;

function extractVersionData(
  gemDefNode: SgNode,
): Pick<PackageDependency, 'currentValue' | 'skipReason' | 'managerData'> {
  const doubleRangeMatch = astGrep.extractMatches(
    gemDefNode,
    gemDoubleRangePattern,
    ['LOWER', 'HIGHER'],
  );
  const [lowerStr, higherStr] = doubleRangeMatch.map(extractPlainString);
  if (lowerStr?.trim().startsWith('>') && higherStr) {
    const [lower, higher] = doubleRangeMatch;
    const offset = gemDefNode.range().start.index;
    const start = lower.range().start.index - offset;
    const end = higher.range().end.index - offset;
    return {
      currentValue: gemDefNode.text().slice(start, end),
      managerData: { lineNumber: lower.range().start.line },
    };
  }

  const [versionNode] = astGrep.extractMatches(
    gemDefNode,
    gemSingularVersionPattern,
    ['VERSION'],
  );

  if (!versionNode) {
    const managerData = { lineNumber: gemDefNode.range().start.line };
    return { skipReason: 'unspecified-version', managerData };
  }

  const managerData = { lineNumber: versionNode.range().start.line };

  if (versionNode.kind() === 'float' || versionNode.kind() === 'integer') {
    return { currentValue: versionNode.text(), managerData };
  }

  const children = namedChildren(versionNode);
  if (children.length === 0) {
    return { currentValue: '', skipReason: 'empty', managerData };
  }

  if (children.length > 1) {
    return {
      currentValue: children.map((child) => child.text()).join(''),
      skipReason: 'version-placeholder',
      managerData,
    };
  }

  const [child] = children;
  const currentValue = child.text();

  if (child.kind() === 'interpolation') {
    return { currentValue, skipReason: 'version-placeholder', managerData };
  }

  if (child.kind() !== 'string_content') {
    return { skipReason: 'unsupported-version', managerData };
  }

  return { currentValue, managerData };
}

const rubyVersionPattern = astGrep.rule`
  rule:
    kind: program
    has:
      kind: call
      all:
        - has:
            field: method
            regex: ^ruby$
        - has:
            field: arguments
            has:
              nthChild: 1
              pattern: $RUBY_VERSION
              any:
                - kind: string
                - kind: simple_symbol
`;

function extractRubyVersion(root: SgNode): PackageDependency | null {
  const node = root.find(rubyVersionPattern)?.getMatch('RUBY_VERSION');
  if (!node) {
    return null;
  }

  const managerData = { lineNumber: node.range().start.line };

  if (node.kind() === 'string') {
    const children = namedChildren(node);
    if (children.length === 0) {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue: '',
        skipReason: 'empty',
        managerData,
      };
    }

    if (children.length > 1) {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue: children.map((child) => child.text()).join(''),
        skipReason: 'version-placeholder',
        managerData,
      };
    }

    const [child] = children;
    const currentValue = child.text();

    if (child.kind() === 'interpolation') {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue,
        skipReason: 'version-placeholder',
        managerData,
      };
    }

    if (child.kind() === 'string_content') {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue,
        managerData,
      };
    }
  }

  if (node.kind() === 'simple_symbol') {
    return {
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: node.text(),
      skipReason: 'not-a-version',
      managerData,
    };
  }

  return {
    depName: 'ruby',
    datasource: 'ruby-version',
    currentValue: node.text(),
    skipReason: 'unsupported-version',
    managerData,
  };
}

const globalSourcePattern = astGrep.rule`
  rule:
    kind: call
    inside:
      kind: program
    not:
      has:
        field: block
        pattern: $_
    all:
      - has:
          field: method
          regex: ^source$
      - has:
          field: arguments
          has:
            nthChild: 1
            pattern: $REGISTRY_URL
            any:
              - kind: string
              - kind: simple_symbol
              - kind: identifier
`;

function extractGlobalRegistries(root: SgNode): string[] {
  const result: string[] = [];

  for (const m of root.findAll(globalSourcePattern)) {
    const node = m.getMatch('REGISTRY_URL')!;

    if (node.kind() === 'simple_symbol' && node.text() === ':rubygems') {
      result.push('https://rubygems.org');
    }

    if (node.kind() === 'string') {
      const children = namedChildren(node);
      const [child] = children;
      if (children.length === 1 && child.kind() === 'string_content') {
        result.push(child.text());
      }
    }

    if (node.kind() === 'identifier') {
      const resolvedValue = resolveIdentifier(node);
      if (resolvedValue) {
        result.push(resolvedValue);
      }
    }
  }

  return result.reverse();
}

const kvArgsPattern = astGrep.rule`
  rule:
    inside:
      kind: argument_list
      inside:
        kind: call
    kind: pair
    all:
      - has:
          field: key
          pattern: $KEY
      - has:
          field: value
          pattern: $VAL
`;

type KvArgs = Record<string, string | symbol | (string | symbol)[]>;

function extractKvArgs(argsListNode: SgNode): KvArgs {
  const result: KvArgs = {};
  const pairs = astGrep.extractAllMatches(argsListNode, kvArgsPattern, [
    'KEY',
    'VAL',
  ]);

  for (const [keyNode, valNode] of pairs) {
    const key = coerceToString(keyNode);
    if (!key) {
      continue;
    }

    const val = coerceToStringOrSymbol(valNode);
    if (val) {
      result[key] = val;
      continue;
    }

    if (valNode.kind() === 'array') {
      const children = namedChildren(valNode);
      const stringValues = children.map((child) => coerceToString(child));
      if (stringValues.every((value) => value !== null)) {
        result[key] = stringValues;
      }
    }

    if (valNode.kind() === 'identifier') {
      result[key] = Symbol.for(valNode.text());
    }
  }

  return result;
}

const scopedCallPattern = astGrep.rule`
  rule:
    kind: call
    all:
      - has:
          field: method
          pattern: $METHOD
          regex: ^(?:group|source)$
      - has:
          field: arguments
          pattern: $ARGS
      - has:
          field: block
          pattern: $_
`;

function aliasRubygemsSource(input: string): string {
  return input === 'rubygems' ? 'https://rubygems.org' : input;
}

function extractParentBlockData(node: SgNode): [string[], string[]] {
  const depTypes: string[][] = [];
  const registryUrls: string[][] = [];
  const ancestors = node.ancestors();
  for (const ancestor of ancestors) {
    if (ancestor.kind() !== 'call') {
      continue;
    }

    const match = ancestor.find(scopedCallPattern);
    if (!match) {
      continue;
    }

    const method = match.getMatch('METHOD')!.text();
    const args = match.getMatch('ARGS')!;
    if (method === 'group') {
      depTypes.push(
        namedChildren(args)
          .map((arg) => coerceToString(arg))
          .filter(is.truthy),
      );
    }

    if (method === 'source') {
      registryUrls.push(
        namedChildren(args)
          .map((arg) =>
            arg.kind() === 'identifier'
              ? resolveIdentifier(arg)
              : coerceToString(arg),
          )
          .filter(is.truthy)
          .map(aliasRubygemsSource),
      );
    }
  }

  return [depTypes.reverse().flat(), registryUrls.flat()];
}

const stringAssignmentPattern = astGrep.rule`
  rule:
    kind: assignment
    all:
      - has:
          field: left
          pattern: $LEFT
      - has:
          field: right
          pattern: $RIGHT
`;

type StringAssignmentResult =
  | { result: string; error?: undefined }
  | { result?: undefined; error: 'continue' | 'break' };

function matchAssignment(
  node: SgNode,
  variable: string,
): StringAssignmentResult {
  const [left, right] = astGrep.extractMatches(node, stringAssignmentPattern, [
    'LEFT',
    'RIGHT',
  ]);

  const identifier = coerceToString(left);
  if (identifier !== variable) {
    return { error: 'continue' };
  }

  const result = extractPlainString(right);
  if (!result) {
    return { error: 'break' };
  }

  return { result };
}

function resolveIdentifier(node: SgNode, variable?: string): string | null {
  const identifier = variable ?? node.text();
  let cursor = astGrep.recede(node);
  while (cursor) {
    if (!cursor.isNamed()) {
      cursor = astGrep.recede(cursor);
      continue;
    }

    const { result, error } = matchAssignment(cursor, identifier);

    if (result) {
      return result;
    }

    if (error === 'break') {
      return null;
    }

    cursor = astGrep.recede(cursor);
  }

  return null;
}

const gemDefPattern = astGrep.rule`
  utils:
    string-or-symbol:
      any:
        - kind: simple_symbol
        - kind: string
  rule:
    kind: call
    all:
      - has:
          field: method
          regex: ^gem$
      - has:
          field: arguments
          pattern: $ARGS
          has:
            matches: string-or-symbol
            pattern: $DEP_NAME
            nthChild: 1
`;

export async function parseGemfile(
  content: string,
): Promise<PackageFileContent | null> {
  const deps: PackageDependency[] = [];

  const ast = await parseAsync('ruby', content);
  const astRoot = ast.root();

  const rubyDep = extractRubyVersion(astRoot);
  if (rubyDep) {
    deps.push(rubyDep);
  }

  const globalRegistryUrls = extractGlobalRegistries(astRoot);

  for (const gemDef of astRoot.findAll(gemDefPattern)) {
    const depNameData = extractDepNameData(gemDef);
    const versionData = extractVersionData(gemDef);

    const dep: PackageDependency = {
      datasource: 'rubygems',
      ...depNameData,
      ...versionData,
    };

    const [blockDepTypes, registryUrls] = extractParentBlockData(gemDef);

    const kvArgs = extractKvArgs(gemDef);

    // Check for path argument (local gems)
    const { path } = kvArgs;
    if (is.string(path)) {
      dep.skipReason = 'internal-package';
      deps.push(dep);
      continue;
    }

    const { git, github, ref, tag, branch } = kvArgs;
    if (is.string(git) || is.string(github)) {
      dep.datasource = 'git-refs';
      delete dep.skipReason;

      if (is.string(git)) {
        dep.packageName = git;
        dep.sourceUrl = git;
      } else if (is.string(github)) {
        const fullUrl = `https://github.com/${github}`;
        dep.packageName = fullUrl;
        dep.sourceUrl = fullUrl;
      }

      if (is.string(ref)) {
        dep.currentDigest = ref;
        delete dep.currentValue;
      } else if (is.string(tag)) {
        dep.currentValue = tag;
      } else if (is.string(branch)) {
        dep.currentValue = branch;
      }

      deps.push(dep);
      continue;
    }

    const groupData = kvArgs.group;
    let depTypes: string[] = [...blockDepTypes];
    if (is.string(groupData)) {
      depTypes.push(groupData);
    } else if (is.array(groupData, is.string)) {
      depTypes.push(...groupData);
    }
    depTypes = uniq(depTypes);
    if (depTypes.length === 1) {
      dep.depType = depTypes[0];
    } else if (depTypes.length > 1) {
      Object.assign(dep, { depTypes });
    }

    const localRegistryUrl = kvArgs.source;
    if (is.string(localRegistryUrl)) {
      registryUrls.unshift(aliasRubygemsSource(localRegistryUrl));
    } else if (is.symbol(localRegistryUrl)) {
      const resolvedValue = resolveIdentifier(
        gemDef,
        localRegistryUrl.description,
      );
      if (resolvedValue) {
        registryUrls.unshift(resolvedValue);
      }
    }
    if (registryUrls.length !== 0) {
      dep.registryUrls = uniq(registryUrls);
    } else if (globalRegistryUrls.length === 0) {
      dep.skipReason ??= 'unknown-registry';
    }

    deps.push(dep);
  }

  if (!deps.length) {
    return null;
  }

  const res: PackageFileContent = { deps };

  if (globalRegistryUrls.length) {
    res.registryUrls = globalRegistryUrls;
  }

  return res;
}
