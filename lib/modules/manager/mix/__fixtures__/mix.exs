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
      {:ranch, "<1.7.0 or ~>1.7.1"},
      {:cowboy, github: "ninenines/cowboy", tag: "0.6.0"},
      {:phoenix, git: "https://github.com/phoenixframework/phoenix.git", branch: "main"},
      {:ecto, github: "elixir-ecto/ecto", ref: "795036d997c7503b21fb64d6bf1a89b83c44f2b5"},
      {:secret, "~> 1.0", organization: "acme"},
      {:also_secret, "~> 1.0", only: [:dev, :test], organization: "acme", runtime: false},
      {:metrics, ">0.2.0 and <=1.0.0"},
      {:jason, ">= 1.0.0", only: :prod},
      {:hackney, "~> 1.0",
        optional: true},
      {:hammer_backend_redis, "~> 6.1", only: [:dev, :prod, :test]},
      {:castore, "== 1.0.10"},
      {:gun, "~> 2.0.0", hex: "grpc_gun"},
      {:another_gun, "~> 0.4.0", hex: :raygun},
      {:credo, "~> 1.7", only:
        [:test,
        # prod,
        :dev],
        runtime: false},
      {:floki, "== 0.37.0", only: :test},
    ]
  end
end
