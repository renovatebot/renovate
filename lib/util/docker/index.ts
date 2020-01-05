type Opt<T> = T | null | undefined;

export interface DockerOptions {
  image: string;
  dockerUser?: Opt<string>;
  volumes?: Opt<Opt<string>[]>;
  envVars?: Opt<Opt<string>[]>;
  cwd?: Opt<string>;
  tag?: Opt<string>;
  cmdWrap?: Opt<string>;
}

export function dockerCmd(cmd: string, options: DockerOptions): string {
  const { dockerUser, volumes, envVars, cwd, image, tag, cmdWrap } = options;

  const result = ['docker run --rm'];
  if (dockerUser) result.push(`--user=${dockerUser}`);

  if (volumes)
    result.push(...volumes.filter(x => !!x).map(vol => `-v "${vol}":"${vol}"`));

  if (envVars) result.push(...envVars.filter(x => !!x).map(e => `-e ${e}`));

  if (cwd) result.push(`-w "${cwd}"`);

  const taggedImage = tag ? `${image}:${tag}` : `${image}`;
  result.push(taggedImage);

  if (cmdWrap) {
    const regex = /{{\s*cmd\s*}}/;
    if (regex.test(cmdWrap)) {
      result.push(cmdWrap.replace(regex, cmd));
    } /* istanbul ignore next */ else {
      throw new Error(
        'dockerCmd(): Provide {{ cmd }} placeholder inside `wrapCmd` parameter'
      );
    }
  } else {
    result.push(cmd);
  }

  return result.join(' ');
}
