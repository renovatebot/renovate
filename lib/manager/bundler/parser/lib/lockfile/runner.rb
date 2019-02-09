module Parser
  class Lockfile
    class Runner
      def initialize(lockfile:)
        @lockfile = lockfile
      end

      def call
        Result.new(parser: parser)
      end

      private

      attr_reader :lockfile

      def parser
        ::Bundler::LockfileParser.new(content)
      end

      def content
        ::Bundler.read_file(lockfile)
      end
    end
  end
end
