import os
import subprocess
import json
from pathlib import Path

ROOT = Path("posts")
CACHE = "diff_cache"

def get_diff(path):
    return subprocess.run([
        "git", "diff", "--no-color", "--patch", str(path)
    ], capture_output=True, text=True).stdout

def write_cache(post_dir, rel_path, content):
    cache_dir = post_dir / CACHE
    cache_dir.mkdir(exist_ok=True)
    out = cache_dir / f"{rel_path.name}.json"
    with out.open("w") as f:
        json.dump({"filename": str(rel_path), "diff": content}, f, indent=2)

def main():
    for post in ROOT.iterdir():
        if not post.is_dir():
            continue
        for file in ("prompts.txt", "instructions.txt", "output.md"):
            fpath = post / file
            if fpath.exists():
                diff = get_diff(fpath)
                write_cache(post, fpath, diff)

if __name__ == "__main__":
    main()
