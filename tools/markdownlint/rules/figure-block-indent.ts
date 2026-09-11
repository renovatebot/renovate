// MkDocs renders our docs with `tab_length: 2`, set by
// `tools/mkdocs/mkdocs-hooks/markdown-tab-length.py`. Content indented inside a
// `<figure markdown>` block is therefore parsed as an indented code block, so
// images are printed as literal markdown instead of being rendered.

interface MicromarkToken {
  type: string;
  startLine: number;
  endLine: number;
}

interface RuleParams {
  lines: string[];
  parsers: {
    micromark: {
      tokens: MicromarkToken[];
    };
  };
}

type OnError = (error: { lineNumber: number; context: string }) => void;

export default {
  names: ['figure-block-indent'],
  description:
    'Content inside a `<figure markdown>` block must not be indented, otherwise MkDocs renders it as a code block',
  tags: ['renovate', 'html'],
  parser: 'micromark',
  function: (params: RuleParams, onError: OnError): void => {
    const figures = params.parsers.micromark.tokens.filter(
      (token) =>
        token.type === 'htmlFlow' &&
        params.lines[token.startLine - 1].startsWith('<figure markdown'),
    );

    for (const figure of figures) {
      for (
        let lineNumber = figure.startLine + 1;
        lineNumber <= figure.endLine;
        lineNumber += 1
      ) {
        const line = params.lines[lineNumber - 1];
        if (line.startsWith(' ')) {
          onError({ lineNumber, context: line.trim() });
        }
      }
    }
  },
};
