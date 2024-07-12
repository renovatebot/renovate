import { mockDeep } from 'jest-mock-extended';
import { hostRules } from '../../../../test/util';
import { logger } from '../../../logger';
import {
  allowedPipOptions,
  extractHeaderCommand,
  extractPythonVersion,
  getRegistryCredVarsFromPackageFiles,
  matchManager,
} from './common';
import { inferCommandExecDir } from './utils';

jest.mock('../../../util/host-rules', () => mockDeep());

function getCommandInHeader(command: string) {
  return `#
# This file is autogenerated by pip-compile with Python 3.11
# by the following command:
#
#    ${command}
#
`;
}

describe('modules/manager/pip-compile/common', () => {
  describe('extractHeaderCommand()', () => {
    it.each([
      '-v',
      '--all-extras',
      `--allow-unsafe`,
      '--generate-hashes',
      `--no-emit-index-url`,
      `--strip-extras`,
      '--resolver=backtracking',
      '--resolver=legacy',
      '--output-file=reqs.txt',
      '--extra-index-url=https://pypi.org/simple',
    ])('returns object on correct options', (argument: string) => {
      expect(
        extractHeaderCommand(
          getCommandInHeader(`pip-compile ${argument} reqs.in`),
          'reqs.txt',
        ),
      ).toBeObject();
      expect(logger.warn).toHaveBeenCalledTimes(0);
    });

    it.each(['--resolver', '--output-file reqs.txt', '--extra = jupyter'])(
      'errors on malformed options with argument',
      (argument: string) => {
        expect(() =>
          extractHeaderCommand(
            getCommandInHeader(`pip-compile ${argument} reqs.in`),
            'reqs.txt',
          ),
        ).toThrow(/equal sign/);
      },
    );

    it.each(['--foo', '-x', '--$(curl this)', '--bar=sus', '--extra-large'])(
      'errors on unknown options',
      (argument: string) => {
        expect(() =>
          extractHeaderCommand(
            getCommandInHeader(`pip-compile ${argument} reqs.in`),
            'reqs.txt',
          ),
        ).toThrow(/not supported/);
      },
    );

    it.each(['--no-header'])(
      'always errors on not allowed options',
      (argument: string) => {
        expect(() =>
          extractHeaderCommand(
            getCommandInHeader(`pip-compile ${argument} reqs.in`),
            'reqs.txt',
          ),
        ).toThrow(/not allowed/);
      },
    );

    it.each(['--output-file', '--index-url'])(
      'throws on duplicate options',
      (argument: string) => {
        expect(() =>
          extractHeaderCommand(
            getCommandInHeader(
              `pip-compile ${argument}=xxx ${argument}=xxx reqs.in`,
            ),
            'reqs.txt',
          ),
        ).toThrow(/multiple/);
      },
    );

    it('throws when no source files passed as arguments', () => {
      expect(() =>
        extractHeaderCommand(
          getCommandInHeader(`pip-compile --extra=color`),
          'reqs.txt',
        ),
      ).toThrow(/source/);
    });

    it('throws on malformed header', () => {
      expect(() => extractHeaderCommand('Dd', 'reqs.txt')).toThrow(/extract/);
    });

    it('throws on mutually exclusive options', () => {
      expect(() =>
        extractHeaderCommand(
          getCommandInHeader(
            `pip-compile --no-emit-index-url --emit-index-url reqs.in`,
          ),
          'reqs.txt',
        ),
      ).toThrow();
    });

    it('returned sourceFiles returns all source files', () => {
      const exampleSourceFiles = [
        'requirements.in',
        'reqs/testing.in',
        'base.txt',
        './lib/setup.py',
        'pyproject.toml',
      ];
      expect(
        extractHeaderCommand(
          getCommandInHeader(
            `pip-compile --extra=color ${exampleSourceFiles.join(' ')}`,
          ),
          'reqs.txt',
        ).sourceFiles,
      ).toEqual(exampleSourceFiles);
    });

    it.each(allowedPipOptions)(
      'returned sourceFiles must not contain options',
      (argument: string) => {
        const sourceFiles = extractHeaderCommand(
          getCommandInHeader(`pip-compile ${argument}=reqs.txt reqs.in`),
          'reqs.txt',
        ).sourceFiles;
        expect(sourceFiles).not.toContainEqual(argument);
        expect(sourceFiles).toEqual(['reqs.in']);
      },
    );

    it('detects custom command', () => {
      expect(
        extractHeaderCommand(
          getCommandInHeader(`./pip-compile-wrapper reqs.in`),
          'reqs.txt',
        ),
      ).toHaveProperty('isCustomCommand', true);
    });

    it.each([
      { path: 'reqs.txt', arg: 'reqs.txt', result: '.' },
      { path: 'subdir/reqs.txt', arg: 'subdir/reqs.txt', result: '.' },
      { path: 'subdir/reqs.txt', arg: './subdir/reqs.txt', result: '.' },
      { path: 'subdir/reqs.txt', arg: 'reqs.txt', result: 'subdir' },
      { path: 'subdir/reqs.txt', arg: './reqs.txt', result: 'subdir' },
    ])(
      'infer exec directory (cwd) from output file path and header command',
      ({ path, arg, result }) => {
        expect(inferCommandExecDir(path, arg)).toEqual(result);
      },
    );
  });

  describe('extractPythonVersion()', () => {
    it('extracts Python version from valid header', () => {
      expect(
        extractPythonVersion(
          getCommandInHeader('pip-compile reqs.in'),
          'reqs.txt',
        ),
      ).toBe('3.11');
    });

    it('returns undefined if version cannot be extracted', () => {
      expect(extractPythonVersion('', 'reqs.txt')).toBeUndefined();
    });
  });

  describe('getRegistryCredVarsFromPackageFiles()', () => {
    it('handles both registryUrls and additionalRegistryUrls', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'user1',
        password: 'password1',
      });
      hostRules.find.mockReturnValueOnce({
        username: 'user2',
        password: 'password2',
      });
      expect(
        getRegistryCredVarsFromPackageFiles([
          {
            deps: [],
            registryUrls: ['https://example.com/pypi/simple'],
            additionalRegistryUrls: ['https://example2.com/pypi/simple'],
          },
        ]),
      ).toEqual({
        KEYRING_SERVICE_NAME_0: 'example.com',
        KEYRING_SERVICE_USERNAME_0: 'user1',
        KEYRING_SERVICE_PASSWORD_0: 'password1',
        KEYRING_SERVICE_NAME_1: 'example2.com',
        KEYRING_SERVICE_USERNAME_1: 'user2',
        KEYRING_SERVICE_PASSWORD_1: 'password2',
      });
    });

    it('handles multiple additionalRegistryUrls', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'user1',
        password: 'password1',
      });
      hostRules.find.mockReturnValueOnce({
        username: 'user2',
        password: 'password2',
      });
      expect(
        getRegistryCredVarsFromPackageFiles([
          {
            deps: [],
            additionalRegistryUrls: [
              'https://example.com/pypi/simple',
              'https://example2.com/pypi/simple',
            ],
          },
        ]),
      ).toEqual({
        KEYRING_SERVICE_NAME_0: 'example.com',
        KEYRING_SERVICE_USERNAME_0: 'user1',
        KEYRING_SERVICE_PASSWORD_0: 'password1',
        KEYRING_SERVICE_NAME_1: 'example2.com',
        KEYRING_SERVICE_USERNAME_1: 'user2',
        KEYRING_SERVICE_PASSWORD_1: 'password2',
      });
    });

    it('handles hosts with only a username', () => {
      hostRules.find.mockReturnValue({
        username: 'user',
      });
      expect(
        getRegistryCredVarsFromPackageFiles([
          {
            deps: [],
            additionalRegistryUrls: ['https://example.com/pypi/simple'],
          },
        ]),
      ).toEqual({
        KEYRING_SERVICE_NAME_0: 'example.com',
        KEYRING_SERVICE_USERNAME_0: 'user',
        KEYRING_SERVICE_PASSWORD_0: '',
      });
    });

    it('handles hosts with only a password', () => {
      hostRules.find.mockReturnValue({
        password: 'password',
      });
      expect(
        getRegistryCredVarsFromPackageFiles([
          {
            deps: [],
            additionalRegistryUrls: ['https://example.com/pypi/simple'],
          },
        ]),
      ).toEqual({
        KEYRING_SERVICE_NAME_0: 'example.com',
        KEYRING_SERVICE_USERNAME_0: '',
        KEYRING_SERVICE_PASSWORD_0: 'password',
      });
    });

    it('handles invalid URLs', () => {
      hostRules.find.mockReturnValue({
        password: 'password',
      });
      expect(
        getRegistryCredVarsFromPackageFiles([
          {
            deps: [],
            additionalRegistryUrls: ['invalid-url'],
          },
        ]),
      ).toEqual({});
    });
  });

  it('handles multiple package files', () => {
    hostRules.find.mockReturnValueOnce({
      username: 'user1',
      password: 'password1',
    });
    hostRules.find.mockReturnValueOnce({
      username: 'user2',
      password: 'password2',
    });
    expect(
      getRegistryCredVarsFromPackageFiles([
        {
          deps: [],
          registryUrls: ['https://example.com/pypi/simple'],
        },
        {
          deps: [],
          additionalRegistryUrls: ['https://example2.com/pypi/simple'],
        },
      ]),
    ).toEqual({
      KEYRING_SERVICE_NAME_0: 'example.com',
      KEYRING_SERVICE_USERNAME_0: 'user1',
      KEYRING_SERVICE_PASSWORD_0: 'password1',
      KEYRING_SERVICE_NAME_1: 'example2.com',
      KEYRING_SERVICE_USERNAME_1: 'user2',
      KEYRING_SERVICE_PASSWORD_1: 'password2',
    });
  });

  describe('matchManager()', () => {
    it('matches pip_setup setup.py', () => {
      expect(matchManager('setup.py')).toBe('pip_setup');
    });

    it('matches setup-cfg setup.cfg', () => {
      expect(matchManager('setup.cfg')).toBe('setup-cfg');
    });

    it('matches pep621 pyproject.toml', () => {
      expect(matchManager('pyproject.toml')).toBe('pep621');
    });

    it('matches pip_requirements any .in file', () => {
      expect(matchManager('file.in')).toBe('pip_requirements');
      expect(matchManager('another_file.in')).toBe('pip_requirements');
    });

    it('matches pip_requirements any .txt file', () => {
      expect(matchManager('file.txt')).toBe('pip_requirements');
      expect(matchManager('another_file.txt')).toBe('pip_requirements');
    });
  });
});