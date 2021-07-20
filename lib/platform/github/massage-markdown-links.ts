import findAndReplace from 'mdast-util-find-and-replace';
import remark from 'remark';
import type { Plugin, Transformer } from 'unified';
// eslint-disable-next-line import/no-unresolved
import type { Node } from 'unist';
import visit from 'unist-util-visit';

const urlRegex =
  /(?:https?:)?(?:\/\/)?(?:www\.)?(?<!api\.)(?:to)?github\.com(?:[/?#][^\s")'.,]*)?/i;

function massageLink(input: string): string {
  return urlRegex.test(input)
    ? input.replace(/(?:to)?github\.com/, 'togithub.com')
    : input;
}

function linkifyText(url: string): Node | boolean {
  const newUrl = massageLink(url);
  if (newUrl !== url) {
    const content = { type: 'text', value: url };
    return {
      type: 'link',
      url: newUrl,
      title: null,
      children: [content],
    } as Node;
  }
  return false;
}

function transformer(tree: Node): void {
  findAndReplace(tree, urlRegex, linkifyText, {
    ignore: ['link', 'linkReference'],
  });
  visit(tree, 'link', (node: any) => {
    if (node?.url) {
      // eslint-disable-next-line no-param-reassign
      node.url = massageLink(node.url);
    }
  });
}

const githubExtra: Plugin<any> = (): Transformer => transformer;

export function massageMarkdownLinks(content: string): string {
  const output = remark().use(githubExtra).processSync(content);
  return output.toString();
}
