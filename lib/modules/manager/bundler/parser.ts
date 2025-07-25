import ruby from '@ast-grep/lang-ruby';
import type { SgNode } from '@ast-grep/napi';
import { parseAsync, registerDynamicLanguage } from '@ast-grep/napi';
import is from '@sindresorhus/is';
import * as astGrep from '../../../util/ast-grep';
import { regEx } from '../../../util/regex';
import { uniq } from '../../../util/uniq';
import type { PackageDependency } from '../types';

registerDynamicLanguage({ ruby });

function namedChildren(node: SgNode): SgNode[] {
  return node.children().filter((child) => child.isNamed());
}

function extractDepNameData(
  gemArgList: SgNode,
): Pick<PackageDependency, 'depName' | 'skipReason'> {
  const node = gemArgList.getMatch('DEP_NAME');
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
  gemArgList: SgNode,
): Pick<PackageDependency, 'currentValue' | 'skipReason'> {
  const doubleRangeMatch = astGrep.extractMatches(
    gemArgList,
    gemDoubleRangePattern,
    ['LOWER', 'HIGHER'],
  );
  const [lowerStr, higherStr] = doubleRangeMatch.map(extractPlainString);
  if (lowerStr?.trim().startsWith('>') && higherStr) {
    const [lower, higher] = doubleRangeMatch;
    const offset = gemArgList.range().start.index;
    const start = lower.range().start.index - offset;
    const end = higher.range().end.index - offset;
    return { currentValue: gemArgList.text().slice(start, end) };
  }

  const [versionNode] = astGrep.extractMatches(
    gemArgList,
    gemSingularVersionPattern,
    ['VERSION'],
  );

  if (!versionNode) {
    return { skipReason: 'unspecified-version' };
  }

  if (versionNode.kind() === 'float' || versionNode.kind() === 'integer') {
    return { currentValue: versionNode.text() };
  }

  const children = namedChildren(versionNode);
  if (children.length === 0) {
    return { currentValue: '', skipReason: 'empty' };
  }

  if (children.length > 1) {
    return {
      currentValue: children.map((child) => child.text()).join(''),
      skipReason: 'version-placeholder',
    };
  }

  const [child] = children;
  const currentValue = child.text();

  if (child.kind() === 'interpolation') {
    return { currentValue, skipReason: 'version-placeholder' };
  }

  if (child.kind() !== 'string_content') {
    return { skipReason: 'unsupported-version' };
  }

  return { currentValue };
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

  if (node.kind() === 'string') {
    const children = namedChildren(node);
    if (children.length === 0) {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue: '',
        skipReason: 'empty',
      };
    }

    if (children.length > 1) {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue: children.map((child) => child.text()).join(''),
        skipReason: 'version-placeholder',
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
      };
    }

    if (child.kind() === 'string_content') {
      return {
        depName: 'ruby',
        datasource: 'ruby-version',
        currentValue,
      };
    }
  }

  if (node.kind() === 'simple_symbol') {
    return {
      depName: 'ruby',
      datasource: 'ruby-version',
      currentValue: node.text(),
      skipReason: 'not-a-version',
    };
  }

  return {
    depName: 'ruby',
    datasource: 'ruby-version',
    currentValue: node.text(),
    skipReason: 'unsupported-version',
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

function extractPlainString(node: SgNode | null): string | null {
  if (node?.kind() === 'string') {
    const children = namedChildren(node);
    if (children.length === 1 && children[0].kind() === 'string_content') {
      return children[0].text();
    }
  }

  return null;
}

function extractStringValue(node: SgNode | null): string | null {
  if (!node) {
    return null;
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

function extractKvArgs(
  argsListNode: SgNode,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const pairs = astGrep.extractAllMatches(argsListNode, kvArgsPattern, [
    'KEY',
    'VAL',
  ]);

  for (const [keyNode, valNode] of pairs) {
    const key = extractStringValue(keyNode);
    if (!key) {
      continue;
    }

    const val = extractStringValue(valNode);
    if (val) {
      result[key] = val;
      continue;
    }

    if (valNode.kind() === 'array') {
      const children = namedChildren(valNode);
      const stringValues = children.map((child) => extractStringValue(child));
      if (stringValues.every((value) => value !== null)) {
        result[key] = stringValues;
      }
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
          .map((arg) => extractStringValue(arg))
          .filter(is.truthy),
      );
    }

    if (method === 'source') {
      registryUrls.push(
        namedChildren(args)
          .map((arg) => extractStringValue(arg))
          .filter(is.truthy)
          .map(aliasRubygemsSource),
      );
    }
  }

  return [depTypes.reverse().flat(), registryUrls.flat()];
}

const gemArgListPattern = astGrep.rule`
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
): Promise<PackageDependency[]> {
  const result: PackageDependency[] = [];

  const ast = await parseAsync('ruby', content);
  const astRoot = ast.root();

  const rubyDep = extractRubyVersion(astRoot);
  if (rubyDep) {
    result.push(rubyDep);
  }

  const globalRegistryUrls = extractGlobalRegistries(astRoot);

  for (const argList of astRoot.findAll(gemArgListPattern)) {
    const depNameData = extractDepNameData(argList);
    const versionData = extractVersionData(argList);

    const dep: PackageDependency = {
      datasource: 'rubygems',
      ...depNameData,
      ...versionData,
    };

    const [blockDepTypes, blockRegistryUrls] = extractParentBlockData(argList);

    const kvArgs = extractKvArgs(argList);

    // Check for path argument (local gems)
    const { path } = kvArgs;
    if (is.string(path)) {
      dep.skipReason = 'internal-package';
      result.push(dep);
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

      result.push(dep);
      continue;
    }

    const groupData = kvArgs.group;
    let depTypes: string[] = [...blockDepTypes];
    if (is.string(groupData)) {
      depTypes.push(groupData);
    } else if (is.array(groupData)) {
      depTypes.push(...groupData);
    }
    depTypes = uniq(depTypes);
    if (depTypes.length === 1) {
      dep.depType = depTypes[0];
    } else if (depTypes.length > 1) {
      Object.assign(dep, { depTypes });
    }

    const registryUrls = uniq([...blockRegistryUrls, ...globalRegistryUrls]);
    const localRegistryUrl = kvArgs.source;
    if (is.string(localRegistryUrl)) {
      registryUrls.unshift(aliasRubygemsSource(localRegistryUrl));
    }

    if (registryUrls.length) {
      dep.registryUrls = registryUrls;
    } else {
      dep.skipReason ??= 'unknown-registry';
    }

    result.push(dep);
  }

  return result;
}
