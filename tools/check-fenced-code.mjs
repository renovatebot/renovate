import fs from 'fs-extra';
import glob from 'glob';
import MarkdownIt from 'markdown-it';
import shell from 'shelljs';

const errorTitle = 'Invalid JSON in fenced code block';
const markdownGlob = 'docs/**/*.md';
const markdown = new MarkdownIt('zero');

let issues = 0;

markdown.enable(['fence']);

function checkValidJson(file, token) {
  const start = parseInt(token.map[0], 10) + 1;
  const end = parseInt(token.map[1], 10) + 1;

  try {
    JSON.parse(token.content);
  } catch (err) {
    issues += 1;
    if (process.env.CI) {
      shell.echo(
        `::error file=${file},line=${start},endLine=${end},title=${errorTitle}::${err.message}`
      );
    } else {
      shell.echo(
        `${errorTitle} (${file} lines ${start}-${end}): ${err.message}`
      );
    }
  }
}

function processFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const tokens = markdown.parse(text, undefined);
  shell.echo(`Linting ${file}..`);

  tokens.forEach((token) => {
    if (token.type === 'fence' && token.info === 'json') {
      checkValidJson(file, token);
    }
  });
}

glob(markdownGlob, (err, files) => {
  files.forEach((file) => {
    processFile(file);
  });
  if (issues) {
    shell.echo(`${issues} issues found.`);
    shell.exit(1);
  }
});
