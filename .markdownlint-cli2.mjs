/* eslint-disable */
const ci = !!process.env.CI;

export default {
  // Disable some built-in rules
  config: {
    'no-emphasis-as-heading': false,
    'fenced-code-language': false,
    'first-line-heading': false,
    'line-length': false,
    'no-emphasis-as-header': false,
    'no-inline-html': false,
    'single-h1': false,
    'table-column-style': {
      style: 'aligned',
    },
  },

  ...(ci && {
    outputFormatters: [
      [
        'markdownlint-cli2-formatter-template',
        {
          template:
            '::${errorSeverity:${errorSeverity}}${errorSeverity!error} file=${fileName},line=${lineNumber},${columnNumber:col=${columnNumber},}title=${ruleName}::${ruleDescription}',
        },
      ],
    ],
  }),

  // Define glob expressions to use (only valid at root)
  globs: ['**/*.md'],

  // Define glob expressions to ignore
  ignores: [
    '**/__fixtures__/*',
    '**/node_modules/**',
    'tmp/**',
    '**/.cache/**',
    '.venv/**',
    'tools/mkdocs/docs/**',
    'tools/mkdocs/site/**',
  ],
};
