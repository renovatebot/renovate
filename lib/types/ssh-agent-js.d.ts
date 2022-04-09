declare module 'ssh-agent-js/client/index' {
  class Agent {
    constructor(socket: any);
    add_key(key: string);
    remove_all_keys();
  }
  export = Agent;
}
