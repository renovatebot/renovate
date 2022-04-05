import type { HostRule } from '../../types';
import * as cp from 'child_process';
import * as net from 'net';
import Agent from 'ssh-agent-js/client/index';
import { join } from 'upath';

export class SshSocket {
  agent_socket: string;
  agent_process: cp.ChildProcess;
  socket: net.Socket;
  agent: Agent;

  async start(cacheDir: string) {
    this.agent_socket = join(
      cacheDir,
      '.ssh-agent.' + Math.floor(Math.random() * 999999) + 1
    );
    this.agent_process = cp.spawn('ssh-agent', ['-d', '-a', this.agent_socket]);
    await new Promise((r) => setTimeout(r, 2000));
    this.socket = net.connect(this.agent_socket);
    this.agent = new Agent(this.socket);
    process.env.SSH_AUTH_SOCKET = this.agent_socket;
  }

  async addKeyFromHostRule(hostRule: HostRule) {
    if (hostRule.ssh_key) {
      await this.agent.add_key(hostRule.ssh_key);
    }
  }

  async clear() {
    await this.agent.remove_all_keys();
  }

  stop() {
    if (this.agent_process) {
      this.agent_process.kill('SIGINT');
    }
  }
}
