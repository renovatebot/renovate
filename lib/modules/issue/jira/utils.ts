import is from '@sindresorhus/is';
import remark from 'remark';
import github from 'remark-github';
import type {
  AtlassianDocumentContent,
  AtlassianDocumentFormat,
  MarkdownASTNode,
} from './types';

export const StatusCategoryKey = [
  'new',
  'indeterminate',
  'in-progress',
  'done',
] as const;

/**
 * See https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/
 */
export function convertMarkdownToAtlassianDocumentFormat(
  issueBody: string
): AtlassianDocumentFormat {
  const markdownAST = remark().use(github).parse(issueBody) as MarkdownASTNode;
  const atlassianDocumentContent: AtlassianDocumentContent =
    convertMarkdownToAtlassianDocumentContent(markdownAST);

  const atlassianDocumentFormat: AtlassianDocumentFormat = {
    type: 'doc',
    version: 1,
    content: atlassianDocumentContent.content,
  };

  return atlassianDocumentFormat;
}

export function convertAtlassianDocumentFormatToMarkdown(
  description: AtlassianDocumentFormat
): string {
  // const markdown = remark().use(github).process(description);

  /**
   * TODO: This is a naive implementation where we don't try to convert ADF back to markdown,
   * which will result in Jira Issues always being updated
   */
  return '';
}

function convertMarkdownToAtlassianDocumentContent(
  node: MarkdownASTNode,
  parent?: MarkdownASTNode
): AtlassianDocumentContent {
  let content: AtlassianDocumentContent = {};

  switch (node.type) {
    case 'paragraph':
    case 'listItem':
      content = {
        type: node.type,
      };
      break;
    case 'heading':
      content = {
        type: node.type,
        attrs: {
          level: node.depth,
        },
      };
      break;
    case 'text':
      switch (parent?.type) {
        case 'link':
        case 'inlineCode':
        case 'strong':
        case 'emphasis':
          break;
        default:
          content = {
            type: node.type,
            text: node.value,
          };
      }
      break;
    case 'link':
      content = {
        type: 'text',
        text: node.children[0].value,
        marks: [
          {
            type: 'link',
            attrs: {
              href: node.url,
            },
          },
        ],
      };
      break;
    case 'inlineCode':
      content = {
        type: 'text',
        text: node.value,
        marks: [
          {
            type: 'code',
          },
        ],
      };
      break;
    case 'strong':
      content = {
        type: 'text',
        text: node.children[0].value,
        marks: [
          {
            type: 'strong',
          },
        ],
      };
      break;
    case 'emphasis':
      content = {
        type: 'text',
        text: node.children[0].value,
        marks: [
          {
            type: 'em',
          },
        ],
      };
      break;
    case 'list':
      content = {
        type: node.ordered ? 'orderedList' : 'bulletList',
      };
      break;
    default:
  }

  if ('children' in node) {
    const adfContent: AtlassianDocumentContent[] = [];
    for (const childNode of node.children) {
      const childADF = convertMarkdownToAtlassianDocumentContent(
        childNode,
        node
      );
      if (is.nonEmptyObject(childADF)) {
        adfContent.push(
          convertMarkdownToAtlassianDocumentContent(childNode, node)
        );
      }
    }

    if (is.nonEmptyArray(adfContent)) {
      content.content = adfContent;
    }
  }

  return content;
}
