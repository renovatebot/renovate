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
    [ #{:broadway_dashboard, "~> 0.2.2"},
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
    ]
  end
end
