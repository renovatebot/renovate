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
      {:ecto, "~> 2.0.0"},
      {:postgrex, "~> 0.8.1"},
      {:cowboy, github: "ninenines/cowboy"},
    ]
  end
end