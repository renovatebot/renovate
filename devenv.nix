{ pkgs, lib, config, inputs, ... }: {

  # https://devenv.sh/basics/
  env.NODE_ENV = "development";
  env.LOG_LEVEL = "debug";

  # https://devenv.sh/packages/
  packages = with pkgs; [
    git
    gh
    jq
    tsx
  ];

  # https://devenv.sh/languages/
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    pnpm = {
      enable = true;
      package = pkgs.pnpm;
      install.enable = true;
    };
  };

  # https://devenv.sh/scripts/
  scripts = {
    d-build = {
      exec = "pnpm run build";
      description = "Build the project";
    };
    d-test = {
      exec = "pnpm test";
      description = "Run tests";
    };
    d-lint = {
      exec = "pnpm run lint";
      description = "Run linting (includes type check, eslint, prettier)";
    };
    d-lint-fix = {
      exec = "pnpm run lint-fix";
      description = "Run linting with auto-fix";
    };
    d-dev = {
      exec = "pnpm start";
      description = "Start renovate in development mode";
    };
    d-clean = {
      exec = "pnpm run clean";
      description = "Clean build artifacts";
    };
    d-type-check = {
      exec = "pnpm run type-check";
      description = "Run TypeScript type checking";
    };
    d-prettier = {
      exec = "pnpm run prettier-fix";
      description = "Format code with prettier";
    };
    d-docs = {
      exec = "pnpm run build:docs";
      description = "Build documentation";
    };
    d-prepare = {
      exec = "pnpm run prepare";
      description = "Prepare the project (generate imports, setup husky)";
    };
  };

  # https://devenv.sh/tasks/
  tasks = {
    "renovate:generate" = {
      exec = "pnpm run generate";
      before = [ "devenv:enterShell" ];
    };
  };

  # https://devenv.sh/pre-commit-hooks/
  git-hooks.hooks = {
    # Use the existing husky setup
    commitizen.enable = false;
    conventional-pre-commit.enable = false;
  };

  # Make sure we don't show bloated enterShell message
  # Everything is accessible via devenv info
}