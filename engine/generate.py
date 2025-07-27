import os
import subprocess
import json
from pathlib import Path
import markdown
import datetime

ROOT = Path("posts")
CACHE = "diff_cache"

def get_git_versions(path):
    result = subprocess.run([
        "git", "log", "--pretty=format:%H", str(path)
    ], capture_output=True, text=True)
    return result.stdout.strip().splitlines()

def get_version_diff(path, commit):
    return subprocess.run([
        "git", "show", f"{commit}:{path}"], capture_output=True, text=True).stdout

def write_versioned_diffs(post_dir, rel_path):
    cache_dir = post_dir / CACHE / rel_path.name
    cache_dir.mkdir(parents=True, exist_ok=True)
    versions = get_git_versions(rel_path)
    for i, commit in enumerate(reversed(versions)):
        content = get_version_diff(rel_path, commit)
        out = cache_dir / f"v{i+1}.json"
        with out.open("w") as f:
            json.dump({"version": i+1, "commit": commit, "content": content}, f, indent=2)

def write_html(md_path):
    html_out = md_path.parent / "index.html"
    with md_path.open("r", encoding="utf-8") as f:
        md_text = f.read()
    html = markdown.markdown(md_text)
    with html_out.open("w", encoding="utf-8") as f:
        f.write(html)

def main():
    for post in ROOT.iterdir():
        if not post.is_dir():
            continue
        for file in ("prompts.txt", "instructions.txt", "output.md"):
            fpath = post / file
            if fpath.exists():
                write_versioned_diffs(post, fpath)
                if fpath.suffix == ".md":
                    write_html(fpath)

if __name__ == "__main__":
    main()
