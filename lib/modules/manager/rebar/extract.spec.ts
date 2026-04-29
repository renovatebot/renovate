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
    it('returns empty for invalid dependency file', async () => {
      const res = await extractPackageFile('nothing here', 'rebar.config');
      expect(res).toBeNull();
    });

    it('returns empty for file with no deps section', async () => {
      const res = await extractPackageFile(
        '{erl_opts, [debug_info]}.',
        'rebar.config',
      );
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

    it('extracts dependencies with locked versions from lockfile', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce(rebarLock);
      const res = await extractPackageFile(rebarConfig, 'rebar.config');
      expect(res?.lockFiles).toEqual(['rebar.lock']);

      const cowlib = res?.deps.find((d) => d.depName === 'cowlib');
      expect(cowlib?.lockedVersion).toBe('2.13.0');

      const ranch = res?.deps.find((d) => d.depName === 'ranch');
      expect(ranch?.lockedVersion).toBe('2.1.0');

      const hackney = res?.deps.find((d) => d.depName === 'hackney');
      expect(hackney?.lockedVersion).toBe('1.20.1');

      const telemetry = res?.deps.find((d) => d.depName === 'telemetry');
      expect(telemetry?.lockedVersion).toBe('1.3.0');

      const nova = res?.deps.find((d) => d.depName === 'nova');
      expect(nova?.currentDigest).toBe('abc123def456');
    });

    it('handles simple deps-only rebar.config', async () => {
      const config = `{deps, [{cowboy, "2.13.0"}, {ranch, "~> 2.0"}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps[0]).toMatchObject({
        depName: 'cowboy',
        currentValue: '2.13.0',
        datasource: 'hex',
      });
      expect(res?.deps[1]).toMatchObject({
        depName: 'ranch',
        currentValue: '~> 2.0',
        datasource: 'hex',
      });
    });

    it('ignores commented-out dependencies', async () => {
      const config = codeBlock`
        {deps, [
          %% {commented, "1.0.0"},
          {real, "2.0.0"}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].depName).toBe('real');
    });

    it('handles == version prefix', async () => {
      const config = `{deps, [{cowboy, "== 2.13.0"}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps[0]).toMatchObject({
        depName: 'cowboy',
        currentValue: '== 2.13.0',
        currentVersion: '2.13.0',
        datasource: 'hex',
      });
    });

    it('skips erlang keywords in bare atom position', async () => {
      const config = codeBlock`
        {deps, [
          {real_dep, "1.0.0"}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].depName).toBe('real_dep');
    });

    it('handles deps on a single line', async () => {
      const config = `{deps, [{cowboy, "2.13.0"}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].depName).toBe('cowboy');
    });

    it('handles non-github git url', async () => {
      const config = `{deps, [{myapp, {git, "https://gitlab.com/org/myapp.git", {tag, "1.0.0"}}}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps[0]).toMatchObject({
        depName: 'myapp',
        currentValue: '1.0.0',
        datasource: 'git-tags',
        packageName: 'https://gitlab.com/org/myapp.git',
      });
    });

    it('handles non-github git url without ref', async () => {
      const config = `{deps, [{myapp, {git, "https://gitlab.com/org/myapp.git"}}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps[0]).toMatchObject({
        depName: 'myapp',
        datasource: 'git-tags',
        packageName: 'https://gitlab.com/org/myapp.git',
        skipReason: 'unspecified-version',
      });
    });

    it('handles nested brackets in deps', async () => {
      const config = codeBlock`
        {deps, [
          {cowboy, "2.13.0"},
          {ranch, "~> 2.0"}
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toHaveLength(2);
    });

    it('returns null when all deps are erlang keywords', async () => {
      const config = `{deps, []}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res).toBeNull();
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
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].depName).toBe('real_dep');
    });

    it('handles nested tuples in deps section', async () => {
      const config = codeBlock`
        {deps, [
          {cowboy, "2.13.0"},
          {ranch, "~> 2.0"}
        ]}.
        {plugins, [{rebar3_hex, "~> 7.0"}]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toHaveLength(2);
    });

    it('handles nested brackets in deps opening line', async () => {
      const config = codeBlock`
        {deps, [[{cowboy, "2.13.0"}]
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res).toBeDefined();
    });

    it('handles brackets in dep body lines', async () => {
      const config = codeBlock`
        {deps, [
          [{cowboy, "2.13.0"}]
        ]}.
      `;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res).toBeDefined();
    });

    it('ignores lock entries not in deps', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('rebar.lock');
      fs.readLocalFile.mockResolvedValueOnce(rebarLock);
      const config = `{deps, [{cowlib, "~> 2.13"}]}.`;
      const res = await extractPackageFile(config, 'rebar.config');
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].depName).toBe('cowlib');
      expect(res?.deps[0].lockedVersion).toBe('2.13.0');
    });
  });
});
