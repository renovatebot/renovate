import fs from 'fs-extra';
import upath from 'upath';
import { customManagerList as customManagers } from './custom/index.ts';

describe('modules/manager/metadata', () => {
  const managerList: string[] = fs
    .readdirSync(import.meta.dirname, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('__') && name !== 'custom')
    .sort();

  const customManagerList = fs
    .readdirSync(upath.join(import.meta.dirname, 'custom'), {
      withFileTypes: true,
    })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !name.startsWith('__'))
    .sort();

  it.each([...managerList, ...customManagerList])(
    '%s has readme with no h1 or h2',
    async (manager) => {
      let readme: string | undefined;
      try {
        const readmeFilePath = `${import.meta.dirname}/${
          (customManagers.includes(manager) ? 'custom/' : '') + manager
        }/readme.md`;
        readme = await fs.readFile(readmeFilePath, 'utf8');
      } catch {
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
        res.some((line) => line.startsWith('# ') || line.startsWith('## ')),
      ).toBeFalse();
    },
  );
});
