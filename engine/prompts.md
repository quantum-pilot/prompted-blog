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

1. The markdown theme is very basic. I want something modern. I want server-side rendered GH pages like blog post view of my posts. I'm sure there are libraries or tools that offer this?
2. You are doing a git diff on files directly but we are tracking the diff of each revision for a file, save it as a versioned JSON diff for that file and use that for rendering the diff - again in a Github-like preview. Single file with all revisions and diffs for a file or multiple versioned JSON files containing that revision and only that diff - your call.
3. Rename output.html to index.html
4. This render also does not deal with unicode chars as you can see in the screenshot.

![minimal](/assets/minimal-md.jpg)

The minimal output is getting to me. Can we already switch to a modern markdown rendering tool. It's not a necessity to use markdown package. We can split the markdown generation from python and use a docker-based tool instead and it will run as a separate step. Also, instructions.txt is not inside posts but in in root because it applies to the blog as a whole. We should create diffs for that as well in the python script.

Instead of downloading wget and downloading css, I have put `github-markdown.css` into assets, we already mount data, now we can use the CSS from assets for generation. Can your rewrite the script? We don't even need our own dockerfile here.

The CSS seems to be added to HTML but not being used anywhere. Is it even supposed to make a difference? Also, no need to call pandoc command for running the container. It is already an entrypoint which is why it's causing an error.

This emits the necessary GH-flavored rendered markdown in index html. Let's write the homepage layout in a separate canvas. The blog header would be "Prompted Blog" and below that would be a brief one-liner description of what this idea is. When the home page is loaded, it should fetch the latest post render and inline it below the header - one approach for the latest post is to configure or set it during generation time. Write the homepage html with necessary css and js files. If you want to change render.sh, do it in the same canvas.

I don't want static embedding. Change render.sh to emit all rendered posts and setting the latest post somewhere which can then be fetched by homepage. It must ignore diff_cache dirs.

Let's rewrite the fetch logic to fetch this json.

Now comes the functionality. Let's add a button for prompt history somewhere. Next to header or outside of div container slightly to the right or left? Note that we will also have previous and next post buttons on the far  left and right edges. You can add them now. Only make the necessary changes. If something is untouched, drop a comment as placeholder for unchanged lines.

Let's revisit diff generation in python. Right now we are generating full file content and storing in json which is a lot of load. Let's obtain and store a list of commit hashes for each post, and generate diffs of individual files for each SHA hash relative to their parent hash. Once we get the revisions for a post, we check if the diff json exists for each file progressively, starting from the last revision and work our way to the first ever revision. If diff exists, it gets rendered for that file in the view. If it doesn't exist, it will remain static. Let's implement this logic in python script first.

Let's change frontend html now. Also change cloudflare font-awesome to refer to local "assets/font-awesome-6.4.0.css"
Reminder that instructions is global.

When the history mode is activated, the button should be highlighted to show that it's enabled, so that when it's clicked again, it's disabled and we go back to the normal post render without any diffs. In history mode, I want the diffs in color for all those files and the files must be side by side (similar to a table-like container with three columns) showing the visual contrast of changes made (similar to Github PRs). Each file individually is vertically scrollable, but if it fits within the screen, then there is no scrolling.

When history mode is enabled, we can put all three files outside the main div container so that they can span up to 90% of page width rather than fitting them within the div container dedicated for markdown posts.
For diff, I am noticing several things, like the diff header need not be mentioned since we only show one file. --- a and +++ b does not have to be included at all. We can display line numbers as a thin column to the left of each file so that we don't render it like @@ -43,3 +43,5 @@ and it will be easier to read.
Can we use diff2html instead and work on raw diffs? Let's make changes to python script to emit raw diffs instead. Let's also remove all the operating directories so that we don't accumulate junk.

Let's change html now.
I've added both these files for usage
assets/diff2html.min.css
assets/diff2html.min.js
Remember what I said earlier on keeping the diff containers out of the main container so that we can use 90% of available window width.

Do you see the problem? Body seems to have a margin and it's letting everything overflow out of the window.
![](/assets/margin-offset.jpg)

Sure, but now it affects the entire blog post view. Blog has taken up all the width. We only want history to take up 90% of the space, post width (when history is disabled) should be how it was before, about 60% of the width. Also, let's not change the file order. Instructions should be first, then comes prompts and then comes output. I see the order in the array, but it still comes in random order in history view.

