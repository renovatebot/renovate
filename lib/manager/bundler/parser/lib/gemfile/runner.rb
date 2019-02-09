module Parser
  class Gemfile
    class Runner
      def initialize(gemfile:)
        @gemfile = Gemfile.new(path: gemfile)
      end

      def call
        result_for(conditions: true).merge(result_for(conditions: false))
      end

      private

      attr_reader :gemfile

      def result_for(conditions:)
        gemfile.replace_conditions(with: conditions)

        dsl = DSL.new
        dsl.eval_gemfile(gemfile.path)

        Result.new(dependencies: dsl.dependencies)
      end
    end
  end
end
