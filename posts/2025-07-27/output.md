# Things LLMs Can Do That You Never Thought They Would

## 1. Spotting Your Silly Shell Syntax

> TL;DR: I wrote a one‑liner so cursed even `zsh` vomited. ChatGPT fixed it before Kagi could even autocomplete my search.

### The Crime Scene

I wanted to watch **Typst** rebuild my résumé every second—because nothing says “productivity” like real‑time CV tweaking. My *ingenious* `zsh` loop:

```zsh
while true; do typst compile resume.typ source/resume.pdf || true; do typst compile --input redacted=true resume.typ source/resume-redacted.pdf || true; sleep 1; done
```

`zsh`’s response (delivered with the warmth of a compiler having a bad day):

```
zsh: parse error near `do'
```

### Five Minutes of Blame

Being a *senior* developer (which apparently doesn’t include “reads shell docs”), I:

1. Googled—sorry, **Kagi**‑ed—the exact error.
2. Found nothing useful.
3. Declared `zsh` fundamentally broken.

### Enter the LLM

In desperation I threw the line at ChatGPT, which instantly pointed out the obvious: I wrote **two** `do`s. One of them needed to be a `;`.

Correct spell‑incantation:

```zsh
while true; do
  typst compile resume.typ source/resume.pdf || true
  typst compile --input redacted=true resume.typ source/resume-redacted.pdf || true
  sleep 1
done
```

*(Yes, that actually works. Try not to faint.)*

---

**Links for the terminally curious:**

* Typst → [https://typst.app/](https://typst.app/)
* Kagi → [https://kagi.com/](https://kagi.com/)

<!-- Placeholder: ChatGPT’s verbatim explanation will be dropped in here once pasted. -->
