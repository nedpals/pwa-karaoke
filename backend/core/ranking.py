"""
Karaoke ranking, shared by every source.

Sources rank for watching rather than for singing, so an official music video
or a lyric video routinely outranks the karaoke cut of the same song. The
corrections for that are not specific to any platform, and keeping them here is
what lets results from different sources be ordered against each other rather
than concatenated.
"""

import math
import re

from core.search import SearchCandidate

# Words that mark a query as already asking for a karaoke cut.
KARAOKE_QUERY_KEYWORDS = (
    "karaoke", "instrumental", "backing track", "sing along", "videoke", "minus one",
)

KARAOKE_TITLE_MARKERS = KARAOKE_QUERY_KEYWORDS + (
    "sing-along", "no vocal", "lyrics on screen", "karaoke version",
)

# Shapes that match the song but are not something to sing over.
NON_KARAOKE_TITLE_MARKERS = (
    "official video", "official music video", "official lyric", "lyric video",
    "(lyrics)", "reaction", "live performance", "behind the scenes",
    "tutorial", "how to", "review", "full album", "medley", "nonstop",
    "compilation",
)

KARAOKE_UPLOADER_MARKERS = (
    "karaoke", "videoke", "sing king", "karafun", "singalong", "sing along",
)

TITLE_MARKER_WEIGHT = 3.0
NON_KARAOKE_PENALTY = 3.0
KARAOKE_UPLOADER_WEIGHT = 2.0
VERIFIED_WEIGHT = 1.5
# Damped by a log and capped, so a well known track edges out an equally
# karaoke one without burying it.
POPULARITY_WEIGHT = 0.4
POPULARITY_CEILING = 7.0
# The source's own ordering stays the baseline.
POSITION_PENALTY = 0.15
# Outweighs the rest, or a karaoke channel's most popular upload outranks the
# song that was actually asked for.
QUERY_MATCH_WEIGHT = 6.0


def query_tokens(query: str) -> list[str]:
    return re.findall(r"\w+", query.lower(), flags=re.UNICODE)


def query_match_ratio(title: str, tokens: list[str]) -> float:
    if not tokens:
        return 1.0
    return sum(1 for token in tokens if token in title) / len(tokens)


def score_candidate(candidate: SearchCandidate, tokens: list[str], curated: bool = False) -> float:
    entry = candidate.entry
    signals = candidate.signals
    title = entry.title.lower()
    uploader = entry.uploader.lower()

    score = QUERY_MATCH_WEIGHT * query_match_ratio(title, tokens)
    score += TITLE_MARKER_WEIGHT * sum(1 for marker in KARAOKE_TITLE_MARKERS if marker in title)
    score -= NON_KARAOKE_PENALTY * sum(1 for marker in NON_KARAOKE_TITLE_MARKERS if marker in title)

    if curated or any(marker in uploader for marker in KARAOKE_UPLOADER_MARKERS):
        score += KARAOKE_UPLOADER_WEIGHT

    if signals.verified:
        score += VERIFIED_WEIGHT

    score += POPULARITY_WEIGHT * min(math.log10(signals.popularity + 1), POPULARITY_CEILING)

    return score - POSITION_PENALTY * signals.position


def is_singable(candidate: SearchCandidate, min_duration: float, max_duration: float) -> bool:
    """
    A missing duration usually means a live stream or something else that never
    ends, which would stall the player once it reached the front of a queue.
    """
    duration = candidate.entry.duration
    if duration is None:
        return False

    return min_duration <= duration <= max_duration


def enhance_query_with_keywords(query: str, keywords: list[str]) -> str:
    """
    Steer a search towards karaoke cuts without drowning out the song.

    These search engines have no boolean operators, so a list of alternatives is
    read as more words to match rather than a choice between them. Spending four
    of them on keywords leaves the song title outweighed, and results drift onto
    whatever else the keywords match. One keyword, added only when the query
    carries none, narrows the search instead.
    """
    if not keywords:
        return query

    lowered = query.lower()
    if any(keyword in lowered for keyword in keywords):
        return query

    return f"{query} {keywords[0]}"
