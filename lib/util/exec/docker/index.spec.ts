import { mockExecAll, mockExecSequence } from '../../../../test/exec-util';
import { GlobalConfig } from '../../../config/global';
import { SYSTEM_INSUFFICIENT_MEMORY } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { getPkgReleases as _getPkgReleases } from '../../../modules/datasource';
import type { VolumeOption } from '../types';
import {
  generateDockerCommand,
  getDockerTag,
  prefetchDockerImage,
  removeDanglingContainers,
  removeDockerContainer,
  resetPrefetchedImages,
} from '.';

const getPkgReleases: jest.Mock<typeof _getPkgReleases> =
  _getPkgReleases as any;
jest.mock('../../../modules/datasource');

describe('util/exec/docker/index', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('prefetchDockerImage', () => {
    beforeEach(() => {
      resetPrefetchedImages();
    });

    it('runs prefetch command', async () => {
      const execSnapshots = mockExecAll();
      await prefetchDockerImage('foo:1.2.3');
      expect(execSnapshots).toMatchObject([{ cmd: 'docker pull foo:1.2.3' }]);
    });

    it('performs prefetch once for each image', async () => {
      const execSnapshots = mockExecAll();
      await prefetchDockerImage('foo:1.0.0');
      await prefetchDockerImage('foo:2.0.0');
      await prefetchDockerImage('bar:3.0.0');
      await prefetchDockerImage('foo:1.0.0');

      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull foo:1.0.0' },
        { cmd: 'docker pull foo:2.0.0' },
        { cmd: 'docker pull bar:3.0.0' },
      ]);
    });
  });

  describe('getDockerTag', () => {
    it('returns "latest" for invalid constraint', async () => {
      const res = await getDockerTag('foo', '!@#$%', 'semver');
      expect(res).toBe('latest');
    });

    it('returns "latest" for bad release results', async () => {
      getPkgReleases.mockResolvedValueOnce(undefined as never);
      expect(await getDockerTag('foo', '1.2.3', 'semver')).toBe('latest');

      getPkgReleases.mockResolvedValueOnce({} as never);
      expect(await getDockerTag('foo', '1.2.3', 'semver')).toBe('latest');

      getPkgReleases.mockResolvedValueOnce({ releases: [] } as never);
      expect(await getDockerTag('foo', '1.2.3', 'semver')).toBe('latest');
    });

    it('returns tag for good release results', async () => {
      const releases = [
        { version: '1.0.0' },
        { version: '1.0.1' },
        { version: '1.0.2' },
        { version: '1.2.0' },
        { version: '1.2.1' },
        { version: '1.2.2' },
        { version: '1.2.3' },
        { version: '1.2.4' },
        { version: '1.9.0' },
        { version: '1.9.1' },
        { version: '1.9.2' },
        { version: '1.9.9' },
        { version: '2.0.0' },
        { version: '2.0.1' },
        { version: '2.0.2' },
        { version: '2.1.0' },
        { version: '2.1.1' },
        { version: '2.1.2' },
      ];
      getPkgReleases.mockResolvedValueOnce({ releases } as never);
      expect(await getDockerTag('foo', '^1.2.3', 'npm')).toBe('1.9.9');
    });

    it('filters out node unstable', async () => {
      const releases = [
        { version: '12.0.0' },
        { version: '13.0.1' },
        { version: '14.0.2' },
        { version: '15.0.2' },
      ];
      getPkgReleases.mockResolvedValueOnce({ releases } as never);
      expect(await getDockerTag('foo', '>=12', 'node')).toBe('14.0.2');
    });
  });

  describe('removeDockerContainer', () => {
    it('gracefully handles container list error', async () => {
      mockExecAll(new Error('unknown'));
      await expect(removeDockerContainer('bar', 'foo_')).resolves.not.toThrow();
    });

    it('gracefully handles container removal error', async () => {
      mockExecSequence([{ stdout: '12345', stderr: '' }, new Error('unknown')]);
      await expect(removeDockerContainer('bar', 'foo_')).resolves.not.toThrow();
    });

    it('gracefully handles empty container list', async () => {
      mockExecAll({ stdout: '\n', stderr: '' });
      await expect(removeDockerContainer('bar', 'foo_')).resolves.not.toThrow();
    });

    it('runs Docker commands for container removal', async () => {
      const execSnapshots = mockExecSequence([
        { stdout: '12345', stderr: '' },
        { stdout: '', stderr: '' },
      ]);
      await removeDockerContainer('bar', 'foo_');
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker ps --filter name=foo_bar -aq' },
        { cmd: 'docker rm -f 12345' },
      ]);
    });
  });

  describe('removeDanglingContainers', () => {
    beforeEach(() => {
      GlobalConfig.set({ binarySource: 'docker' });
    });

    it('short-circuits in non-Docker environment', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ binarySource: 'global' });
      await removeDanglingContainers();
      expect(execSnapshots).toBeEmpty();
    });

    it('handles insufficient memory error', async () => {
      const err: Error & { errno: string } = new Error() as never;
      err.errno = 'ENOMEM';
      mockExecAll(err);
      await expect(removeDanglingContainers).rejects.toThrow(
        SYSTEM_INSUFFICIENT_MEMORY
      );
    });

    it('handles missing Docker daemon', async () => {
      const err: Error & { stderr: string } = new Error() as never;
      err.stderr = 'Cannot connect to the Docker daemon';
      const execSnapshots = mockExecAll(err);
      await removeDanglingContainers();
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker ps --filter label=renovate_child -aq' },
      ]);
      expect(logger.info).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('handles unknown error', async () => {
      const execSnapshots = mockExecAll(new Error('unknown'));
      await removeDanglingContainers();
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker ps --filter label=renovate_child -aq' },
      ]);
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('handles empty container list ', async () => {
      const execSnapshots = mockExecAll({ stdout: '\n\n\n', stderr: '' });
      await removeDanglingContainers();
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker ps --filter label=renovate_child -aq' },
      ]);
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    });

    it('removes containers', async () => {
      const execSnapshots = mockExecSequence([
        { stdout: '111\n222\n333', stderr: '' },
        { stdout: '', stderr: '' },
      ]);
      await removeDanglingContainers();
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker ps --filter label=renovate_child -aq' },
        { cmd: 'docker rm -f 111 222 333' },
      ]);
    });
  });

  describe('generateDockerCommand', () => {
    const preCommands = [null as never, 'foo', undefined as never];
    const commands = ['bar'];
    const envVars = ['FOO', 'BAR'];
    const image = 'sample_image';
    const dockerOptions = {
      image,
      cwd: '/tmp/foobar',
      envVars,
    };
    const command = (img: string, vol?: string): string =>
      `docker run --rm ` +
      `--name=renovate_sample_image ` +
      `--label=renovate_child ` +
      `--user=some-user ` +
      (vol ? `${vol} ` : '') +
      `-e FOO -e BAR ` +
      `-w "/tmp/foobar" ` +
      `renovate/${img} ` +
      `bash -l -c "foo && bar"`;

    beforeEach(() => {
      GlobalConfig.set({ dockerUser: 'some-user' });
    });

    it('returns executable command', async () => {
      mockExecAll();
      const res = await generateDockerCommand(
        commands,
        preCommands,
        dockerOptions
      );
      expect(res).toBe(command(image));
    });

    it('handles volumes', async () => {
      mockExecAll();
      const volumes: VolumeOption[] = [
        '/tmp/foo',
        ['/tmp/bar', `/tmp/bar`],
        ['/tmp/baz', `/home/baz`],
      ];
      const res = await generateDockerCommand(commands, preCommands, {
        ...dockerOptions,
        volumes: [...volumes, ...volumes],
      });
      expect(res).toBe(
        command(
          image,
          `-v "/tmp/foo":"/tmp/foo" -v "/tmp/bar":"/tmp/bar" -v "/tmp/baz":"/home/baz"`
        )
      );
    });

    it('adds custom containerbaseDir to volumes', async () => {
      mockExecAll();
      GlobalConfig.set({
        cacheDir: '/tmp/cache',
        containerbaseDir: '/tmp/containerbase',
        dockerUser: 'some-user',
      });
      const volumes: VolumeOption[] = ['/tmp/foo'];
      const res = await generateDockerCommand(commands, preCommands, {
        ...dockerOptions,
        volumes: [...volumes, ...volumes],
      });
      expect(res).toBe(
        command(
          image,
          `-v "/tmp/cache":"/tmp/cache" -v "/tmp/containerbase":"/tmp/containerbase" -v "/tmp/foo":"/tmp/foo"`
        )
      );
    });

    it('adds dedupes default containerbaseDir in volumes', async () => {
      mockExecAll();
      GlobalConfig.set({
        cacheDir: '/tmp/cache',
        containerbaseDir: '/tmp/cache/containerbase',
        dockerUser: 'some-user',
      });
      const volumes: VolumeOption[] = ['/tmp/foo'];
      const res = await generateDockerCommand(commands, preCommands, {
        ...dockerOptions,
        volumes: [...volumes, ...volumes],
      });
      expect(res).toBe(
        command(image, `-v "/tmp/cache":"/tmp/cache" -v "/tmp/foo":"/tmp/foo"`)
      );
    });

    it('handles tag parameter', async () => {
      mockExecAll();
      const res = await generateDockerCommand(commands, preCommands, {
        ...dockerOptions,
        tag: '1.2.3',
      });
      expect(res).toBe(command(`${image}:1.2.3`));
    });

    it('handles tag constraint', async () => {
      mockExecAll();
      getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.2.3' },
          { version: '1.2.4' },
          { version: '2.0.0' },
        ],
      } as never);
      const res = await generateDockerCommand(commands, preCommands, {
        ...dockerOptions,
        tagScheme: 'npm',
        tagConstraint: '^1.2.3',
      });
      expect(res).toBe(command(`${image}:1.2.4`));
    });
  });
});
