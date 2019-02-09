module Parser
  class Gemfile
    class Result
      attr_reader :dependencies

      def initialize(dependencies:)
        @dependencies = dependencies
      end

      def merge(other)
        self.class.new(
          dependencies: dependencies.concat(other.dependencies)
        )
      end

      def packages
        @packages ||= dependencies.map(&:to_h).uniq(&:hash)
      end

      def to_h
        {
          packages: packages
        }
      end
    end
  end
end
