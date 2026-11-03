---
name: mercado-cero-design
description: Build and review Mercado Cero interface with a warm Mexican-market design system, accessible UX, payment state integrity, and modular subagents. Read the installed design reference kit first.
compatibility: opencode
metadata:
  project: mercado-cero
  workflow: designops
---

# Skill: Mercado Cero DesignOps

Use only when modifying Mercado Cero UI, UX, iconography, app flow or design system.

## Load references

- `design-references/mercado-cero/03_SISTEMA_DISENO/01_BRAND_GUIDE.md`
- `design-references/mercado-cero/03_SISTEMA_DISENO/03_CONTRATOS_COMPONENTES.md`
- `design-references/mercado-cero/04_PANTALLAS/MATRIZ_PANTALLAS.csv`
- relevant modules in `design-references/mercado-cero/04_PANTALLAS/`
- `design-references/mercado-cero/01_REFERENCIAS/00_MASTER_1536x1024.png`

## Gates

1. Audit existing code before editing.
2. Design around **one critical task per screen**.
3. Preserve financial state machines and authorization.
4. Maintain usability with no AI, no voice, intermittent internet.
5. Provide proof: build/test output + desktop/mobile screenshot + keyboard/focus check.
6. Flag any unsupported claim instead of inventing provider capabilities or certification.

## Do not

- Paste screenshot as a background image.
- Copy rasterized typography or fictional balances into live UI.
- Use receipt/QR appearance to mark money received.
- Rewrite app architecture or core business logic as side-effect of visual work.
