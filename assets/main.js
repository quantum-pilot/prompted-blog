// main.js – inline diff view with full‑file context
const url = new URL(window.location);
const isHistory = url.searchParams.get('history_enabled') === 'true';

const diffOutput = document.getElementById('diff-output');
const historyBtn = document.getElementById('history-trigger');
const revScroller = document.getElementById('revision-scroller');

if (isHistory) historyBtn.classList.add('active');

// single‑pane, inline, word‑level diff
const DIFF_OPTS = { drawFileList: false, matching: 'words', outputFormat: 'line-by-line' };

fetch('latest.json')
  .then(r => r.json())
  .then(basePath => {
    if (!isHistory) {
      // latest post only
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

    // load revision meta
    Promise.all(targets.map(({ name, dir }) =>
      fetch(`${dir}/diff_cache/${name}/revisions.json`)
        .then(r => r.json())
        .then(list => { maxRevs = Math.max(maxRevs, list.length); return { name, dir, list }; })
    )).then(files => {
      buildScroller(maxRevs);
      renderRev(maxRevs - 1);

      function renderRev(idx) {
        diffOutput.innerHTML = '';
        const blocks = new Map(order.map(k => [k, null]));

        files.forEach(({ name, dir, list }) => {
          let rev = idx; while (rev >= list.length) rev--; if (rev < 0) return;
          const diffPath = `${dir}/diff_cache/${name}/${rev}.diff`;
          const txtPath  = `${dir}/diff_cache/${name}/${rev}.txt`;

          Promise.all([
            fetch(diffPath).then(r => r.ok ? r.text() : null),
            fetch(txtPath).then(r => r.ok ? r.text() : '')
          ]).then(([diff, txt]) => {
            const full = txt.split('\n');
            let final;
            if (diff) final = expandDiff(diff, full);
            else final = ['--- a/'+name, '+++ b/'+name, ...full.map(l => ' '+l)].join('\n');
            inject(name, final);
          });
        });

        function inject(fname, src) {
          const html = Diff2Html.html(src, DIFF_OPTS);
          const wrap = document.createElement('div');
          wrap.className = 'diff-container';
          wrap.innerHTML = html;
          blocks.set(fname, wrap);
          if ([...blocks.values()].every(Boolean)) order.forEach(k => diffOutput.appendChild(blocks.get(k)));
        }
      }

      function buildScroller(total) {
        if (revScroller.childElementCount) return;
        const dots = [];
        for (let i = 0; i < total; i++) {
          const d = document.createElement('div');
          d.className = 'rev-dot' + (i === total - 1 ? ' active' : '');
          d.addEventListener('click', () => { dots.forEach(x => x.classList.remove('active')); d.classList.add('active'); renderRev(i); });
          dots.push(d); revScroller.appendChild(d);
        }
        revScroller.appendChild(Object.assign(document.createElement('div'), { className: 'rev-scroll-icon' }));
      }
    });
  });

// toggle history
historyBtn.addEventListener('click', () => {
  historyBtn.classList.toggle('active');
  if (isHistory) url.searchParams.delete('history_enabled');
  else url.searchParams.set('history_enabled', 'true');
  window.location = url.toString();
});

// expand diff: fills gaps with unchanged lines from full file
function expandDiff(diffText, fullLines) {
  if (!diffText) return null;
  const src = diffText.split('\n');
  const out = [];
  let i = 0;
  // copy file header lines
  while (i < src.length && !src[i].startsWith('@@')) out.push(src[i++]);
  let prevNew = 1;
  while (i < src.length) {
    const head = src[i];
    const m = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(head);
    if (!m) { out.push(src[i++]); continue; }
    const newStart = +m[1], newCount = +(m[2] || 1);
    // pre‑hunk unchanged
    for (let ln = prevNew; ln < newStart; ln++) out.push(' ' + (fullLines[ln - 1] || ''));
    out.push(head); i++;
    // hunk body
    while (i < src.length && !src[i].startsWith('@@')) out.push(src[i++]);
    prevNew = newStart + newCount;
  }
  // tail
  for (let ln = prevNew; ln <= fullLines.length; ln++) out.push(' ' + (fullLines[ln - 1] || ''));
  return out.join('\n');
}
