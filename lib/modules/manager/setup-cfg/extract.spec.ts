import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/setup-cfg/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts dependencies', () => {
      const res = extractPackageFile(Fixtures.get('setup-cfg-1.txt'));
      expect(res).toMatchSnapshot({
        deps: [
          { depName: 'coloredlogs', currentValue: '~=14.0' },
          { depName: 'first', currentValue: '~=1.0' },
          { depName: 'second', currentValue: '==2.2' },
          { depName: 'third', currentValue: '>=3.0' },
          { depName: 'quux', currentValue: '>=5.5.5' },
          { depName: 'python-dateutil', currentValue: '~=2.1' },
          { depName: 'foo', currentValue: '>=1.1.1' },
          { depName: 'baz', currentValue: '>=3.3.3.' },
          { depName: 'docopt', currentValue: '~=0.4' },
          { depName: 'fs', currentValue: '~=2.1' },
          { depName: 'nmspc.pkg', currentValue: '==1.0' },
          { depName: 'requests', currentValue: '~=2.18' },
          { depName: 'compact', currentValue: '~=1.2.3' },
          { depName: 'responses', currentValue: '>=2.27.0' },
          { depName: 'six', currentValue: '~=1.4' },
          { depName: 'tqdm', currentValue: '~=4.19' },
          { depName: 'tenacity', currentValue: '~=6.0' },
          { depName: 'typing', currentValue: '~=3.6' },
          { depName: 'verboselogs', currentValue: '~=1.7' },
          { depName: 'piexif', currentValue: undefined },
          { depName: 'Pillow', currentValue: undefined },
          { depName: 'bar', currentValue: '>=2.2.2' },
          { depName: 'qux', currentValue: '>=4.4.4' },
          { depName: 'contexter', currentValue: '~=0.1' },
          { depName: 'mock', currentValue: '~=2.0' },
          { depName: 'parameterized', currentValue: '~=0.6' },
          { depName: 'green', currentValue: '~=2.12' },
          { depName: 'coverage', currentValue: undefined },
          { depName: 'codecov', currentValue: undefined },
          { depName: 'codacy-coverage', currentValue: undefined },
          { depName: 'sphinx', currentValue: '~=1.7' },
          { depName: 'sphinx-bootstrap-theme', currentValue: '~=0.6' },
          { depName: 'semantic-version', currentValue: '~=2.6' },
          { depName: 'docutils', currentValue: undefined },
          { depName: 'Pygments', currentValue: undefined },
          { depName: 'aiortc', currentValue: '>=0.9' },
          { depName: 'websockets', currentValue: '>=8.1' },
          { depName: 'aiohttp', currentValue: '>=3.6' },
          { depName: 'pyee', currentValue: '>=6.0' },
          { depName: 'websockets', currentValue: '>=8.1' },
          { depName: 'dataclasses_json', currentValue: '>=0.3' },
          { depName: 'coloredlogs', currentValue: '>=10.0' },
          { depName: 'av', currentValue: '~=8.0.0' },
        ],
      });
    });
  });
});
