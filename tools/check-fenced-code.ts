import fs from 'fs-extra';
import { glob } from 'glob';
import type { Token } from 'markdown-it';
import MarkdownIt from 'markdown-it';

const errorTitle = 'Invalid JSON in fenced code block';
const errorBody =
  'Fix this manually by ensuring each block is a valid, complete JSON document.';
const markdownGlob = '{docs,lib}/**/*.md';
const markdown = new MarkdownIt('zero');

let issues = 0;

markdown.enable(['fence']);

function checkValidJson(file: string, token: Token): void {
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

async function processFile(file: string): Promise<void> {
  const text = await fs.readFile(file, 'utf8');
  const tokens = markdown.parse(text, undefined);

  tokens.forEach((token) => {
    if (token.type === 'fence' && token.info === 'json') {
      checkValidJson(file, token);
    }
  });
}

void (async () => {
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
