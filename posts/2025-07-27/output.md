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
