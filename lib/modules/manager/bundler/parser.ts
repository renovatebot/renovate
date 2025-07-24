import ruby from '@ast-grep/lang-ruby';
import type { NapiConfig, SgNode } from '@ast-grep/napi';
import { parseAsync, registerDynamicLanguage } from '@ast-grep/napi';
import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { uniq } from '../../../util/uniq';
import { parseSingleYaml } from '../../../util/yaml';
import type { PackageDependency } from '../types';

registerDynamicLanguage({ ruby });

function namedChildren(node: SgNode): SgNode[] {
  return node.children().filter((child) => child.isNamed());
}

const gemArgListPattern = parseSingleYaml<NapiConfig>(`
utils:
  string-like:
    any:
      - kind: simple_symbol
      - kind: string
  gem-name:
    pattern: $DEP_NAME
    matches: string-like
    nthChild: 1
rule:
  kind: argument_list
  inside:
    pattern: gem $$$
    stopBy: neighbor
  has:
    matches: gem-name
`);

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

const versionArgumentPattern = parseSingleYaml<NapiConfig>(`
utils:
  version-like:
    any:
      - kind: string
      - kind: float
      - kind: integer
    pattern: $VERSION
    nthChild: 2
rule:
  kind: argument_list
  inside:
    pattern: gem $$$
    stopBy: neighbor
  has:
    matches: version-like
`);

function extractVersionData(
  gemArgList: SgNode,
): Pick<PackageDependency, 'currentValue' | 'skipReason'> {
  const node = gemArgList.find(versionArgumentPattern)?.getMatch('VERSION');

  if (!node) {
    return { skipReason: 'unspecified-version' };
  }

  if (node.kind() === 'float' || node.kind() === 'integer') {
    return { currentValue: node.text() };
  }

  const children = namedChildren(node);
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

  if (child.kind() === 'string_content') {
    if (currentValue.trim().startsWith('>')) {
      const secondPart = namedChildren(gemArgList)[2];
      if (secondPart?.kind() === 'string' && extractStringValue(node)) {
        const offset = gemArgList.range().start.index;
        const start = node.range().start.index - offset;
        const end = secondPart.range().end.index - offset;
        return {
          currentValue: gemArgList.text().slice(start, end),
        };
      }
    }

    return { currentValue };
  }

  return { skipReason: 'unsupported-version' };
}

const rubyVersionPattern = parseSingleYaml<NapiConfig>(`
utils:
  ruby-version-call:
    inside:
      kind: program
    kind: call
    pattern: ruby $$$
  ruby-version-args:
    inside:
      matches: ruby-version-call
    kind: argument_list
  ruby-version-string:
    kind: string
  ruby-version-symbol:
    kind: simple_symbol
rule:
  inside:
    matches: ruby-version-args
  nthChild: 1
  any:
    - matches: ruby-version-string
    - matches: ruby-version-symbol
`);

function extractRubyVersion(root: SgNode): PackageDependency | null {
  const node = root.find(rubyVersionPattern);
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

const sourceCallPattern = parseSingleYaml<NapiConfig>(`
utils:
  source-call:
    inside:
      kind: program
    kind: call
    pattern: source $$$
    not:
      has:
        kind: do_block
  source-call-args:
    inside:
      matches: source-call
    kind: argument_list
  source-string:
    kind: string
  source-symbol:
    kind: simple_symbol
rule:
  inside:
    matches: source-call-args
  nthChild: 1
  any:
    - matches: source-string
    - matches: source-symbol
`);

function extractGlobalRegistries(root: SgNode): string[] {
  const result: string[] = [];
  const nodes = root.findAll(sourceCallPattern);

  for (const node of nodes) {
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

const kvArgsPattern = parseSingleYaml<NapiConfig>(`
utils:
  key:
    pattern: $KEY
    nthChild: 1
  val:
    pattern: $VAL
    nthChild: 2
rule:
  inside:
    kind: argument_list
  kind: pair
  all:
    - has:
        matches: key
    - has:
        matches: val
`);

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

  if (node.kind() === 'string') {
    const children = namedChildren(node);
    if (children.length === 1 && children[0].kind() === 'string_content') {
      return children[0].text();
    }
    return null;
  }

  if (node.kind() === 'float' || node.kind() === 'integer') {
    return node.text();
  }

  return null;
}

function extractKvArgs(
  argsListNode: SgNode,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const pairs = argsListNode.findAll(kvArgsPattern);

  for (const pair of pairs) {
    const keyNode = pair.getMatch('KEY')!;
    const valNode = pair.getMatch('VAL')!;

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

const scopedCallPattern = parseSingleYaml<NapiConfig>(`
rule:
  kind: call
  all:
    - has:
        field: method
        pattern: $METHOD
        regex: group|source
    - has:
        field: arguments
        pattern: $ARGS
    - has:
        field: block
        pattern: $$$
`);

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

export async function parseGemfile(
  content: string,
): Promise<PackageDependency[]> {
  const result: PackageDependency[] = [];

  const ast = await parseAsync('ruby', content);
  const root = ast.root();

  const rubyDep = extractRubyVersion(root);
  if (rubyDep) {
    result.push(rubyDep);
  }

  const globalRegistryUrls = extractGlobalRegistries(root);

  const gemNodes = root.findAll(gemArgListPattern);
  for (const argList of gemNodes) {
    const depNameData = extractDepNameData(argList);
    const versionData = extractVersionData(argList);

    const dep: PackageDependency = {
      datasource: 'rubygems',
      ...depNameData,
      ...versionData,
    };

    const [blockDepTypes, blockRegistryUrls] = extractParentBlockData(argList);

    const kvArgs = extractKvArgs(argList);

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
