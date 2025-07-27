import os
import subprocess
import json
from pathlib import Path

POSTS = Path("posts")
ROOT_FILES = [Path("instructions.txt")]
CACHE = "diff_cache"


def get_git_versions(path):
    result = subprocess.run([
        "git", "log", "--pretty=format:%H", str(path)
    ], capture_output=True, text=True)
    return result.stdout.strip().splitlines()


def get_version_diff(path, commit):
    return subprocess.run([
        "git", "show", f"{commit}:{path}"], capture_output=True, text=True).stdout


def write_versioned_diffs(target_dir, rel_path):
    cache_dir = target_dir / CACHE / rel_path.name
    cache_dir.mkdir(parents=True, exist_ok=True)
    versions = get_git_versions(rel_path)
    for i, commit in enumerate(reversed(versions)):
        content = get_version_diff(rel_path, commit)
        out = cache_dir / f"v{i+1}.json"
        with out.open("w") as f:
            json.dump({"version": i+1, "commit": commit, "content": content}, f, indent=2)


def main():
    for post in POSTS.iterdir():
        if not post.is_dir():
            continue
        for file in ("prompts.txt", "output.md"):
            fpath = post / file
            if fpath.exists():
                write_versioned_diffs(post, fpath)

    for path in ROOT_FILES:
        if path.exists():
            write_versioned_diffs(path.parent, path)


if __name__ == "__main__":
    main()
