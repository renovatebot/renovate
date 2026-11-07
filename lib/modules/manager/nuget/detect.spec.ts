import { fs } from '~test/util.ts';
import { detectGlobalConfig } from './index.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/nuget/detect', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('.detectGlobalConfig()', () => {
    it('detects nuget.config in home directory', async () => {
      fs.readSystemFile.mockImplementation((path) => {
        if (path.endsWith('.nuget/NuGet/NuGet.Config')) {
          return Promise.resolve(
            '<configuration><packageSources><add key="nuget.org" value="https://api.nuget.org/v3/index.json"/></packageSources></configuration>',
          );
        }
        return Promise.reject(new Error('not found'));
      });

      const res = await detectGlobalConfig();
      expect(res).toEqual({
        nugetConfig:
          '<configuration><packageSources><add key="nuget.org" value="https://api.nuget.org/v3/index.json"/></packageSources></configuration>',
        nugetConfigMerge: true,
      });
    });

    it('detects NuGet.Config from APPDATA on Windows', async () => {
      vi.stubEnv('APPDATA', 'C:\\Users\\test\\AppData\\Roaming');
      fs.readSystemFile.mockImplementation((path) => {
        if (path === 'C:/Users/test/AppData/Roaming/NuGet/NuGet.Config') {
          return Promise.resolve(
            '<configuration><packageSources><add key="nuget.org" value="https://api.nuget.org/v3/index.json"/></packageSources></configuration>',
          );
        }
        return Promise.reject(new Error('not found'));
      });

      const res = await detectGlobalConfig();
      expect(res).toEqual({
        nugetConfig:
          '<configuration><packageSources><add key="nuget.org" value="https://api.nuget.org/v3/index.json"/></packageSources></configuration>',
        nugetConfigMerge: true,
      });
    });

    it('handles no nuget.config found', async () => {
      fs.readSystemFile.mockRejectedValue(new Error('not found'));
      const res = await detectGlobalConfig();
      expect(res).toEqual({});
    });

    it('handles empty nuget.config content', async () => {
      fs.readSystemFile.mockResolvedValue('');
      const res = await detectGlobalConfig();
      expect(res).toEqual({});
    });
  });
});
