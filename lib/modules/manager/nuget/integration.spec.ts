import { codeBlock } from 'common-tags';
import upath from 'upath';
import { partial } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { getManagerConfig, mergeChildConfig } from '../../../config/index.ts';
import type {
  RenovateConfig,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { applyPackageRules } from '../../../util/package-rules/index.ts';
import { Result } from '../../../util/result.ts';
import * as lookup from '../../../workers/repository/process/lookup/index.ts';
import type { LookupUpdateConfig } from '../../../workers/repository/process/lookup/types.ts';
import { doAutoReplace } from '../../../workers/repository/update/branch/auto-replace.ts';
import type { BranchUpgradeConfig } from '../../../workers/types.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import { id as nugetVersioningId } from '../../versioning/nuget/index.ts';
import type { PackageDependency } from '../types.ts';
import { extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('/tmp/repo'),
};

describe('modules/manager/nuget/integration', () => {
  const getNugetReleases = vi.spyOn(NugetDatasource.prototype, 'getReleases');

  let baseConfig: RenovateConfig;

  beforeEach(() => {
    GlobalConfig.set(adminConfig);
    baseConfig = getConfig() as RenovateConfig;
    baseConfig.rangeStrategy = 'replace';
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  async function makeConfig(
    dep: PackageDependency,
  ): Promise<LookupUpdateConfig> {
    const managerConfig = getManagerConfig(baseConfig, 'nuget');
    let depConfig = mergeChildConfig(managerConfig, dep);
    depConfig = await applyPackageRules(depConfig, 'pre-lookup');
    return {
      ...depConfig,
      currentValue: dep.currentValue ?? undefined,
      packageName: dep.packageName ?? dep.depName!,
    } as LookupUpdateConfig;
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
    });

    getNugetReleases.mockResolvedValueOnce({
      releases: [{ version: '0.1.19-preview' }, { version: '2.2.0' }],
    });

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(await makeConfig(dep!)),
    ).unwrapOrThrow();

    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0]?.newVersion).toBe('2.2.0');
    expect(updates[0]?.newValue).toBe('2.2.0');
  });

  it('does not propose updates for msbuild-sdk when nuget versioning and replace range strategy are used', async () => {
    getNugetReleases.mockResolvedValueOnce({
      releases: [{ version: '0.1.19-preview' }, { version: '2.2.0' }],
    });

    const { updates } = await Result.wrap(
      lookup.lookupUpdates(
        partial<LookupUpdateConfig>({
          manager: 'nuget',
          rangeStrategy: 'replace',
          depName: 'Microsoft.Build.Sql',
          currentValue: '0.1.19-preview',
          depType: 'msbuild-sdk',
          datasource: 'nuget',
          versioning: nugetVersioningId,
          packageName: 'Microsoft.Build.Sql',
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
