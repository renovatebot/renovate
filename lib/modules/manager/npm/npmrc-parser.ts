import ini from 'ini';

export type NpmrcLineEnding = '\n' | '\r\n' | '\r' | '';
type DetectedNpmrcLineEnding = Exclude<NpmrcLineEnding, ''>;

interface NpmrcBaseLine {
  raw: string;
  lineEnding: NpmrcLineEnding;
}

export interface NpmrcSettingLine extends NpmrcBaseLine {
  type: 'setting';
  section: string | null;
  key: string;
  isArray: boolean;
  value: unknown;
}

export interface NpmrcSectionLine extends NpmrcBaseLine {
  type: 'section';
  name: string;
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

// This is the line shape used by `ini.parse`; notably, indented sections are keys.
const npmrcLineRegex = /^\[([^\]]*)\]\s*$|^([^=]+)(=(.*))?$/i;

// `ini.unsafe` is the token decoder used internally by `ini.parse`.
function decodeNpmrcText(raw: string): unknown {
  return ini.unsafe(raw);
}

function decodeNpmrcValue(raw: string): unknown {
  const value = decodeNpmrcText(raw);
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (value === 'null') {
    return null;
  }
  return value;
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

  const match = npmrcLineRegex.exec(raw);
  if (!match) {
    return { type: 'other', raw, lineEnding };
  }

  if (match[1] !== undefined) {
    return {
      type: 'section',
      name: String(decodeNpmrcText(match[1])),
      raw,
      lineEnding,
    };
  }

  const decodedKey = String(decodeNpmrcText(match[2]));
  const isArray = decodedKey.length > 2 && decodedKey.endsWith('[]');

  return {
    type: 'setting',
    section,
    key: isArray ? decodedKey.slice(0, -2) : decodedKey,
    isArray,
    value: match[3] ? decodeNpmrcValue(match[4] ?? '') : true,
    raw,
    lineEnding,
  };
}

export function parseNpmrc(content: string): NpmrcDocument {
  const lines: NpmrcLine[] = [];
  let detectedLineEnding: DetectedNpmrcLineEnding | null = null;
  let section: string | null = null;
  const parts = content.split(/(\r\n|\r|\n)/);

  for (let index = 0; index < parts.length; index += 2) {
    const raw = parts[index];
    const lineEnding = (parts[index + 1] ?? '') as NpmrcLineEnding;
    if (!raw && !lineEnding) {
      continue;
    }

    if (lineEnding && !detectedLineEnding) {
      detectedLineEnding = lineEnding;
    }

    const line = parseNpmrcLine(raw, lineEnding, section);
    lines.push(line);
    if (line.type === 'section') {
      section = line.name;
    }
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
