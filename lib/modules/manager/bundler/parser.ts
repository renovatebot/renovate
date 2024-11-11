import type { SyntaxNode } from 'tree-sitter';
import Parser, { Query } from 'tree-sitter';
import type {
  ArgumentListNode,
  CallNode,
  IdentifierNode,
} from 'tree-sitter-ruby';
import Ruby from 'tree-sitter-ruby';
import { uniq } from '../../../util/uniq';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import type { PackageDependency } from '../types';

const gemStatement = `
(call
  method:
    (identifier) @gem-method (#eq? @gem-method "gem")

  arguments:
    (argument_list
      .
      (string
        .
        (string_content) @depName
        .
      )
      .
      [
        (string
          (string_content) @currentValue
        )
        (float) @currentValue
        (integer) @currentValue
      ]?
    ) @gem-args
) @gem-call
`.trim();

const gemQuery = new Query(Ruby, gemStatement);

const globalSourceStatement = `
(program
  .
  (_)*
  (call
    method: (identifier) @source-id (#eq? @source-id "source")
    arguments:
      (argument_list
        .
        [
          (string)
          (simple_symbol)
        ] @source
        .
      )
    !block
  )
)
`.trim();

const globalSourceQuery = new Query(Ruby, globalSourceStatement);

const rubyVersionStatement = `
(program
  .
  (_)*
  (call
    method: (identifier) @ruby-id (#eq? @ruby-id "ruby")
    arguments:
      (argument_list
        .
        (string
          .
          (string_content) @ruby-version
          .
        )
        .
      )
  )
)
`.trim();

const rubyVersionQuery = new Query(Ruby, rubyVersionStatement);

const parser = new Parser();
parser.setLanguage(Ruby);

function extractSymValue(input: SyntaxNode): string {
  return input.text.replace(/^:/, '');
}

function extractStrValue(input: SyntaxNode): string | undefined {
  const stringContent = input.children.find(
    ({ type }) => type === 'string_content',
  );
  return stringContent?.text;
}

function extractChildStrings(node: SyntaxNode): string[] {
  const res: string[] = [];
  for (const child of node.children) {
    if (child.type === 'simple_symbol') {
      res.push(extractSymValue(child));
    }

    if (child.type === 'string') {
      const stringValue = extractStrValue(child);
      if (stringValue) {
        res.push(stringValue);
      }
    }
  }

  return res;
}

function isCallNode(node: SyntaxNode): node is CallNode {
  return node.type === 'call';
}

function isIdentifierNode(node: SyntaxNode): node is IdentifierNode {
  return node.type === 'identifier';
}

function isArgumentListNode(node: SyntaxNode): node is ArgumentListNode {
  return node.type === 'argument_list';
}

function extractStringArgs(node: CallNode): string[] {
  // istanbul ignore if: should never happen
  if (!node.argumentsNode || !isArgumentListNode(node.argumentsNode)) {
    return [];
  }

  return extractChildStrings(node.argumentsNode);
}

function extractRegistry(node: SyntaxNode): string | undefined {
  if (node.type === 'string') {
    const source = extractStrValue(node);
    if (source) {
      return source;
    }
  } else if (node.type === 'simple_symbol') {
    const sym = extractSymValue(node);

    if (sym === 'rubygems') {
      return 'https://rubygems.org';
    }
  }

  return undefined;
}

function extractWeirdVersion(
  content: string,
  args: SyntaxNode[],
): string | null {
  const [, , second, , third] = args;
  if (second?.type === 'string' && third?.type === 'string') {
    const startIndex = second.startIndex;
    const endIndex = third.endIndex;
    return content.slice(startIndex, endIndex);
  }

  return null;
}

