import { getName } from '../../../../test/util';
import { setAdminConfig } from '../../../config/admin';
import { SYSTEM_INSUFFICIENT_MEMORY } from '../../../constants/error-messages';
import { getPkgReleases as _getPkgReleases } from '../../../datasource';
import { logger } from '../../../logger';
import { VolumeOption, rawExec as _rawExec } from '../common';
import {
  generateDockerCommand,
  getDockerTag,
  prefetchDockerImage,
  removeDanglingContainers,
  removeDockerContainer,
  resetPrefetchedImages,
} from '.';

const rawExec: jest.Mock<typeof _rawExec> = _rawExec as any;
jest.mock('../common');

const getPkgReleases: jest.Mock<typeof _getPkgReleases> =
  _getPkgReleases as any;
jest.mock('../../../datasource');

describe(getName(), () => {
  const execOpts = { encoding: 'utf-8' };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('prefetchDockerImage', () => {
    beforeEach(() => {
      rawExec.mockResolvedValue(null as never);
      resetPrefetchedImages();
    });

    it('runs prefetch command', async () => {
      await prefetchDockerImage('foo:1.2.3');
      expect(rawExec).toHaveBeenCalledWith('docker pull foo:1.2.3', execOpts);
    });

    it('performs prefetch once for each image', async () => {
      await prefetchDockerImage('foo:1.0.0');
      await prefetchDockerImage('foo:2.0.0');
      await prefetchDockerImage('bar:3.0.0');
      await prefetchDockerImage('foo:1.0.0');

      expect(rawExec).toHaveBeenNthCalledWith(
        1,
        'docker pull foo:1.0.0',
        execOpts
      );
      expect(rawExec).toHaveBeenNthCalledWith(
        2,
        'docker pull foo:2.0.0',
        execOpts
      );
      expect(rawExec).toHaveBeenNthCalledWith(
        3,
        'docker pull bar:3.0.0',
        execOpts
      );
      expect(rawExec).toHaveBeenCalledTimes(3);
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
  });

  describe('removeDockerContainer', () => {
    it('gracefully handles container list error', async () => {
      rawExec.mockRejectedValueOnce('unknown' as never);
      await expect(removeDockerContainer('bar', 'foo_')).resolves.not.toThrow();
    });

    it('gracefully handles container removal error', async () => {
      rawExec.mockResolvedValueOnce({ stdout: '12345' } as never);
      rawExec.mockRejectedValueOnce('unknown' as never);
      await expect(removeDockerContainer('bar', 'foo_')).resolves.not.toThrow();
    });

    it('gracefully handles empty container list', async () => {
      rawExec.mockResolvedValueOnce({ stdout: '\n' } as never);
      await expect(removeDockerContainer('bar', 'foo_')).resolves.not.toThrow();
    });

    it('runs Docker commands for container removal', async () => {
      rawExec.mockResolvedValueOnce({ stdout: '12345' } as never);
      rawExec.mockResolvedValueOnce(null as never);
      await removeDockerContainer('bar', 'foo_');
      expect(rawExec).toHaveBeenNthCalledWith(
        1,
        'docker ps --filter name=foo_bar -aq',
        execOpts
      );
      expect(rawExec).toHaveBeenNthCalledWith(
        2,
        'docker rm -f 12345',
        execOpts
      );
    });
  });

  describe('removeDanglingContainers', () => {
    beforeEach(() => {
      setAdminConfig({ binarySource: 'docker' });
    });

    it('short-circuits in non-Docker environment', async () => {
      setAdminConfig({ binarySource: 'global' });
      await removeDanglingContainers();
      expect(rawExec).not.toHaveBeenCalled();
    });

    it('handles insufficient memory error', async () => {
      rawExec.mockRejectedValueOnce({ errno: 'ENOMEM' } as never);
      await expect(removeDanglingContainers).rejects.toThrow(
        SYSTEM_INSUFFICIENT_MEMORY
      );
    });

    it('handles missing Docker daemon', async () => {
      rawExec.mockRejectedValueOnce({
        stderr: 'Cannot connect to the Docker daemon',
      } as never);
      await removeDanglingContainers();
      expect(rawExec).toHaveBeenNthCalledWith(
        1,
        'docker ps --filter label=renovate_child -aq',
        execOpts
      );
      expect(rawExec).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('handles unknown error', async () => {
      rawExec.mockRejectedValueOnce('unknown' as never);
      await removeDanglingContainers();
      expect(rawExec).toHaveBeenNthCalledWith(
        1,
        'docker ps --filter label=renovate_child -aq',
        execOpts
      );
      expect(rawExec).toHaveBeenCalledTimes(1);
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('handles empty container list ', async () => {
      rawExec.mockResolvedValueOnce({ stdout: '\n\n\n' } as never);
      await removeDanglingContainers();
      expect(rawExec).toHaveBeenNthCalledWith(
        1,
        'docker ps --filter label=renovate_child -aq',
        execOpts
      );
      expect(rawExec).toHaveBeenCalledTimes(1);
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    });

    it('removes containers', async () => {
      rawExec.mockResolvedValueOnce({ stdout: '111\n222\n333' } as never);
      rawExec.mockResolvedValueOnce(null as never);
      await removeDanglingContainers();
      expect(rawExec).toHaveBeenNthCalledWith(
        1,
        'docker ps --filter label=renovate_child -aq',
        execOpts
      );
      expect(rawExec).toHaveBeenNthCalledWith(
        2,
        'docker rm -f 111 222 333',
        execOpts
      );
      expect(rawExec).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateDockerCommand', () => {
    const preCommands = [null, 'foo', undefined];
    const commands = ['bar'];
    const postCommands = [undefined, 'baz', null];
    const envVars = ['FOO', 'BAR'];
    const image = 'sample_image';
    const dockerOptions = {
      preCommands,
      postCommands,
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
      `bash -l -c "foo && bar && baz"`;

    beforeEach(() => {
      setAdminConfig({ dockerUser: 'some-user' });
    });

    it('returns executable command', async () => {
      rawExec.mockResolvedValue(null as never);
      const res = await generateDockerCommand(commands, dockerOptions);
      expect(res).toBe(command(image));
    });

    it('handles volumes', async () => {
      rawExec.mockResolvedValue(null as never);
      const volumes: VolumeOption[] = [
        '/tmp/foo',
        ['/tmp/bar', `/tmp/bar`],
        ['/tmp/baz', `/home/baz`],
      ];
      const res = await generateDockerCommand(commands, {
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

    it('handles tag parameter', async () => {
      rawExec.mockResolvedValue(null as never);
      const res = await generateDockerCommand(commands, {
        ...dockerOptions,
        tag: '1.2.3',
      });
      expect(res).toBe(command(`${image}:1.2.3`));
    });

    it('handles tag constraint', async () => {
      rawExec.mockResolvedValue(null as never);
      getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.2.3' },
          { version: '1.2.4' },
          { version: '2.0.0' },
        ],
      } as never);
      const res = await generateDockerCommand(commands, {
        ...dockerOptions,
        tagScheme: 'npm',
        tagConstraint: '^1.2.3',
      });
      expect(res).toBe(command(`${image}:1.2.4`));
    });
  });
});
