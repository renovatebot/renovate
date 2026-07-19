import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/setup-cfg/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts dependencies', async () => {
      const res = await extractPackageFile(Fixtures.get('setup-cfg-1.txt'));
      expect(res?.deps).toMatchObject([
        { currentValue: '~=14.0', depName: 'coloredlogs', depType: 'install' },
        { currentValue: '~=1.0', depName: 'first', depType: 'install' },
        { currentValue: '==2.2', depName: 'second', depType: 'install' },
        { currentValue: '>=3.0', depName: 'third', depType: 'install' },
        { currentValue: '>=5.5.5', depName: 'quux', depType: 'install' },
        {
          currentValue: '~=2.1',
          depName: 'python-dateutil',
          depType: 'install',
        },
        { currentValue: '>=1.1.1', depName: 'foo', depType: 'install' },
        { currentValue: '>=3.3.3.', depName: 'baz', depType: 'install' },
        { currentValue: '~=0.4', depName: 'docopt', depType: 'install' },
        { currentValue: '~=2.1', depName: 'fs', depType: 'install' },
        { currentValue: '==1.0', depName: 'nmspc.pkg', depType: 'install' },
        { currentValue: '~=2.18', depName: 'requests', depType: 'install' },
        { currentValue: '~=1.2.3', depName: 'compact', depType: 'install' },
        { currentValue: '>=2.27.0', depName: 'responses', depType: 'install' },
        { currentValue: '~=1.4', depName: 'six', depType: 'setup' },
        { currentValue: '~=4.19', depName: 'tqdm', depType: 'setup' },
        { currentValue: '~=6.0', depName: 'tenacity', depType: 'setup' },
        { currentValue: '~=3.6', depName: 'typing', depType: 'test' },
        { currentValue: '~=1.7', depName: 'verboselogs', depType: 'test' },
        { depName: 'piexif', depType: 'extra' },
        { depName: 'Pillow', depType: 'extra' },
        { currentValue: '>=2.2.2', depName: 'bar', depType: 'extra' },
        { currentValue: '>=4.4.4', depName: 'qux', depType: 'extra' },
        { currentValue: '~=0.1', depName: 'contexter', depType: 'extra' },
        { currentValue: '~=2.0', depName: 'mock', depType: 'extra' },
        { currentValue: '~=0.6', depName: 'parameterized', depType: 'extra' },
        { currentValue: '~=2.12', depName: 'green', depType: 'extra' },
        { depName: 'coverage', depType: 'extra' },
        { depName: 'codecov', depType: 'extra' },
        { depName: 'codacy-coverage', depType: 'extra' },
        { currentValue: '~=1.7', depName: 'sphinx', depType: 'extra' },
        {
          currentValue: '~=0.6',
          depName: 'sphinx-bootstrap-theme',
          depType: 'extra',
        },
        {
          currentValue: '~=2.6',
          depName: 'semantic-version',
          depType: 'extra',
        },
        { depName: 'docutils', depType: 'extra' },
        { depName: 'Pygments', depType: 'extra' },
        { currentValue: '>=0.9', depName: 'aiortc', depType: 'install' },
        { currentValue: '>=8.1', depName: 'websockets', depType: 'install' },
        { currentValue: '>=3.6', depName: 'aiohttp', depType: 'install' },
        { currentValue: '>=6.0', depName: 'pyee', depType: 'install' },
        { currentValue: '>=8.1', depName: 'websockets', depType: 'install' },
        {
          currentValue: '>=0.3',
          depName: 'dataclasses_json',
          depType: 'install',
        },
        { currentValue: '>=10.0', depName: 'coloredlogs', depType: 'install' },
        { currentValue: '~=8.0.0', depName: 'av', depType: 'install' },
      ]);
    });
  });
});
