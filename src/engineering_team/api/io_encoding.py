"""Normalize stdout/stderr for Unicode on Windows (CrewAI prints emoji to console)."""

from __future__ import annotations

import os
import sys


def ensure_utf8_stdio() -> None:
    """Avoid UnicodeEncodeError when libraries print emoji on Windows (cp1252)."""
    os.environ.setdefault("PYTHONUTF8", "1")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if sys.platform != "win32":
        return
    for stream in (sys.stdout, sys.stderr):
        try:
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError, ValueError):
            pass
    try:
        import ctypes

        ctypes.windll.kernel32.SetConsoleOutputCP(65001)
        ctypes.windll.kernel32.SetConsoleCP(65001)
    except Exception:
        pass
