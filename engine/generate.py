import os
import subprocess
import json
from pathlib import Path

POSTS = Path("posts")
ROOT_FILES = [Path("instructions.txt")]
CACHE = "diff_cache"


def get_commit_history(path):
    result = subprocess.run([
        "git", "log", "--pretty=format:%H", str(path)
    ], capture_output=True, text=True)
    return result.stdout.strip().splitlines()[::-1]  # oldest to newest


def get_parent_commit(sha):
    result = subprocess.run([
        "git", "rev-list", "--parents", "-n", "1", sha
    ], capture_output=True, text=True).stdout.strip().split()
    return result[1] if len(result) > 1 else None


def get_diff_between_commits(path, base, head):
    result = subprocess.run([
        "git", "diff", f"{base}..{head}", "--", str(path)
    ], capture_output=True, text=True)
    return result.stdout


def write_diffs_for_file(post_dir, rel_path):
    cache_dir = post_dir / CACHE / rel_path.name
    cache_dir.mkdir(parents=True, exist_ok=True)
    commits = get_commit_history(rel_path)
    with (cache_dir / "revisions.json").open("w") as revs:
        json.dump(commits, revs, indent=2)
    for i in range(1, len(commits)):
        base, head = commits[i - 1], commits[i]
        diff_file = cache_dir / f"{i}.json"
        if diff_file.exists():
            continue
        diff = get_diff_between_commits(rel_path, base, head)
        with diff_file.open("w") as f:
            json.dump({"from": base, "to": head, "diff": diff}, f, indent=2)


def main():
    for post in POSTS.iterdir():
        if not post.is_dir() or post.name == CACHE:
            continue
        for fname in ("prompts.txt", "output.md"):
            fpath = post / fname
            if fpath.exists():
                write_diffs_for_file(post, fpath)

    for path in ROOT_FILES:
        if path.exists():
            write_diffs_for_file(path.parent, path)


if __name__ == "__main__":
    main()
