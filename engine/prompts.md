Earlier instructions are for writing blog posts. Now we are building the blog.

First version of this blog would be very simple.

Repository structure looks like this:

```
prompted-blog/
├── .git/
├── assets
├── engine
│   └── prompts.txt
├── instructions.txt
└── posts
    └── 2025-07-27
        ├── output.md
        └── prompts.txt
```

There is only one post in posts directory right now.
Assume that git dot dir will exist in this dir, so diffs on prompts, instructions and output can be generated as JSON by using git commands.
Each file will be tracked only through diff.

- `prompts.txt` contains the most recent version of user prompts for the post
- `instructions.txt` is the latest version of the iteratively developed custom instructions for the project as a whole
- `output.md` is the aggregated output from the LLM.

In LLM session, we will be working on a canvas and it will be a specific section to narrow focus and freeze other sections.

The blog will be markdown-based. HTML files have to be generated from existing output.md files. Assume that the latest post is what will be displayed (not linked) in blog homepage, this eliminates the need for homepage and also directly showcases what the blog is meant to do.

By itself, each post will be displayed in a rendered Github-like markdown view. The main feature will be the prompt history button on the left (there will be enough margin on the sides with markdown, so button can be visible there).
On clicking the button, a replay view is triggered. The latest version would be the current page and a button (looking like horizontal middle mouse scroll) at the bottom can go forward or backward to each revision showing how prompt, output and instructions have changed.
These are using the generated JSONs from the git diffs as said earlier. These JSONs can be cached so it will be progressively loaded for each revision in the reverse order (latest being first).
This "prompt history" mode can be tracked with some URL query parameter (for example, ?history_enabled=true and it will show scrollable historical diff view on load).

We can start by designing the posts view with the above-mentioned functionality - prompt history button tied to query parameter, clicking that triggers one view for each filename - `instructions.txt` on left, `prompts.txt` on center and `output.md` which is the markdown-rendered post to the right.
Until the button is clicked, the filenames should not appear as it should only look like a markdown-rendered blog post.
Use one canvas per file. Only work on one file at a time. Ask if you decide to work on another file. Don't use chat - only write comments in file canvas. Don't write elaborate comments anywhere. Use short comments only if needed.
Don't use react. Can explore other frameworks if necessary, but first thing would be to setup project. Write a markdown containing all necessary build or setup scripts with necessary file names before touching product logic.

One idea is that we can have one engine/diff-json.py which does os.walk on the posts and generates the markdown content and necessary diffs for all files. It will be a replace function because it will replace existing files in json cache which also helps with updates to old posts.

Why not merge both markdown generation and diff generation? We can rename it to generate.py as it does all the work.
