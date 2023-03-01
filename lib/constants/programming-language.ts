export const programmingLanguages = [
  'bicep',
  'dart',
  'docker',
  'elixir',
  'golang',
  'java',
  'js',
  'dotnet',
  'node',
  'php',
  'python',
  'ruby',
  'rust',
] as const;

export type ProgrammingLanguage = (typeof programmingLanguages)[number];
