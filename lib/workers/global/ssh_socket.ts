import type { HostRule } from '../../types';
import * as cp from 'child_process';
import * as net from 'net';
import * as saj from 'ssh-agent-js';
import * as tmp from 'tmp';

export class SshSocket {
  readonly agent_socket: tmp.FileSyncObject;
  readonly agent_process: cp.ChildProcess;
  readonly agent: saj.Agent;

  constructor(cacheDir: string) {
    this.agent_socket = tmp.fileSync({
      tmpdir: cacheDir,
    });
    this.agent_process = cp.spawn('ssh-agent', [
      '-d',
      '-a',
      this.agent_socket.name,
    ]);
    let sock = net.connect(this.agent_socket.name);
    this.agent = new saj.Agent(sock);
    process.env.SSH_AUTH_SOCKET = this.agent_socket.name;
  }

  async addKeyFromHostRule(hostRule: HostRule) {
    if (hostRule.ssh_key) {
      await this.agent.add_key(hostRule.ssh_key);
    }
  }

  async clear() {
    await this.agent.remove_all_keys();
  }
}
