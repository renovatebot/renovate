module Parser
  class Lockfile
    class Result
      def initialize(parser:)
        @parser = parser
      end

      def ruby_version
        parser.ruby_version
      end

      def bundler_version
        parser.bundler_version
      end

      def to_h
        {
          ruby_version: ruby_version,
          bundler_version: bundler_version
        }
      end

      private

      attr_reader :parser
    end
  end
end