export function parseGemfile(content: string): PackageDependency[] {
  const tree = parser.parse(content);

  const deps: PackageDependency[] = [];

  for (const rubyVersionMatch of rubyVersionQuery.matches(tree.rootNode)) {
    for (const { name, node } of rubyVersionMatch.captures) {
      if (name === 'ruby-version') {
        deps.push({
          datasource: RubyVersionDatasource.id,
          depName: 'ruby',
          currentValue: node.text,
        });
      }
    }
  }

  const globalSources: string[] = [];
  for (const sourceMatch of globalSourceQuery.matches(tree.rootNode)) {
    for (const { name, node } of sourceMatch.captures) {
      if (name === 'source') {
        const source = extractRegistry(node);
        if (source) {
          globalSources.unshift(source);
        }
      }
    }
  }

  const cachedGroups: WeakMap<SyntaxNode, string[]> = new WeakMap();
  const cachedSources: WeakMap<SyntaxNode, string> = new WeakMap();
  let weirdVersion: string | null = null;
  for (const gemMatch of gemQuery.matches(tree.rootNode)) {
    const dep: PackageDependency = {
      datasource: 'rubygems',
    };
    const depTypes: string[] = [];
    const blockSources = [];
    let gemSources: string[] = [];

    for (const { name, node } of gemMatch.captures) {
      if (name === 'depName') {
        dep.depName = node.text;
        continue;
      }

      if (name === 'currentValue') {
        dep.currentValue = node.text;
        continue;
      }

      if (name === 'gem-args') {
        weirdVersion = extractWeirdVersion(content, node.children);

        for (const arg of node.children) {
          if (arg.type === 'pair') {
            const keyNode = arg.firstChild!;
            const key = extractSymValue(keyNode);
            if (key === 'group') {
              const valNode = arg.lastChild!;

              if (valNode.type === 'string') {
                const group = extractStrValue(valNode);
                if (group) {
                  depTypes.push(group);
                }
              }

              if (valNode.type === 'simple_symbol') {
                depTypes.push(extractSymValue(valNode));
              }

              if (valNode.type === 'array') {
                depTypes.push(...extractChildStrings(valNode));
              }
            }

            if (key === 'source') {
              const node = arg.lastChild!;
              const source = extractRegistry(node);
              if (source) {
                gemSources = [source];
              }
            }
          }
        }
      }

      if (name === 'gem-call') {
        let parent = node.parent;
        while (parent) {
          if (isCallNode(parent)) {
            // istanbul ignore if: should never happen
            if (!isIdentifierNode(parent.methodNode)) {
              continue;
            }

            if (parent.methodNode.text === 'group') {
              let groups: string[] | undefined;
              if (cachedGroups.has(parent)) {
                groups = cachedGroups.get(parent);
              } else {
                groups = extractStringArgs(parent);
                cachedGroups.set(parent, groups);
              }

              if (groups?.length) {
                depTypes.unshift(...groups);
              }
            }

            if (parent.methodNode.text === 'source' && parent.argumentsNode) {
              let source: string | undefined;
              if (cachedSources.has(parent)) {
                source = cachedSources.get(parent);
              } else {
                const firstArg = parent.argumentsNode.children[0];
                source = extractRegistry(firstArg);
              }

              if (source) {
                cachedSources.set(parent, source);
                blockSources.push(source);
              }
            }
          }

          parent = parent.parent;
        }
      }
    }

    if (weirdVersion) {
      dep.currentValue = weirdVersion;
    }

    if (!dep.currentValue) {
      dep.skipReason = 'unspecified-version';
    }

    if (depTypes.length === 1) {
      dep.depType = depTypes[0];
    } else if (depTypes.length > 1) {
      Object.assign(dep, { depTypes: uniq(depTypes) });
    }

    const registryUrls = uniq([
      ...gemSources,
      ...blockSources,
      ...globalSources,
    ]);
    if (registryUrls.length) {
      dep.registryUrls = uniq(registryUrls);
    } else {
      dep.skipReason = 'unknown-registry';
    }

    deps.push(dep);
  }

  return deps;
}
