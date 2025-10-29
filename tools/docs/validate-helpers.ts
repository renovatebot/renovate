import fs from 'node:fs/promises';
import path from 'node:path';
import handlebars from 'handlebars';
import MarkdownIt from 'markdown-it';

const additionalHandlebarsHelpers = 'Additional Handlebars helpers';

async function getAddedHandlebarsHelpers(): Promise<string[]> {
  const before = new Set(Object.keys(handlebars.helpers ?? {}));
  await import(path.resolve(__dirname, '../../lib/util/template/index'));
  const after = new Set(Object.keys(handlebars.helpers ?? {}));
  return Array.from(after).filter((h) => !before.has(h));
}

async function getDocumentedHandlebarsHelpers(): Promise<string[]> {
  // Read and parse the docs section to collect documented helpers
  const docsPath = path.resolve(__dirname, '../../docs/usage/templates.md');
  const md = await fs.readFile(docsPath, 'utf8');
  const markdown = new MarkdownIt('zero').enable(['heading']);
  const tokens = markdown.parse(md, undefined);

  // Find the start index of the "## Additional Handlebars helpers" section
  let inHelpersSection = false;
  const documented: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'heading_open') {
      continue;
    }

    const inline = tokens[i + 1];
    if (!(inline && inline.type === 'inline')) {
      continue;
    }

    const level = Number(t.tag.slice(1));
    const title = inline.content.trim();
    if (level === 2 && title === additionalHandlebarsHelpers) {
      inHelpersSection = true;
      ++i;
      continue;
    }
    if (level === 3 && inHelpersSection) {
      documented.push(title);
    }
    if (level === 2 && inHelpersSection) {
      break;
    }
  }
  return documented;
}

(async function (): Promise<void> {
  const added = await getAddedHandlebarsHelpers();
  const documented = await getDocumentedHandlebarsHelpers();

  const missing = added.filter((h) => !documented.includes(h));
  if (missing.length) {
    const missingHelpersList = missing
      .sort()
      .map((s) => `\n - ${s}`)
      .join('');
    console.error(
      `\nDocumentation check failed: some Handlebars helpers are not documented in docs/usage/templates.md under "## ${additionalHandlebarsHelpers}".\n` +
        `\nUndocumented helpers:${missingHelpersList}`,
    );
    process.exit(1);
  } else {
    console.log('All registered Handlebars helpers are documented.');
  }
})().catch((err) => {
  console.error('Error running helpers documentation validation:', err);
  process.exit(1);
});
