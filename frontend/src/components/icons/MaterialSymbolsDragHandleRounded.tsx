import type { SVGProps } from "react";

export function MaterialSymbolsDragHandleRounded(
  props: SVGProps<SVGSVGElement>,
) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <title>Drag to reorder</title>
      <path
        fill="currentColor"
        d="M4 15q-.425 0-.712-.288T3 14t.288-.712T4 13h16q.425 0 .713.288T21 14t-.288.713T20 15zm0-4q-.425 0-.712-.288T3 10t.288-.712T4 9h16q.425 0 .713.288T21 10t-.288.713T20 11z"
      />
    </svg>
  );
}
