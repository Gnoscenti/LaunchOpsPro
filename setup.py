"""LaunchOps Founder Edition — Setup."""

from setuptools import setup, find_packages

setup(
    name="launchops-founder-edition",
    version="2.0.0",
    description="Build a business like an MBA would. AI + Human Co-Creating GREAT Things.",
    author="GnoscentiStudios",
    python_requires=">=3.10",
    packages=find_packages(),
    install_requires=[
        "openai>=1.30.0",
        "anthropic>=0.25.0",
        "pydantic>=2.0.0",
        "python-dotenv>=1.0.0",
        "cryptography>=42.0.0",
        "httpx>=0.27.0",
        "requests>=2.31.0",
        "rich>=13.7.0",
        "click>=8.1.0",
        "pyyaml>=6.0.0",
        "jinja2>=3.1.0",
    ],
    extras_require={
        "infra": ["docker>=7.0.0", "paramiko>=3.4.0"],
        "web": ["playwright>=1.44.0", "beautifulsoup4>=4.12.0"],
        "payments": ["stripe>=9.0.0"],
        "all": [
            "docker>=7.0.0",
            "paramiko>=3.4.0",
            "playwright>=1.44.0",
            "beautifulsoup4>=4.12.0",
            "stripe>=9.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "launchops=launchops:main",
        ],
    },
)
