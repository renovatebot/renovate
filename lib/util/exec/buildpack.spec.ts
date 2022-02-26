import { mocked } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import * as _datasource from '../../datasource';
import {
  generateInstallCommands,
  isDynamicInstall,
  resolveConstraint,
} from './buildpack';
import type { ToolConstraint } from './types';

jest.mock('../../datasource');

const datasource = mocked(_datasource);

describe('util/exec/buildpack', () => {
  describe('isDynamicInstall()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
      delete process.env.BUILDPACK;
    });
    it('returns false if binarySource is not install', () => {
      expect(isDynamicInstall()).toBeFalse();
    });
    it('returns false if not buildpack', () => {
      GlobalConfig.set({ binarySource: 'install' });
      expect(isDynamicInstall()).toBeFalse();
    });
    it('returns false if any unsupported tools', () => {
      GlobalConfig.set({ binarySource: 'install' });
      process.env.BUILDPACK = 'true';
      const toolConstraints: ToolConstraint[] = [
        { toolName: 'node' },
        { toolName: 'npm' },
      ];
      expect(isDynamicInstall(toolConstraints)).toBeFalse();
    });
    it('returns false if supported tools', () => {
      GlobalConfig.set({ binarySource: 'install' });
      process.env.BUILDPACK = 'true';
      const toolConstraints: ToolConstraint[] = [{ toolName: 'npm' }];
      expect(isDynamicInstall(toolConstraints)).toBeTrue();
    });
  });
  describe('resolveConstraint()', () => {
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
    it('returns from config', async () => {
      expect(
        await resolveConstraint({ toolName: 'composer', constraint: '1.1.0' })
      ).toBe('1.1.0');
    });

    it('returns from latest', async () => {
      expect(await resolveConstraint({ toolName: 'composer' })).toBe('2.1.0');
    });

    it('throws for unknown tools', async () => {
      datasource.getPkgReleases.mockReset();
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [],
      });
      await expect(resolveConstraint({ toolName: 'whoops' })).rejects.toThrow(
        'Invalid tool to install: whoops'
      );
    });

    it('throws no releases', async () => {
      datasource.getPkgReleases.mockReset();
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [],
      });
      await expect(resolveConstraint({ toolName: 'composer' })).rejects.toThrow(
        'No tool releases found.'
      );
    });

    it('falls back to latest version if no compatible release', async () => {
      datasource.getPkgReleases.mockReset();
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.3' }],
      });
      expect(
        await resolveConstraint({ toolName: 'composer', constraint: '^3.1.0' })
      ).toBe('1.2.3');
    });

    it('falls back to latest version if invalid constraint', async () => {
      datasource.getPkgReleases.mockReset();
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.3' }],
      });
      expect(
        await resolveConstraint({ toolName: 'composer', constraint: 'whoops' })
      ).toBe('1.2.3');
    });
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
      expect(await generateInstallCommands(toolConstraints))
        .toMatchInlineSnapshot(`
        Array [
          "install-tool composer 2.1.0",
        ]
      `);
    });
    it('hashes npm', async () => {
      const toolConstraints: ToolConstraint[] = [{ toolName: 'npm' }];
      const res = await generateInstallCommands(toolConstraints);
      expect(res).toHaveLength(2);
      expect(res[1]).toBe('hash -d npm 2>/dev/null || true');
    });
  });
});
