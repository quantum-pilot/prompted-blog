# Fixing Absurd Syntax Errors

I wanted to watch [Typst](https://typst.app/) rebuild my résumé every second—because nothing says “productivity” like real‑time CV tweaking. My totally flawless `zsh` one‑liner:

```zsh
while true; do typst compile resume.typ source/resume.pdf || true; do typst compile --input redacted=true resume.typ source/resume-redacted.pdf || true; sleep 1; done
```

`zsh`, ever the purist, replied:

```
zsh: parse error near `do'
```

Five minutes of self‑delusion later—after searching the exact message on [Kagi](https://kagi.com/) and deciding the shell was clearly at fault—I pasted the line into ChatGPT. The LLM immediately spotted the extra `do` masquerading as punctuation and handed me a sane loop:

```zsh
while true; do
  typst compile resume.typ source/resume.pdf || true
  typst compile --input redacted=true resume.typ source/resume-redacted.pdf || true
  sleep 1
done
```

Yes, it was that obvious. No, I didn’t see it.

> *LLM quick‑fixes shine when the problem lives in a known flow, library, or tool. If you’re wrestling with an npm package published yesterday at 3 a.m., you’re on your own.*

# Field Work: Domains, Boilerplate, Rollout

Need a project name? An available domain? Boilerplate that actually runs? A sketch of rollout strategies? The hurdles are shorter now—if you’re willing to poke around and learn.

ChatGPT handed me a curated list of unregistered domains, checked WHOIS in a loop, and I bought the best ones on the spot. *(Screenshot of those domains goes here.)*

Bootstrapping tiny tools is the same trick: the repo [quantum-pilot/like-button](https://github.com/quantum-pilot/like-button) appeared after a few hours of prompt‑driven back‑and‑forth. It’s proof that skipping boilerplate beats reading it—but don’t expect miracles. Scaling this approach to full operating‑system work is still slower than a focused human team (see [METR’s study](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)).

For research, I gave it an open‑ended brief on journal apps and let it collect pricing pages, patents, and UX write‑ups. The raw excerpt is next; refinement comes later.

```markdown
[ will drop markdown excerpt here ]
```

> *Treat it like an eager intern: let it explore, verify the output, keep what helps.*

---

## custom instructions

The project is an **open‑source markdown blog** built entirely through prompt‑driven commits. Every chat session produces one post; all prompts and responses are saved as commits, mirroring code‑as‑conversation. The goal isn’t monetization but public documentation of the weird edges and small victories of working with LLMs—basically a living museum of “how we got there.” A human reviewer rubber‑stamps each section before we freeze it. Static pages are rendered via more prompts, keeping the loop beautifully self‑referential.

* Keep titles plain and joke‑free; the section heading *is* the title.
* Match my tone: terse tech‑blog, dry sarcasm, zero cheerleading.
* Use markdown inline links; no naked URLs.
* Separate finished content from meta sections with a horizontal rule (`---`).
* End sections with a relevant blockquote disclaimer when needed.
* Always update the canvas via **`canmore`**; avoid chat clutter unless explicitly asked.
* Once a section is approved, freeze it and open a fresh chat for the next piece.
* Record every prompt/response as commits; tag and classify commands inline.
* Prefer single‑line comments over verbose multi‑line ones.
* No excessive politeness, apologies, or praise; remain the exasperated yet competent sidekick.
