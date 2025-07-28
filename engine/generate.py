import subprocess, json, shutil
from pathlib import Path

POSTS = Path("posts")
ROOT_FILES = [Path("instructions.txt")]
CACHE = "diff_cache"


def get_commit_history(path):
    """Return [{hash, date}, …] oldest→newest"""
    lines = subprocess.run(
        ["git", "log", "--pretty=format:%H %cI", str(path)],
        capture_output=True, text=True
    ).stdout.strip().splitlines()[::-1]
    return [{"hash": h, "date": d} for h, d in (ln.split(" ", 1) for ln in lines)]


def git_show(path, rev):
    return subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True).stdout


def git_diff(path, base, head):
    return subprocess.run(["git", "diff", f"{base}..{head}", "--no-color", "--", str(path)], capture_output=True, text=True).stdout


def write_diffs(root, rel):
    cache = root / CACHE / rel.name
    if cache.exists():
        shutil.rmtree(cache)
    cache.mkdir(parents=True)

    commits = get_commit_history(rel)
    (cache / "revisions.json").write_text(json.dumps(commits, indent=2))
    if not commits:
        return

    # first snapshot
    (cache / "0.txt").write_text(git_show(rel, commits[0]["hash"]))
    (cache / "0.diff").write_text(f"Initial version of {rel}\n")

    for i in range(1, len(commits)):
        base, head = commits[i - 1]["hash"], commits[i]["hash"]
        (cache / f"{i}.diff").write_text(git_diff(rel, base, head))
        (cache / f"{i}.txt").write_text(git_show(rel, head))


def main():
    for post in POSTS.iterdir():
        if post.is_dir() and post.name != CACHE:
            for fname in ("prompts.txt", "output.md"):
                path = post / fname
                if path.exists():
                    write_diffs(post, path)

    for root in ROOT_FILES:
        if root.exists():
            write_diffs(root.parent, root)


if __name__ == "__main__":
    main()
