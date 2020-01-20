import {
  VolumeOption,
  VolumesPair,
  DockerOptions,
  ExecConfig,
} from '../common';

function expandVolumeOption(x: VolumeOption): VolumesPair | null {
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

function prepareVolumes(volumes: VolumeOption[] = []): string[] {
  const expanded: (VolumesPair | null)[] = volumes.map(expandVolumeOption);
  const filtered: VolumesPair[] = expanded.filter(vol => vol !== null);
  const unique: VolumesPair[] = uniq<VolumesPair>(filtered, volumesEql);
  return unique.map(([from, to]) => {
    return `-v "${from}":"${to}"`;
  });
}

export function dockerCmd(
  cmd: string,
  options: DockerOptions,
  config: ExecConfig
): string {
  const { image, tag, envVars, cwd, volumes = [] } = options;
  const { localDir, cacheDir, dockerUser } = config;

  const result = ['docker run --rm'];
  if (dockerUser) result.push(`--user=${dockerUser}`);

  result.push(...prepareVolumes([localDir, cacheDir, ...volumes]));

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

  result.push(cmd);

  return result.join(' ');
}
