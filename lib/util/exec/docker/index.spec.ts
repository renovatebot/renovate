import { mockDeep } from 'jest-mock-extended';
import { mockExecAll, mockExecSequence } from '../../../../test/exec-util';
import { partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { SYSTEM_INSUFFICIENT_MEMORY } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import * as modulesDatasource from '../../../modules/datasource';
import type { VolumeOption } from '../types';
import {
  generateDockerCommand,
  getDockerTag,
  prefetchDockerImage,
  removeDanglingContainers,
  removeDockerContainer,
  resetPrefetchedImages,
  sideCarImage,
} from '.';

jest.mock('../../../modules/datasource', () => mockDeep());

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

  describe('getDockerTag', () => {
    it('returns "latest" for invalid constraint', async () => {
      const res = await getDockerTag('foo', '!@#$%', 'semver');
      expect(res).toBe('latest');
    });

    it('returns "latest" for bad release results', async () => {
      jest
        .spyOn(modulesDatasource, 'getPkgReleases')
        .mockResolvedValueOnce(undefined as never)
        .mockResolvedValueOnce(partial<modulesDatasource.ReleaseResult>())
        .mockResolvedValueOnce(
          partial<modulesDatasource.ReleaseResult>({ releases: [] }),
        );
      expect(await getDockerTag('foo', '1.2.3', 'semver')).toBe('latest');
      expect(await getDockerTag('foo', '1.2.3', 'semver')).toBe('latest');
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
      jest
        .spyOn(modulesDatasource, 'getPkgReleases')
        .mockResolvedValueOnce(
          partial<modulesDatasource.ReleaseResult>({ releases }),
        );
      expect(await getDockerTag('foo', '^1.2.3', 'npm')).toBe('1.9.9');
    });

    it('filters out node unstable', async () => {
      const releases = [
        { version: '12.0.0' },
        { version: '13.0.1' },
        { version: '14.0.2' },
        { version: '15.0.2' },
      ];
      jest
        .spyOn(modulesDatasource, 'getPkgReleases')
        .mockResolvedValueOnce(
          partial<modulesDatasource.ReleaseResult>({ releases }),
        );
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
    const image = sideCarImage;
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
      `ghcr.io/containerbase/sidecar ` +
      `bash -l -c "foo && bar"`;

    beforeEach(() => {
      GlobalConfig.set({
        dockerUser: 'some-user',
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
    });

    it('returns executable command', async () => {
      mockExecAll();
      const res = await generateDockerCommand(
        commands,
        preCommands,
        dockerOptions,
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
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
      const volumes: VolumeOption[] = ['/tmp/foo'];
      const res = await generateDockerCommand(commands, preCommands, {
        ...dockerOptions,
        volumes: [...volumes, ...volumes],
      });
      expect(res).toBe(
        command(
          image,
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
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
      const volumes: VolumeOption[] = ['/tmp/foo'];
      const res = await generateDockerCommand(commands, preCommands, {
        ...dockerOptions,
        volumes: [...volumes, ...volumes],
      });
      expect(res).toBe(
        command(image, `-v "/tmp/cache":"/tmp/cache" -v "/tmp/foo":"/tmp/foo"`),
      );
    });

    it('add multiple docker cli option', async () => {
      mockExecAll();
      GlobalConfig.set({
        dockerUser: 'some-user',
        dockerCliOptions: '--memory=4g --cpus=".5"',
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });
      const res = await generateDockerCommand(commands, preCommands, {
        ...dockerOptions,
      });
      expect(res).toBe(command(image, undefined, `--memory=4g --cpus=".5"`));
    });

    // TODO: it('handles tag constraint', async () => {
    //   mockExecAll();
    // jest
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
