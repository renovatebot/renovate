import { extractPackageFile } from '.';

describe('modules/manager/cpanfile/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('nothing here', 'cpanfile')).toBeNull();
    });

    it('parse perl', async () => {
      expect(
        await extractPackageFile(`requires 'perl', '5.008001';`, 'cpanfile')
      ).toEqual({
        deps: [
          {
            versioning: 'perl',
            depName: 'perl',
            packageName: 'Perl/perl5',
            currentValue: '5.008001',
            datasource: 'github-tags',
            extractVersion: '^v(?<version>\\S+)',
          },
        ],
      });
    });

    it('parse modules with requires', async () => {
      expect(
        await extractPackageFile(
          `requires 'Try::Tiny';
           requires 'URI', '1.59';
           requires "Capture::Tiny" => "0";
          `,
          'cpanfile'
        )
      ).toEqual({
        deps: [
          {
            datasource: 'cpan',
            depName: 'Try::Tiny',
          },
          {
            datasource: 'cpan',
            depName: 'URI',
            currentValue: '1.59',
          },
          {
            datasource: 'cpan',
            depName: 'Capture::Tiny',
            currentValue: '0',
          },
        ],
      });
    });

    it('parse modules with recommends', async () => {
      expect(
        await extractPackageFile(
          `recommends 'Crypt::URandom';
           recommends 'HTTP::XSCookies', '0.000015';
          `,
          'cpanfile'
        )
      ).toEqual({
        deps: [
          {
            datasource: 'cpan',
            depName: 'Crypt::URandom',
          },
          {
            datasource: 'cpan',
            depName: 'HTTP::XSCookies',
            currentValue: '0.000015',
          },
        ],
      });
    });

    it('parse modules with suggests', async () => {
      expect(
        await extractPackageFile(
          `suggests 'Test::MockTime::HiRes', '0.06';
           suggests 'Authen::Simple::Passwd';
          `,
          'cpanfile'
        )
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
          },
        ],
      });
    });

    describe('parse modules with phases', () => {
      test('configure phase', async () => {
        expect(
          await extractPackageFile(
            `on 'configure' => sub {
               requires "ExtUtils::MakeMaker" => "0";
             };
            `,
            'cpanfile'
          )
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

      test('build phase', async () => {
        expect(
          await extractPackageFile(
            `on build => sub {
               requires 'Test::More', '0.98';
             };
            `,
            'cpanfile'
          )
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

      test('test phase', async () => {
        expect(
          await extractPackageFile(
            `on test => sub {
               requires 'Test::More', '0.88';
               requires 'Test::Requires';
             };
            `,
            'cpanfile'
          )
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
            },
          ],
        });
      });

      test('runtime phase', async () => {
        expect(
          await extractPackageFile(
            `on runtime => sub {
               suggests 'FCGI';
               suggests 'FCGI::ProcManager';
             };
            `,
            'cpanfile'
          )
        ).toEqual({
          deps: [
            {
              datasource: 'cpan',
              depName: 'FCGI',
              depType: 'runtime',
            },
            {
              datasource: 'cpan',
              depName: 'FCGI::ProcManager',
              depType: 'runtime',
            },
          ],
        });
      });

      test('develop phase', async () => {
        expect(
          await extractPackageFile(
            `on 'develop' => sub {
               requires "IPC::Open3" => "0";
               requires "Term::Table" => "0.013";
             };
            `,
            'cpanfile'
          )
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
      `('$shortcut', async ({ shortcut, phase }) => {
        expect(
          await extractPackageFile(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `${shortcut} 'Capture::Tiny', '0.12';`,
            'cpanfile'
          )
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
