# News Variety Report

## Implemented

- Added deterministic anti-repeat selection at the shared `addNews` insertion point.
- The last three generated headlines are checked before accepting a new title.
- Similarity considers repeated words, repeated subject openings, and repeated sentence pattern.
- If similarity is high, the title rotates through deterministic category templates.
- World media headlines now use at least four templates per topic and avoid recent headline similarity.

## Determinism

- No `Math.random` was introduced.
- Entropy comes from season, week, news type, dedupe key, topic, club, and player identity.
- There are no unbounded loops; candidate scanning is capped by template count.

## Categories Covered

- Preview
- Chronicle
- Rumor
- Fans
- Player story
- Classic
- Dressing room
- World reaction
- General weekly news
- World media topics: pressure, fans, market, identity, sponsors, prestige
