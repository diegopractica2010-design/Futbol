# UX Density Report

## Scope

Audited the major Football Manager Chile screens: Dashboard, Squad, Matches, Calendar, Market, Rivals, Standings, Finances, Career, News, and Settings.

## Findings

- Dashboard mixed primary season state with history, rival AI logs, and notification archive on the same vertical path.
- Squad was the densest screen: plan, tactics, roles, psychology, academy, full roster, and selected player profile were all expanded at once.
- Matches stacked live controls, tactical HUD, tactical preview, full timeline, live orders, and substitutions without clear priority.
- Calendar exposed too many fixture weeks at once, especially when the full season filter was active.
- Market showed scouting board, economy pulse, negotiations, offers, and history as equal-weight content.
- Standings mixed the league table with cups, qualification, super cup, and statistical rankings.
- Finances combined operational cash status with infrastructure/staff upgrade panels and long club event logs.
- Career and News had strong atmosphere, but secondary ecosystem/media layers produced long scrolling.
- Settings had heavy export/import payload text always visible.

## Applied Changes

- Added shared compact rhythm and disclosure styles in `css/styles.css`.
- Kept primary information visible and moved secondary/advanced layers into `details` disclosure blocks.
- Highlighted primary football panels with `football-priority`.
- Reduced Dashboard default log length and moved archival content behind collapsible controls.
- Split Calendar into a short featured run plus full calendar disclosure.
- Moved long financial, career, market, table, news, rival, and squad deep-dive sections behind progressive disclosure.

## Remaining Dense Areas

- Squad roster can still be long for large clubs.
- Live match screen remains rich by design because tactical interaction requires visible controls.
- News can still feel heavy when many generated storylines share the same importance.