There is a recursion or infinite loop in the diff fetch logic. The header is not in the center and the prompt history button always overflows out. A reminder that we should only show the last revision state for three files. If diff exists in that hash for that file, then it's highlighted, then the file is shown as is.

> After this, I tried to improve the results by uploading `prompts.md`, `generate.py`, `render.sh` and `index.html` as project files and starting a new chat with the instructions below:
>
> prompts.md contains the entire user prompt which led to the creation of artifacts.
> index.html is frontend.
> generate.py is for generating diff cache from git tree
> render.sh is the markdown rendering for blog posts.
>
> ![Main view](/assets/v1-main.jpg)
>
> ![Diff view](/assets/v1-diff.jpg)

Use one canvas per file. Now we are working on index.html.

Revisiting diff again, let's add a button with scroll icon 5% higher from the bottom of page (the icon should be similar to what appears when we press middle mouse to scroll a page in browser). Similar to page number elements in Google search, spaced gray circles represent individual revisions of all files in that post. The scroller will sit at the end indicating that it's the latest revision. It can be moved to the left to indicate that we have to switch to the previous revision. Left or right constraints are based on whether we're at the start or end of versions.

For each version, I want the full file with a highlighted diff. Can we generate full files along with the diff in python script? Use the script in project as base and build up on it in a new canvas. By default the diff should contain the file contents as well based on line numbers. The diff tool should still highlight the diff, but the remainder of the file is still scrollable.

It looks like this ignores the initial state of the file? We can call it `0.txt` and `0.diff` - it's basically the creation of the file which may or may not contain contents right?

Let's change index.html to use this. Remember how I asked for it?

The diff may not always exist - for example, instructions are modified barely, but prompts and output can always change. Sometimes outputs have to be fixed so prompts will stay the same. Instead of attempting to fetch all files, we can check if the revision exists in revisions.json and if it does not, we go for whichever revision exists before that - basically the previous index.

The pagination logic is off. Old file views are not removed properly and accumulates when we switch pages.

We need the diffs to extend with the file instead of having it separately. This means, places where we don't have diffs, the tool will still display the last version of the file inside diff tool. This is what Github does, can we do the same? Let's write an assets/main.js with all contents of the custom javascript. We can later include this in the html.

> I received an emoji in response - I realized that the model got switched to 4o suddenly (which could only make buggy changes) and when I switched back to o3, it started crashing every time I tried to update the canvas, so I updated the project files with the latest prompts, files (instructions) and started another chat, for which I had to write more to bring it up to speed. I asked o3 to give me custom instructions based on the project files:
>
> "Give me brief custom instructions for LLM to continue building the blog engine based on prompts.md in project files. It will only work on index.html and main.js, so use those for understanding current logic in plaintext."
>
> ### Custom instructions for LLM
> Follow these points when extending the blog engine.
>
> **Only touch** `index.html` (markup/CSS) and `main.js` (client logic).
>
> **Current logic refresher (from the two files)**
> * `main.js` fetches `latest.json`; if the URL flag `?history_enabled=true` is absent it injects the latest post’s rendered HTML into `#latest-post`.
> * With the flag present it:
>   1. Hides the latest post container.
>   2. Loads *instructions.txt*, the current folder’s `prompts.txt`, and `output.md` commit histories from each file’s `diff_cache/**`, using **Diff2Html** to render side-by-side diffs.
>   3. Builds a revision “dot” scroller and updates the diff view when a dot is clicked.
> * Two nav buttons (`.prev-post`, `.next-post`) are present but not yet wired.
>
> **Project files:**
> - prompts.md contains the entire user prompt which led to the creation of artifacts.
> - index.html is frontend
> - main.js is the custom javascript
> - generate.py is for generating diff cache from git tree
> - render.sh is the markdown rendering for blog posts
> - v1-main.jpg is the current main view
> - v1-diff.jpg is the current diff view

Work on one canvas per file. Use brief comments over descriptive ones.

We are working on main.js - use the existing file in project as base.
We should display the remainder of contents of file within the diff. If diff does not exist, we should still populate the diff view with the contents so that it shows all the contents of the file with line numbers. We are already using diff2html, check index.html for inspiration. Do not append the complete file. We should extend the lines around the diff to include file contents of that version instead, while preserving formatting.

