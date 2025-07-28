// main.js – inline (single‑pane) diff view
const url = new URL(window.location);
const isHistory = url.searchParams.get('history_enabled') === 'true';

const diffOutput = document.getElementById('diff-output');
const historyBtn = document.getElementById('history-trigger');
const revScroller = document.getElementById('revision-scroller');

if (isHistory) historyBtn.classList.add('active');

// unified diff2html options: single column, inline word match
const DIFF_OPTS = { drawFileList: false, matching: 'words', outputFormat: 'line-by-line' };

fetch('latest.json')
  .then(res => res.json())
  .then(path => {
    // normal mode → inject latest post and bail
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

    // history mode setup
    document.getElementById('latest-post').style.display = 'none';

    const targets = [
      { path: 'instructions.txt', dir: '.' },
      { path: 'prompts.txt',      dir: path },
      { path: 'output.md',        dir: path }
    ];

    const order = targets.map(t => t.path);
    let maxRevs = 0;

    // load revision maps
    Promise.all(targets.map(({ path: fname, dir }) =>
      fetch(`${dir}/diff_cache/${fname}/revisions.json`)
        .then(r => r.json())
        .then(revisions => {
          maxRevs = Math.max(maxRevs, revisions.length);
          return { fname, dir, revisions };
        })
    )).then(files => {
      buildScroller(maxRevs);
      renderRevision(maxRevs - 1);

      function renderRevision(index) {
        diffOutput.innerHTML = '';
        const blockMap = new Map(order.map(k => [k, null]));

        files.forEach(({ fname, dir, revisions }) => {
          let revIndex = index;
          while (revIndex >= revisions.length) revIndex--; // out‑of‑range guard
          if (revIndex < 0) return;

          const diffPath = `${dir}/diff_cache/${fname}/${revIndex}.diff`;
          const txtPath  = `${dir}/diff_cache/${fname}/${revIndex}.txt`;

          fetch(diffPath)
            .then(r => r.ok ? r.text() : Promise.reject())
            .then(diff => inject(fname, diff))
            .catch(() => {
              // generate pseudo‑diff when none exists
              fetch(txtPath)
                .then(r => r.ok ? r.text() : Promise.reject())
                .then(content => {
                  const pseudo = [`--- a/${fname}`, `+++ b/${fname}`]
                    .concat(content.split('\n').map(l => ' ' + l))
                    .join('\n');
                  inject(fname, pseudo);
                });
            });

          function inject(name, diff) {
            const html = Diff2Html.html(diff, DIFF_OPTS);
            const wrap = document.createElement('div');
            wrap.className = 'diff-container';
            wrap.innerHTML = html;
            blockMap.set(name, wrap);
            if ([...blockMap.values()].every(Boolean))
              order.forEach(k => diffOutput.appendChild(blockMap.get(k)));
          }
        });
      }

      function buildScroller(total) {
        if (revScroller.childElementCount) return;
        const dots = [];
        for (let i = 0; i < total; i++) {
          const dot = document.createElement('div');
          dot.className = 'rev-dot';
          if (i === total - 1) dot.classList.add('active');
          dot.addEventListener('click', () => {
            dots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            renderRevision(i);
          });
          dots.push(dot);
          revScroller.appendChild(dot);
        }
        revScroller.appendChild(Object.assign(
          document.createElement('div'), { className: 'rev-scroll-icon' }
        ));
      }
    });
  });

// toggle history mode
historyBtn.addEventListener('click', () => {
  historyBtn.classList.toggle('active');
  if (isHistory) url.searchParams.delete('history_enabled');
  else url.searchParams.set('history_enabled', 'true');
  window.location = url.toString();
});
