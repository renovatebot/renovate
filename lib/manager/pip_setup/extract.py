from __future__ import print_function
import sys
import imp
import json
import setuptools

try:
  import mock
except ImportError:
  # for python3.3+
  from unittest import mock

with mock.patch.object(setuptools, 'setup') as mock_setup:
  # This is setup.py which calls setuptools.setup
  imp.load_source('setup', sys.argv[-1])

# called arguments are in `mock_setup.call_args`
args, kwargs = mock_setup.call_args
print(json.dumps(kwargs, indent=2))
