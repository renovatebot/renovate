const { homedir } = require('os');
const Docker = require('dockerode');
const EventEmitter = require('events');
const { PassThrough } = require('stream');

const docker = new Docker();

class Container {
  async create(cwd) {
    const Volumes = {};
    Volumes[`${homedir()}:/root`] = {};
    Volumes[`${cwd}:/git`] = {};

    this.container = await docker.createContainer({
      Image: 'alpine/git',
      NetworkMode: 'host',
      OpenStdin: true,
      Entrypoint: 'tail',
      Volumes,
    });
    await this.container.start();
    logger.debug({ container: this.container.id }, 'Started Docker container');
  }

  spawn(command, args) {
    const { container } = this;
    const spawned = new EventEmitter();
    spawned.stdout = new PassThrough();
    spawned.stderr = new PassThrough();
    (async () => {
      try {
        const exec = await container.exec({
          Cmd: [command, ...args],
          AttachStdout: true,
          AttachStderr: true,
        });
        await exec.start({ hijack: true, stdin: true });
        exec.output.on('close', async () => {
          const info = await exec.inspect();
          spawned.emit('exit', info.ExitCode, null);
          spawned.emit('close', info.ExitCode, null);
        });
        docker.modem.demuxStream(exec.output, spawned.stdout, spawned.stderr);
      } catch (err) {
        logger.warn({ err }, 'Docker Error');
        spawned.emit('error', err);
      }
    })();
    return spawned;
  }

  async remove() {
    const { id } = this.container;
    await this.container.remove({
      v: true,
      force: true,
    });
    logger.info({ container: id }, 'Removed Docker container');
  }
}

module.exports.Container = Container;
