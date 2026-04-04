"""Configuration constants for the Issue Finder."""

import re

# ── Supported languages ─────────────────────────────────────
SUPPORTED_LANGUAGES = ("Python", "JavaScript", "TypeScript")

# Repository criteria (from PR Writer guidelines)
REPO_MAX_SIZE_MB = 200
REPO_MIN_STARS = 200
REPO_SIZE_KB = REPO_MAX_SIZE_MB * 1024

# Issue criteria
MIN_CODE_FILES_CHANGED = 4  # Excluding test and documentation files
MIN_SUBSTANTIAL_CHANGES_IN_FILE = 5  # Lines changed in at least one non-test file
# Legacy alias
MIN_PYTHON_FILES_CHANGED = MIN_CODE_FILES_CHANGED

# ── Language-specific code file extensions ──────────────────
CODE_EXTENSIONS: dict[str, tuple[str, ...]] = {
    "Python": (".py",),
    "JavaScript": (".js", ".jsx", ".mjs", ".cjs"),
    "TypeScript": (".ts", ".tsx", ".mts", ".cts"),
}

# ── Language-specific test file patterns ────────────────────
TEST_FILE_PATTERNS_BY_LANG: dict[str, tuple[str, ...]] = {
    "Python": (
        "test_", "_test", "tests/", "/test/", "conftest.py",
        "unittest", "pytest", "spec.py",
    ),
    "JavaScript": (
        "test/", "tests/", "__tests__/", ".test.", ".spec.",
        "jest.config", "mocha", "karma.conf", "cypress/",
        ".stories.", "e2e/",
    ),
    "TypeScript": (
        "test/", "tests/", "__tests__/", ".test.", ".spec.",
        "jest.config", "vitest.config", "cypress/",
        ".stories.", "e2e/",
    ),
}

# ── Language-specific doc file patterns ─────────────────────
DOC_FILE_PATTERNS_BY_LANG: dict[str, tuple[str, ...]] = {
    "Python": (
        "readme", "changelog", "docs/", ".md", ".rst", ".txt",
        "license", "contributing", "setup.cfg", "pyproject.toml",
    ),
    "JavaScript": (
        "readme", "changelog", "docs/", ".md", ".rst", ".txt",
        "license", "contributing", "package.json", "package-lock.json",
        ".eslintrc", ".prettierrc", "webpack.config", "babel.config",
        "rollup.config", "vite.config", ".babelrc",
    ),
    "TypeScript": (
        "readme", "changelog", "docs/", ".md", ".rst", ".txt",
        "license", "contributing", "package.json", "package-lock.json",
        "tsconfig.json", ".eslintrc", ".prettierrc",
        "webpack.config", "vite.config", "rollup.config",
    ),
}

# Default (union) patterns for backward compatibility
TEST_FILE_PATTERNS = (
    "test_", "_test", "tests/", "/test/", "conftest.py",
    "unittest", "pytest", "spec.py",
    "__tests__/", ".test.", ".spec.",
    "jest.config", "vitest.config", "mocha", "karma.conf",
    "cypress/", ".stories.", "e2e/",
)
DOC_FILE_PATTERNS = (
    "readme", "changelog", "docs/", ".md", ".rst", ".txt",
    "license", "contributing", "setup.cfg", "pyproject.toml",
    "package.json", "package-lock.json", "tsconfig.json",
    ".eslintrc", ".prettierrc", "webpack.config", "babel.config",
    "rollup.config", "vite.config", ".babelrc",
)

# GitHub search exclusions (from guidelines)
GITHUB_SEARCH_EXCLUSIONS = ["collection", "list", "guide", "projects", "exercises"]

# URL regex for detecting links in issue body
URL_PATTERN = re.compile(
    r'https?://[^\s\)\]\>]+|'
    r'\[.*?\]\(https?://[^\)]+\)|'
    r'!\[.*?\]\([^\)]+\)'  # Markdown images
)

# ── Pre-filtering: noise patterns in issue titles ────────────
NOISE_TITLE_PATTERNS = (
    "bump", "update depend", "changelog", "release v", "release:",
    "chore:", "ci:", "docs:", "typo", "readme",
    "merge branch", "merge pull", "version bump",
    "upgrade to", "pin depend", "renovate",
)

