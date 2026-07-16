export type NpmrcLineEnding = '\n' | '\r\n' | '\r' | '';
type DetectedNpmrcLineEnding = Exclude<NpmrcLineEnding, ''>;

interface NpmrcBaseLine {
  raw: string;
  lineEnding: NpmrcLineEnding;
}

export interface NpmrcEnvironmentVariable {
  name: string;
  optional: boolean;
  source: 'section' | 'key' | 'value';
}

export interface NpmrcSettingLine extends NpmrcBaseLine {
  type: 'setting';
  section: string | null;
  key: string;
  array: boolean;
  value: unknown;
  environmentVariables: NpmrcEnvironmentVariable[];
}

export interface NpmrcSectionLine extends NpmrcBaseLine {
  type: 'section';
  name: string;
  environmentVariables: NpmrcEnvironmentVariable[];
}

export interface NpmrcOtherLine extends NpmrcBaseLine {
  type: 'other';
}

export type NpmrcLine = NpmrcSettingLine | NpmrcSectionLine | NpmrcOtherLine;

export interface NpmrcDocument {
  lines: NpmrcLine[];
  detectedLineEnding: DetectedNpmrcLineEnding | null;
  trailingLineEnding: NpmrcLineEnding;
}

function isQuoted(value: string): boolean {
  return (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
}

function decodeQuotedText(value: string): unknown {
  const json = value.startsWith("'") ? value.slice(1, -1) : value;

  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

function decodeUnquotedText(value: string): string {
  let decoded = '';
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      if (character === '\\' || character === ';' || character === '#') {
        decoded += character;
      } else {
        decoded += `\\${character}`;
      }
      escaped = false;
      continue;
    }

    if (character === ';' || character === '#') {
      break;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }
    decoded += character;
  }

  if (escaped) {
    decoded += '\\';
  }

  return decoded.trim();
}

function decodeNpmrcText(raw: string): unknown {
  const value = raw.trim();
  return isQuoted(value) ? decodeQuotedText(value) : decodeUnquotedText(value);
}

function decodeNpmrcValue(raw: string): unknown {
  const value = decodeNpmrcText(raw);
  if (value === 'true' || value === 'false' || value === 'null') {
    return JSON.parse(value);
  }

  return value;
}

function parseEnvironmentVariables(
  value: unknown,
  source: NpmrcEnvironmentVariable['source'],
): NpmrcEnvironmentVariable[] {
  if (typeof value !== 'string') {
    return [];
  }

  const variables: NpmrcEnvironmentVariable[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '$' || value[index + 1] !== '{') {
      continue;
    }

    let escapeCount = 0;
    for (
      let escapeIndex = index - 1;
      escapeIndex >= 0 && value[escapeIndex] === '\\';
      escapeIndex -= 1
    ) {
      escapeCount += 1;
    }

    if (escapeCount % 2 === 1) {
      continue;
    }

    const nameStart = index + 2;
    let nameEnd = nameStart;
    while (
      nameEnd < value.length &&
      value[nameEnd] !== '$' &&
      value[nameEnd] !== '{' &&
      value[nameEnd] !== '}' &&
      value[nameEnd] !== '?'
    ) {
      nameEnd += 1;
    }

    if (nameEnd === nameStart) {
      continue;
    }

    const optional = value[nameEnd] === '?';
    const closingBraceIndex = optional ? nameEnd + 1 : nameEnd;
    if (value[closingBraceIndex] !== '}') {
      continue;
    }

    variables.push({
      name: value.slice(nameStart, nameEnd),
      optional,
      source,
    });
    index = closingBraceIndex;
  }

  return variables;
}

function findAssignmentSeparator(line: string): number {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '=') {
      return index;
    }
  }

  return -1;
}

function isSectionLine(line: string): boolean {
  return line.startsWith('[') && line.indexOf(']') === line.length - 1;
}

function parseNpmrcLine(
  raw: string,
  lineEnding: NpmrcLineEnding,
  section: string | null,
): NpmrcLine {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
    return { type: 'other', raw, lineEnding };
  }

  if (isSectionLine(trimmed)) {
    const name = String(decodeNpmrcText(trimmed.slice(1, -1)));

    return {
      type: 'section',
      name,
      environmentVariables: parseEnvironmentVariables(name, 'section'),
      raw,
      lineEnding,
    };
  }

  const separatorIndex = findAssignmentSeparator(raw);
  if (separatorIndex === 0) {
    return { type: 'other', raw, lineEnding };
  }

  const rawKey = raw.slice(0, separatorIndex < 0 ? undefined : separatorIndex);
  const decodedKey = String(decodeNpmrcText(rawKey));
  const array = decodedKey.length > 2 && decodedKey.endsWith('[]');
  const key = array ? decodedKey.slice(0, -2) : decodedKey;
  const value =
    separatorIndex < 0 ? true : decodeNpmrcValue(raw.slice(separatorIndex + 1));
  const environmentVariables = [
    ...parseEnvironmentVariables(key, 'key'),
    ...parseEnvironmentVariables(value, 'value'),
  ];

  return {
    type: 'setting',
    section,
    key,
    array,
    value,
    environmentVariables,
    raw,
    lineEnding,
  };
}

export function parseNpmrc(content: string): NpmrcDocument {
  const lines: NpmrcLine[] = [];
  let detectedLineEnding: DetectedNpmrcLineEnding | null = null;
  let section: string | null = null;
  let lineStart = 0;
  let index = 0;

  while (index < content.length) {
    const character = content[index];
    if (character !== '\r' && character !== '\n') {
      index += 1;
      continue;
    }

    let lineEnding: NpmrcLineEnding = character;
    if (character === '\r' && content[index + 1] === '\n') {
      lineEnding = '\r\n';
    }

    detectedLineEnding ??= lineEnding;

    const line = parseNpmrcLine(
      content.slice(lineStart, index),
      lineEnding,
      section,
    );
    lines.push(line);

    if (line.type === 'section') {
      section = line.name;
    }

    index += lineEnding.length;
    lineStart = index;
  }

  if (lineStart < content.length) {
    const line = parseNpmrcLine(content.slice(lineStart), '', section);
    lines.push(line);
  }

  return {
    lines,
    detectedLineEnding,
    trailingLineEnding: lines.at(-1)?.lineEnding ?? '',
  };
}

export function renderNpmrc(lines: NpmrcLine[]): string {
  return lines.map((line) => `${line.raw}${line.lineEnding}`).join('');
}
