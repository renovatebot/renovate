import util from 'util';
import _glob from 'glob';

const glob = util.promisify(_glob);

const ignoredExtensions = [
  'js',
  'cjs',
  'ts',
  'cts',
  'md',
  'pyc',
  'DS_Store',
  'map',
  'snap',
];

function filterFiles(files: string[]): string[] {
  return files.filter((file) =>
    ignoredExtensions.every((extension) => !file.endsWith(`.${extension}`))
  );
}

async function getFiles(dir: string): Promise<string[]> {
  return filterFiles(
    await glob(`${dir}/**/*`, {
      dot: true,
      nodir: true,
      ignore: ['**/__fixtures__/**/*', '**/__mocks__/**/*'],
    })
  ).map((file: string) => file.replace(`${dir}/`, ''));
}

describe('static-files', () => {
  // workaround for GitHub macOS
  jest.setTimeout(10 * 1000);

  it('has same static files in lib and dist', async () => {
    expect(await getFiles('dist')).toEqual(await getFiles('lib'));
  });
});
