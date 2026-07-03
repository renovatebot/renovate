import { codeBlock } from 'common-tags';
import type { UpdateLockedConfig } from '../types.ts';
import { updateLockedDependency } from './update-lock.ts';

describe('modules/manager/paket/update-lock', () => {
  describe('updateLockedDependency()', () => {
    const lockFileContent = codeBlock`
      NUGET
        remote: https://api.nuget.org/v3/index.json
          FSharp.Core (9.0.300)
          xunit (2.9.3)
      GROUP GroupA
      NUGET
        remote: https://api.nuget.org/v3/index.json
          xunit (2.9.2)
    `;
    const config: UpdateLockedConfig = {
      packageFile: '/app/test/paket.dependencies',
      lockFile: '/app/test/paket.lock',
      depName: 'FSharp.Core',
      currentVersion: '9.0.300',
      newVersion: '9.0.301',
      lockFileContent,
    };

    it('returns already-updated if the lock file contains the new version', () => {
      const result = updateLockedDependency({
        ...config,
        currentVersion: '9.0.299',
        newVersion: '9.0.300',
      });

      expect(result).toEqual({ status: 'already-updated' });
    });

    it('returns unsupported if the lock file contains the old version', () => {
      const result = updateLockedDependency(config);

      expect(result).toEqual({ status: 'unsupported' });
    });

    it('returns unsupported if only one group is at the new version', () => {
      const result = updateLockedDependency({
        ...config,
        depName: 'xunit',
        currentVersion: '2.9.2',
        newVersion: '2.9.3',
      });

      expect(result).toEqual({ status: 'unsupported' });
    });

    it('returns unsupported if the dependency is missing from the lock file', () => {
      const result = updateLockedDependency({
        ...config,
        depName: 'Newtonsoft.Json',
        currentVersion: '13.0.2',
        newVersion: '13.0.3',
      });

      expect(result).toEqual({ status: 'unsupported' });
    });

    it('returns update-failed if the lock file content is missing', () => {
      const result = updateLockedDependency({
        ...config,
        lockFileContent: undefined,
      });

      expect(result).toEqual({ status: 'update-failed' });
    });
  });
});
