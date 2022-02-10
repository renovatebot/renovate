import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from '.';

const conanfile1 = Fixtures.get('conanfile.txt');
const conanfile2 = Fixtures.get('conanfile2.txt');
const conanfile3 = Fixtures.get('conanfile.py');

describe('manager/conan/extract', () => {
  describe('extractPackageFile', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines from conanfile.txt', () => {
      const res = extractPackageFile(conanfile1);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toContainValues([
        {
          currentValue: '[>1.1 <2.1, include_prerelease=True]',
          depName: '7zip',
          depType: 'build_requires',
          lookupName: '7zip/[>1.1 <2.1, include_prerelease=True]@_/_',
          replaceString: '7zip/[>1.1 <2.1, include_prerelease=True]',
        },
        {
          currentValue: '[~1.2.3, loose=False, include_prerelease=True]',
          depName: 'curl',
          depType: 'build_requires',
          lookupName:
            'curl/[~1.2.3, loose=False, include_prerelease=True]@test/dev',
          replaceString:
            'curl/[~1.2.3, loose=False, include_prerelease=True]@test/dev',
        },
        {
          currentValue: '[>1.1 <2.1]',
          depName: 'boost',
          depType: 'build_requires',
          lookupName: 'boost/[>1.1 <2.1]@_/_',
          replaceString: 'boost/[>1.1 <2.1]',
        },
        {
          currentValue: '[2.8]',
          depName: 'catch2',
          depType: 'build_requires',
          lookupName: 'catch2/[2.8]@_/_',
          replaceString: 'catch2/[2.8]',
        },
        {
          currentValue: '[~=3.0]',
          depName: 'openssl',
          depType: 'build_requires',
          lookupName: 'openssl/[~=3.0]@test/prod',
          replaceString: 'openssl/[~=3.0]@test/prod',
        },
      ]);
    });
    it('extracts multiple 0 lines from conanfile.txt', () => {
      const res = extractPackageFile(conanfile2);
      expect(res).toBeNull();
    });
    it('extracts multiple image lines from conanfile.py', () => {
      const res = extractPackageFile(conanfile3);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toContainValues([
        {
          currentValue: '0.1',
          depName: 'pyreq',
          depType: 'python_requires',
          lookupName: 'pyreq/0.1@user/channel',
          replaceString: 'pyreq/0.1@user/channel',
        },
        {
          currentValue: '0.2',
          depName: 'tool_a',
          depType: 'build_requires',
          lookupName: 'tool_a/0.2@user/testing',
          replaceString: 'tool_a/0.2@user/testing',
        },
        {
          currentValue: '0.2',
          depName: 'tool_b',
          depType: 'build_requires',
          lookupName: 'tool_b/0.2@user/testing',
          replaceString: 'tool_b/0.2@user/testing',
        },
        {
          currentValue: '1.0',
          depName: 'req_a',
          depType: 'requires',
          lookupName: 'req_a/1.0@_/_',
          replaceString: 'req_a/1.0',
        },
      ]);
    });
  });
});
