export default {
  names: ['no-slash-before-markdown-anchor'],
  description: 'Use .md# instead of .md/# in Markdown links',
  tags: ['links'],
  /**
   * @param {{ lines: readonly string[] }} params
   * @param {(error: { lineNumber: number, range: [number, number] }) => void} onError
   */
  function(params, onError) {
    for (const [index, line] of params.lines.entries()) {
      const column = line.indexOf('.md/#');
      if (column !== -1) {
        onError({ lineNumber: index + 1, range: [column + 1, 5] });
      }
    }
  },
};
