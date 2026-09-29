type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'award'
  | 'calendar'
  | 'check'
  | 'clock'
  | 'gift'
  | 'history'
  | 'home'
  | 'leaf'
  | 'map-pin'
  | 'phone'
  | 'person'
  | 'cycle'
  | 'route'
  | 'spark'
  | 'trash'
  | 'target'
  | 'truck'
  | 'x';

interface IconProps {
  name: IconName;
  className?: string;
}

const iconPath: Record<IconName, string[]> = {
  'arrow-left': ['M19 12H5', 'M12 19l-7-7 7-7'],
  'arrow-right': ['M5 12h14', 'M12 5l7 7-7 7'],
  award: ['M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M8 14.5 7 22l5-3 5 3-1-7.5'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'],
  check: ['M20 6 9 17l-5-5'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  gift: ['M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5A2.5 2.5 0 1 1 10 4.5c0 1.4 2 2.5 2 2.5z', 'M12 7h4.5A2.5 2.5 0 1 0 14 4.5C14 5.9 12 7 12 7z'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v6h6', 'M12 7v5l3 2'],
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M9 20v-6h6v6'],
  leaf: ['M5 21c8-1 14-7 14-18-8 1-14 7-14 18z', 'M5 21c3-6 7-10 14-14'],
  'map-pin': ['M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  phone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.4 2.1L8 9.7a16 16 0 0 0 6.3 6.3l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z'],
  person: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
  cycle: ['M7 7h8a5 5 0 0 1 4.6 3', 'M17 5l2.6 5H14', 'M17 17H9a5 5 0 0 1-4.6-3', 'M7 19l-2.6-5H10'],
  route: ['M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M6 16h5a4 4 0 0 0 4-4V8'],
  spark: ['M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 15h10l1-15', 'M10 11v6', 'M14 11v6'],
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  truck: ['M10 17h4V5H2v12h3', 'M14 8h4l4 4v5h-3', 'M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z', 'M15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
};

export function Icon({ name, className = 'h-5 w-5' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {iconPath[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