Can we inline the additions and deletions in the same file? This way we only show one file. We should avoid duplicating lines if content has not changed there. Prefer brief comments instead of writing full blown documentation.

Inline diff is great, but this is not showing the full file in the diff. How can we squeeze the contents around the diff into the view?

Works. Instead of showing the latest revision, fix a page to a revision - if diff exists for the file in the revision, show it like how it is currently. If it does not, then show the file contents corresponding to that version. Make sure "changed" is not shown at the top of the file in difftool indicating that no change has been made in that revision for that file.

> ChatGPT once again started having dementia or schizophrenia, asked it to emit custom instructions again for a new chat, this time it will be with 4.1 instead of o3. as it's advertise for "quick coding and analysis".
>
> ### Custom instructions v2
>
> **Only edit `index.html` (HTML + CSS) and `main.js` (client JS).**
>
> Frontend containers in `index.html`:
>
> * `#latest-post` – slot for rendered HTML of the newest post.
> * `#diff-output` – Diff2Html target pane.
> * `#revision-scroller` – row of clickable dots (one per revision).
> * `#history-trigger`, `.prev-post`, `.next-post` – navigation controls.
>
> Main workflow in `main.js`:
>
> **Parse URL flags:**
>    * `?history_enabled=true` → show *history* view.
>    * `?rev=N` (optional) → pin UI to a specific revision.
>
> **Latest (default) view**
>    * Fetch `latest.json` → inject `${path}/index.html` into `#latest-post`.
>
> **History view**
>    * Hide `#latest-post`; highlight `#history-trigger`.
>    * For the selected revision (`rev`), load `.diff` *if it exists* **or** the raw file snapshot.
>      * If a diff exists, merge it with unchanged context lines so the Diff2Html **inline** (single-pane, `outputFormat:'line-by-line'`) view shows the *entire* file, unchanged lines included, no duplicates.
>      * If no diff, synthesize a unified diff that marks every line as neutral; suppress the “changed” banner so the header doesn’t imply edits.
>    * Build / update the dot scroller; clicking a dot sets `rev` via `history.replaceState` and re-renders without reload.
>
> **Nav buttons** `.prev-post`, `.next-post` remain to be wired (future work).
>
> Diff rendering:
>
> * **Inline (+/–) highlighting, single copy of each unchanged line.**
> * Full-file context always visible; line numbers preserved.
> * Brief, minimal code comments—avoid verbose docs in source.
>
> Use these rules for any future modifications or new features.
>
> **Project files:**
> - prompts.md contains the entire user prompt which led to the creation of artifacts.
> - index.html is frontend
> - main.js is the custom javascript
> - generate.py is for generating diff cache from git tree (used in server, only for understanding logic)
> - render.sh is the markdown rendering for blog posts (used in server, only for understanding logic)
> - main.jpg is the current main view
> - diff.jpg is the current diff view
>
> ![v2-diff.jpg](/assets/v2-diff.jpg)

> And then I regreted going to 4.1 because it was worse. So I went back to o3.

Use brief comments instead of descriptive comments or explanations. We are working on diff view over files index.html and main.js. Create new canvas one for each, start with main.js. If index.html needs to be updated, let me know in chat.

As you can see in diff.jpg, instructions.txt has no file changes, but it should still show the file contents at that version. If you look at post markdown in image, the line number states later at line 3 instead of line 1 in the file.

We do not have to fetch the last version for all files - each file's revisions.json (fetched) contains a list of hashes. We can modify generate.py to include date from Git commit. Let's work on a new canvas for that using existing generate.py as base.

> At this point, I was tired of copy-pasting stuff from o3, so I switched to Claude Code.

This javascript file is invoked inn index.html in root. You can go through engine/prompts.md to see how this has evolved. All artifacts have been generated. We are fetching individual revisions for a file. See revisions.json for any file in diff_cache dir and it'll contain a list of hash and datetime. We can use this to merge and sort all the revisions. After that, if a file contains a diff, it'll be shown surrounded by the file contents, otherwise the latest full content version will be displayed.

Line numbers are static now, but the file content is scrollable. The first line (unless it's diff) is still ignored probably because it is treated as a diff header. We could generate a diff header for files when there is no diff at line 1 - just for diff2html so that it ignores it and continues with actual file. It should be added only when the file has no diff at line 1. If diff already exists for line 1, then no need to add it manually.
