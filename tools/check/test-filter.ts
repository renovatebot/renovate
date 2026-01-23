const TEST_OUTPUT_MARKERS = [
  '❯',
  'FAIL',
  '×',
  'Test Files',
  'Tests',
  'Start at',
  'Duration',
  '⎯',
  'Error',
  'expected',
  'Received',
  'Expected',
];

function isRelevantTestLine(line: string): boolean {
  return TEST_OUTPUT_MARKERS.some((marker) => line.includes(marker));
}

export function filterTestOutput(output: string): string {
  const lines = output.split('\n');
  const filtered: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (line.includes('✓') && !line.includes('failed')) {
      capturing = false;
      continue;
    }

    if (isRelevantTestLine(line)) {
      capturing = true;
    }

    if (capturing || line.trim() === '') {
      filtered.push(line);
    }
  }

  return filtered.join('\n').trim();
}
