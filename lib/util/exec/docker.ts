import { uniq } from 'lodash';

type Opt<T> = T | null | undefined;

export interface DockerOptions {
  image: string;
  tag?: Opt<string>;
  dockerUser?: Opt<string>;
  volumes?: Opt<Opt<string>[]>;
  envVars?: Opt<Opt<string>[]>;
  cwd?: Opt<string>;
  preCommands?: Opt<Opt<string>[]>;
  postCommands?: Opt<Opt<string>[]>;
}

let globalDockerUser: string | null = null;

export function setDockerUser(_dockerUser: string | null): void {
  globalDockerUser = _dockerUser;
}

function filterCommands(commands: Opt<Opt<string>[]>): string[] {
  const pred = (cmd): boolean => typeof cmd === 'string';
  return commands ? commands.filter(pred) : [];
}

export function dockerCmd(cmd: string, options: DockerOptions): string {
  const { image, tag, dockerUser = globalDockerUser, envVars, cwd } = options;

  const result = ['docker run --rm'];
  if (dockerUser) result.push(`--user=${dockerUser}`);

  let volumes = options.volumes || [];
  volumes = cwd ? [...volumes, options.cwd] : volumes;
  if (volumes) {
    result.push(
      ...uniq(volumes)
        .filter(x => typeof x === 'string')
        .map(vol => `-v "${vol}":"${vol}"`)
    );
  }

  if (envVars) {
    result.push(
      ...uniq(envVars)
        .filter(x => typeof x === 'string')
        .map(e => `-e ${e}`)
    );
  }

  if (cwd) result.push(`-w "${cwd}"`);

  const taggedImage = tag ? `${image}:${tag}` : `${image}`;
  result.push(taggedImage);

  const preCommands = filterCommands(options.preCommands);
  const postCommands = filterCommands(options.postCommands);
  const commands = [...preCommands, cmd, ...postCommands];
  const command =
    commands.length === 1
      ? cmd
      : `bash -l -c "${commands.join(' && ').replace(/"/g, '\\"')}"`;
  result.push(command);

  return result.join(' ');
}
