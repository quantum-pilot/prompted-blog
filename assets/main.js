// Updated main.js – extends diff display to include the entire file content for the selected
// revision while still highlighting changed lines. If no .diff exists for a revision, we
// fall back to rendering the full file as context lines with proper line‑number hunks so
// Diff2Html shows line numbers.

/* -------------------------------------------------------------------------- */
/* Utilities                                                                   */
/* -------------------------------------------------------------------------- */

const url = new URL(window.location);
const isHistory = url.searchParams.get("history_enabled") === "true";
const diffOutput = document.getElementById("diff-output");
const historyBtn = document.getElementById("history-trigger");
const revScroller = document.getElementById("revision-scroller");

if (isHistory) historyBtn.classList.add("active");

/**
 * Produce a synthetic unified diff that shows *every* line of `content` as an
 * unchanged context line so that Diff2Html can render the full file with line
 * numbers.
 */
function buildFullContextDiff(fname, content) {
  const lines = content.split("\n");
  const header = [
    `--- a/${fname}`,
    `+++ b/${fname}`,
    `@@ -1,${lines.length} +1,${lines.length} @@`,
  ].join("\n");
  const body = lines.map((l) => ` ${l}`).join("\n");
  return `${header}\n${body}`;
}

/**
 * Extend an **existing** git diff so that the rendered view contains the rest
 * of the file (unchanged lines) while preserving + additions. Deleted lines
 * (‑) are *not* included because they do not exist in the new file version.
 *
 * @param {string} fname – filename for diff headers
 * @param {string} rawDiff – git diff text for this revision (may include multiple hunks)
 * @param {string} fullContent – the *complete* file content for the same revision
 * @returns {string} – a unified diff string suitable for Diff2Html
 */
function buildExtendedDiff(fname, rawDiff, fullContent) {
  // Collect the line numbers that are present as additions in the raw diff
  const addedLines = new Set();
  const diffLines = rawDiff.split("\n");
  let newLinePtr = 0;

  for (const line of diffLines) {
    if (line.startsWith("@@")) {
      // Parse hunk header: "@@ -a,b +c,d @@"
      const m = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (m) newLinePtr = parseInt(m[1], 10);
      continue;
    }

    if (line.startsWith(" ")) {
      newLinePtr += 1; // context line advances both pointers
    } else if (line.startsWith("+")) {
      addedLines.add(newLinePtr);
      newLinePtr += 1; // insertion only advances new pointer
    } else if (line.startsWith("-")) {
      // deletion: advances old pointer only – newLinePtr unchanged
    }
  }

  // Build a single synthetic hunk covering the whole file.
  const allLines = fullContent.split("\n");
  const header = [
    `--- a/${fname}`,
    `+++ b/${fname}`,
    `@@ -1,${allLines.length} +1,${allLines.length} @@`,
  ].join("\n");

  const body = allLines
    .map((l, idx) => {
      const ln = idx + 1;
      return `${addedLines.has(ln) ? "+" : " "}${l}`;
    })
    .join("\n");

  return `${header}\n${body}`;
}

/** Render a diff string through Diff2Html and wrap it in a container DIV. */
function createDiffContainer(diffStr) {
  const html = Diff2Html.html(diffStr, {
    drawFileList: false,
    matching: "lines",
    outputFormat: "side-by-side",
  });
  const container = document.createElement("div");
  container.className = "diff-container";
  container.innerHTML = html;
  return container;
}

/* -------------------------------------------------------------------------- */
/* Main fetch & render flow                                                    */
/* -------------------------------------------------------------------------- */

fetch("latest.json")
  .then((res) => res.json())
  .then((latestPath) => {
    if (!isHistory) {
      // Regular post view – inject rendered HTML of latest post
      fetch(`${latestPath}/index.html`)
        .then((res) => res.text())
        .then((html) => {
          const tmp = document.createElement("div");
          tmp.innerHTML = html;
          const post = tmp.querySelector(".markdown-body");
          if (post) document.getElementById("latest-post").appendChild(post);
        });
      return; // No further processing required
    }

    // History mode
    document.getElementById("latest-post").style.display = "none";

    const targets = [
      { path: "instructions.txt", dir: "." },
      { path: "prompts.txt", dir: latestPath },
      { path: "output.md", dir: latestPath },
    ];

    const order = targets.map((t) => t.path);
    let maxRevs = 0;

    // Fetch revision arrays for each target file
    Promise.all(
      targets.map(({ path: fname, dir }) =>
        fetch(`${dir}/diff_cache/${fname}/revisions.json`)
          .then((res) => res.json())
          .then((revs) => {
            maxRevs = Math.max(maxRevs, revs.length);
            return { fname, dir, revisions: revs };
          })
      )
    ).then((files) => {
      initRevisionScroller(maxRevs, renderRevision);
      renderRevision(maxRevs - 1); // start at newest revision

      /**
       * Render a particular revision index across *all* tracked files.
       * @param {number} index – revision index (0 = first commit)
       */
      function renderRevision(index) {
        diffOutput.innerHTML = "";
        const blockMap = new Map(order.map((k) => [k, null]));

        files.forEach(({ fname, dir, revisions }) => {
          // Clamp to last existing revision for this file
          let rev = index;
          while (rev >= revisions.length && rev > 0) rev -= 1;
          if (rev < 0) return; // nothing to show

          const diffPath = `${dir}/diff_cache/${fname}/${rev}.diff`;
          const txtPath = `${dir}/diff_cache/${fname}/${rev}.txt`;

          Promise.all([
            fetch(diffPath).then((r) => (r.ok ? r.text() : null)),
            fetch(txtPath).then((r) => (r.ok ? r.text() : null)),
          ])
            .then(([rawDiff, fullContent]) => {
              if (!fullContent) return; // cannot render without file contents

              const diffStr = rawDiff
                ? buildExtendedDiff(fname, rawDiff, fullContent)
                : buildFullContextDiff(fname, fullContent);

              blockMap.set(fname, createDiffContainer(diffStr));
            })
            .finally(() => {
              // Once we have a container for every file in order, append them
              if (order.every((k) => blockMap.get(k))) {
                order.forEach((k) => {
                  const el = blockMap.get(k);
                  if (el) diffOutput.appendChild(el);
                });
              }
            });
        });
      }
    });
  });

/* -------------------------------------------------------------------------- */
/* UI interactions                                                             */
/* -------------------------------------------------------------------------- */

historyBtn.addEventListener("click", () => {
  if (historyBtn.classList.contains("active")) {
    url.searchParams.delete("history_enabled");
  } else {
    url.searchParams.set("history_enabled", "true");
  }
  window.location = url.toString();
});

/**
 * Build the dot scroller UI and wire click events.
 *
 * @param {number} totalRevisions – highest revision count among files
 * @param {(index:number)=>void} onSelect – callback when a dot is clicked
 */
function initRevisionScroller(totalRevisions, onSelect) {
  revScroller.innerHTML = "";
  const dots = [];

  for (let i = 0; i < totalRevisions; i++) {
    const dot = document.createElement("div");
    dot.className = "rev-dot";
    if (i === totalRevisions - 1) dot.classList.add("active");

    dot.addEventListener("click", () => {
      dots.forEach((d) => d.classList.remove("active"));
      dot.classList.add("active");
      onSelect(i);
    });

    dots.push(dot);
    revScroller.appendChild(dot);
  }

  const scrollIcon = document.createElement("div");
  scrollIcon.className = "rev-scroll-icon";
  revScroller.appendChild(scrollIcon);
}
