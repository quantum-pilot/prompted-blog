import subprocess
import json
from pathlib import Path
import shutil

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


def get_raw_diff(path, base, head):
    return subprocess.run([
        "git", "diff", f"{base}..{head}", "--no-color", "--", str(path)
    ], capture_output=True, text=True).stdout


def write_diffs_for_file(post_dir, rel_path):
    cache_dir = post_dir / CACHE / rel_path.name
    if cache_dir.exists():
        shutil.rmtree(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    commits = get_commit_history(rel_path)
    (cache_dir / "revisions.json").write_text(json.dumps(commits, indent=2))

    for i in range(1, len(commits)):
        base, head = commits[i - 1], commits[i]
        diff = get_raw_diff(rel_path, base, head)
        (cache_dir / f"{i}.diff").write_text(diff)


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
