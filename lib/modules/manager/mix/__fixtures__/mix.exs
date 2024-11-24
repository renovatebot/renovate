defmodule MyProject.MixProject do
  use Mix.Project

  def project() do
    [
      app: :my_project,
      version: "0.0.1",
      elixir: "~> 1.0",
      deps: deps(),
    ]
  end

  def application() do
    []
  end

  defp deps() do
    [
      #{:broadway_dashboard, "~> 0.2.2"},
#{:broadway_dashboard, "~> 0.2.2"},
#   {:broadway_dashboard, "~> 0.2.2"},
      #    {:broadway_dashboard, "~> 0.2.2"},
      {:postgrex, "~> 0.8.1"}, #  {:broadway_dashboard, "~> 0.2.2"},
      {:foo_bar, ">2.1.0 or <=3.0.0"},
      {:cowboy, github: "ninenines/cowboy", tag: "v0.4.1"},
      {:phoenix, git: "https://github.com/phoenixframework/phoenix.git", branch: "main"},
      {:ecto, github: "elixir-ecto/ecto", ref: "795036d997c7503b21fb64d6bf1a89b83c44f2b5"},
      {:secret, "~> 1.0", organization: "acme"},
      {:also_secret, "~> 1.0", only: [:dev, :test], organization: "acme", runtime: false},
      {:ex_doc, ">2.1.0 and <=3.0.0"},
      {:jason, ">= 1.0.0"},
      {:mason, "~> 1.0",
        optional: true},
      {:hammer_backend_redis, "~> 6.1"},
      {:public, "== 1.6.14"},


      # Basic Git URL
      # Fetches the latest commit from the default branch
      {:basic_dep, git: "https://github.com/user/repo.git"},

      # Git URL with a specific branch
      # Fetches the latest commit from the specified branch
      {:branch_dep, git: "https://github.com/user/repo.git", branch: "main"},

      # Git URL with a specific commit (ref)
      # Fetches the exact commit specified
      {:commit_dep, git: "https://github.com/user/repo.git", ref: "abc123"},

      # Git URL with a specific commit and manager: :make
      # Specifies that this dependency should be built using make instead of mix
      {:make_dep, git: "https://github.com/user/repo.git", ref: "abc123", manager: :make},

      # Git URL with a specific tag
      # Fetches the exact commit pointed to by the tag
      {:tag_dep, git: "https://github.com/user/repo.git", tag: "v1.0.0"},

      # Git URL with a specific tag and compile path
      # Specifies a subdirectory to compile the project from
      # {:compile_dep, git: "https://github.com/user/repo.git", tag: "v1.0.0", compile: "src"},

      # Git URL with a specific branch and app name
      # Sets app to false, meaning this dependency won't be treated as an OTP application
      # {:app_dep, git: "https://github.com/user/repo.git", branch: "dev", app: false},

      # Git URL with a specific commit and override in umbrella
      # Allows this dependency to override others in an umbrella project
      # {:override_dep, git: "https://github.com/user/repo.git", ref: "abc123", override: true},

      # Git URL with a specific tag and runtime: false
      # Indicates this dependency is only needed at compile time, not at runtime
      # {:compile_time_dep, git: "https://github.com/user/repo.git", tag: "v1.0.0", runtime: false},

      # Git URL with a specific branch and only: :test
      # Specifies this dependency is only needed in the test environment
      # {:test_dep, git: "https://github.com/user/repo.git", branch: "test", only: :test},

      # Git URL with a specific tag and optional: true
      # Marks the dependency as optional, allowing the project to compile even if it's missing
      # {:optional_dep, git: "https://github.com/user/repo.git", tag: "v1.0.0", optional: true},



    ]
  end
end
