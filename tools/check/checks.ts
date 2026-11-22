import { stat } from 'node:fs/promises';
import { posix as path } from 'node:path';
import { type Result, execa } from 'execa';
import { escape } from 'minimatch';
import { type Checkout, regularFiles } from './checkout.ts';
import { compileGlob } from './glob.ts';
import { runCheck } from './tui.ts';

function matching(...patterns: string[]): (file: string) => boolean {
  const globs = patterns.map(compileGlob);
  return (file) => globs.some((glob) => glob.match(file));
}

function affectedFiles(
  { changes, files }: Checkout,
  policy: (file: string) => boolean,
): string[] {
  const directories = changes.filter(policy).map((file) => path.dirname(file));
  if (directories.includes('.')) {
    return [...files];
  }

  const affected = new Set(changes);
  for (const directory of directories) {
    for (const file of files) {
      if (file.startsWith(`${directory}/`)) {
        affected.add(file);
      }
    }
  }

  return [...affected.intersection(files)];
}

const toolchain = matching(
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'patches/**/*.patch',
  'mise.toml',
  '.nvmrc',
  '.npmrc',
  '.pnpmfile.{cjs,mjs}',
);
const formatFile = matching('**/*.{ts,js,mjs,json,md,yml}');
const formatPolicy = matching(
  '**/{.editorconfig,.gitignore,.prettierignore,.prettierrc*,prettier.config.*}',
);
const markdownFile = matching('**/*.md');
const prettierPlugin = 'tools/prettier/plugins/mkdocs-admonitions/index.mjs';

async function formatArgs(checkout: Checkout): Promise<string[]> {
  const pluginChanged = checkout.changes.some(
    (file) => file === prettierPlugin,
  );
  const candidates = checkout.changes.some(toolchain)
    ? [...checkout.files]
    : affectedFiles(checkout, formatPolicy);
  const files = new Set(candidates.filter(formatFile));
  if (pluginChanged) {
    for (const file of [...checkout.files].filter(markdownFile)) {
      files.add(file);
    }
  }

  const paths = await regularFiles([...files]);
  if (paths.length === 0) {
    return [];
  }

  const cache = pluginChanged
    ? ['--no-cache']
    : ['--cache', '--cache-location', '.cache/prettier-check'];
  return [
    '--experimental-cli',
    '--write',
    ...cache,
    '--',
    ...paths.map(fileArg),
  ];
}

function fileArg(file: string): string {
  return `./${file}`;
}

function markdownArg(file: string): string {
  const input = fileArg(file);
  return input.includes('\\')
    ? `:${input}`
    : escape(input).replaceAll('{', '[{]').replaceAll('}', '[}]');
}

const typeInput = matching(
  '**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx,json}',
  'data/**',
  'lib/modules/manager/**/*.snap',
);
const modulePath = matching('lib/modules/{manager,datasource,versioning}/**');
const runtimeInput = matching('lib/**/*.{ts,mts,cts,js,mjs,cjs,json}');
const nonRuntime = matching('**/*.spec.{ts,mjs}', '**/__fixtures__/**');
const runtimeSetup = matching(
  'data/**',
  'package.json',
  'tools/generate-imports.mjs',
  'tools/utils/hash.mjs',
);
const schemaInput = matching(
  'tools/{generate-schema,validate-schema}.ts',
  'tools/docs/{schema,utils}.ts',
  'tools/utils/index.ts',
  'tools/schemas/*.json',
  'docs/usage/{configuration-options,self-hosted-configuration}.md',
  '{.editorconfig,.gitignore,.prettierignore,.prettierrc*,prettier.config.*}',
);
const oxlintInput = matching(
  'tools/lint/**',
  '**/{.oxlintrc*,oxlint.config.*,.eslintignore,.gitignore,.ignore}',
  '**/*.{vue,svelte,astro,html,htm,mdx}',
);
const docsImages = 'docs/**/*.{png,jpg,jpeg,gif,webp}';
const biomeEditIgnored = matching(docsImages, '**/__fixtures__/**/*.{txt,xml}');
const knipEditIgnored = matching('**/*.md', docsImages);
const lintedName = matching('**/*.{js,md,ts}');
const markdownPolicy = matching('**/.markdownlint*');
const docsMarkdown = matching('{docs,lib}/**/*.md');
const proseFile = matching('**/*.{md,ts}');
const valePolicy = matching('.vale.ini', '.vale/**', 'mise.toml');

