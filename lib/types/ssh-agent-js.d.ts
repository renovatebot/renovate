declare module 'ssh-agent-js' {
  class Agent {
    constructor(socket: any);
    add_key(key: string);
    remove_all_keys();
  }
}
