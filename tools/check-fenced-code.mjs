import fs from 'fs-extra';
import { glob } from 'glob';
import MarkdownIt from 'markdown-it';

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
      console.log(
        `::error file=${file},line=${start},endLine=${end},title=${errorTitle}::${err.message}. ${errorBody}`,
      );
    } else {
      console.log(
        `${errorTitle} (${file} lines ${start}-${end}): ${err.message}`,
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

await (async () => {
  const files = await glob(markdownGlob);

  for (const file of files) {
    await processFile(file);
  }

  if (issues) {
    console.error(
      `${issues} issues found. ${errorBody} See above for lines affected.`,
    );
    process.exit(1);
  }
})();
