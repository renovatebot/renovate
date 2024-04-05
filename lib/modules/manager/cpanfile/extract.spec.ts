import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

describe('modules/manager/cpanfile/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('', 'cpanfile')).toBeNull();
      expect(extractPackageFile('nothing here', 'cpanfile')).toBeNull();
    });

    describe('parse perl', () => {
      test.each`
        version         | expected
        ${'5.012005'}   | ${'5.012005'}
        ${`'5.008001'`} | ${'5.008001'}
        ${`"5.008001"`} | ${'5.008001'}
      `('$version', ({ version, expected }) => {
        expect(
          extractPackageFile(
            `requires 'perl', ${version as string};`,
            'cpanfile',
          ),
        ).toEqual({
          deps: [
            {
              versioning: 'perl',
              depName: 'perl',
              packageName: 'Perl/perl5',
              currentValue: expected,
              datasource: 'github-tags',
              extractVersion: '^v(?<version>\\S+)',
            },
          ],
          extractedConstraints: { perl: expected },
        });
      });
    });

    it('parse modules with requires', () => {
      expect(
        extractPackageFile(
          codeBlock`
            requires 'Try::Tiny';
            requires 'URI', '1.59';
            requires 'HTTP::Tiny', 0.034;
            requires "Capture::Tiny" => "0";

            requires 'A', '== 1.1';
            requires 'AA', '== v1.1';
            requires 'B', '>= 1.2';
            requires 'BB', '>= v1.2';
            requires 'C', '> 1.3';
            requires 'CC', '> v1.3';
          `,
          'cpanfile',
        ),
      ).toEqual({
        deps: [
          {
            datasource: 'cpan',
            depName: 'Try::Tiny',
            skipReason: 'unspecified-version',
          },
          {
            datasource: 'cpan',
            depName: 'URI',
            currentValue: '1.59',
          },
          {
            datasource: 'cpan',
            depName: 'HTTP::Tiny',
            currentValue: '0.034',
          },
          {
            datasource: 'cpan',
            depName: 'Capture::Tiny',
            currentValue: '0',
          },
          {
            datasource: 'cpan',
            depName: 'A',
            currentValue: '1.1',
          },
          {
            datasource: 'cpan',
            depName: 'AA',
            currentValue: '1.1',
          },
          {
            datasource: 'cpan',
            depName: 'B',
            currentValue: '1.2',
          },
          {
            datasource: 'cpan',
            depName: 'BB',
            currentValue: '1.2',
          },
          {
            datasource: 'cpan',
            depName: 'C',
            currentValue: '1.3',
          },
          {
            datasource: 'cpan',
            depName: 'CC',
            currentValue: '1.3',
          },
        ],
      });
    });

    it('parse modules with recommends', () => {
      expect(
        extractPackageFile(
          codeBlock`
            recommends 'Crypt::URandom';
            recommends 'HTTP::XSCookies', '0.000015';
          `,
          'cpanfile',
        ),
      ).toEqual({
        deps: [
          {
            datasource: 'cpan',
            depName: 'Crypt::URandom',
            skipReason: 'unspecified-version',
          },
          {
            datasource: 'cpan',
            depName: 'HTTP::XSCookies',
            currentValue: '0.000015',
          },
        ],
      });
    });

    it('parse modules with suggests', () => {
      expect(
        extractPackageFile(
          codeBlock`
            suggests 'Test::MockTime::HiRes', '0.06';
            suggests 'Authen::Simple::Passwd';
          `,
          'cpanfile',
        ),
      ).toEqual({
        deps: [
          {
            datasource: 'cpan',
            depName: 'Test::MockTime::HiRes',
            currentValue: '0.06',
          },
          {
            datasource: 'cpan',
            depName: 'Authen::Simple::Passwd',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    describe('parse modules with phases', () => {
      test('configure phase', () => {
        expect(
          extractPackageFile(
            codeBlock`
              on 'configure' => sub {
                requires "ExtUtils::MakeMaker" => "0";
              };
            `,
            'cpanfile',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'cpan',
              depName: 'ExtUtils::MakeMaker',
              currentValue: '0',
              depType: 'configure',
            },
          ],
        });
      });

      test('build phase', () => {
        expect(
          extractPackageFile(
            codeBlock`
              on build => sub {
                requires 'Test::More', '0.98';
              };
            `,
            'cpanfile',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'cpan',
              depName: 'Test::More',
              currentValue: '0.98',
              depType: 'build',
            },
          ],
        });
      });

      test('test phase', () => {
        expect(
          extractPackageFile(
            codeBlock`
              on test => sub {
                requires 'Test::More', '0.88';
                requires 'Test::Requires';
              };
            `,
            'cpanfile',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'cpan',
              depName: 'Test::More',
              currentValue: '0.88',
              depType: 'test',
            },
            {
              datasource: 'cpan',
              depName: 'Test::Requires',
              depType: 'test',
              skipReason: 'unspecified-version',
            },
          ],
        });
      });

      test('runtime phase', () => {
        expect(
          extractPackageFile(
            codeBlock`
              on runtime => sub {
                suggests 'FCGI';
                suggests 'FCGI::ProcManager';
              };
            `,
            'cpanfile',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'cpan',
              depName: 'FCGI',
              depType: 'runtime',
              skipReason: 'unspecified-version',
            },
            {
              datasource: 'cpan',
              depName: 'FCGI::ProcManager',
              depType: 'runtime',
              skipReason: 'unspecified-version',
            },
          ],
        });
      });

      test('develop phase', () => {
        expect(
          extractPackageFile(
            codeBlock`
              on 'develop' => sub {
                requires "IPC::Open3" => "0";
                requires "Term::Table" => "0.013";
              };
            `,
            'cpanfile',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'cpan',
              depName: 'IPC::Open3',
              currentValue: '0',
              depType: 'develop',
            },
            {
              datasource: 'cpan',
              depName: 'Term::Table',
              currentValue: '0.013',
              depType: 'develop',
            },
          ],
        });
      });
    });

    describe('parse modules with phase shortcuts', () => {
      test.each`
        shortcut                | phase
        ${'configure_requires'} | ${'configure'}
        ${'build_requires'}     | ${'build'}
        ${'test_requires'}      | ${'test'}
        ${'author_requires'}    | ${'develop'}
      `('$shortcut', ({ shortcut, phase }) => {
        expect(
          extractPackageFile(
            `${shortcut as string} 'Capture::Tiny', '0.12';`,
            'cpanfile',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'cpan',
              depName: 'Capture::Tiny',
              currentValue: '0.12',
              depType: phase,
            },
          ],
        });
      });
    });
  });
});
