import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 2,
} as const;

function makeIcon(path: string) {
  return function Icon({ className = "h-4 w-4", ...props }: IconProps) {
    return (
      <svg {...base} className={className} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    );
  };
}

export const PenIcon = makeIcon(
  "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
);
export const BusIcon = makeIcon(
  "M4 16V8a3 3 0 013-3h10a3 3 0 013 3v8m-16 0h16m-16 0a1 1 0 01-1 1H4a1 1 0 01-1-1v-1m16 0a1 1 0 011 1v1a1 1 0 01-1 1h-1m-14-2v2a1 1 0 001 1h1m10-3v2a1 1 0 01-1 1h-1M7 12h.01M17 12h.01"
);
export const MapPinIcon = makeIcon(
  "M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
);
export const SearchIcon = makeIcon(
  "M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.4 5.4 7.5 7.5 0 0016.65 16.65z"
);
export const PrinterIcon = makeIcon(
  "M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-12 0h12v3a2 2 0 01-2 2H8a2 2 0 01-2-2v-3z"
);
export const BackIcon = makeIcon("M3 12h18M13 6l-6 6 6 6");
export const ChevronDownIcon = makeIcon("M6 9l6 6 6-6");
export const DashboardIcon = makeIcon(
  "M3 4h8v8H3V4zm10 0h8v5h-8V4zM3 14h8v6H3v-6zm10 0h8v6h-8v-6z"
);
export const TrashIcon = makeIcon(
  "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
);