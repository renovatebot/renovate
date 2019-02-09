module Parser
  class DSL < Bundler::Dsl
    attr_reader :sources, :ruby_version

    def gem(*args)
      dependency = super.pop

      locations = caller_locations(1..1)
      defined_at = locations.first.lineno

      definitions[dependency.name] ||= []
      definitions[dependency.name] << defined_at

      dependencies << Dependency.new(dsl: self, dependency: dependency)
    end

    def gemspec(*args); end

    def default_remote
      sources.rubygems_remotes - dependencies.map(&:gem_remotes).flatten.uniq
    end

    def definitions
      @definitions ||= {}
    end
  end
end
