import assert from 'node:assert';
import path from 'node:path';
import { describe, it } from 'node:test';
import fs from 'fs-extra';
import { glob } from 'glob';
import remark from 'remark';
import github from 'remark-github';

const root = path.resolve('tmp/docs');

/**
 * @param {any} node
 * @param {Set<string>} files
 * @param {string} file
 */
function checkNode(node, files, file) {
  if (node.type === 'link') {
    /** @type {import('mdast').Link} */
    const link = node;
    assert.ok(
      !link.url.startsWith('/'),
      `Link should be external or relative: ${link.url}`,
    );

    if (link.url.startsWith('.') && !/^https?:\/\//.test(link.url)) {
      // absolute path
      const absPath = path.resolve(
        'tmp/docs',
        path.dirname(file),
        link.url.replace(/#.*/, ''),
      );
      // relative path
      const relPath = absPath.substring(root.length + 1);

      assert.ok(
        files.has(relPath),
        `File not found: ${link.url} in ${file} -> ${relPath}`,
      );
    } else {
      assert.ok(
        !link.url.startsWith('https://docs.renovatebot.com/'),
        `Docs links should be relative: ${link.url}`,
      );
    }
  } else if ('children' in node) {
    for (const child of node.children) {
      checkNode(child, files, file);
    }
  }
}

describe('index', async () => {
  await describe('validate links', async () => {
    const todo = await glob('**/*.md', { cwd: 'tmp/docs' });
    const files = new Set(todo);

    let c = 0;

    for (const file of todo) {
      c++;

      await it(`${file}`, async () => {
        const node = remark()
          .use(github)
          .parse(await fs.readFile(`tmp/docs/${file}`, 'utf8'));
        checkNode(node, files, file);
      });
    }

    assert.ok(c > 0, 'Should find at least one file');
  });
});