# ── Auto-discovery: curated repos by language ──────────────
CURATED_REPOS: dict[str, list[str]] = {
    "Python": [
        "tiangolo/fastapi", "pallets/flask", "django/django",
        "encode/httpx", "pydantic/pydantic", "Textualize/rich",
        "Textualize/textual", "tiangolo/typer", "pallets/click",
        "celery/celery", "psf/requests", "aio-libs/aiohttp",
        "pytest-dev/pytest", "astral-sh/ruff", "psf/black",
        "python/mypy", "sqlalchemy/sqlalchemy", "encode/starlette",
        "marshmallow-code/marshmallow", "jazzband/pip-tools",
        "pallets/jinja", "pallets/werkzeug", "mitmproxy/mitmproxy",
        "python-poetry/poetry", "pypa/pip", "pypa/setuptools",
        "boto/boto3", "fabric/fabric", "paramiko/paramiko",
        "arrow-py/arrow", "dateutil/dateutil",
        "tqdm/tqdm", "Delgan/loguru", "cool-RR/PySnooper",
        "dbader/schedule", "agronholm/anyio", "encode/uvicorn",
        "scrapy/scrapy", "psf/httptools", "ijl/orjson",
        "samuelcolvin/watchfiles", "jpadilla/pyjwt",
    ],
    "JavaScript": [
        "expressjs/express", "facebook/react", "vuejs/core",
        "sveltejs/svelte", "lodash/lodash", "axios/axios",
        "webpack/webpack", "vitejs/vite", "chartjs/Chart.js",
        "mrdoob/three.js", "d3/d3", "socketio/socket.io",
        "hapijs/hapi", "fastify/fastify", "koajs/koa",
        "sequelize/sequelize", "knex/knex", "jestjs/jest",
        "mochajs/mocha", "prettier/prettier", "eslint/eslint",
        "chalk/chalk", "sindresorhus/got", "node-fetch/node-fetch",
        "date-fns/date-fns", "moment/moment", "nodemailer/nodemailer",
        "brianc/node-postgres", "Automattic/mongoose",
        "shelljs/shelljs", "jprichardson/node-fs-extra",
    ],
    "TypeScript": [
        "microsoft/TypeScript", "nestjs/nest", "trpc/trpc",
        "prisma/prisma", "drizzle-team/drizzle-orm",
        "colinhacks/zod", "tRPC/tRPC", "Effect-TS/effect",
        "type-challenges/type-challenges",
        "angular/angular", "remix-run/remix", "vercel/next.js",
        "denoland/deno", "supabase/supabase", "grafana/grafana",
        "calcom/cal.com", "toeverything/AFFiNE",
        "strapi/strapi", "directus/directus", "medusajs/medusa",
        "n8n-io/n8n", "nocodb/nocodb", "appwrite/appwrite",
        "refinedev/refine", "BuilderIO/qwik",
        "slidevjs/slidev", "vitest-dev/vitest",
        "changesets/changesets", "TypeStrong/ts-node",
        "unjs/nitro", "honojs/hono",
    ],
}
# Legacy alias
CURATED_PYTHON_REPOS = CURATED_REPOS["Python"]

# ── Auto-discovery: topic keywords by language ──────────────
DISCOVERY_TOPICS_BY_LANG: dict[str, tuple[str, ...]] = {
    "Python": (
        "web", "cli", "api", "data", "automation",
        "devtools", "testing", "async", "http", "database",
        "security", "networking", "parsing", "validation",
    ),
    "JavaScript": (
        "web", "cli", "api", "frontend", "backend",
        "nodejs", "react", "vue", "bundler", "testing",
        "http", "database", "framework", "ui",
    ),
    "TypeScript": (
        "web", "cli", "api", "frontend", "backend",
        "nodejs", "react", "fullstack", "orm", "testing",
        "http", "framework", "validation", "type-safe",
    ),
}
# Legacy alias
DISCOVERY_TOPICS = DISCOVERY_TOPICS_BY_LANG["Python"]

# ── Heavy dependencies to exclude by language ──────────────
HEAVY_DEPS_BY_LANG: dict[str, set[str]] = {
    "Python": {
        "pytorch", "torch", "tensorflow", "keras", "jax", "mxnet",
        "cuda", "cupy", "triton", "onnxruntime", "paddlepaddle",
        "detectron2", "mmdet", "mmcv", "transformers", "diffusers",
        "deepspeed", "megatron", "fairseq", "espnet",
        "opencv-python-headless", "opencv-contrib-python",
        "dask", "ray", "spark", "pyspark", "hadoop",
    },
    "JavaScript": {
        "tensorflow", "onnxruntime", "cuda",
        "electron", "react-native",
    },
    "TypeScript": {
        "tensorflow", "onnxruntime", "cuda",
        "electron", "react-native",
    },
}


def get_code_extensions(language: str) -> tuple[str, ...]:
    """Get code file extensions for a language."""
    return CODE_EXTENSIONS.get(language, CODE_EXTENSIONS["Python"])


def get_test_patterns(language: str) -> tuple[str, ...]:
    """Get test file patterns for a language."""
    return TEST_FILE_PATTERNS_BY_LANG.get(language, TEST_FILE_PATTERNS)


def get_doc_patterns(language: str) -> tuple[str, ...]:
    """Get documentation file patterns for a language."""
    return DOC_FILE_PATTERNS_BY_LANG.get(language, DOC_FILE_PATTERNS)


def get_curated_repos(language: str) -> list[str]:
    """Get curated repos for a language."""
    return CURATED_REPOS.get(language, [])


def get_discovery_topics(language: str) -> tuple[str, ...]:
    """Get discovery topics for a language."""
    return DISCOVERY_TOPICS_BY_LANG.get(language, DISCOVERY_TOPICS_BY_LANG["Python"])


def get_heavy_deps(language: str) -> set[str]:
    """Get heavy dependencies to exclude for a language."""
    return HEAVY_DEPS_BY_LANG.get(language, set())


# ── GitHub URL parsing ──────────────────────────────────────
_GITHUB_URL_RE = re.compile(
    r"(?:https?://)?github\.com/([^/]+/[^/]+)/(issues|pull|pulls)/(\d+)"
)


def parse_github_url(url: str) -> tuple[str, int, str]:
    """Parse a GitHub issue or PR URL.

    Returns (full_name, number, url_type) where url_type is 'issue' or 'pr'.
    Raises ValueError for malformed URLs.
    """
    m = _GITHUB_URL_RE.search(url.strip())
    if not m:
        raise ValueError(
            f"Could not parse GitHub URL: {url}\n"
            "Expected format: https://github.com/owner/repo/issues/123 or .../pull/456"
        )
    full_name = m.group(1)
    url_type = "issue" if m.group(2) == "issues" else "pr"
    number = int(m.group(3))
    return full_name, number, url_type
