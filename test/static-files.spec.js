const util = require('util');
const glob = util.promisify(require('glob'));

const ignoredExtensions = ['js', 'ts', 'md', 'pyc', 'DS_Store', 'map'];

function filterFiles(files) {
  return files.filter(file =>
    ignoredExtensions.every(extension => !file.endsWith(`.${extension}`))
  );
}

async function getFiles(dir) {
  return filterFiles(await glob(`${dir}/**/*`, { dot: true, nodir: true })).map(
    file => file.replace(`${dir}/`, '')
  );
}

describe('static-files', () => {
  it('has same static files in lib and dist', async () => {
    expect(await getFiles('lib')).toEqual(await getFiles('dist'));
  });
});
