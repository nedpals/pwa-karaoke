import { useState, useMemo } from "react";
import { useDebounce } from "use-debounce";
import type { KaraokeEntry } from "../../types";
import { useSearch } from "../../hooks/useApi";
import { Text } from "../../components/atoms/Text";
import { Button } from "../../components/atoms/Button";
import { LoadingIndicator } from "../../components/atoms/LoadingIndicator";
import { SearchInput } from "../../components/molecules/SearchInput";
import { SongRow } from "../../components/organisms/SongRow";
import { SongActionsDialog } from "../../components/organisms/SongActionsDialog";
import { useEntryStatus, type EntryStatus } from "../../hooks/useEntryStatus";
import { cn } from "../../lib/utils";
import { SectionLabel } from "./SectionLabel";
import { Notice } from "./Notice";
import { useSongDialog } from "./useSongDialog";

const SEARCH_DEBOUNCE_MS = 450;
// One or two letters match most of the catalogue, so searching them costs a
// round trip to say nothing.
const MIN_QUERY_LENGTH = 3;

function SearchResults({
  entries,
  isSearching,
  isLoadingMore,
  hasMore,
  onLoadMore,
  searchError,
  searchQuery,
  entryStatus,
  onSelect,
}: {
  entries: KaraokeEntry[];
  isSearching: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  searchError: string | null;
  searchQuery: string;
  entryStatus: (entry: KaraokeEntry) => EntryStatus | null;
  onSelect: (entry: KaraokeEntry) => void;
}) {
  if (searchError) {
    return (
      <div className="py-12 text-center space-y-2">
        <Text font="display" size="2xl" weight="bold" tone="danger">
          Search Failed
        </Text>
        <Text size="sm" tone="dim">
          {searchError}
        </Text>
      </div>
    );
  }

  if (entries.length > 0) {
    return (
      <div>
        <SectionLabel count={entries.length} busy={isSearching}>
          Results
        </SectionLabel>
        <div className={cn("flex flex-col gap-1", isSearching && "opacity-50")}>
          {entries.map((entry, i) => (
            <SongRow
              key={`search_result_${entry.id}_${i}`}
              entry={entry}
              showSource
              status={entryStatus(entry)}
              onClick={() => onSelect(entry)}
            />
          ))}
        </div>

        {hasMore && (
          <Button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore || isSearching}
            className="w-full mt-2"
          >
            {isLoadingMore ? "Loading" : "More Songs"}
          </Button>
        )}
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <LoadingIndicator size="lg" />
        <Text font="display" size="xl" tone="dim">
          Searching
        </Text>
      </div>
    );
  }

  if (searchQuery.trim()) {
    return (
      <div className="py-12 text-center space-y-2">
        <Text font="display" size="2xl" weight="bold" tone="dim">
          No Results
        </Text>
        <Text size="sm" tone="dim">
          Nothing matched "{searchQuery}".
        </Text>
      </div>
    );
  }

  return (
    <div className="py-12 text-center">
      <Text size="sm" tone="dim">
        Reserved songs play on the display in order.
      </Text>
    </div>
  );
}
export function SongSelectTab() {
  const entryStatus = useEntryStatus();
  const dialog = useSongDialog();
  const [textInput, setTextInput] = useState("");
  const typed = textInput.trim();
  const [settled, debounced] = useDebounce(typed, SEARCH_DEBOUNCE_MS);
  const query = settled.length >= MIN_QUERY_LENGTH ? settled : "";

  const { data: pages, error, isLoading, isValidating, size, setSize } = useSearch(query);
  const entries = useMemo(() => pages?.flatMap((page) => page.entries) ?? [], [pages]);
  const total = pages?.[pages.length - 1]?.total ?? 0;
  const hasMore = entries.length > 0 && entries.length < total;
  // The page just asked for has not arrived while its slot is still empty.
  const isLoadingMore = pages !== undefined && size > 0 && pages[size - 1] === undefined;
  const isFetching = isLoading || (isValidating && !isLoadingMore);
  // Covers the wait for the singer to stop typing as well as the request, so
  // the results do not read as settled while another one is on its way.
  const isSearching = isFetching || typed !== settled;

  return (
    <div className="px-2 pb-8">
      <div className="sticky top-0 z-10 bg-ka-void/95 py-2 -mx-2 px-2 border-b-2 border-ka-line">
        <SearchInput
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onSearch={() => debounced.flush()}
          isSearching={isFetching}
          placeholder="Song title or artist"
        />
      </div>

      <div className="pt-3">
        {dialog.error && <Notice>{dialog.error}</Notice>}

        <SearchResults
          entries={entries}
          isSearching={isSearching}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          onLoadMore={() => setSize(size + 1)}
          searchError={error ? "Search failed. Check the connection." : null}
          searchQuery={query}
          entryStatus={entryStatus}
          onSelect={dialog.open}
        />
      </div>

      <SongActionsDialog
        entry={dialog.selected}
        status={dialog.status}
        busy={dialog.busyLabel}
        onClose={dialog.close}
        actions={dialog.actions}
      />
    </div>
  );
}
