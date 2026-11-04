// kept separate from `markdown.ts`, so its users (such as `renovate-config-validator`) don't load `remark`

/**
 * Format items as a Markdown list, indenting any further lines of an item.
 */
export function formatMarkdownList(items: string[]): string {
  return items
    .map((item) => {
      const [first, ...rest] = item.split('\n');
      // so the further lines are rendered as part of the item
      const indented = rest.map((line) => (line ? `  ${line}` : line));
      return [`- ${first}`, ...indented].join('\n');
    })
    .join('\n');
}
