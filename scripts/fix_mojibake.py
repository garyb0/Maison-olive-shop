from __future__ import annotations

import re
import subprocess
from pathlib import Path


def bad_score(text: str) -> int:
    markers = ["Ã", "â", "Â", "ð", "�"]
    return sum(text.count(m) for m in markers)


COMMON_REPLACEMENTS = {
    "Ã©": "é",
    "Ã¨": "è",
    "Ãª": "ê",
    "Ã«": "ë",
    "Ã‰": "É",
    "Ã€": "À",
    "Ã ": "à",
    "Ã¢": "â",
    "Ã¤": "ä",
    "Ã®": "î",
    "Ã¯": "ï",
    "Ã´": "ô",
    "Ã¶": "ö",
    "Ã¹": "ù",
    "Ã»": "û",
    "Ã¼": "ü",
    "Ã§": "ç",
    "Ã‡": "Ç",
    "Ã±": "ñ",
    "â€”": "—",
    "â€“": "–",
    "â€¦": "…",
    "â€˜": "‘",
    "â€™": "’",
    "â€œ": "“",
    "â€": "”",
    "â€¢": "•",
    "Â©": "©",
    "Â®": "®",
    "Â°": "°",
    "Â«": "«",
    "Â»": "»",
    "Â·": "·",
    "Â ": " ",
}


def maybe_decode_token(token: str) -> str:
    if not any(m in token for m in ("Ã", "â", "Â", "ð", "�")):
        return token

    best = token
    for enc in ("cp1252", "latin1"):
        try:
            candidate = best.encode(enc).decode("utf-8")
        except Exception:
            continue
        if bad_score(candidate) < bad_score(best) or (bad_score(candidate) == bad_score(best) and candidate != best):
            best = candidate
    return best


def fix_text(text: str) -> str:
    fixed = text
    # Fast-path replacements for the most common mojibake sequences.
    for old, new in COMMON_REPLACEMENTS.items():
        fixed = fixed.replace(old, new)

    # Token-level fallback decode to catch emojis and edge cases.
    parts = re.split(r"(\s+)", fixed)
    for i, part in enumerate(parts):
        if i % 2 == 1:  # whitespace separators
            continue
        parts[i] = maybe_decode_token(part)
    return "".join(parts)


def normalize_runtime_names(text: str) -> str:
    replacements = [
        ("\"Chez-olive-shop\"", "\"chez-olive-shop\""),
        ("'Chez-olive-shop'", "'chez-olive-shop'"),
        ("pm2 restart Chez-olive-shop", "pm2 restart chez-olive-shop"),
        ("pm2 stop Chez-olive-shop", "pm2 stop chez-olive-shop"),
        ("pm2 logs Chez-olive-shop", "pm2 logs chez-olive-shop"),
        ("service: \"Chez-olive-shop\"", "service: \"chez-olive-shop\""),
        # Do not force a directory rename automatically; keep real current workspace path.
        ("C:/Cline/Chez-olive-shop", "C:/Cline/maison-olive-shop"),
        ("C:/Cline/chez-olive-shop", "C:/Cline/maison-olive-shop"),
        ("C:\\Cline\\Chez-olive-shop", "C:\\Cline\\maison-olive-shop"),
        ("C:\\Cline\\chez-olive-shop", "C:\\Cline\\maison-olive-shop"),
    ]
    fixed = text
    for old, new in replacements:
        fixed = fixed.replace(old, new)
    return fixed


def main() -> None:
    files = subprocess.check_output(["git", "ls-files"], text=True, encoding="utf-8", errors="ignore").splitlines()

    changed: list[str] = []
    for rel in files:
        path = Path(rel)
        try:
            raw = path.read_bytes()
        except Exception:
            continue

        if b"\x00" in raw:
            # Skip binary files.
            continue

        try:
            original = raw.decode("utf-8")
        except Exception:
            continue

        fixed = original
        # Multiple rounds help when text was double-encoded.
        for _ in range(3):
            next_fixed = fix_text(fixed)
            if next_fixed == fixed:
                break
            fixed = next_fixed

        fixed = normalize_runtime_names(fixed)

        if fixed != original:
            # Write clean UTF-8 without BOM and with LF newlines.
            path.write_text(fixed, encoding="utf-8", newline="\n")
            changed.append(rel)

    print(f"changed_files={len(changed)}")
    for rel in changed:
        print(rel)


if __name__ == "__main__":
    main()
