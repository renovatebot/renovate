// istanbul ignore next
const Categories = [
  'ansible',
  'batect',
  'bazel',
  'c',
  'cd',
  'ci',
  'dart',
  'docker',
  'dotnet',
  'elixir',
  'golang',
  'helm',
  'iac',
  'java',
  'js',
  'kubernetes',
  'node',
  'php',
  'python',
  'ruby',
  'rust',
  'swift',
  'terraform',
] as const;

export type Category = (typeof Categories)[number];
