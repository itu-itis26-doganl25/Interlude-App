import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'search'
  | 'music'
  | 'rooms'
  | 'chart'
  | 'user'
  | 'menu'
  | 'close'
  | 'arrow'
  | 'headphones'
  | 'disc';

const shapes: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  rooms: <><rect x="3" y="4" width="18" height="14" rx="3" /><path d="M7 22v-4m10 4v-4M8 9h8M8 13h5" /></>,
  chart: <><path d="M4 20V11m6 9V5m6 15v-7m5 7H3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3-7 8-7s8 3 8 7" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m5 5 14 14M19 5 5 19" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  headphones: <><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2Zm16 0h-3v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2Z" /></>,
  disc: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="M6 6c1-1 3-2 5-2" /></>,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {shapes[name]}
    </svg>
  );
}
