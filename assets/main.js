const url = new URL(window.location);
const isHistory = url.searchParams.get('history_enabled') === 'true';
const diffOutput = document.getElementById('diff-output');
const historyBtn = document.getElementById('history-trigger');
const revScroller = document.getElementById('revision-scroller');

if (isHistory) historyBtn.classList.add('active');

fetch('latest.json')
  .then(res => res.json())
  .then(path => {
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

    document.getElementById('latest-post').style.display = 'none';
    const targets = [
      { path: 'instructions.txt', dir: '.' },
      { path: 'prompts.txt', dir: path },
      { path: 'output.md', dir: path }
    ];

    const order = targets.map(t => t.path);
    let maxRevs = 0;

    Promise.all(targets.map(({ path: fname, dir }) =>
      fetch(`${dir}/diff_cache/${fname}/revisions.json`)
        .then(res => res.json())
        .then(revisions => {
          maxRevs = Math.max(maxRevs, revisions.length);
          return { fname, dir, revisions };
        })
    )).then(files => {
      renderRevision(maxRevs - 1);

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

      const scrollIcon = document.createElement('div');
      scrollIcon.className = 'rev-scroll-icon';
      revScroller.appendChild(scrollIcon);

      function renderRevision(index) {
        diffOutput.innerHTML = '';
        const blockMap = new Map(order.map(k => [k, null]));

        files.forEach(({ fname, dir, revisions }) => {
          let revIndex = index;
          while (revIndex >= 0 && revIndex >= revisions.length) revIndex--;
          if (revIndex < 0) return;

          const diffPath = `${dir}/diff_cache/${fname}/${revIndex}.diff`;
          const fallback = `${dir}/diff_cache/${fname}/${revIndex}.txt`;

          fetch(diffPath)
            .then(r => r.ok ? r.text() : Promise.reject())
            .then(diff => {
              const html = Diff2Html.html(diff, {
                drawFileList: false,
                matching: 'lines',
                outputFormat: 'side-by-side'
              });
              const container = document.createElement('div');
              container.className = 'diff-container';
              container.innerHTML = html;
              blockMap.set(fname, container);
            })
            .catch(() => {
              return fetch(fallback).then(r => r.ok ? r.text() : Promise.reject())
                .then(content => {
                  const fallbackDiff = `--- a/${fname}\n+++ b/${fname}\n` + content
                    .split('\n')
                    .map((line, idx) => ` ${line}`)
                    .join('\n');
                  const html = Diff2Html.html(fallbackDiff, {
                    drawFileList: false,
                    matching: 'lines',
                    outputFormat: 'side-by-side'
                  });
                  const container = document.createElement('div');
                  container.className = 'diff-container';
                  container.innerHTML = html;
                  blockMap.set(fname, container);
                });
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

historyBtn.addEventListener('click', () => {
  const active = historyBtn.classList.contains('active');
  if (active) {
    url.searchParams.delete('history_enabled');
  } else {
    url.searchParams.set('history_enabled', 'true');
  }
  window.location = url.toString();
});
