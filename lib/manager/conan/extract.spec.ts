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
      expect(res?.deps).toEqual([
        {
          currentValue: '1.9.4',
          depName: 'poco',
          depType: 'requires',
          lookupName: 'poco/1.9.4@_/_',
          replaceString: 'poco/1.9.4',
        },
        {
          currentValue: '[~1.2.3, loose=False]',
          depName: 'zlib',
          depType: 'requires',
          lookupName: 'zlib/[~1.2.3, loose=False]@_/_',
          replaceString: 'zlib/[~1.2.3, loose=False]',
        },
        {
          currentValue: '8.62.134',
          depName: 'fake',
          depType: 'requires',
          lookupName: 'fake/8.62.134@test/dev',
          replaceString: 'fake/8.62.134@test/dev',
        },
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
        {
          currentValue: '[>1.1 || 0.8]',
          depName: 'cmake',
          depType: 'build_requires',
          lookupName: 'cmake/[>1.1 || 0.8]@_/_',
          replaceString: 'cmake/[>1.1 || 0.8]',
        },
        {
          currentValue: '[1.2.7 || >=1.2.9 <2.0.0]',
          depName: 'cryptopp',
          depType: 'build_requires',
          lookupName: 'cryptopp/[1.2.7 || >=1.2.9 <2.0.0]@test/local',
          replaceString: 'cryptopp/[1.2.7 || >=1.2.9 <2.0.0]@test/local',
        },
      ]);
    });
    it('extracts multiple 0 lines from conanfile.txt', () => {
      const res = extractPackageFile(conanfile2);
      expect(res).toBeNull();
    });
    it('extracts multiple image lines from conanfile.py', () => {
      const res = extractPackageFile(conanfile3);
      expect(res?.deps).toEqual([
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
        {
          currentValue: '2.1',
          depName: 'req_l',
          depType: 'requires',
          lookupName: 'req_l/2.1@otheruser/testing',
          replaceString: 'req_l/2.1@otheruser/testing',
        },
        {
          currentValue: '0.1',
          depName: 'req_b',
          depType: 'requires',
          lookupName: 'req_b/0.1@user/testing',
          replaceString: 'req_b/0.1@user/testing',
        },
        {
          currentValue: '0.2',
          depName: 'req_d',
          depType: 'requires',
          lookupName: 'req_d/0.2@dummy/stable',
          replaceString: 'req_d/0.2@dummy/stable',
        },
        {
          currentValue: '2.1',
          depName: 'req_e',
          depType: 'requires',
          lookupName: 'req_e/2.1@coder/beta',
          replaceString: 'req_e/2.1@coder/beta',
        },
        {
          currentValue: '1.0',
          depName: 'req_c',
          depType: 'requires',
          lookupName: 'req_c/1.0@user/stable',
          replaceString: 'req_c/1.0@user/stable',
        },
        {
          currentValue: '1.0',
          depName: 'req_f',
          depType: 'requires',
          lookupName: 'req_f/1.0@user/stable',
          replaceString: 'req_f/1.0@user/stable',
        },
        {
          currentValue: '3.0',
          depName: 'req_h',
          depType: 'requires',
          lookupName: 'req_h/3.0@other/beta',
          replaceString: 'req_h/3.0@other/beta',
        },
        {
          currentValue: '[>1.0 <1.8]',
          depName: 'req_g',
          depType: 'requires',
          lookupName: 'req_g/[>1.0 <1.8]@user/stable',
          replaceString: 'req_g/[>1.0 <1.8]@user/stable',
        },
        {
          currentValue: '1.2',
          depName: 'req_i',
          depType: 'requires',
          lookupName: 'req_i/1.2@drl/testing',
          replaceString: 'req_i/1.2@drl/testing',
        },
        {
          currentValue: '2.2',
          depName: 'req_i',
          depType: 'requires',
          lookupName: 'req_i/2.2@drl/stable',
          replaceString: 'req_i/2.2@drl/stable',
        },
        {
          currentValue: '1.2',
          depName: 'req_k',
          depType: 'requires',
          lookupName: 'req_k/1.2@drl/testing',
          replaceString: 'req_k/1.2@drl/testing',
        },
        {
          currentValue: '0.1',
          depName: 'tool_win',
          depType: 'build_requires',
          lookupName: 'tool_win/0.1@user/stable',
          replaceString: 'tool_win/0.1@user/stable',
        },
      ]);
    });
  });
});
