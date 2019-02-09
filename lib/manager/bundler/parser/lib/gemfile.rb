module Parser
  class Gemfile
    GEM_REGEXP = /gem\s/.freeze
    BLOCK_IF_REGEXP = /^(\s*if .+)$/.freeze
    INLINE_IF_REGEXP = /\S+ (if .+)$/.freeze
    IF_REPLACE_REGEXP = /(if .+)$/.freeze

    attr_reader :path

    def initialize(path:)
      @path = path
    end

    def replace_conditions(with:)
      content = File.readlines(path)

      next_content = content.map do |line|
        gem_match = line.match(GEM_REGEXP)
        block_if_match = line.match(BLOCK_IF_REGEXP)
        inline_if_match = line.match(INLINE_IF_REGEXP)

        if block_if_match || (inline_if_match && gem_match)
          line.gsub(IF_REPLACE_REGEXP, "if #{with}")
        else
          line
        end
      end

      File.open(path, 'w') { |file| file.puts(next_content) }
    end
  end
end
