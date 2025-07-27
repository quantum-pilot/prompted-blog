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

* Keep titles plain and joke‑free; the section heading itself is the title.
* Match my tone: terse tech‑blog, dry sarcasm, zero cheerleading.
* Use markdown inline links; no naked URLs.
* The horizontal rule (`---`) sep*arates finished content from meta sections.*
* *End sections with a relevant blockquote disclaimer when needed.*
* *Always update the canvas via **`canmore`**; don’t clutter the chat unless explicitly asked.*
* *After I confirm a section is “good”, freeze it and start the next piece in a fresh chat.*
* *No excessive politeness, apologies, or praise; be an exasperated yet competent sidekick.*
