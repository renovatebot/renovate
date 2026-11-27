import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/mix/extract', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: '' });
  });

  describe('extractPackageFile()', () => {
    it('extracts literal declared repos, Hex.pm and organizations without mixing package names', async () => {
      const privateRepo = {
        url: 'https://example.com/artifact/hex/',
        publicKeyFingerprint:
          'SHA256:4/OSKi0NRF91QVVXlGAhb/BIMLnK8NHcx/EWs+aIWPc',
      };

      const res = await extractPackageFile(
        codeBlock`
          defp deps do
            [
              {:local_app, "~> 1.0", system_env: [{"FLAG}#", "1"}], hex: :upstream, repo: "acme.private"},
              {:public_app, "~> 1.0", repo: "hexpm"},
              {:default_nil, "~> 1.0", repo: nil},
              {:default_false, "~> 1.0", repo: false},
              {:bracketed, "~> 1.0", [repo: "acme.private"],},
              {:keyword_tuple, "~> 1.0", [{:repo, "acme.private"}]},
              {:opaque_options, "~> 1.0", @private_options},
              {:org_app, "~> 1.0", repo: "hexpm:acme", hex: "org_pkg"},
              {:org_option_app, "~> 1.0", organization: "acme"},
              {:unknown, "~> 1.0", repo: "acme-private"},
              {:dynamic, "~> 1.0", repo: get_repo()}
            ]
          end
        `,
        'mix.exs',
        { hexRepositories: { 'acme.private': privateRepo } },
      );

      expect(res?.deps).toMatchObject([
        {
          depName: 'local_app',
          packageName: 'upstream',
          registryUrls: ['https://example.com/artifact/hex'],
          hexRepository: {
            name: 'acme.private',
            packageName: 'upstream',
            url: 'https://example.com/artifact/hex',
            publicKeyFingerprint: privateRepo.publicKeyFingerprint,
          },
        },
        { packageName: 'public_app' },
        { packageName: 'default_nil' },
        { packageName: 'default_false' },
        {
          packageName: 'bracketed',
          registryUrls: ['https://example.com/artifact/hex'],
        },
        {
          packageName: 'keyword_tuple',
          registryUrls: ['https://example.com/artifact/hex'],
        },
        { packageName: 'opaque_options', skipReason: 'no-repository' },
        { packageName: 'org_pkg:acme' },
        { packageName: 'org_option_app:acme' },
        { packageName: 'unknown', skipReason: 'no-repository' },
        { packageName: 'dynamic', skipReason: 'no-repository' },
      ]);
      expect(res?.deps.slice(1, 4)).toEqual(
        ['public_app', 'default_nil', 'default_false'].map((name) => ({
          depName: name,
          packageName: name,
          currentValue: '~> 1.0',
          depType: 'prod',
          datasource: 'hex',
        })),
      );
    });

    it('does not treat an incomplete tuple or a computed repository option list as public', async () => {
      const result = await extractPackageFile(
        codeBlock`
          defp deps do
            [
              {:computed, "~> 1.0", [only: :dev] ++ [repo: "company"]},
              {:truncated, "~> 1.0", system_env: [{"FLAG", "1"}]
            ]
          end
        `,
        'mix.exs',
      );

      expect(result).toBeNull();
    });

    it('skips computed app names and tuples without a closing brace', async () => {
      const result = await extractPackageFile(
        codeBlock`
          defp deps do
            [{:prefix |> app_name(), "~> 1.0"},
             {:incomplete, "~> 1.0", repo: "company"
          end
        `,
        'mix.exs',
      );

      expect(result).toBeNull();
    });

    it('returns empty for invalid dependency file', async () => {
      const res = await extractPackageFile('nothing here', 'mix.exs');
      expect(res).toBeNull();
    });

    it('extracts all dependencies when no lockfile', async () => {
      const res = await extractPackageFile(Fixtures.get('mix.exs'), 'mix.exs');
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          depType: 'prod',
          packageName: 'postgrex',
        },
        {
          currentValue: '<1.7.0 or ~>1.7.1',
          datasource: 'hex',
          depName: 'ranch',
          depType: 'prod',
          packageName: 'ranch',
        },
        {
          currentDigest: undefined,
          currentValue: '0.6.0',
          datasource: 'github-tags',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'ninenines/cowboy',
        },
        {
          currentDigest: undefined,
          currentValue: 'main',
          datasource: 'git-tags',
          depName: 'phoenix',
          depType: 'prod',
          packageName: 'https://github.com/phoenixframework/phoenix.git',
        },
        {
          currentDigest: '795036d997c7503b21fb64d6bf1a89b83c44f2b5',
          currentValue: undefined,
          datasource: 'github-tags',
          depName: 'ecto',
          depType: 'prod',
          packageName: 'elixir-ecto/ecto',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'secret',
          depType: 'prod',
          packageName: 'secret:acme',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          depType: 'dev',
          packageName: 'also_secret:acme',
        },
        {
          currentValue: '>0.2.0 and <=1.0.0',
          datasource: 'hex',
          depName: 'metrics',
          depType: 'prod',
          packageName: 'metrics',
        },
        {
          currentValue: '>= 1.0.0',
          datasource: 'hex',
          depName: 'jason',
          depType: 'prod',
          packageName: 'jason',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'hackney',
          depType: 'prod',
          packageName: 'hackney',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          depType: 'prod',
          packageName: 'hammer_backend_redis',
        },
        {
          currentValue: '== 1.0.10',
          currentVersion: '1.0.10',
          datasource: 'hex',
          depName: 'castore',
          depType: 'prod',
          packageName: 'castore',
        },
        {
          currentValue: '~> 2.0.0',
          datasource: 'hex',
          depName: 'gun',
          depType: 'prod',
          packageName: 'grpc_gun',
        },
        {
          currentValue: '~> 0.4.0',
          datasource: 'hex',
          depName: 'another_gun',
          depType: 'prod',
          packageName: 'raygun',
        },
        {
          currentValue: '~> 1.7',
          datasource: 'hex',
          depName: 'credo',
          depType: 'dev',
          packageName: 'credo',
        },
        {
          currentValue: '== 0.37.0',
          currentVersion: '0.37.0',
          datasource: 'hex',
          depName: 'floki',
          depType: 'dev',
          packageName: 'floki',
        },
      ]);
      expect(res?.extractedConstraints).toEqual({
        elixir: '>=1.0.0 <2.0.0-0',
      });
    });

    it.each`
      requirement                 | constraint
      ${'~> 1.13'}                | ${'>=1.13.0 <2.0.0-0'}
      ${'~> 1.15.0'}              | ${'>=1.15.0 <1.16.0-0'}
      ${'1.18.4'}                 | ${'1.18.4'}
      ${'== 1.18.4'}              | ${'1.18.4'}
      ${'>= 1.14.0 and < 2.0.0'}  | ${'>=1.14.0 <2.0.0'}
      ${'~> 1.14.0 or ~> 1.15.0'} | ${'>=1.14.0 <1.15.0-0||>=1.15.0 <1.16.0-0'}
    `(
      'extracts the elixir requirement $requirement as $constraint',
      async ({
        requirement,
        constraint,
      }: {
        requirement: string;
        constraint: string;
      }) => {
        const content = codeBlock`
          defmodule MyProject.MixProject do
            use Mix.Project

            def project do
              [
                app: :my_project,
                elixir: "${requirement}",
                deps: deps()
              ]
            end

            defp deps do
              [
                {:plug, "~> 1.0"},
              ]
            end
          end
        `;

        const res = await extractPackageFile(content, 'mix.exs');

        expect(res?.extractedConstraints).toEqual({ elixir: constraint });
      },
    );

    it.each`
      requirement
      ${'invalid'}
      ${'> 1.0.0 or *'}
    `(
      'skips the unsupported elixir requirement $requirement',
      async ({ requirement }: { requirement: string }) => {
        const content = codeBlock`
          defmodule MyProject.MixProject do
            use Mix.Project

            def project do
              [app: :my_project, elixir: "${requirement}", deps: deps()]
            end

            defp deps do
              [{:plug, "~> 1.0"}]
            end
          end
        `;

        const res = await extractPackageFile(content, 'mix.exs');

        expect(res?.extractedConstraints).toBeUndefined();
      },
    );

    it('extracts the elixir requirement from a trailing project definition', async () => {
      const content = codeBlock`
        defmodule MyProject.MixProject do
          use Mix.Project

          defp deps do
            [{:plug, "~> 1.0"}]
          end

          def project do
            [app: :my_project, elixir: "~> 1.18", deps: deps()]
          end
        end
      `;

      const res = await extractPackageFile(content, 'mix.exs');

      expect(res?.extractedConstraints).toEqual({
        elixir: '>=1.18.0 <2.0.0-0',
      });
    });

    it('ignores elixir keys outside the project definition', async () => {
      const content = codeBlock`
        defmodule MyProject.MixProject do
          use Mix.Project

          def project do
            [app: :my_project, deps: deps()]
          end

          def application do
            [elixir: "~> 1.18"]
          end

          defp deps do
            [{:plug, "~> 1.0"}]
          end
        end
      `;

      const res = await extractPackageFile(content, 'mix.exs');

      expect(res?.extractedConstraints).toBeUndefined();
    });

    it('skips the elixir requirement without a project definition', async () => {
      const content = codeBlock`
        defmodule MyProject.MixProject do
          use Mix.Project

          defp deps do
            [{:plug, "~> 1.0"}]
          end
        end
      `;

      const res = await extractPackageFile(content, 'mix.exs');

      expect(res?.extractedConstraints).toBeUndefined();
    });

    it('extracts all dependencies and adds the locked version if lockfile present', async () => {
      // allows fetching the sibling mix.lock file
      GlobalConfig.set({ localDir: 'lib/modules/manager/mix/__fixtures__' });
      const res = await extractPackageFile(Fixtures.get('mix.exs'), 'mix.exs');
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 0.8.1',
          datasource: 'hex',
          depName: 'postgrex',
          depType: 'prod',
          packageName: 'postgrex',
          lockedVersion: '0.8.4',
        },
        {
          currentValue: '<1.7.0 or ~>1.7.1',
          datasource: 'hex',
          depName: 'ranch',
          depType: 'prod',
          packageName: 'ranch',
          lockedVersion: '1.7.1',
        },
        {
          currentDigest: undefined,
          currentValue: '0.6.0',
          datasource: 'github-tags',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'ninenines/cowboy',
          lockedVersion: '0.6.0',
        },
        {
          currentDigest: undefined,
          currentValue: 'main',
          datasource: 'git-tags',
          depName: 'phoenix',
          depType: 'prod',
          packageName: 'https://github.com/phoenixframework/phoenix.git',
          lockedVersion: undefined,
        },
        {
          currentDigest: '795036d997c7503b21fb64d6bf1a89b83c44f2b5',
          currentValue: undefined,
          datasource: 'github-tags',
          depName: 'ecto',
          depType: 'prod',
          packageName: 'elixir-ecto/ecto',
          lockedVersion: undefined,
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'secret',
          depType: 'prod',
          packageName: 'secret:acme',
          lockedVersion: '1.5.0',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'also_secret',
          depType: 'dev',
          packageName: 'also_secret:acme',
          lockedVersion: '1.3.4',
        },
        {
          currentValue: '>0.2.0 and <=1.0.0',
          datasource: 'hex',
          depName: 'metrics',
          depType: 'prod',
          packageName: 'metrics',
          lockedVersion: '1.0.0',
        },
        {
          currentValue: '>= 1.0.0',
          datasource: 'hex',
          depName: 'jason',
          depType: 'prod',
          packageName: 'jason',
          lockedVersion: '1.4.4',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'hackney',
          depType: 'prod',
          packageName: 'hackney',
          lockedVersion: '1.20.1',
        },
        {
          currentValue: '~> 6.1',
          datasource: 'hex',
          depName: 'hammer_backend_redis',
          depType: 'prod',
          packageName: 'hammer_backend_redis',
          lockedVersion: '6.2.0',
        },
        {
          currentValue: '== 1.0.10',
          currentVersion: '1.0.10',
          datasource: 'hex',
          depName: 'castore',
          depType: 'prod',
          packageName: 'castore',
          lockedVersion: '1.0.10',
        },
        {
          currentValue: '~> 2.0.0',
          datasource: 'hex',
          depName: 'gun',
          depType: 'prod',
          packageName: 'grpc_gun',
          lockedVersion: '2.0.1',
        },
        {
          currentValue: '~> 0.4.0',
          datasource: 'hex',
          depName: 'another_gun',
          depType: 'prod',
          packageName: 'raygun',
          lockedVersion: '0.4.0',
        },
        {
          currentValue: '~> 1.7',
          datasource: 'hex',
          depName: 'credo',
          depType: 'dev',
          packageName: 'credo',
          lockedVersion: '1.7.10',
        },
        {
          currentValue: '== 0.37.0',
          currentVersion: '0.37.0',
          datasource: 'hex',
          depName: 'floki',
          depType: 'dev',
          lockedVersion: '0.37.0',
          packageName: 'floki',
        },
      ]);
    });
  });
});
