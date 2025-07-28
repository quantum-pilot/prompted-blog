// main.js – per‑revision inline diff with full‑file context
const url = new URL(window.location);
const isHistory = url.searchParams.get('history_enabled') === 'true';
const fixedRev = url.searchParams.has('rev') ? parseInt(url.searchParams.get('rev'), 10) : null;

const diffOutput = document.getElementById('diff-output');
const historyBtn = document.getElementById('history-trigger');
const revScroller = document.getElementById('revision-scroller');

if (isHistory) historyBtn.classList.add('active');

const DIFF_OPTS = {
  drawFileList: false,
  matching: 'words',
  outputFormat: 'line-by-line'
};

fetch('latest.json')
  .then(r => r.json())
  .then(basePath => {
    if (!isHistory) {
      // latest view
      fetch(`${basePath}/index.html`).then(r => r.text()).then(html => {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const post = tmp.querySelector('.markdown-body');
        if (post) document.getElementById('latest-post').appendChild(post);
      });
      return;
    }

    document.getElementById('latest-post').style.display = 'none';

    const targets = [
      { name: 'instructions.txt', dir: '.' },
      { name: 'prompts.txt',      dir: basePath },
      { name: 'output.md',        dir: basePath }
    ];
    const order = targets.map(t => t.name);
    let maxRevs = 0;

    // revisions
    Promise.all(targets.map(({ name, dir }) =>
      fetch(`${dir}/diff_cache/${name}/revisions.json`)
        .then(r => r.json())
        .then(list => ({ name, dir, list }))
    )).then(files => {
      // merge all revisions with date and sort
      const allRevisions = new Map();
      files.forEach(({ name, dir, list }) => {
        list.forEach((rev, idx) => {
          const key = rev.date;
          if (!allRevisions.has(key)) {
            allRevisions.set(key, { date: rev.date, files: new Map() });
          }
          allRevisions.get(key).files.set(name, { name, dir, revIdx: idx, hash: rev.hash });
        });
      });

      const sortedRevisions = Array.from(allRevisions.values())
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      maxRevs = sortedRevisions.length;
      buildScroller(maxRevs);

      const revIdx = clamp(fixedRev ?? (maxRevs - 1), 0, maxRevs - 1);
      setActiveDot(revIdx);
      renderRev(revIdx);

      /* -------- helpers -------- */
      function renderRev(idx) {
        diffOutput.innerHTML = '';
        const blocks = new Map(order.map(k => [k, null]));
        const currentRev = sortedRevisions[idx];

        // for each target file, find most recent version up to current revision
        targets.forEach(({ name, dir }) => {
          const fileInRev = currentRev.files.get(name);

          if (fileInRev) {
            // file changed in this revision
            const diffPath = `${dir}/diff_cache/${name}/${fileInRev.revIdx}.diff`;
            const txtPath = `${dir}/diff_cache/${name}/${fileInRev.revIdx}.txt`;

            Promise.all([
              fetch(diffPath).then(r => r.ok ? r.text() : null),
              fetch(txtPath).then(r => r.ok ? r.text() : '')
            ]).then(([diff, txt]) => {
              const full = txt.split('\n');
              const unchanged = !diff;
              const final = unchanged ? buildUnchanged(name, full) : expandDiff(diff, full);
              inject(name, final, unchanged);
            });
          } else {
            // find most recent version of this file before current revision
            let mostRecentIdx = -1;
            for (let i = idx - 1; i >= 0; i--) {
              if (sortedRevisions[i].files.has(name)) {
                mostRecentIdx = sortedRevisions[i].files.get(name).revIdx;
                break;
              }
            }

            if (mostRecentIdx >= 0) {
              const txtPath = `${dir}/diff_cache/${name}/${mostRecentIdx}.txt`;
              fetch(txtPath).then(r => r.ok ? r.text() : '').then(txt => {
                const full = txt.split('\n');
                const final = buildUnchanged(name, full);
                inject(name, final, true);
              });
            } else {
              // no previous version, show empty
              inject(name, buildUnchanged(name, []), true);
            }
          }
        });

        function inject(fname, src, unchanged) {
          const html = Diff2Html.html(src, DIFF_OPTS);
          const wrap = document.createElement('div');
          wrap.className = 'diff-container';
          wrap.innerHTML = html;
          if (unchanged) {
            const tag = wrap.querySelector('.d2h-tag');
            if (tag) tag.remove();
          }
          blocks.set(fname, wrap);
          if ([...blocks.values()].every(Boolean)) order.forEach(k => diffOutput.appendChild(blocks.get(k)));
        }
      }

      function buildScroller(total) {
        if (revScroller.childElementCount) return;
        const dots = [];
        for (let i = 0; i < total; i++) {
          const d = document.createElement('div');
          d.className = 'rev-dot';
          d.addEventListener('click', () => {
            setActiveDot(i);
            url.searchParams.set('rev', i);
            history.replaceState(null, '', url.toString());
            renderRev(i);
          });
          dots.push(d);
          revScroller.appendChild(d);
        }
        revScroller.appendChild(Object.assign(document.createElement('div'), { className: 'rev-scroll-icon' }));
      }

      function setActiveDot(i) {
        const dots = revScroller.querySelectorAll('.rev-dot');
        dots.forEach((x, idx) => x.classList.toggle('active', idx === i));
      }
    });
  });

// toggle
historyBtn.addEventListener('click', () => {
  historyBtn.classList.toggle('active');
  if (isHistory) url.searchParams.delete('history_enabled');
  else url.searchParams.set('history_enabled', 'true');
  window.location = url.toString();
});

/* ---- utils ---- */
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

// synthetic full‑file diff when unchanged
function buildUnchanged(name, lines) {
  return [
    `--- a/${name}`,
    `+++ b/${name}`,
    `@@ -1,${lines.length} +1,${lines.length} @@`,
    ...lines.map(l => ' ' + l)
  ].join('\n');
}

// inject context lines into diff
function expandDiff(diffText, fullLines) {
  if (!diffText) return null;
  const src = diffText.split('\n');
  const out = [];
  let i = 0;
  while (i < src.length && !src[i].startsWith('@@')) out.push(src[i++]);
  let prevNew = 1;
  while (i < src.length) {
    const head = src[i];
    const m = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(head);
    if (!m) { out.push(src[i++]); continue; }
    const newStart = +m[1], newCount = +(m[2] || 1);
    for (let ln = prevNew; ln < newStart; ln++) out.push(' ' + (fullLines[ln - 1] || ''));
    out.push(head); i++;
    while (i < src.length && !src[i].startsWith('@@')) out.push(src[i++]);
    prevNew = newStart + newCount;
  }
  for (let ln = prevNew; ln <= fullLines.length; ln++) out.push(' ' + (fullLines[ln - 1] || ''));
  return out.join('\n');
}
