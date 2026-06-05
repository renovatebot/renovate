import { codeBlock } from 'common-tags';
import upath from 'upath';
import { partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { Result } from '../../../util/result.ts';
import * as lookup from '../../../workers/repository/process/lookup/index.ts';
import type { LookupUpdateConfig } from '../../../workers/repository/process/lookup/types.ts';
import { doAutoReplace } from '../../../workers/repository/update/branch/auto-replace.ts';
import type { BranchUpgradeConfig } from '../../../workers/types.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import { id as nugetVersioningId } from '../../versioning/nuget/index.ts';
import { id as semverVersioningId } from '../../versioning/semver/index.ts';
import type { PackageDependency } from '../types.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('/tmp/repo'),
};

describe('modules/manager/nuget/integration', () => {
  const getNugetReleases = vi.spyOn(NugetDatasource.prototype, 'getReleases');

  let baseConfig: LookupUpdateConfig;

  beforeEach(() => {
    GlobalConfig.set(adminConfig);
    baseConfig = partial<LookupUpdateConfig>(getConfig() as never);
    baseConfig.manager = 'nuget';
    baseConfig.rangeStrategy = 'replace';
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  function makeConfig(dep: PackageDependency): LookupUpdateConfig {
    return {
      ...baseConfig,
      ...dep,
      currentValue: dep.currentValue ?? undefined,
      packageName: dep.packageName ?? dep.depName!,
    };
  }

  it('proposes updates for Sdk elements in sqlproj files', async () => {
    const sqlproj = codeBlock`
      <Project>
        <Sdk Name="Microsoft.Build.Sql" Version="0.1.19-preview" />
      </Project>
    `;

    const extracted = await extractPackageFile(
      sqlproj,
      'src/Database.sqlproj',
      {},
    );
    expect(extracted).not.toBeNull();

    const dep = extracted!.deps.find(
      (d) => d.depName === 'Microsoft.Build.Sql',
    );
    expect(dep).toEqual({
      depName: 'Microsoft.Build.Sql',
      currentValue: '0.1.19-preview',
      depType: 'msbuild-sdk',
      datasource: 'nuget',
      versioning: semverVersioningId,
    });

    getNugetReleases.mockResolvedValueOnce({
      releases: [{ version: '0.1.19-preview' }, { version: '2.2.0' }],
    });

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(makeConfig(dep!)),
    ).unwrapOrThrow();

    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0]?.newVersion).toBe('2.2.0');
    expect(updates[0]?.newValue).toBe('2.2.0');
  });

  it('does not propose updates for msbuild-sdk when nuget versioning is used', async () => {
    getNugetReleases.mockResolvedValueOnce({
      releases: [{ version: '0.1.19-preview' }, { version: '2.2.0' }],
    });

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(
        makeConfig({
          depName: 'Microsoft.Build.Sql',
          currentValue: '0.1.19-preview',
          depType: 'msbuild-sdk',
          datasource: 'nuget',
          versioning: nugetVersioningId,
        }),
      ),
    ).unwrapOrThrow();

    expect(updates).toEqual([]);
  });

  it('updates Sdk element version in sqlproj via auto-replace', async () => {
    const sqlproj = codeBlock`
      <Project>
        <Sdk Name="Microsoft.Build.Sql" Version="0.1.19-preview" />
      </Project>
    `;

    const upgrade = partial<BranchUpgradeConfig>({
      manager: 'nuget',
      packageFile: 'src/Database.sqlproj',
      depName: 'Microsoft.Build.Sql',
      currentValue: '0.1.19-preview',
      newValue: '2.2.0',
      depIndex: 0,
    });

    const updated = await doAutoReplace(upgrade, sqlproj, false);

    expect(updated).toBe(sqlproj.replace('0.1.19-preview', '2.2.0'));
  });

  it('does not set versioning on PackageReference dependencies at extract', async () => {
    const csproj = codeBlock`
      <Project>
        <ItemGroup>
          <PackageReference Include="Autofac" Version="4.5.0" />
        </ItemGroup>
      </Project>
    `;

    const extracted = await extractPackageFile(
      csproj,
      'src/Project.csproj',
      {},
    );
    const dep = extracted!.deps.find((d) => d.depName === 'Autofac');

    expect(dep?.versioning).toBeUndefined();
    expect(dep?.depType).toBe('nuget');
  });
});
