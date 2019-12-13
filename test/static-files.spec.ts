import util from 'util';

const glob = util.promisify(require('glob'));

const ignoredExtensions = ['js', 'ts', 'md', 'pyc', 'DS_Store', 'map'];

function filterFiles(files: string[]): string[] {
  return files.filter(file =>
    ignoredExtensions.every(extension => !file.endsWith(`.${extension}`))
  );
}

async function getFiles(dir: string): Promise<string[]> {
  return filterFiles(await glob(`${dir}/**/*`, { dot: true, nodir: true })).map(
    (file: string) => file.replace(`${dir}/`, '')
  );
}

describe('static-files', () => {
  it('has same static files in lib and dist', async () => {
    expect(await getFiles('lib')).toEqual(await getFiles('dist'));
  });
});
