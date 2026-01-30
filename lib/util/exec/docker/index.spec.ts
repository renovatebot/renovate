import { GlobalConfig } from '../../../config/global.ts';
import { SYSTEM_INSUFFICIENT_MEMORY } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import type { VolumeOption } from '../types.ts';
import {
  generateDockerCommand,
  prefetchDockerImage,
  removeDanglingContainers,
  removeDockerContainer,
  resetPrefetchedImages,
  sideCarName,
} from './index.ts';
import { mockExecAll, mockExecSequence } from '~test/exec-util.ts';

vi.mock('../../../modules/datasource/index.ts', () => ({
  getPkgReleases: vi.fn(),
}));

describe('util/exec/docker/index', () => {
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
        { cmd: 'docker ps --filter name=foo_sidecar -aq' },
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
        SYSTEM_INSUFFICIENT_MEMORY,
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

    it('handles empty container list', async () => {
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
    const dockerOptions = {
      cwd: '/tmp/foobar',
      envVars,
    };
    const command = (img: string, vol?: string, opts?: string): string =>
      `docker run --rm ` +
      `--name=renovate_${img} ` +
      `--label=renovate_child ` +
      `--user=some-user ` +
      (vol ? `${vol} ` : '') +
      (opts ? `${opts} ` : '') +
      `-e FOO -e BAR ` +
      `-w "/tmp/foobar" ` +
      `ghcr.io/renovatebot/base-image ` +
      `bash -l -c "foo && bar"`;

    beforeEach(() => {
      GlobalConfig.set({
        dockerUser: 'some-user',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
    });

    it('returns executable command', async () => {
      mockExecAll();
      const res = await generateDockerCommand(
        commands,
        preCommands,
        dockerOptions,
        'ghcr.io/renovatebot/base-image',
      );
      expect(res).toBe(command(sideCarName));
    });

    it('adds `|| true` if ignoreFailure is set on a pre-command', async () => {
      mockExecAll();
      const res = await generateDockerCommand(
        ['ls'],
        [
          'foo',
          {
            command: ['bar'],
            ignoreFailure: true,
          },
          {
            command: ['bleh'],
          },
          'baz',
        ],
        dockerOptions,
        'ghcr.io/renovatebot/base-image',
      );
      expect(res).toBe(
        `docker run --rm ` +
          `--name=renovate_${sideCarName} ` +
          `--label=renovate_child ` +
          `--user=some-user ` +
          `-e FOO -e BAR ` +
          `-w "/tmp/foobar" ` +
          `ghcr.io/renovatebot/base-image ` +
          `bash -l -c "foo && bar || true && bleh && baz && ls"`,
      );
    });

    it('adds `|| true` if ignoreFailure is set on a command', async () => {
      mockExecAll();
      const res = await generateDockerCommand(
        [
          'foo',
          {
            command: ['bar'],
            ignoreFailure: true,
          },
          {
            command: ['bleh'],
          },
          'baz',
        ],
        ['pre'],
        dockerOptions,
        'ghcr.io/renovatebot/base-image',
      );
      expect(res).toBe(
        `docker run --rm ` +
          `--name=renovate_${sideCarName} ` +
          `--label=renovate_child ` +
          `--user=some-user ` +
          `-e FOO -e BAR ` +
          `-w "/tmp/foobar" ` +
          `ghcr.io/renovatebot/base-image ` +
          `bash -l -c "pre && foo && bar || true && bleh && baz"`,
      );
    });

    it('handles volumes', async () => {
      mockExecAll();
      const volumes: VolumeOption[] = [
        '/tmp/foo',
        ['/tmp/bar', `/tmp/bar`],
        ['/tmp/baz', `/home/baz`],
      ];
      const res = await generateDockerCommand(
        commands,
        preCommands,
        {
          ...dockerOptions,
          volumes: [...volumes, ...volumes],
        },
        'ghcr.io/renovatebot/base-image',
      );
      expect(res).toBe(
        command(
          sideCarName,
          `-v "/tmp/foo":"/tmp/foo" -v "/tmp/bar":"/tmp/bar" -v "/tmp/baz":"/home/baz"`,
        ),
      );
    });

    it('adds custom containerbaseDir to volumes', async () => {
      mockExecAll();
      GlobalConfig.set({
        cacheDir: '/tmp/cache',
        containerbaseDir: '/tmp/containerbase',
        dockerUser: 'some-user',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const volumes: VolumeOption[] = ['/tmp/foo'];
      const res = await generateDockerCommand(
        commands,
        preCommands,
        {
          ...dockerOptions,
          volumes: [...volumes, ...volumes],
        },
        'ghcr.io/renovatebot/base-image',
      );
      expect(res).toBe(
        command(
          sideCarName,
          `-v "/tmp/cache":"/tmp/cache" -v "/tmp/containerbase":"/tmp/containerbase" -v "/tmp/foo":"/tmp/foo"`,
        ),
      );
    });

    it('adds dedupes default containerbaseDir in volumes', async () => {
      mockExecAll();
      GlobalConfig.set({
        cacheDir: '/tmp/cache',
        containerbaseDir: '/tmp/cache/containerbase',
        dockerUser: 'some-user',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const volumes: VolumeOption[] = ['/tmp/foo'];
      const res = await generateDockerCommand(
        commands,
        preCommands,
        {
          ...dockerOptions,
          volumes: [...volumes, ...volumes],
        },
        'ghcr.io/renovatebot/base-image',
      );
      expect(res).toBe(
        command(
          sideCarName,
          `-v "/tmp/cache":"/tmp/cache" -v "/tmp/foo":"/tmp/foo"`,
        ),
      );
    });

    it('add multiple docker cli option', async () => {
      mockExecAll();
      GlobalConfig.set({
        dockerUser: 'some-user',
        dockerCliOptions: '--memory=4g --cpus=".5"',
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
      });
      const res = await generateDockerCommand(
        commands,
        preCommands,
        {
          ...dockerOptions,
        },
        'ghcr.io/renovatebot/base-image',
      );
      expect(res).toBe(
        command(sideCarName, undefined, `--memory=4g --cpus=".5"`),
      );
    });

    // TODO: it('handles tag constraint', async () => {
    //   mockExecAll();
    // vi
    // .spyOn(modulesDatasource, 'getPkgReleases')
    // .mockResolvedValue(
    //   partial<modulesDatasource.ReleaseResult>({
    //     releases: [{ version: '5.5.5' }, { version: '6.0.0' }],
    //   })
    // );
    //   const res = await generateDockerCommand(commands, preCommands, {
    //     ...dockerOptions,
    //   });
    //   expect(res).toBe(command(`${image}:5.5.5`));
    // });
  });
});
