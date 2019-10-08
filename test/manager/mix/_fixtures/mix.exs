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
      {:postgrex, "~> 0.8.1"},
      {:ecto, ">2.1.0 or <=3.0.0"},
      {:cowboy, github: "ninenines/cowboy"},
      {:secret, "~> 1.0", organization: "acme"},
      {:ex_doc, ">2.1.0 and <=3.0.0"},
      {:jason, ">= 1.0.0"},
      {:jason, "~> 1.0", 
        optional: true},
    ]
  end
end