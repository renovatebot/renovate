import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { extractPackageFile } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

const rebarConfig = codeBlock`
  %% -*- mode: erlang;erlang-indent-level: 4;indent-tabs-mode: nil -*-

  {erl_opts, [debug_info]}.

  {deps, [
          cowboy,
          {cowlib, "~> 2.13"},
          {ranch, "2.1.0"},
          {thoas, "~> 1.2.0"},
          %% {commented_dep, "1.0.0"},
          {hackney, "~> 1.20"},
          {pgo, {pkg, pgo_fork}},
          {telemetry, "~> 1.0", {pkg, my_telemetry}},
          {nova, {git, "https://github.com/novaframework/nova.git", {tag, "0.10.0"}}},
          {cowboy_swagger, {git, "https://github.com/inaka/cowboy_swagger.git", {branch, "master"}}},
          {jiffy, {git, "https://github.com/davisp/jiffy.git", {ref, "a7db72493d2288533afbb8a95db43eadc9e7de12"}}},
          {sumo_db, {git, "git://github.com/inaka/sumo_db.git"}},
          {sub_app, {git_subdir, "https://github.com/org/monorepo.git", {tag, "2.0.0"}, "apps/sub_app"}}
         ]}.

  {profiles, [
      {test, [
          {deps, [
              {meck, "0.9.2"},
              {proper, "~> 1.4"}
          ]}
      ]}
  ]}.

  {plugins, [rebar3_hex]}.
`;

const rebarLock = codeBlock`
  {"1.2.0",
  [{<<"cowboy">>,{pkg,<<"cowboy">>,<<"2.13.0">>},0},
   {<<"cowlib">>,{pkg,<<"cowlib">>,<<"2.13.0">>},0},
   {<<"hackney">>,{pkg,<<"hackney">>,<<"1.20.1">>},0},
   {<<"jiffy">>,
    {git,"https://github.com/davisp/jiffy.git",
         {ref,"a7db72493d2288533afbb8a95db43eadc9e7de12"}},
    0},
   {<<"meck">>,{pkg,<<"meck">>,<<"0.9.2">>},0},
   {<<"nova">>,
    {git,"https://github.com/novaframework/nova.git",
         {ref,"abc123def456"}},
    0},
   {<<"pgo">>,{pkg,<<"pgo_fork">>,<<"0.20.0">>},0},
   {<<"proper">>,{pkg,<<"proper">>,<<"1.4.0">>},0},
   {<<"ranch">>,{pkg,<<"ranch">>,<<"2.1.0">>},0},
   {<<"sub_app">>,
    {git,"https://github.com/org/monorepo.git",
         {ref,"deadbeef"}},
    0},
   {<<"sumo_db">>,
    {git,"git://github.com/inaka/sumo_db.git",
         {ref,"fedcba9876543210"}},
    0},
   {<<"telemetry">>,{pkg,<<"my_telemetry">>,<<"1.3.0">>},0},
   {<<"thoas">>,{pkg,<<"thoas">>,<<"1.2.1">>},0}]}.
`;

