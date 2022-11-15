from conans import ConanFile

class Pkg(ConanFile):
   python_requires = "pyreq/0.1@user/channel"  # recipe to reuse code from
   build_requires = "tool_a/0.2@user/testing", "tool_b/0.2@user/testing"
   requires = "req_a/1.0", "req_l/2.1@otheruser/testing"

   requires = [("req_b/0.1@user/testing"),
               ("req_d/0.2@dummy/stable", "override"),
               ("req_e/2.1@coder/beta", "private")]

   requires = (("req_c/1.0@user/stable", "private"), )
   requires = ("req_f/1.0@user/stable", ("req_h/3.0@other/beta", "override"))
   requires = "req_g/[>1.0 <1.8]@user/stable"
#  requires = "commentedout/[>1.0 <1.8]@user/stable"
   #  requires = "commentedout2/[>1.0 <1.8]@user/stable"
   requires = (("req_l/1.0@user/stable#bc592346b33fd19c1fbffce25d1e4236", "private"), )



def requirements(self):
   if self.options.myoption:
      self.requires("req_i/1.2@drl/testing")
   else:
      self.requires("req_i/2.2@drl/stable")
      self.requires("req_k/1.2@drl/testing", private=True, override=False)


def build_requirements(self):
   if self.settings.os == "Windows":
      self.build_requires("tool_win/0.1@user/stable")
