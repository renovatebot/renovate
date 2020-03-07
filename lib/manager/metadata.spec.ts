import * as fs from 'fs-extra';

describe('manager metadata', () => {
  const managerList: string[] = fs
    .readdirSync(__dirname, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !name.startsWith('__'))
    .sort();
  test.each(managerList)('%s has readme with no h1 or h2', async manager => {
    let readme;
    try {
      readme = await fs.readFile(`${__dirname}/${manager}/readme.md`, 'utf8');
    } catch (err) {
      // do nothing
    }
    expect(readme).toBeDefined();
    expect(
      readme
        .split('\n')
        .some(line => line.startsWith('# ') || line.startsWith('## '))
    ).toBe(false);
  });
});
