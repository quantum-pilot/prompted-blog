// Updated main.js to display full file contents with line numbers in history view
// and to remove the old (left) view. Uses the cached .txt files for each revision
// rather than the patch diffs. This ensures the entire file is visible even when
// no explicit diff exists.

const url = new URL(window.location);
const isHistory = url.searchParams.get('history_enabled') === 'true';
const diffOutput = document.getElementById('diff-output');
const historyBtn = document.getElementById('history-trigger');
const revScroller = document.getElementById('revision-scroller');

if (isHistory) historyBtn.classList.add('active');

/**
 * Simple HTML escape helper.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build a <pre> block with line-number gutter for a file’s full contents.
 * @param {string} content – raw file contents
 * @returns {HTMLElement}
 */
function buildFullView(content) {
  const pre = document.createElement('pre');
  pre.className = 'diff-full';

  const lines = content.split('\n');
  pre.innerHTML = lines
    .map((line, idx) => {
      const ln = `<span style="display:inline-block; width:3rem; text-align:right; margin-right:1rem; color:#8b949e;">${idx + 1}</span>`;
      return ln + escapeHtml(line);
    })
    .join('\n');

  return pre;
}

/**
 * Fetch latest post path and decide whether to show blog post or history.
 */
fetch('latest.json')
  .then(res => res.json())
  .then(path => {
    // Regular blog view – just embed the generated HTML.
    if (!isHistory) {
      fetch(`${path}/index.html`)
        .then(res => res.text())
        .then(html => {
          const temp = document.createElement('div');
          temp.innerHTML = html;
          const post = temp.querySelector('.markdown-body');
          if (post) document.getElementById('latest-post').appendChild(post);
        });
      return;
    }

    // History view – hide the rendered post and build revision viewer.
    document.getElementById('latest-post').style.display = 'none';

    const targets = [
      { path: 'instructions.txt', dir: '.' },
      { path: 'prompts.txt',        dir: path },
      { path: 'output.md',          dir: path }
    ];

    const order = targets.map(t => t.path);
    let maxRevs = 0;

    // Load revision metadata for each tracked file.
    Promise.all(
      targets.map(({ path: fname, dir }) =>
        fetch(`${dir}/diff_cache/${fname}/revisions.json`)
          .then(res => res.json())
          .then(revisions => {
            maxRevs = Math.max(maxRevs, revisions.length);
            return { fname, dir, revisions };
          })
      )
    ).then(files => {
      // Initially render the latest revision.
      renderRevision(maxRevs - 1);

      // Build the revision scroller dots.
      const dots = [];
      for (let i = 0; i < maxRevs; i++) {
        const dot = document.createElement('div');
        dot.className = 'rev-dot';
        if (i === maxRevs - 1) dot.classList.add('active');
        dot.addEventListener('click', () => {
          dots.forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
          renderRevision(i);
        });
        dots.push(dot);
        revScroller.appendChild(dot);
      }

      // Decorative centre scroll icon.
      const scrollIcon = document.createElement('div');
      scrollIcon.className = 'rev-scroll-icon';
      revScroller.appendChild(scrollIcon);

      /**
       * Render a particular revision index for all tracked files.
       * @param {number} index
       */
      function renderRevision(index) {
        diffOutput.innerHTML = '';
        const blockMap = new Map(order.map(k => [k, null]));

        files.forEach(({ fname, dir, revisions }) => {
          let revIndex = index;
          // Clamp to available revisions for this file.
          while (revIndex >= 0 && revIndex >= revisions.length) revIndex--;
          if (revIndex < 0) return;

          const txtPath = `${dir}/diff_cache/${fname}/${revIndex}.txt`;

          fetch(txtPath)
            .then(r => r.ok ? r.text() : Promise.reject())
            .then(content => {
              const container = buildFullView(content);
              blockMap.set(fname, container);
            })
            .catch(() => {
              const container = document.createElement('pre');
              container.className = 'diff-full';
              container.textContent = `Unable to load ${fname} revision ${revIndex}`;
              blockMap.set(fname, container);
            })
            .finally(() => {
              const allFilled = order.every(k => blockMap.get(k));
              if (allFilled) {
                order.forEach(k => {
                  const el = blockMap.get(k);
                  if (el) diffOutput.appendChild(el);
                });
              }
            });
        });
      }
    });
  });

// History toggle (kept the existing behaviour).
historyBtn.addEventListener('click', () => {
  const active = historyBtn.classList.contains('active');
  if (active) {
    url.searchParams.delete('history_enabled');
  } else {
    url.searchParams.set('history_enabled', 'true');
  }
  window.location = url.toString();
});
