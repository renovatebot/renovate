type Opt<T> = T | null | undefined;

type VolumesPair = [string, string];
export type VolumeOption = Opt<string> | Opt<VolumesPair>;

export interface DockerOptions {
  image: string;
  tag?: Opt<string>;
  dockerUser?: Opt<string>;
  volumes?: Opt<VolumeOption[]>;
  envVars?: Opt<Opt<string>[]>;
  cwd?: Opt<string>;
  preCommands?: Opt<Opt<string>[]>;
  postCommands?: Opt<Opt<string>[]>;
}

let globalDockerUser: string | null = null;

export function setDockerUser(_dockerUser: string | null): void {
  globalDockerUser = _dockerUser;
}

function prepareCommands(commands: Opt<Opt<string>[]>): string[] {
  const pred = (cmd): boolean => typeof cmd === 'string';
  return commands ? commands.filter(pred) : [];
}

function expandVolumeOption(x: Opt<VolumeOption>): VolumesPair | null {
  if (typeof x === 'string') return [x, x];
  if (Array.isArray(x) && x.length === 2) {
    const [from, to] = x;
    if (typeof from === 'string' && typeof to === 'string') {
      return [from, to];
    }
  }
  return null;
}

function volumesEql(x: VolumesPair, y: VolumesPair): boolean {
  const [xFrom, xTo] = x;
  const [yFrom, yTo] = y;
  return xFrom === yFrom && xTo === yTo;
}

function uniq<T = unknown>(
  array: T[],
  eql = (x: T, y: T): boolean => x === y
): T[] {
  return array.filter((x, idx, arr) => {
    return arr.findIndex(y => eql(x, y)) === idx;
  });
}

function prepareVolumes(
  cwd: Opt<string>,
  volumes: VolumeOption[] = []
): string[] {
  const volumesWithCwd: VolumeOption[] = cwd ? [...volumes, cwd] : volumes;
  const expanded: Opt<VolumesPair>[] = volumesWithCwd.map(expandVolumeOption);
  const filtered: VolumesPair[] = expanded.filter(vol => vol !== null);
  const unique: VolumesPair[] = uniq<VolumesPair>(filtered, volumesEql);
  return unique.map(([from, to]) => {
    return `-v "${from}":"${to}"`;
  });
}

export function dockerCmd(cmd: string, options: DockerOptions): string {
  const { image, tag, dockerUser = globalDockerUser, envVars, cwd } = options;

  const result = ['docker run --rm'];
  if (dockerUser) result.push(`--user=${dockerUser}`);

  result.push(...prepareVolumes(cwd, options.volumes));

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

  const preCommands = prepareCommands(options.preCommands);
  const postCommands = prepareCommands(options.postCommands);
  const commands = [...preCommands, cmd, ...postCommands];
  const command =
    commands.length === 1
      ? cmd
      : `bash -l -c "${commands.join(' && ').replace(/"/g, '\\"')}"`;
  result.push(command);

  return result.join(' ');
}
