---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## Feature Description

A clear and concise description of what you want to happen.

## User Story

As a [type of user], I want [goal] so that [benefit].

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Implementation Notes

Any insights on how this feature could be implemented.

## Code Organization

Remember our module-based organization:

- Group files by functionality, not file type
- Place in appropriate directory (auth, users, etc.)
- API endpoints should mirror frontend structure

```
// Example organization:
src/app/
  └── [feature-domain]/       # e.g., billing
      └── [feature-name]/     # e.g., invoices
          └── page.tsx        # /billing/invoices route

src/app/api/
  └── [feature-domain]/       # e.g., billing
      └── [feature-name]/     # e.g., invoices
          └── route.ts        # /api/billing/invoices endpoint
```

## Additional Context

Add any other context or screenshots about the feature request here.
