class Aap < Formula
  desc "Make-like tool to download, build, and install software"
  homepage "http://www.a-a-p.org"
  url "https://downloads.sourceforge.net/project/a-a-p/aap-1.094.zip"
  sha256 "3f53b2fc277756042449416150acc477f29de93692944f8a77e8cef285a1efd8"

  bottle do
    cellar :any_skip_relocation
    rebuild 1
    sha256 "533ff4c588ea7e7369570eb3ae7de191d9b62ed9161acbdeb0b07cb8d328aec7" => :mojave
    sha256 "4fa43a4a0294b7e9040e13bf843e70fbeb189c2e505315dd574fbc9ed43bd060" => :high_sierra
    sha256 "6e42400eb31e15dae56452b347925eb20faae1b996d94173b8711bd080e4a182" => :sierra
    sha256 "32c30b38a37147754c5abfe9a801777b4a798af6dbcce2f15e1693c6027f0fbe" => :el_capitan
    sha256 "15472b5a56a90d2d83c3ab24eba09e3644867857d8a7c547c82e6937beff3344" => :yosemite
    sha256 "b141c07f091f90bd883148bf0e3c093d90fc0be7c4f8e7d07df9ae7cae684862" => :mavericks
  end

  depends_on "python@2" # does not support Python 3

  def install
    # Aap is designed to install using itself
    system "./aap", "install", "PREFIX=#{prefix}", "MANSUBDIR=share/man"
  end

  test do
    # A dummy target definition
    (testpath/"main.aap").write("dummy:\n\t:print OK\n")
    system "#{bin}/aap", "dummy"
  end
end
