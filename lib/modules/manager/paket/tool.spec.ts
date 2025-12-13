import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { UpdatePackage } from './types';
import { updateAllPackages, updatePackage } from './tool';
import type { ExecResult } from '~test/exec-util';
import { exec } from '~test/exec-util';

const defaultExecResult = { stdout: '', stderr: '' };
export function mockExecAll(
  execResult: ExecResult = defaultExecResult,
): string[] {
  const snapshots: string[] = [];
  exec.mockImplementation((cmd) => {
    snapshots.push(cmd);
    if (execResult instanceof Error) {
      throw execResult;
    }
    return execResult as never;
  });
  return snapshots;
}

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('lib/modules/manager/paket/__fixtures__'),
};
const packageFilePath = './paket.dependencies';

describe('modules/manager/paket/tool', () => {
  describe('updatePackage()', () => {
    it('update all packages if no parameters', async () => {
      const execSnapshots = mockExecAll({
        stderr: '',
        stdout:
          'Paket version 9.0.2+a9b12aaeb8d8d5e47a415a3442b7920ed04e98e0\n' +
          'Resolving dependency graph for group GroupA...\n' +
          'Resolving dependency graph...\n' +
          'Updated packages:\n' +
          '  Group: GroupA\n' +
          '  - FAKE: 5.16.0 (added)\n' +
          '  Group: Main\n' +
          '  - dotnet-fable: 2.0.11 (added)\n' +
          '  - Dotnet.ProjInfo: 0.44.0 (added)\n' +
          '  - FSharp.Compiler.Service: 43.9.300 (added)\n' +
          '  - FSharp.Core: 9.0.300 (added)\n' +
          '  - Microsoft.NETCore.App: 2.2.8 (added)\n' +
          '  - Microsoft.NETCore.DotNetAppHost: 9.0.7 (added)\n' +
          '  - Microsoft.NETCore.DotNetHostPolicy: 8.0.18 (added)\n' +
          '  - Microsoft.NETCore.DotNetHostResolver: 8.0.18 (added)\n' +
          '  - Microsoft.NETCore.Platforms: 7.0.4 (added)\n' +
          '  - Microsoft.NETCore.Targets: 5.0.0 (added)\n' +
          '  - Microsoft.NETFramework.ReferenceAssemblies: 1.0.3 (added)\n' +
          '  - NETStandard.Library: 2.0.3 (added)\n' +
          '  - Newtonsoft.Json: 13.0.3 (added)\n' +
          '  - System.Buffers: 4.6.1 (added)\n' +
          '  - System.Collections.Immutable: 9.0.7 (added)\n' +
          '  - System.Diagnostics.DiagnosticSource: 9.0.7 (added)\n' +
          '  - System.Memory: 4.6.3 (added)\n' +
          '  - System.Reflection.Emit: 4.7.0 (added)\n' +
          '  - System.Reflection.Metadata: 9.0.7 (added)\n' +
          '  - System.Runtime.CompilerServices.Unsafe: 6.1.2 (added)\n' +
          '  - System.ValueTuple: 4.6.1 (added)\n' +
          '  - xunit: 2.9.3 (added)\n' +
          '  - xunit.abstractions: 2.0.3 (added)\n' +
          '  - xunit.analyzers: 1.23.0 (added)\n' +
          '  - xunit.assert: 2.9.3 (added)\n' +
          '  - xunit.core: 2.9.3 (added)\n' +
          '  - xunit.extensibility.core: 2.9.3 (added)\n' +
          '  - xunit.extensibility.execution: 2.9.3 (added)\n' +
          '  Installing into projects:\n' +
          '    Created dependency graph (29 packages in total)\n' +
          '  Total time taken: 6 seconds\n',
      });
      GlobalConfig.set(adminConfig);

      await updatePackage({ filePath: packageFilePath });

      expect(execSnapshots).toEqual(['paket update']);
    });
    test.each([
      [
        { filePath: packageFilePath, packageName: 'FSharp.Core' },
        'paket update FSharp.Core ',
      ],
      [
        { filePath: packageFilePath, group: 'GroupA' },
        'paket update --group GroupA ',
      ],
      [
        {
          filePath: packageFilePath,
          group: 'GroupA',
          packageName: 'FSharp.Core',
        },
        'paket update --group GroupA  FSharp.Core ',
      ],
      [
        {
          filePath: packageFilePath,
          packageName: 'FSharp.Core',
          version: '1.2.3',
        },
        'paket update --version 1.2.3  FSharp.Core ',
      ],
      [
        {
          filePath: packageFilePath,
          group: 'GroupA',
          packageName: 'FSharp.Core',
          version: '1.2.3',
        },
        'paket update --group GroupA  --version 1.2.3  FSharp.Core ',
      ],
    ])(
      'can specify parameters (%o)',
      async (command: UpdatePackage, expected) => {
        const execSnapshots = mockExecAll();
        GlobalConfig.set(adminConfig);

        await updatePackage(command);

        expect(execSnapshots).toEqual([expected]);
      },
    );
    it('secure parameters (impossible case normally)', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);

      await updatePackage({
        filePath: packageFilePath,
        packageName: 'FSharp Core',
        group: 'Group A',
        version: '1 2 3',
      });

      expect(execSnapshots).toEqual([
        `paket update --group 'Group A'  --version '1 2 3'  'FSharp Core' `,
      ]);
    });
  });

  describe('updateAllPackages()', () => {
    it('update all packages if no parameters', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);

      await updateAllPackages(packageFilePath);

      expect(execSnapshots).toEqual(['paket update']);
    });
    it('can specify group', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set(adminConfig);

      await updateAllPackages(packageFilePath, 'GroupA');

      expect(execSnapshots).toEqual(['paket update --group GroupA ']);
    });
  });
});
