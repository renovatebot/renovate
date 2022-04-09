import type { HostRule } from '../../types';
import * as cp from 'child_process';
import * as net from 'net';
import Agent from 'ssh-agent-js/client/index';
import { join } from 'upath';
import { logger } from '../../logger';
import is from '@sindresorhus/is';

export class SshSocket {
  agent_process: cp.ChildProcess | undefined;
  agent: Agent | undefined;

  async start(cacheDir: string) {
    if (!is.nonEmptyStringAndNotWhitespace(process.env.SSH_AUTH_SOCK)) {
      let agent_socket = join(cacheDir, '.ssh-agent');
      this.agent_process = cp.spawn('ssh-agent', ['-d', '-a', agent_socket]);
      this.agent_process.on('error', function (err) {
        logger.error({ err }, 'Unable to spawn ssh-agent');
      });
      await new Promise((r) => setTimeout(r, 2000));
      process.env.SSH_AUTH_SOCK = agent_socket;
    }
    try {
      let socket = net.connect(process.env.SSH_AUTH_SOCK);
      this.agent = new Agent(socket);
    } catch (err) {
      logger.warn({ err }, 'Unable to connect to ssh-agent');
    }
  }

  async addKeyFromHostRule(hostRule: HostRule) {
    if (hostRule.sshKey && this.agent) {
      await this.agent.add_key(hostRule.sshKey);
    }
  }

  async clear() {
    if (this.agent) {
      await this.agent.remove_all_keys();
    }
  }

  stop() {
    if (this.agent_process) {
      this.agent_process.kill('SIGINT');
    }
  }
}
