import { styleText } from 'node:util';
import type { Result } from 'execa';

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export async function runCheck(
  name: string,
  run: () => Promise<Result>,
): Promise<boolean> {
  const { stdout } = process;
  const label = `${name} `.padEnd(36, '.');
  const started = Date.now();
  let frame = 0;

  function draw(): void {
    stdout.write(`\r  ${label} ${frames[frame]}`);
    frame = (frame + 1) % frames.length;
  }

  let timer: NodeJS.Timeout | undefined;
  if (stdout.isTTY) {
    draw();
    timer = setInterval(draw, 80);
  }

  try {
    const result = await run();
    const status = result.failed
      ? styleText('red', '✗')
      : styleText('green', '✓');
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    stdout.write(`${timer ? '\r' : ''}  ${label} ${status}  ${seconds} s\n`);

    if (result.failed) {
      console.error(result.all?.length ? result.all : result.shortMessage);
    }

    return !result.failed;
  } finally {
    clearInterval(timer);
  }
}
