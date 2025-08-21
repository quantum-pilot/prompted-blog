---
created: 2025-08-21T17:53:12Z
last_updated: 2025-08-21T17:53:12Z
version: 1.0
author: Claude Code PM System
---

# Product Context

## Product Definition
**Prompted Blog** - An AI-assisted blogging platform where LLMs help users write content by acting as intelligent writing assistants, particularly beneficial for users who struggle with grammar, spelling, or language nuances.

## Target Users

### Primary Personas
1. **Non-Native English Speakers**
   - Need help with grammar and language nuances
   - Want to write professional blog posts in English
   - Benefit from AI assistance for clarity and flow

2. **Content Creators with Writing Challenges**
   - May have dyslexia or other writing difficulties
   - Have ideas but struggle with articulation
   - Need assistance with structure and coherence

3. **Busy Professionals**
   - Limited time for content creation
   - Need efficient writing workflow
   - Want to maintain consistent blog presence

### User Needs
- Easy authentication without password management
- Intuitive interface for content creation
- AI assistance that enhances, not replaces, their voice
- Version control to track content evolution
- Simple publishing workflow
- Personal blog subdomain

## Core Features

### Authentication & User Management
- **OAuth Login:** Google authentication with PKCE
- **Username Selection:** Unique subdomain registration
- **Profile Management:** Basic user profile settings
- **Session Management:** Secure cookie-based sessions

### Content Creation (Planned)
- **Dual-Panel Interface:**
  - Left panel: AI personality, directions, feedback
  - Right panel: Markdown editor with live preview
- **Section-Based Writing:** Work on one section at a time
- **Context Preservation:** Frozen sections provided as context
- **AI Assistance:** Grammar, spelling, style improvements

### Publishing System (Planned)
- **Draft Management:** Save and resume writing sessions
- **Publishing Flow:** One-click publish to public blog
- **Subdomain Hosting:** username.promptedblog.com
- **SEO Optimization:** Meta tags and structured data

### Revision History (Planned)
- **Version Tracking:** Complete history of edits
- **Diff Visualization:** See how content evolved
- **Privacy Controls:** Public or private history
- **Prompt Evolution:** Track AI interaction changes

## User Journey

### Onboarding Flow
1. Land on homepage → Learn about product
2. Click "Sign in with Google" → OAuth flow
3. First-time users → Choose username
4. Username validation → Subdomain creation
5. Redirect to dashboard → Ready to write

### Content Creation Flow
1. Create new post or open draft
2. Set AI personality and tone
3. Write section prompts and directions
4. Review AI-generated content
5. Edit and refine output
6. Move to next section
7. Save as draft or publish

### Publishing Flow
1. Review complete post
2. Set metadata (title, description, tags)
3. Choose visibility settings
4. Publish to subdomain
5. Share link with audience

## Use Cases

### Primary Use Cases
1. **Blog Post Creation**
   - Personal blogs
   - Professional content
   - Technical writing
   - Creative writing

2. **Content Improvement**
   - Grammar correction
   - Style enhancement
   - Clarity improvement
   - Language translation

3. **Collaborative Writing**
   - AI as writing partner
   - Iterative refinement
   - Feedback incorporation

### Secondary Use Cases
1. **Learning Tool**
   - Improve writing skills
   - Learn language nuances
   - Understand structure

2. **Content Planning**
   - Outline generation
   - Topic exploration
   - Research assistance

## Product Requirements

### Functional Requirements
- **Must Have:**
  - OAuth authentication
  - Username/subdomain registration
  - Basic text editor
  - AI integration for writing
  - Draft saving
  - Publishing capability
  - Public blog viewing

- **Should Have:**
  - Revision history
  - Markdown support
  - Live preview
  - SEO features
  - Analytics dashboard
  - Multiple AI models

- **Nice to Have:**
  - Custom domains
  - Themes/templates
  - Comment system
  - RSS feeds
  - API access
  - Export functionality

### Non-Functional Requirements
- **Performance:**
  - Page load < 2 seconds
  - AI response < 5 seconds
  - Auto-save every 30 seconds

- **Security:**
  - HTTPS only
  - Secure authentication
  - Data encryption
  - GDPR compliance

- **Usability:**
  - Mobile responsive
  - Accessible (WCAG 2.1)
  - Intuitive UI
  - Minimal learning curve

- **Reliability:**
  - 99.9% uptime
  - Data persistence
  - Error recovery
  - Graceful degradation

## Success Metrics

### User Metrics
- Monthly active users
- User retention rate
- Posts created per user
- Publishing rate
- Session duration

### Product Metrics
- Time to first post
- AI assistance usage
- Feature adoption rate
- Error rate
- Performance metrics

### Business Metrics
- User acquisition cost
- Conversion rate
- Churn rate
- User satisfaction (NPS)
- Support ticket volume

## Competitive Landscape

### Direct Competitors
- Medium with AI assistance
- Substack with writing tools
- WordPress with AI plugins
- Jasper AI for content

### Differentiation
- Focused on AI-assisted writing
- Section-based approach
- Transparent revision history
- Integrated subdomain hosting
- Prompt-driven development

## Constraints

### Technical Constraints
- Cloudflare Workers limitations
- KV storage constraints
- AI API rate limits
- Edge computing restrictions

### Business Constraints
- LLM API costs
- Infrastructure costs
- Development resources
- Market competition

### User Constraints
- AI quality expectations
- Privacy concerns
- Learning curve
- Trust in AI content