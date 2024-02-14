import { mockDeep } from 'jest-mock-extended';
import { hostRules } from '../../../../test/util';
import {
  allowedPipOptions,
  extractHeaderCommand,
  getRegistryUrlVarsFromPackageFile,
} from './common';

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
      '--generate-hashes',
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
      { path: 'subdir/reqs.txt', arg: 'reqs.txt', result: 'subdir' },
      // { path: '../reqs.txt', arg: '../reqs.txt', result: '.' },
    ])(
      'infer exec directory (cwd) from output file path and header command',
      ({ path, arg, result }) => {
        expect(
          extractHeaderCommand(
            getCommandInHeader(`pip-compile --output-file=${arg} reqs.in`),
            path,
          ).commandExecDir,
        ).toEqual(result);
      },
    );
  });

  describe('getRegistryUrlFlagsFromPackageFile()', () => {
    it('handles both registryUrls and additionalRegistryUrls', () => {
      hostRules.find.mockReturnValue({});
      expect(
        getRegistryUrlVarsFromPackageFile({
          deps: [],
          registryUrls: ['https://example.com/pypi/simple'],
          additionalRegistryUrls: ['https://example2.com/pypi/simple'],
        }),
      ).toEqual({
        haveCredentials: false,
        environmentVars: {
          PIP_INDEX_URL: 'https://example.com/pypi/simple',
          PIP_EXTRA_INDEX_URL: 'https://example2.com/pypi/simple',
        },
      });
    });

    it('handles multiple additionalRegistryUrls', () => {
      hostRules.find.mockReturnValue({});
      expect(
        getRegistryUrlVarsFromPackageFile({
          deps: [],
          additionalRegistryUrls: [
            'https://example.com/pypi/simple',
            'https://example2.com/pypi/simple',
          ],
        }),
      ).toEqual({
        haveCredentials: false,
        environmentVars: {
          PIP_EXTRA_INDEX_URL:
            'https://example.com/pypi/simple https://example2.com/pypi/simple',
        },
      });
    });

    it('uses extra index URLs with no auth', () => {
      hostRules.find.mockReturnValue({});
      expect(
        getRegistryUrlVarsFromPackageFile({
          deps: [],
          registryUrls: ['https://example.com/pypi/simple'],
        }),
      ).toEqual({
        haveCredentials: false,
        environmentVars: {
          PIP_INDEX_URL: 'https://example.com/pypi/simple',
        },
      });
    });

    it('uses auth from extra index URLs matching host rules', () => {
      hostRules.find.mockReturnValue({
        username: 'user',
        password: 'password',
      });
      expect(
        getRegistryUrlVarsFromPackageFile({
          deps: [],
          registryUrls: ['https://example.com/pypi/simple'],
        }),
      ).toEqual({
        haveCredentials: true,
        environmentVars: {
          PIP_INDEX_URL: 'https://user:password@example.com/pypi/simple',
        },
      });
    });

    it('handles invalid URLs', () => {
      hostRules.find.mockReturnValue({});
      expect(
        getRegistryUrlVarsFromPackageFile({
          deps: [],
          additionalRegistryUrls: [
            'https://example.com/pypi/simple',
            'this is not a valid URL',
          ],
        }),
      ).toEqual({
        haveCredentials: false,
        environmentVars: {
          PIP_EXTRA_INDEX_URL: 'https://example.com/pypi/simple',
        },
      });
    });
  });
});
