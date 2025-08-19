## Prompted Blog

Idea: LLMs as writing assistants for blogging i.e., enable an LLM to write _for_ the user when they suffer in grammar, spelling or language nuances. User flow looks like this:

- Signup/signin with OAuth.
- If user didn't exist - pick a username for which (sub-)domain is registered at [promptedblog.com](https://promptedblog.com).
- Create new post or open a draft.
- HTML container with a fancy textarea on the left side is for giving a personality to LLM, directions/content for each section and feedback about sections.
- Another HTML container with a fancy markdown editor on the right for LLM to write into a section (can also be edited by the user).
- Only one section can be actively worked on - other sections are frozen and provided to LLM as context.
- Save as draft or publish for public visibility.
- History view showing a diff of how the prompts and output evolved with each revision (can be public or private).

This was a benchmark idea to see current LLM capabilities when it comes to mid-level projects (i.e., more features than simple apps like PDF converters, drawing tools, image enhancer, etc.). If I provide enough documentation, tools and atomic stories to an LLM and ask it to follow test-driven development, will it be able to work effectively with little human interaction?

I started off with ChatGPT (through Canvas), then switched to Claude Code along the way. I hit my limits on Max 5x and upgraded to Max 20x... for no practical use.

**Result:** Prolly wasted some of my brain cells in the past month.

As of now, the only features it has implemented:

- OAuth + PKCE flow using Google and Cloudflare Workers + KV

### Problems with current Agentic Coding

I thought TDD would be a great tool for agents to iterate on features - write a failing test, implement feature, make it succeed - simple right?

I've defined agents with clear criteria in `.claude/agents` to make sure they follow a limited set of most important practices aimed at efficiency (max. 100 LoC, TDD, etc.). [`CLAUDE.md`](./CLAUDE.md) states how the default agent should plan and route it to other agents. Even with stories broken down into very small parts, my experience (as a somewhat senior engineer) is very similar to what's [outlined here](https://colton.dev/blog/curing-your-ai-10x-engineer-imposter-syndrome/).

My problems in no particular order:

- **Sycophancy Pro Max** - If there's one thing I hate compared to everything else I endured, it's, ["You're absolutely right"](https://github.com/anthropics/claude-code/issues/3382).
- **CLAUDE.md is not followed** whenever I provide a story - I have to interrupt and remind it again. My CLAUDE.md is specifically for planning and routing to other agents (because sub-agents have their own context window, which is great) - sometimes other agents look at this CLAUDE.md, start planning and do all the tasks by themselves without sticking to a plan. Problem with this is that they miss out on steps, do something they're not supposed to do, hallucinate existing features, ignore tests, etc. as context increases. I've tried mentioning about what [ROOT agent](https://github.com/quantum-pilot/prompted-blog/blob/master/CLAUDE.md#root-agent-instructions) and specialist agents must do, but it hasn't really solved the problems above, but at least other agents don't pick up tasks unrelated to them. The core problem remains - me reminding about the existence of CLAUDE.md file.
- **Documentation becomes bottleneck** eventually. My [previous attempt](https://github.com/quantum-pilot/prompted-blog/tree/6683415013b1e48dd204fa87303687267cb1d66d/docs) was based on [this suggestion](https://gist.github.com/Vikram-T/2ea46b0590941a3dbe89e4d1407e09ec). Maybe it worked for them for their project scope, but for me, it quickly went to a point where it became very inefficient, which is why I restarted with [lightweight agents](./.claude/agents/) focusing on specific areas so that they at least remember the rules which are important to me - which is also a hit or miss.
- **It ignores important instructions** (even when I mention `IMPORTANT`). Two prompts later, it starts ignoring rules and goes ahead vibe-coding. It ignores tests, and sometimes when I ask it to fix them, it attempts for a while and stops, saying, "92% tests covered" and when I ask, "Why not all?", it complains about test expectations and then I have to ask it to fix the test expectations. Too much time spent on things that is obvious to a seasoned coder.
- **Resorts to reinventing the wheel** - ignores utilities even when nearby code uses them, like: `console.log` when there's an audited logger, kvstore from scratch when there's an audited kvstore, writes a new handler from scratch and ignores router entirely when there's a middleware signature and a router, or uses request directly when every other method uses a wrapped request. It's easier if it uses the existing helpers, but no, it's easier if it goes YOLO. I solved this by downloading the library, using another instance to create a markdown of usage by going through that library and using that for reference, but even that is not respected as stories go on. It's like that junior coder who likes writing everything by himself - [great for learning](https://endler.dev/2025/reinvent-the-wheel/), useless for building and definitely useless for LLM (see next point).
- **No learning is carried forward** - I [used to maintain](https://github.com/quantum-pilot/prompted-blog/blob/5a4014d25e82ebfe3b71bde161c92e29f70c51f3/docs/technicals/bug_fixes.md) a bugs list when it kept hitting same issues, but that became useless as well cuz it hits those issues regardless and I have to point it out. Even existing rules aren't respected, so I can't really expect much here.
- **Code review burnout** - I review anywhere from 1k-3k lines of code every day (keeping my day job aside) just for this project and my chats for this project have more prompts than I ever prompted any LLMs throughout last year ([claude-monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) reports that I've spent almost $830 on tokens alone - not useful in any way cuz I've only managed to get to OAuth functionality at the time of this writing and when I think of all that wasted GPU compute, it makes me sad).
- **Illusional feedback loop** - LLMs give this amazing feedback loop (dopamine?) - that coding is always happening. I'm honestly tired of it because I cannot trust the code emitted by it and the more I work with it, the more I feel like I can't trust it anymore and I have to do it by myself. It gets to you eventually when you have to keep shouting at an intern who only charges $200/month but has constant amnesia. Blatantly stupid security issues, ignored test cases (especially when the story is dead simple), ignored practices and instructions (see earlier points), invalid assumptions, flawed understanding of requirements, etc. And no, I've been dead clear. I'm sure I've only gotten better in writing stories as clear as possible, provided that if I don't write it properly in the first attempt, I have to battle with it backfiring on me.

After wasting my time on this, now I know it's bullshit when people make questionable claims with Claude Code - or even [Claude teams themselves](https://www-cdn.anthropic.com/58284b19e702b49db9302d5b6f135ad8871e7658.pdf) for that matter. I'm happy with a $20/mo plan using it to write one-off scripts, which is all it's good for in the current state of LLMs. I no longer feel FOMO in the present AI hype train.

My new idea is to never review the code - let it continue building the project or do whatever it wants to if I keep feeding stories. I don't care how it exhausts my Max 20x plan. We'll see how far it goes before my plan expires.
