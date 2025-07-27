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
