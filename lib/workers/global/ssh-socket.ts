import type { HostRule } from '../../types';
import * as cp from 'child_process';
import * as net from 'net';
import delay from 'delay';
import Agent from 'ssh-agent-js/client/index';
import { join } from 'upath';
import { logger } from '../../logger';
import is from '@sindresorhus/is';

export class SshSocket {
  agentProcess: cp.ChildProcess | undefined;
  agent: Agent | undefined;
  cacheDir: string;

  async setCacheDir(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  private async start(cacheDir: string) {
    if (is.nonEmptyStringAndNotWhitespace(process.env.SSH_AUTH_SOCK)) {
      logger.info('Found external ssh agent, skipping shh key processing,');
      return;
    }
    let agentSocket = join(cacheDir, '.ssh-agent');
    this.agentProcess = cp.spawn('ssh-agent', ['-d', '-a', agentSocket]);
    this.agentProcess.on('error', function (err) {
      logger.error({ err }, 'Unable to spawn ssh-agent');
    });
    await delay(2000);
    process.env.SSH_AUTH_SOCK = agentSocket;
    try {
      let socket = net.connect(process.env.SSH_AUTH_SOCK);
      this.agent = new Agent(socket);
    } catch (err) {
      logger.warn({ err }, 'Unable to connect to ssh-agent');
    }
  }

  async addKeyFromHostRule(hostRule: HostRule) {
    if (hostRule.sshKey) {
      if (!this.agent) {
        await this.start(this.cacheDir);
      }
      if (this.agent) {
        await this.agent.add_key(hostRule.sshKey);
      }
    }
  }

  async clear() {
    if (this.agent) {
      await this.agent.remove_all_keys();
    }
  }

  stop() {
    if (this.agentProcess) {
      this.agentProcess.kill('SIGINT');
    }
  }
}
