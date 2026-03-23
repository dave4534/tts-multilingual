"""Test configuration.

Pytest discovery sometimes puts the `modal_app/` directory itself on `sys.path`,
which makes `import modal_app` fail. We ensure the repo root is always present.
"""

from __future__ import annotations

import sys
from pathlib import Path


def _ensure_repo_root_on_syspath() -> None:
    repo_root = Path(__file__).resolve().parent
    repo_root_str = str(repo_root)
    if repo_root_str not in sys.path:
        sys.path.insert(0, repo_root_str)


_ensure_repo_root_on_syspath()

