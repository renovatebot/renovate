import fs from 'fs-extra';

describe('modules/manager/metadata', () => {
  const managerList: string[] = fs
    .readdirSync(__dirname, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('__') || name === 'custom')
    .sort();

  it.each(managerList)('%s has readme with no h1 or h2', async (manager) => {
    let readme: string | undefined;
    try {
      readme = await fs.readFile(
        `${__dirname}/${
          manager === 'custom' ? 'custom/regex' : manager
        }/readme.md`,
        'utf8'
      );
    } catch (err) {
      // do nothing
    }
    expect(readme).toBeDefined();
    const lines = readme!.split('\n');
    let isCode = false;
    const res: string[] = [];

    for (const line of lines) {
      if (line.startsWith('```')) {
        isCode = !isCode;
      } else if (!isCode) {
        res.push(line);
      }
    }

    expect(
      res.some((line) => line.startsWith('# ') || line.startsWith('## '))
    ).toBeFalse();
  });
});
