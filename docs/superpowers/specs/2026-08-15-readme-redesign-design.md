# Agent Skill Manager README Redesign

## Goal

Replace the current developer-oriented README with a bilingual GitHub landing page that explains what Agent Skill Manager does, why it is useful, and how to get started without overstating the product.

## Audience

- Chinese-speaking developers who use more than one AI coding agent.
- International contributors and prospective users who need an equivalent English introduction.

## Content design

The README will use a Chinese-first, English-mirror structure in one file:

1. A concise bilingual value proposition and lightweight project badges.
2. A Chinese section covering:
   - the problem ASM solves and its three principal benefits;
   - capabilities grouped as discovery and comparison, collection and installation, and distribution and configuration;
   - a four-step workflow;
   - supported agents;
   - local data and filesystem safety boundaries;
   - source development prerequisites and commands;
   - contribution and license information.
3. An English section with the same substantive information and structure, adapted for natural English rather than line-by-line translation.
4. A three-image gallery placed after the product introduction. The images will be equal-width real application screenshots: dashboard, master Skill library, and MiniMax Code agent detail. Each image will have bilingual alt text and a short caption.

## Accuracy boundaries

- Describe only implemented behavior verified in the repository.
- State that the master library defaults to `~/.asm/skills` and that ASM uses local filesystem links for distribution.
- Avoid unverified claims about release installers, download counts, cloud sync, analytics, or capabilities not present in the repository.
- Keep the existing source-development commands and MIT license reference.
- Use only genuine Agent Skill Manager UI screenshots; do not use generated interface mockups as product screenshots.
- Present the screenshots in a three-column GitHub-friendly layout, with each image linking to its full-size file.

## Verification

- Review the Markdown for clear heading hierarchy, working relative links, and correct command names.
- Confirm the supported-agent list and safety claims against the adapter and master-library implementation.
