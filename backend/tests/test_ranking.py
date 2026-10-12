from core.ranking import (
    enhance_query_with_keywords,
    is_singable,
    query_match_ratio,
    query_tokens,
    score_candidate,
)
from core.search import KaraokeEntry, RankingSignals, SearchCandidate


def make_candidate(
    title: str = "Some Song",
    uploader: str = "Some Channel",
    duration: float | None = 200.0,
    position: int = 0,
    popularity: float = 0.0,
    verified: bool = False,
) -> SearchCandidate:
    entry = KaraokeEntry(
        id="abc",
        title=title,
        artist="Some Artist",
        source="test",
        uploader=uploader,
        duration=duration,
    )
    signals = RankingSignals(position=position, popularity=popularity, verified=verified)
    return SearchCandidate(entry=entry, signals=signals)


def test_query_tokens_lowercases_and_splits_words():
    assert query_tokens("Don't Stop Believin") == ["don", "t", "stop", "believin"]


def test_query_match_ratio_is_one_when_every_word_is_in_the_title():
    assert query_match_ratio("don't stop believin", ["stop", "believin"]) == 1.0


def test_query_match_ratio_is_half_when_one_of_two_words_matches():
    assert query_match_ratio("don't stop believin", ["stop", "queen"]) == 0.5


def test_query_match_ratio_with_no_words_counts_as_a_full_match():
    assert query_match_ratio("anything", []) == 1.0


def test_karaoke_title_scores_higher_than_plain_title():
    tokens = query_tokens("bohemian rhapsody")
    karaoke = make_candidate(title="Bohemian Rhapsody (Karaoke Version)")
    plain = make_candidate(title="Bohemian Rhapsody")

    assert score_candidate(karaoke, tokens) > score_candidate(plain, tokens)


def test_official_video_scores_lower_than_plain_title():
    tokens = query_tokens("bohemian rhapsody")
    official = make_candidate(title="Bohemian Rhapsody (Official Video)")
    plain = make_candidate(title="Bohemian Rhapsody")

    assert score_candidate(official, tokens) < score_candidate(plain, tokens)


def test_karaoke_uploader_scores_higher_than_unknown_uploader():
    karaoke_channel = make_candidate(uploader="Sing King Karaoke")
    other_channel = make_candidate(uploader="Random Person")

    assert score_candidate(karaoke_channel, []) > score_candidate(other_channel, [])


def test_curated_source_gets_the_karaoke_uploader_bonus():
    candidate = make_candidate(uploader="Random Person")

    assert score_candidate(candidate, [], curated=True) > score_candidate(candidate, [])


def test_verified_candidate_scores_higher():
    verified = make_candidate(verified=True)
    unverified = make_candidate(verified=False)

    assert score_candidate(verified, []) > score_candidate(unverified, [])


def test_more_popular_candidate_scores_higher():
    popular = make_candidate(popularity=1_000_000)
    unknown = make_candidate(popularity=0)

    assert score_candidate(popular, []) > score_candidate(unknown, [])


def test_later_position_scores_lower():
    first = make_candidate(position=0)
    tenth = make_candidate(position=10)

    assert score_candidate(first, []) > score_candidate(tenth, [])


def test_title_matching_the_query_beats_unrelated_karaoke_title():
    tokens = query_tokens("bohemian rhapsody")
    right_song = make_candidate(title="Bohemian Rhapsody")
    wrong_song = make_candidate(title="Another Song (Karaoke)")

    assert score_candidate(right_song, tokens) > score_candidate(wrong_song, tokens)


def test_is_singable_accepts_a_normal_length_song():
    assert is_singable(make_candidate(duration=200.0), min_duration=90, max_duration=900)


def test_is_singable_rejects_too_short_and_too_long():
    too_short = make_candidate(duration=30.0)
    too_long = make_candidate(duration=3600.0)

    assert not is_singable(too_short, min_duration=90, max_duration=900)
    assert not is_singable(too_long, min_duration=90, max_duration=900)


def test_is_singable_rejects_missing_duration():
    assert not is_singable(make_candidate(duration=None), min_duration=90, max_duration=900)


def test_enhance_query_adds_the_first_keyword():
    result = enhance_query_with_keywords("bohemian rhapsody", ["karaoke", "instrumental"])

    assert result == "bohemian rhapsody karaoke"


def test_enhance_query_leaves_query_alone_if_it_already_has_a_keyword():
    result = enhance_query_with_keywords("bohemian rhapsody karaoke", ["karaoke"])

    assert result == "bohemian rhapsody karaoke"


def test_enhance_query_with_no_keywords_returns_query_unchanged():
    assert enhance_query_with_keywords("bohemian rhapsody", []) == "bohemian rhapsody"
