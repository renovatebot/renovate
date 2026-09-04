import upath from 'upath';
import { mockExecAll } from '~test/exec-util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { runPaketUpdate } from './tool.ts';
import type { UpdatePackage } from './types.ts';

const packageFilePath = './paket.dependencies';

describe('modules/manager/paket/tool', () => {
  beforeAll(() => {
    GlobalConfig.set({
      localDir: upath.resolve('lib/modules/manager/paket/__fixtures__'),
    });
  });

  describe('runPaketUpdate()', () => {
    it('update all packages if no parameters', async () => {
      const execSnapshots = mockExecAll();

      await runPaketUpdate(packageFilePath, [{}]);

      expect(execSnapshots.map((s) => s.cmd)).toEqual(['paket update']);
    });

    it.each([
      [{ packageName: 'FSharp.Core' }, 'paket update FSharp.Core '],
      [{ group: 'GroupA' }, 'paket update --group GroupA '],
      [
        { group: 'GroupA', packageName: 'FSharp.Core' },
        'paket update --group GroupA  FSharp.Core ',
      ],
      [
        { packageName: 'FSharp.Core', version: '1.2.3' },
        'paket update --version 1.2.3  FSharp.Core ',
      ],
      [
        { group: 'GroupA', packageName: 'FSharp.Core', version: '1.2.3' },
        'paket update --group GroupA  --version 1.2.3  FSharp.Core ',
      ],
    ])(
      'can specify parameters (%o)',
      async (command: UpdatePackage, expected) => {
        const execSnapshots = mockExecAll();

        await runPaketUpdate(packageFilePath, [command]);

        expect(execSnapshots.map((s) => s.cmd)).toEqual([expected]);
      },
    );

    it('run all update commands in a single exec call', async () => {
      const execSnapshots = mockExecAll();

      await runPaketUpdate(packageFilePath, [
        { packageName: 'xunit', version: '2.9.3', group: 'Main' },
        { packageName: 'FAKE', version: '5.16', group: 'GroupA' },
      ]);

      expect(execSnapshots.map((s) => s.cmd)).toEqual([
        'paket update --group Main  --version 2.9.3  xunit ',
        'paket update --group GroupA  --version 5.16  FAKE ',
      ]);
    });

    it('quotes parameters containing spaces', async () => {
      const execSnapshots = mockExecAll();

      await runPaketUpdate(packageFilePath, [
        { packageName: 'FSharp Core', group: 'Group A', version: '1 2 3' },
      ]);

      expect(execSnapshots.map((s) => s.cmd)).toEqual([
        `paket update --group 'Group A'  --version '1 2 3'  'FSharp Core' `,
      ]);
    });
  });
});
