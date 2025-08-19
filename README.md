## Prompted Blog

Idea is to use LLMs as writing assistants for blogging. Window on the left side is for giving personality to LLMs, directions/content for each section and giving feedback about sections. Window on the right is a markdown editor for LLM to write into - it can also be edited by the user.

This was a benchmark idea to see current LLM capabilities. If I provide enough documentation, tools and atomic stories to an LLM and ask it to follow test-driven development, will it be able to work effectively with little human interaction?

I started off with ChatGPT (through Canvas), then switched to Claude Code along the way.

As of now, the only features it has implemented is:
- OAuth + PKCE flow using Google and Cloudflare Workers + KV
