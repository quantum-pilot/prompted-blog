// main.js – per‑revision inline diff with full‑file context
const url = new URL(window.location);
const isHistory = url.searchParams.get('history_enabled') === 'true';
const fixedRev = url.searchParams.has('rev') ? parseInt(url.searchParams.get('rev'), 10) : null;

const diffOutput = document.getElementById('diff-output');
const historyBtn = document.getElementById('history-trigger');
const revScroller = document.getElementById('revision-scroller');

if (isHistory) historyBtn.classList.add('active');

const DIFF_OPTS = { drawFileList: false, matching: 'words', outputFormat: 'line-by-line' };

fetch('latest.json')
  .then(r => r.json())
  .then(basePath => {
    if (!isHistory) {
      // normal mode → just show latest post
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

    // load revision metadata
    Promise.all(targets.map(({ name, dir }) =>
      fetch(`${dir}/diff_cache/${name}/revisions.json`)
        .then(r => r.json())
        .then(list => { maxRevs = Math.max(maxRevs, list.length); return { name, dir, list }; })
    )).then(files => {
      buildScroller(maxRevs);

      // pick revision (defaults to latest)
      const revIdx = clamp(fixedRev ?? (maxRevs - 1), 0, maxRevs - 1);
      setActiveDot(revIdx);
      renderRev(revIdx);

      /* ---------------- helpers ---------------- */
      function renderRev(idx) {
        diffOutput.innerHTML = '';
        const blocks = new Map(order.map(k => [k, null]));

        files.forEach(({ name, dir }) => {
          const diffPath = `${dir}/diff_cache/${name}/${idx}.diff`;
          const txtPath  = `${dir}/diff_cache/${name}/${idx}.txt`;

          Promise.all([
            fetch(diffPath).then(r => r.ok ? r.text() : null),
            fetch(txtPath).then(r => r.ok ? r.text() : '')
          ]).then(([diff, txt]) => {
            const full = txt.split('\n');
            const unchanged = !diff;
            const final = unchanged ? buildUnchanged(name, full) : expandDiff(diff, full);
            inject(name, final, unchanged);
          });
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

        function setActiveDot(i) { dots.forEach((x, idx) => x.classList.toggle('active', idx === i)); }
      }
    });
  });

// history toggle
historyBtn.addEventListener('click', () => {
  historyBtn.classList.toggle('active');
  if (isHistory) url.searchParams.delete('history_enabled');
  else url.searchParams.set('history_enabled', 'true');
  window.location = url.toString();
});

/* ---------- utils ---------- */
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

function buildUnchanged(name, lines) {
  return [
    `--- a/${name}`,
    `+++ b/${name}`,
    ...lines.map(l => ' ' + l)
  ].join('\n');
}

// fills gaps with unchanged lines so whole file is visible
function expandDiff(diffText, fullLines) {
  if (!diffText) return null;
  const src = diffText.split('\n');
  const out = [];
  let i = 0;
  // headers
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
