# Club Identity Report

## Implemented

- Added subtle `club-tinted-row` styling using existing club colors only.
- Applied club color cues to:
  - Squad/player rows
  - Standings rows
  - Dashboard top-table rows
  - Calendar match rows
  - Market player and offer rows
  - News rows with team references

## Visual Rules

- Tint is subtle, using a left border plus low-opacity background blend.
- No new brand colors were invented.
- Existing `FMG.getClubIdentity` and team identity data drive the styling.

## Remaining Opportunities

- Match history rows could include richer club cues when result entities are more explicit.
- Transfer history could be improved further by resolving both origin and destination clubs visually.
