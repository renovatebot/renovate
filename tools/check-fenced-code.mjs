import { promisify } from 'util';
import fs from 'fs-extra';
import g from 'glob';
import MarkdownIt from 'markdown-it';
import shell from 'shelljs';

const glob = promisify(g);

const errorTitle = 'Invalid JSON in fenced code block';
const errorBody =
  'Fix this manually by ensuring each block is a valid, complete JSON document.';
const markdownGlob = '{docs,lib}/**/*.md';
const markdown = new MarkdownIt('zero');

let issues = 0;

markdown.enable(['fence']);

/**
 *
 * @param {string} file
 * @param {import('markdown-it/lib/token')} token
 */
function checkValidJson(file, token) {
  const start = token.map ? token.map[0] + 1 : 0;
  const end = token.map ? token.map[1] + 1 : 0;

  try {
    JSON.parse(token.content);
  } catch (err) {
    issues += 1;
    if (process.env.CI) {
      shell.echo(
        `::error file=${file},line=${start},endLine=${end},title=${errorTitle}::${err.message}. ${errorBody}`
      );
    } else {
      shell.echo(
        `${errorTitle} (${file} lines ${start}-${end}): ${err.message}`
      );
    }
  }
}

/**
 *
 * @param {string} file
 */
async function processFile(file) {
  const text = await fs.readFile(file, 'utf8');
  const tokens = markdown.parse(text, undefined);

  tokens.forEach((token) => {
    if (token.type === 'fence' && token.info === 'json') {
      checkValidJson(file, token);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const files = await glob(markdownGlob);

  for (const file of files) {
    await processFile(file);
  }

  if (issues) {
    shell.echo(
      `${issues} issues found. ${errorBody} See above for lines affected.`
    );
    shell.exit(1);
  }
})();
