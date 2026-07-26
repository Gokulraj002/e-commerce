# Blueprint — Elite NonVeg

The blueprint is the **design source of truth** for this platform. It was
written before the code was scaffolded and every module in the repo maps back
to a chapter here. Read the chapter that matches the module you're touching
before you change behaviour.

Everything below is design writing — no code. Deployment is native VPS; there
is no Docker anywhere in the blueprint.

## Chapters

| Chapter                                                          | Summary                                                                                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [00-PROJECT-BRIEF.md](00-PROJECT-BRIEF.md)                       | The shared context every chapter agrees on: company, business, stack, canonical module list, RBAC roles, writing style.        |
| [01-business-analysis.md](01-business-analysis.md)               | **Chapter 1** — Business analysis of the reference site, plus Chapters 7 and 8 on Order Management and Delivery Management.    |
| [02-technology-architecture.md](02-technology-architecture.md)   | **Chapters 2 & 3** — Technology architecture, data-flow, and non-functional requirements for the whole platform.                |
| [03-structure-modules.md](03-structure-modules.md)               | **Chapters 4 & 5** — Folder structure (backend depth) and every business module with dependencies + roadmap.                    |
| [04-roles-inventory-reports.md](04-roles-inventory-reports.md)   | **Chapters 6, 9, 15** — Complete RBAC matrix, Inventory & warehouse strategy, and Reports & analytics.                          |
| [05-database-api.md](05-database-api.md)                         | **Chapters 10 & 11** — Database planning (Prisma-model shape, indexes, relationships) and the REST API catalogue.               |
| [06-ui-dev-roadmap.md](06-ui-dev-roadmap.md)                     | **Chapters 12–14** — Customer UI/UX, Admin panel UX, Development plan and future roadmap.                                       |
| [07-deployment-vps.md](07-deployment-vps.md)                     | **Chapter 16** — Deployment runbook for native VPS: provisioning, TLS, PM2, NGINX, backups, rollback, scaling triggers.         |
| [08-code-standards.md](08-code-standards.md)                     | **Chapter 17** — Non-negotiable code-quality rulebook: no dead code, DRY, folder/component structure, PR review checklist.       |

## Assembly note

[`MASTER-BLUEPRINT.md`](MASTER-BLUEPRINT.md) is the **single-file concatenation**
of the eight chapter files above, in order. It's convenient for full-text
search or handing the entire spec to a client. If you need to update a
section, edit the individual chapter file — do not edit `MASTER-BLUEPRINT.md`
directly.

## How to use the blueprint

- Adding a **new module or capability** → start with `03-structure-modules.md`,
  then `05-database-api.md` for the data + endpoint contract.
- Adding a **new role or permission** → `04-roles-inventory-reports.md` (RBAC matrix).
- Changing **customer or admin UX** → `06-ui-dev-roadmap.md`.
- Deploying, scaling, or debugging in production → `07-deployment-vps.md`.
- Any style or structure question that has a "how should this look?" answer →
  `08-code-standards.md`. That chapter wins over the others when they conflict.
