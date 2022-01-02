import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const content = loadFixture('setup-cfg-1.txt');

describe('manager/setup-cfg/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(content);
      expect(res).toMatchSnapshot({
        deps: [
          { depName: 'qux', currentValue: '>=4.4.4' },
          { depName: 'coloredlogs', currentValue: '~=14.0' },
          { depName: 'python-dateutil', currentValue: '~=2.1' },
          { depName: 'docopt', currentValue: '~=0.4' },
          { depName: 'fs', currentValue: '~=2.1' },
          { depName: 'requests', currentValue: '~=2.18' },
          { depName: 'six', currentValue: '~=1.4' },
          { depName: 'tqdm', currentValue: '~=4.19' },
          { depName: 'tenacity', currentValue: '~=6.0' },
          { depName: 'typing', currentValue: '~=3.6' },
          { depName: 'verboselogs', currentValue: '~=1.7' },
          { depName: 'contexter', currentValue: '~=0.1' },
          { depName: 'mock', currentValue: '~=2.0' },
          { depName: 'parameterized', currentValue: '~=0.6' },
          { depName: 'green', currentValue: '~=2.12' },
          { depName: 'sphinx', currentValue: '~=1.7' },
          { depName: 'sphinx-bootstrap-theme', currentValue: '~=0.6' },
          { depName: 'semantic-version', currentValue: '~=2.6' },
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
