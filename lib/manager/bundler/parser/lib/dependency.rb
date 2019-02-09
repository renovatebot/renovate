module Parser
  class Dependency < SimpleDelegator
    ZERO_VERSION = '>= 0'.freeze
    VERSION_DELIMITER = ', '.freeze

    def initialize(dsl:, dependency:)
      @dsl = dsl

      super(dependency)
    end

    def version
      versions = sorted_requirements.map { |op, version| "#{op} #{version}" }
                                    .reject { |version| version == ZERO_VERSION }

      versions.empty? ? nil : versions.join(VERSION_DELIMITER)
    end

    def defined_at
      dsl.definitions[name]
    end

    def external_groups
      groups.reject { |group| group == :default }
    end

    def remotes
      if gem_remotes.any?
        gem_remotes
      else
        gemfile_remotes
      end
    end

    def gem_remotes
      if remote?
        source.remotes.flatten.uniq
      else
        Bundler::Source::Rubygems.new.remotes
      end
    end

    def gemfile_remotes
      dsl.default_remote
    end

    def to_h
      {
        name: name,
        groups: external_groups,
        version: version,
        platforms: platforms,
        defined_at: defined_at,
        remotes: remotes
      }
    end

    private

    attr_reader :dsl

    def remote?
      source.is_a? Bundler::Source::Rubygems
    end

    def sorted_requirements
      requirement.requirements.sort do |left, right|
        diff = left.last <=> right.last
        next diff unless diff.zero?

        left.first <=> right.first
      end
    end
  end
end
