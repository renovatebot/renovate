export function packageScript(
  script: string,
  ...args: string[]
): [string, ...string[]] {
  // On Windows, pnpm's shell emulator can run POSIX scripts that cmd.exe cannot.
  if (process.platform === 'win32') {
    return ['pnpm', '--loglevel=error', script, ...args];
  }

  return ['node', '--run', script, '--', ...args];
}
