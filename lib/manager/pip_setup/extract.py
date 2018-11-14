from __future__ import print_function
import sys
import imp
import json
import distutils.core

try:
  import setuptools
except ImportError:
  class setuptools:
    def setup():
      pass

try:
  from unittest import mock
except ImportError:
  # for python3.3+
  import mock

@mock.patch.object(setuptools, 'setup')
@mock.patch.object(distutils.core, 'setup')
def invoke(mock1, mock2):
  # This is setup.py which calls setuptools.setup
  imp.load_source('_target_setup_', sys.argv[-1])
  # called arguments are in `mock_setup.call_args`
  call_args = mock1.call_args or mock2.call_args
  args, kwargs = call_args
  print(json.dumps(kwargs, indent=2))

invoke()