function runtimeFile(file: string): boolean {
  return runtimeInput(file) && !nonRuntime(file);
}

const execute = execa({ all: true, reject: false });

async function runVale(files: string[]): Promise<Result> {
  const grammar = await stat(
    '.vale/styles/config/grammars/typescript.wasm',
  ).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  });
  if (!grammar?.size) {
    const sync = await execute('vale', ['sync']);
    if (sync.failed) {
      return sync;
    }
  }

  return await execute('vale', ['--output=line', ...files.map(fileArg)]);
}

export async function runChecks(
  readCheckout: () => Promise<Checkout>,
): Promise<string[]> {
  const failures: string[] = [];
  async function stage(
    name: string,
    run: () => Promise<Result>,
  ): Promise<void> {
    if (!(await runCheck(name, run))) {
      failures.push(name);
    }
  }

  async function check(
    name: string,
    command: string,
    ...args: string[]
  ): Promise<void> {
    await stage(name, () => execute(command, args));
  }

  let checkout = await readCheckout();
  const format = await formatArgs(checkout);
  if (format.length > 0) {
    await check('Format', 'prettier', ...format);
    checkout = await readCheckout();
  }

  const { changes, files, tracked, changedNames, typeChanges } = checkout;
  const names = changedNames.union(typeChanges);
  const toolsChanged = changes.some(toolchain);
  const modulesChanged = [...names].some(modulePath);
  const runtimeChanged =
    toolsChanged ||
    modulesChanged ||
    changes.some(runtimeSetup) ||
    changes.some(runtimeFile);
  const typedInputsChanged =
    toolsChanged || modulesChanged || changes.some(typeInput);

  if (typedInputsChanged) {
    await check('Type check', 'node', '--run', 'type-check:tsrs');
  }

  if (runtimeChanged || changes.some(schemaInput)) {
    await check('JSON schema', 'node', '--run', 'test-schema');
  }

  if (typedInputsChanged || changes.some(oxlintInput)) {
    await check('Oxlint', 'node', '--run', 'oxlint');
  }

  if (names.size > 0 || changes.some((file) => !biomeEditIgnored(file))) {
    await check('Biome', 'node', '--run', 'biome');
  }

  const fileNames =
    toolsChanged || changes.includes('.ls-lint.yml')
      ? [...files]
      : [...names.intersection(files)].filter(lintedName);
  if (fileNames.length > 0) {
    await check('File names', 'ls-lint', ...fileNames.map(fileArg));
  }

  const markdown = new Set(
    toolsChanged
      ? [...files].filter(markdownFile)
      : affectedFiles(checkout, markdownPolicy).filter(markdownFile),
  );
  if (changes.includes('tools/lint/markdown-anchor.mjs')) {
    for (const file of [...files].filter(docsMarkdown)) {
      markdown.add(file);
    }
  }

  const documents = await regularFiles([...markdown]);
  if (documents.length > 0) {
    await check(
      'Markdown',
      'markdownlint-cli2',
      '--no-globs',
      ...documents.map(markdownArg),
    );
  }

  if (changes.some(valePolicy)) {
    await check('Prose', 'pnpm', 'lint-prose');
  } else {
    const prose = await regularFiles(
      changes.filter(
        (file) => tracked.has(file) && files.has(file) && proseFile(file),
      ),
    );
    if (prose.length > 0) {
      await stage('Prose', () => runVale(prose));
    }
  }

  const examplePaths =
    runtimeChanged || changes.includes('tools/check-fenced-code.ts')
      ? [...files]
      : changes.filter((file) => files.has(file));
  const examples = await regularFiles(examplePaths.filter(docsMarkdown));
  if (examples.length > 0) {
    await check(
      'Code examples',
      process.execPath,
      'tools/check-fenced-code.ts',
      ...examples,
    );
  }

  if (names.size > 0 || changes.some((file) => !knipEditIgnored(file))) {
    await check(
      'Knip',
      'node',
      '--run',
      'knip',
      '--',
      '--cache',
      '--cache-location',
      '.cache/knip-check',
    );
  }

  return failures;
}
