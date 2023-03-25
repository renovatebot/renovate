export const programmingLanguages = [
  'dart',
  'docker',
  'elixir',
  'golang',
  'java',
  'js',
  'dotnet',
  'node',
  'perl',
  'php',
  'python',
  'ruby',
  'rust',
] as const;

export type ProgrammingLanguage = (typeof programmingLanguages)[number];
