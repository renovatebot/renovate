from setuptools import setup, find_packages

from testpkg import __version__

setup(
    name="testpkg",
    version=__version__,
    packages=find_packages(),
)
