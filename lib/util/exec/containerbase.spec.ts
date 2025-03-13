import { GlobalConfig } from '../../config/global';
import * as _datasource from '../../modules/datasource';
import {
  generateInstallCommands,
  isDynamicInstall,
  resolveConstraint,
} from './containerbase';
import type { ToolConstraint } from './types';

vi.mock('../../modules/datasource');

const datasource = vi.mocked(_datasource);

describe('util/exec/containerbase', () => {
  describe('isDynamicInstall()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
      delete process.env.CONTAINERBASE;
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
      process.env.CONTAINERBASE = 'true';
      const toolConstraints: ToolConstraint[] = [
        { toolName: 'node' },
        { toolName: 'invalid' },
      ];
      expect(isDynamicInstall(toolConstraints)).toBeFalse();
    });

    it('returns true if supported tools', () => {
      GlobalConfig.set({ binarySource: 'install' });
      process.env.CONTAINERBASE = 'true';
      const toolConstraints: ToolConstraint[] = [{ toolName: 'npm' }];
      expect(isDynamicInstall(toolConstraints)).toBeTrue();
    });
  });

  describe('resolveConstraint()', () => {
    it('returns from config', async () => {
      expect(
        await resolveConstraint({ toolName: 'composer', constraint: '1.1.0' }),
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
        '2.1.0-a.1',
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

    it('supports rust docker tags', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1' },
          { version: '1.65' },
          { version: '1.65.0' },
          { version: '1.65.0-slim' },
          { version: '1.65.0-buster' },
          { version: '1.66' },
        ],
      });
      expect(await resolveConstraint({ toolName: 'rust' })).toBe('1.65.0');
    });

    it('throws for unknown tools', async () => {
      await expect(resolveConstraint({ toolName: 'whoops' })).rejects.toThrow(
        'Invalid tool to install: whoops',
      );
    });

    it('throws no releases', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [],
      });
      await expect(resolveConstraint({ toolName: 'composer' })).rejects.toThrow(
        'No tool releases found.',
      );
    });

    it('falls back to latest version if no compatible release', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.3' }],
      });
      expect(
        await resolveConstraint({ toolName: 'composer', constraint: '^3.1.0' }),
      ).toBe('1.2.3');
    });

    it('falls back to latest version if invalid constraint', async () => {
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.2.3' }],
      });
      expect(
        await resolveConstraint({ toolName: 'composer', constraint: 'whoops' }),
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
          await resolveConstraint({ toolName: 'python', constraint }),
        ).toBe(expected);
      },
    );

    it('removes pep440 ==', async () => {
      expect(
        await resolveConstraint({
          toolName: 'pipenv',
          constraint: '==2020.8.13',
        }),
      ).toBe('2020.8.13');
    });

    it.each`
      version                             | expected
      ${'>=2.5.0 <2.6.0'}                 | ${'2.5.1'}
      ${'>=2.6.0-0.0.pre <2.7.0-0.0.pre'} | ${'2.6.0-0.0.pre'}
      ${'>=2.8.0'}                        | ${'2.8.1'}
      ${'<2.9.0-0.1.pre'}                 | ${'2.8.1'}
      ${'2.10.0-0.2.pre'}                 | ${'2.10.0-0.2.pre'}
      ${'>=2.11.0-0.1.pre'}               | ${'2.12.0-4.1.pre'}
      ${'<=2.10.0'}                       | ${'2.8.1'}
    `(
      'supports flutter ranges "$version" => "$expected"',
      async ({ version: constraint, expected }) => {
        datasource.getPkgReleases.mockResolvedValueOnce({
          releases: [
            { version: '2.5.0-1.0.pre', isStable: false },
            { version: '2.5.0', isStable: true },
            { version: '2.5.1', isStable: true },
            { version: '2.6.0-0.0.pre', isStable: false },
            { version: '2.8.0', isStable: true },
            { version: '2.8.1', isStable: true },
            { version: '2.9.0-0.1.pre', isStable: false },
            { version: '2.12.0-4.1.pre', isStable: false },
          ],
        });
        expect(
          await resolveConstraint({ toolName: 'flutter', constraint }),
        ).toBe(expected);
      },
    );

    it.each`
      version              | expected
      ${'>2.17.0 <2.17.8'} | ${'2.17.7'}
      ${'>2.19.0'}         | ${'2.19.0-81.0.dev'}
      ${'<=2.17.5'}        | ${'2.17.5'}
      ${'<2.17.5'}         | ${'2.19.0-81.0.dev'}
      ${'<2.17.6'}         | ${'2.17.5'}
    `(
      'supports dart ranges "$version" => "$expected"',
      async ({ version: constraint, expected }) => {
        datasource.getPkgReleases.mockResolvedValueOnce({
          releases: [
            { version: '2.17.0-69.2.beta', isStable: false },
            { version: '2.17.0-7.0.dev', isStable: false },
            { version: '2.17.5', isStable: true },
            { version: '2.17.6', isStable: true },
            { version: '2.17.7', isStable: true },
            { version: '2.18.0', isStable: true },
            { version: '2.18.0-44.1.beta', isStable: false },
            { version: '2.18.0-99.0.dev', isStable: false },
            { version: '2.18.4', isStable: true },
            { version: '2.18.5', isStable: true },
            { version: '2.19.0-255.2.beta', isStable: false },
            { version: '2.19.0-81.0.dev', isStable: false },
          ],
        });
        expect(await resolveConstraint({ toolName: 'dart', constraint })).toBe(
          expected,
        );
      },
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
