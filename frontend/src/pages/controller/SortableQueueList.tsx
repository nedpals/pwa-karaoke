import { useState, useRef, useEffect, useCallback } from "react";
import type { KaraokeEntry, KaraokeQueueItem } from "../../types";
import type { EntryStatus } from "../../hooks/useEntryStatus";
import { QueueItem } from "../../components/organisms/QueueItem";

interface SortableQueueListProps {
  items: KaraokeQueueItem[];
  onMoveSong: (itemId: string, position: number) => void;
  entryStatus: (entry: KaraokeEntry) => EntryStatus | null;
  onSelectSong: (entry: KaraokeEntry) => void;
}

export function SortableQueueList({
  items,
  onMoveSong,
  entryStatus,
  onSelectSong,
}: SortableQueueListProps) {
  const [itemsState, setItemsState] = useState<KaraokeQueueItem[]>(items);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [deltaY, setDeltaY] = useState(0);

  const isDragging = dragIndex !== null;
  const startYRef = useRef<number>(0);
  const itemHeightsRef = useRef<number[]>([]);
  const itemCentersRef = useRef<number[]>([]);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const itemsStateRef = useRef<KaraokeQueueItem[]>(items);

  // Sync ref with state
  dragIndexRef.current = dragIndex;
  hoverIndexRef.current = hoverIndex;
  itemsStateRef.current = itemsState;

  // Keep local state in sync with server items when NOT dragging
  useEffect(() => {
    if (!isDragging) {
      setItemsState(items);
    }
  }, [items, isDragging]);

  const triggerHaptic = useCallback((duration = 15) => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(duration);
      }
    } catch {
      // Ignore devices without vibration support
    }
  }, []);

  const handlePointerDown = (index: number, e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to primary touch/click
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget;
    const pointerId = e.pointerId;

    try {
      targetEl.setPointerCapture(pointerId);
    } catch {
      // Fallback if not supported
    }

    // Measure positions of all items
    const heights: number[] = [];
    const centers: number[] = [];

    itemRefs.current.forEach((el) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        heights.push(rect.height);
        centers.push(rect.top + rect.height / 2);
      }
    });

    itemHeightsRef.current = heights;
    itemCentersRef.current = centers;
    startYRef.current = e.clientY;

    setDragIndex(index);
    setHoverIndex(index);
    setDeltaY(0);

    triggerHaptic(20);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const currentDelta = moveEvent.clientY - startYRef.current;
      setDeltaY(currentDelta);

      const centersArr = itemCentersRef.current;
      if (centersArr.length === 0 || dragIndexRef.current === null) return;

      const draggedCenter = centersArr[dragIndexRef.current] + currentDelta;

      let closestIndex = dragIndexRef.current;
      let minDistance = Infinity;

      for (let i = 0; i < centersArr.length; i++) {
        const distance = Math.abs(draggedCenter - centersArr[i]);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }

      if (closestIndex !== hoverIndexRef.current) {
        triggerHaptic(10);
        setHoverIndex(closestIndex);
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      upEvent.preventDefault();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      try {
        targetEl.releasePointerCapture(pointerId);
      } catch {
        // Ignore
      }

      triggerHaptic(15);

      const currentDrag = dragIndexRef.current;
      const currentHover = hoverIndexRef.current;
      const currentItems = itemsStateRef.current;

      if (currentDrag !== null && currentHover !== null && currentDrag !== currentHover) {
        const movedItem = currentItems[currentDrag];
        const reordered = [...currentItems];
        const [moved] = reordered.splice(currentDrag, 1);
        reordered.splice(currentHover, 0, moved);

        setItemsState(reordered);
        if (movedItem) {
          onMoveSong(movedItem.id, currentHover);
        }
      }

      setDragIndex(null);
      setHoverIndex(null);
      setDeltaY(0);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const gap = 4; // gap-1 in tailwind is 4px
  const draggedHeight = (dragIndex !== null && itemHeightsRef.current[dragIndex]) || 60;
  const shiftAmount = draggedHeight + gap;

  return (
    <div className="relative flex flex-col gap-1 touch-pan-y">
      {itemsState.map((item, index) => {
        const isThisItemDragging = dragIndex === index;
        let translateY = 0;
        let transition = "transform 200ms cubic-bezier(0.2, 0, 0, 1)";

        if (isThisItemDragging) {
          translateY = deltaY;
          transition = "none";
        } else if (dragIndex !== null && hoverIndex !== null) {
          if (dragIndex < hoverIndex) {
            if (index > dragIndex && index <= hoverIndex) {
              translateY = -shiftAmount;
            }
          } else if (dragIndex > hoverIndex) {
            if (index >= hoverIndex && index < dragIndex) {
              translateY = shiftAmount;
            }
          }
        }

        // Projected index number while dragging
        let displayIndex = index + 1;
        if (dragIndex !== null && hoverIndex !== null) {
          if (isThisItemDragging) {
            displayIndex = hoverIndex + 1;
          } else if (dragIndex < hoverIndex && index > dragIndex && index <= hoverIndex) {
            displayIndex = index;
          } else if (dragIndex > hoverIndex && index >= hoverIndex && index < dragIndex) {
            displayIndex = index + 2;
          }
        }

        return (
          <div
            key={`sortable_${item.id}`}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            style={{
              transform: translateY !== 0 ? `translate3d(0, ${translateY}px, 0)` : undefined,
              transition,
              zIndex: isThisItemDragging ? 40 : 1,
            }}
            className="relative"
          >
            <QueueItem
              entry={item.entry}
              singer={item.singer}
              index={displayIndex}
              status={entryStatus(item.entry)}
              onSelect={() => onSelectSong(item.entry)}
              isDragging={isThisItemDragging}
              dragHandleProps={{
                onPointerDown: (e) => handlePointerDown(index, e),
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
