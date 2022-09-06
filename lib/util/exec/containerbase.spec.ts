import { mocked } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import * as _datasource from '../../modules/datasource';
import {
  generateInstallCommands,
  isDynamicInstall,
  resolveConstraint,
} from './containerbase';
import type { ToolConstraint } from './types';

jest.mock('../../modules/datasource');

const datasource = mocked(_datasource);

describe('util/exec/containerbase', () => {
  describe('isDynamicInstall()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
      delete process.env.BUILDPACK;
    });

    it('returns false if binarySource is not install', () => {
      expect(isDynamicInstall()).toBeFalse();
    });

    it('returns false if not containerbase', () => {
      GlobalConfig.set({ binarySource: 'install' });
      expect(isDynamicInstall()).toBeFalse();
    });

    it('returns false if any unsupported tools', () => {
      GlobalConfig.set({ binarySource: 'install' });
      process.env.BUILDPACK = 'true';
      const toolConstraints: ToolConstraint[] = [
        { toolName: 'node' },
        { toolName: 'invalid' },
      ];
      expect(isDynamicInstall(toolConstraints)).toBeFalse();
    });

    it('returns true if supported tools', () => {
      GlobalConfig.set({ binarySource: 'install' });
      process.env.BUILDPACK = 'true';
      const toolConstraints: ToolConstraint[] = [{ toolName: 'npm' }];
      expect(isDynamicInstall(toolConstraints)).toBeTrue();
    });
  });

  describe('resolveConstraint()', () => {
    it('returns from config', async () => {
      expect(
        await resolveConstraint({ toolName: 'composer', constraint: '1.1.0' })
      ).toBe('1.1.0');
    });

    it('returns highest stable', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.1.0' },
          { version: '1.3.0' },
          { version: '2.0.14' },
          { version: '2.1.0' },
          { version: '2.2.0-pre.0' },
        ],
      });
      expect(await resolveConstraint({ toolName: 'composer' })).toBe('2.1.0');
    });

    it('returns highest unstable', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '2.0.14-b.1' }, { version: '2.1.0-a.1' }],
      });
      expect(await resolveConstraint({ toolName: 'composer' })).toBe(
        '2.1.0-a.1'
      );
    });

    it('respects latest', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        tags: {
          latest: '2.0.14',
        },
        releases: [
          { version: '1.0.0' },
          { version: '1.1.0' },
          { version: '1.3.0' },
          { version: '2.0.14' },
          { version: '2.1.0' },
          { version: '2.2.0-pre.0' },
        ],
      });
      expect(await resolveConstraint({ toolName: 'composer' })).toBe('2.0.14');
    });

    it('throws for unknown tools', async () => {
      await expect(resolveConstraint({ toolName: 'whoops' })).rejects.toThrow(
        'Invalid tool to install: whoops'
      );
    });

    it('throws no releases', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [],
      });
      await expect(resolveConstraint({ toolName: 'composer' })).rejects.toThrow(
        'No tool releases found.'
      );
    });

    it('falls back to latest version if no compatible release', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.3' }],
      });
      expect(
        await resolveConstraint({ toolName: 'composer', constraint: '^3.1.0' })
      ).toBe('1.2.3');
    });

    it('falls back to latest version if invalid constraint', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.3' }],
      });
      expect(
        await resolveConstraint({ toolName: 'composer', constraint: 'whoops' })
      ).toBe('1.2.3');
    });

    it.each`
      version         | expected
      ${'^3.9.0'}     | ${'3.10.4'}
      ${'^3.9'}       | ${'3.10.4'}
      ${'3.9.*'}      | ${'3.9.1'}
      ${'>3.8,<3.10'} | ${'3.9.1'}
      ${'==3.9.*'}    | ${'3.9.1'}
    `(
      'supports python ranges "$version" => "$expected"',
      async ({ version: constraint, expected }) => {
        datasource.getPkgReleases.mockResolvedValueOnce({
          releases: [
            { version: '3.9.0' },
            { version: '3.9.1' },
            { version: '3.10.0' },
            { version: '3.10.4' },
          ],
        });
        expect(
          await resolveConstraint({ toolName: 'python', constraint })
        ).toBe(expected);
      }
    );
  });

  describe('generateInstallCommands()', () => {
    beforeEach(() => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.1.0' },
          { version: '1.3.0' },
          { version: '2.0.14' },
          { version: '2.1.0' },
        ],
      });
    });

    it('returns install commands', async () => {
      const toolConstraints: ToolConstraint[] = [
        {
          toolName: 'composer',
        },
      ];
      expect(await generateInstallCommands(toolConstraints)).toEqual([
        'install-tool composer 2.1.0',
      ]);
    });

    it('hashes npm', async () => {
      const toolConstraints: ToolConstraint[] = [{ toolName: 'npm' }];
      const res = await generateInstallCommands(toolConstraints);
      expect(res).toEqual([
        'install-tool npm 2.1.0',
        'hash -d npm 2>/dev/null || true',
      ]);
    });
  });
});