describe('modules/manager/rebar/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid dependency file', async () => {
      const res = await extractPackageFile('nothing here', 'rebar.config');
      expect(res).toBeNull();
    });

    it('returns null for file with no deps section', async () => {
      const res = await extractPackageFile(
        '{erl_opts, [debug_info]}.',
        'rebar.config',
      );
      expect(res).toBeNull();
    });

    it('returns null for an empty deps list', async () => {
      const res = await extractPackageFile('{deps, []}.', 'rebar.config');
      expect(res).toBeNull();
    });

    it('extracts all dependencies when no lockfile', async () => {
      const res = await extractPackageFile(rebarConfig, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '~> 2.13',
          datasource: 'hex',
          depName: 'cowlib',
          depType: 'prod',
          packageName: 'cowlib',
        },
        {
          currentValue: '2.1.0',
          datasource: 'hex',
          depName: 'ranch',
          depType: 'prod',
          packageName: 'ranch',
        },
        {
          currentValue: '~> 1.2.0',
          datasource: 'hex',
          depName: 'thoas',
          depType: 'prod',
          packageName: 'thoas',
        },
        {
          currentValue: '~> 1.20',
          datasource: 'hex',
          depName: 'hackney',
          depType: 'prod',
          packageName: 'hackney',
        },
        {
          datasource: 'hex',
          depName: 'pgo',
          depType: 'prod',
          packageName: 'pgo_fork',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'telemetry',
          depType: 'prod',
          packageName: 'my_telemetry',
        },
        {
          currentValue: '0.10.0',
          datasource: 'github-tags',
          depName: 'nova',
          depType: 'prod',
          packageName: 'novaframework/nova',
        },
        {
          currentValue: 'master',
          datasource: 'github-tags',
          depName: 'cowboy_swagger',
          depType: 'prod',
          packageName: 'inaka/cowboy_swagger',
        },
        {
          currentDigest: 'a7db72493d2288533afbb8a95db43eadc9e7de12',
          datasource: 'github-tags',
          depName: 'jiffy',
          depType: 'prod',
          packageName: 'davisp/jiffy',
        },
        {
          datasource: 'github-tags',
          depName: 'sumo_db',
          depType: 'prod',
          packageName: 'inaka/sumo_db',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '2.0.0',
          datasource: 'github-tags',
          depName: 'sub_app',
          depType: 'prod',
          packageName: 'org/monorepo',
        },
        {
          currentValue: '0.9.2',
          datasource: 'hex',
          depName: 'meck',
          depType: 'test',
          packageName: 'meck',
        },
        {
          currentValue: '~> 1.4',
          datasource: 'hex',
          depName: 'proper',
          depType: 'test',
          packageName: 'proper',
        },
      ]);
    });

    it('adds lockedVersion from the lockfile without inventing a digest', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce(rebarLock);
      const res = await extractPackageFile(rebarConfig, 'rebar.config');
      expect(res?.lockFiles).toEqual(['rebar.lock']);
      expect(res?.deps).toEqual([
        {
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          lockedVersion: '2.13.0',
          packageName: 'cowboy',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '~> 2.13',
          datasource: 'hex',
          depName: 'cowlib',
          depType: 'prod',
          lockedVersion: '2.13.0',
          packageName: 'cowlib',
        },
        {
          currentValue: '2.1.0',
          datasource: 'hex',
          depName: 'ranch',
          depType: 'prod',
          lockedVersion: '2.1.0',
          packageName: 'ranch',
        },
        {
          currentValue: '~> 1.2.0',
          datasource: 'hex',
          depName: 'thoas',
          depType: 'prod',
          lockedVersion: '1.2.1',
          packageName: 'thoas',
        },
        {
          currentValue: '~> 1.20',
          datasource: 'hex',
          depName: 'hackney',
          depType: 'prod',
          lockedVersion: '1.20.1',
          packageName: 'hackney',
        },
        {
          datasource: 'hex',
          depName: 'pgo',
          depType: 'prod',
          lockedVersion: '0.20.0',
          packageName: 'pgo_fork',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '~> 1.0',
          datasource: 'hex',
          depName: 'telemetry',
          depType: 'prod',
          lockedVersion: '1.3.0',
          packageName: 'my_telemetry',
        },
        {
          currentValue: '0.10.0',
          datasource: 'github-tags',
          depName: 'nova',
          depType: 'prod',
          packageName: 'novaframework/nova',
        },
        {
          currentValue: 'master',
          datasource: 'github-tags',
          depName: 'cowboy_swagger',
          depType: 'prod',
          packageName: 'inaka/cowboy_swagger',
        },
        {
          currentDigest: 'a7db72493d2288533afbb8a95db43eadc9e7de12',
          datasource: 'github-tags',
          depName: 'jiffy',
          depType: 'prod',
          packageName: 'davisp/jiffy',
        },
        {
          datasource: 'github-tags',
          depName: 'sumo_db',
          depType: 'prod',
          packageName: 'inaka/sumo_db',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '2.0.0',
          datasource: 'github-tags',
          depName: 'sub_app',
          depType: 'prod',
          packageName: 'org/monorepo',
        },
        {
          currentValue: '0.9.2',
          datasource: 'hex',
          depName: 'meck',
          depType: 'test',
          lockedVersion: '0.9.2',
          packageName: 'meck',
        },
        {
          currentValue: '~> 1.4',
          datasource: 'hex',
          depName: 'proper',
          depType: 'test',
          lockedVersion: '1.4.0',
          packageName: 'proper',
        },
      ]);
    });

    it('ignores lock entries not in deps', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce(rebarLock);
      const config = `{deps, [{cowlib, "~> 2.13"}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '~> 2.13',
          datasource: 'hex',
          depName: 'cowlib',
          depType: 'prod',
          lockedVersion: '2.13.0',
          packageName: 'cowlib',
        },
      ]);
    });

    it('handles deps on a single line', async () => {
      const config = `{deps, [{cowboy, "2.13.0"}, {ranch, "~> 2.0"}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
        {
          currentValue: '~> 2.0',
          datasource: 'hex',
          depName: 'ranch',
          depType: 'prod',
          packageName: 'ranch',
        },
      ]);
    });

    it('extracts the last bare atom of a single-line deps list', async () => {
      const config = `{deps, [jsx, cowboy]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          datasource: 'hex',
          depName: 'jsx',
          depType: 'prod',
          packageName: 'jsx',
          skipReason: 'unspecified-version',
        },
        {
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('ignores commented-out dependencies', async () => {
      const config = codeBlock`
        {deps, [
          %% {commented, "1.0.0"},
          {real, "2.0.0"}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.0.0',
          datasource: 'hex',
          depName: 'real',
          depType: 'prod',
          packageName: 'real',
        },
      ]);
    });

    it('does not treat a percent sign inside a string as a comment', async () => {
      const config = codeBlock`
        {deps, [
          {cowboy, "2.13.0"},
          {internal, {git, "https://dev.azure.com/acme/My%20Project/_git/internal", {tag, "1.2.3"}}},
          {jsx, "3.1.0"}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
        {
          currentValue: '1.2.3',
          datasource: 'git-tags',
          depName: 'internal',
          depType: 'prod',
          packageName: 'https://dev.azure.com/acme/My%20Project/_git/internal',
        },
        {
          currentValue: '3.1.0',
          datasource: 'hex',
          depName: 'jsx',
          depType: 'prod',
          packageName: 'jsx',
        },
      ]);
    });

    it('does not end a string on an escaped quote', async () => {
      const config = codeBlock`
        {erl_opts, [{d, 'MSG', "say \\"hi"}]}.
        {deps, [{cowboy, "2.13.0"}]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
      ]);
    });

    it('keeps parsing entries after one containing an escaped quote', async () => {
      const config = codeBlock`
        {deps, [
          {cowboy, "2.13.0"},
          {odd, {git, "https://example.com/a\\"b.git", {tag, "1.0.0"}}},
          {jsx, "3.1.0"}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
        {
          currentValue: '3.1.0',
          datasource: 'hex',
          depName: 'jsx',
          depType: 'prod',
          packageName: 'jsx',
        },
      ]);
    });

    it('handles == version prefix', async () => {
      const config = `{deps, [{cowboy, "== 2.13.0"}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '== 2.13.0',
          currentVersion: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
      ]);
    });

    it('handles non-github git url', async () => {
      const config = `{deps, [{myapp, {git, "https://gitlab.com/org/myapp.git", {tag, "1.0.0"}}}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '1.0.0',
          datasource: 'git-tags',
          depName: 'myapp',
          depType: 'prod',
          packageName: 'https://gitlab.com/org/myapp.git',
        },
      ]);
    });

    it('handles non-github git url without ref', async () => {
      const config = `{deps, [{myapp, {git, "https://gitlab.com/org/myapp.git"}}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          datasource: 'git-tags',
          depName: 'myapp',
          depType: 'prod',
          packageName: 'https://gitlab.com/org/myapp.git',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('filters erlang keywords from bare atom deps', async () => {
      const config = codeBlock`
        {deps, [
          end,
          true,
          false,
          undefined,
          {real_dep, "1.0.0"}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '1.0.0',
          datasource: 'hex',
          depName: 'real_dep',
          depType: 'prod',
          packageName: 'real_dep',
        },
      ]);
    });

    it('ignores deps of other top-level tuples', async () => {
      const config = codeBlock`
        {deps, [
          {cowboy, "2.13.0"}
        ]}.
        {plugins, [{rebar3_hex, "~> 7.0"}]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
      ]);
    });

    it('handles nested brackets in deps opening line', async () => {
      const config = codeBlock`
        {deps, [[{cowboy, "2.13.0"}]
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
      ]);
    });

    it('handles brackets in dep body lines', async () => {
      const config = codeBlock`
        {deps, [
          [{cowboy, "2.13.0"}]
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
      ]);
    });

    it('dedupes a dep that appears in both prod and a profile', async () => {
      const config = codeBlock`
        {deps, [{cowboy, "1.0.0"}]}.
        {profiles, [
          {test, [
            {deps, [{cowboy, "2.0.0"}]}
          ]}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.0.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'test',
          packageName: 'cowboy',
        },
      ]);
    });

    it('extracts deps from a profile written on a single line', async () => {
      const config = `{profiles, [{test, [{deps, [{meck, "0.9.2"}, {proper, "1.4.0"}]}]}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '0.9.2',
          datasource: 'hex',
          depName: 'meck',
          depType: 'test',
          packageName: 'meck',
        },
        {
          currentValue: '1.4.0',
          datasource: 'hex',
          depName: 'proper',
          depType: 'test',
          packageName: 'proper',
        },
      ]);
    });

    it('uses the profile name as depType for non-test profiles', async () => {
      const config = codeBlock`
        {profiles, [
          {test, [{deps, [{meck, "0.9.2"}]}]},
          {prod, [{deps, [{recon, "2.5.0"}]}]},
          {docs, [{deps, [{edown, "0.9.0"}]}]}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '0.9.2',
          datasource: 'hex',
          depName: 'meck',
          depType: 'test',
          packageName: 'meck',
        },
        {
          currentValue: '2.5.0',
          datasource: 'hex',
          depName: 'recon',
          depType: 'prod',
          packageName: 'recon',
        },
        {
          currentValue: '0.9.0',
          datasource: 'hex',
          depName: 'edown',
          depType: 'docs',
          packageName: 'edown',
        },
      ]);
    });

    it('uses a quoted profile name as depType', async () => {
      const config = `{profiles, [{'int-test', [{deps, [{meck, "0.9.2"}]}]}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '0.9.2',
          datasource: 'hex',
          depName: 'meck',
          depType: 'int-test',
          packageName: 'meck',
        },
      ]);
    });

    it('does not treat a {test, ...} alias as a profile marker', async () => {
      const config = codeBlock`
        {alias, [{test, [eunit, ct, cover]}]}.
        {deps, [{cowboy, "2.13.0"}]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
      ]);
    });

    it('keeps prod depType for a top-level deps list after the profiles block', async () => {
      const config = codeBlock`
        {profiles, [
          {test, [{deps, [{meck, "0.9.2"}]}]}
        ]}.
        {deps, [{cowboy, "2.13.0"}]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '0.9.2',
          datasource: 'hex',
          depName: 'meck',
          depType: 'test',
          packageName: 'meck',
        },
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
      ]);
    });

    it('extracts the same deps regardless of line endings', async () => {
      const lf = codeBlock`
        {erl_opts, [debug_info]}.
        {deps, [{cowboy, "2.13.0"}]}.
        {profiles, [{test, [{deps, [{meck, "0.9.2"}]}]}]}.
      `;
      const lfRes = await extractPackageFile(lf, 'rebar.config');
      const crlfRes = await extractPackageFile(
        lf.replace(/\n/g, '\r\n'),
        'rebar.config',
      );
      expect(crlfRes?.deps).toEqual(lfRes?.deps);
      expect(crlfRes?.deps).toEqual([
        {
          currentValue: '2.13.0',
          datasource: 'hex',
          depName: 'cowboy',
          depType: 'prod',
          packageName: 'cowboy',
        },
        {
          currentValue: '0.9.2',
          datasource: 'hex',
          depName: 'meck',
          depType: 'test',
          packageName: 'meck',
        },
      ]);
    });

    it('skips rebar2-style 3-tuple deps', async () => {
      const config = codeBlock`
        {deps, [
          {cowboy, ".*", {git, "https://github.com/ninenines/cowboy.git", {tag, "2.13.0"}}},
          {jsx, "3.1.0"}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toEqual([
        {
          currentValue: '3.1.0',
          datasource: 'hex',
          depName: 'jsx',
          depType: 'prod',
          packageName: 'jsx',
        },
      ]);
    });
  });
});
