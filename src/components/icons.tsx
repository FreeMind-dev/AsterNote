import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

function IconBase({
  size = 16,
  viewBox = '0 0 24 24',
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function TextIcon({ label, size = 16, ...props }: IconProps & { label: string }) {
  return (
    <IconBase size={size} {...props}>
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fontSize="10"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor"
        stroke="none"
      >
        {label}
      </text>
    </IconBase>
  );
}

export function FileUp(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M12 17V10" />
      <path d="M9.5 12.5 12 10l2.5 2.5" />
    </IconBase>
  );
}

export function Sparkles(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4z" />
      <path d="m5 14 .8 2L8 17l-2.2 1-.8 2-.8-2L2 17l2.2-1z" />
      <path d="m18.5 13 .9 2.2 2.1.9-2.1.9-.9 2.2-.9-2.2-2.1-.9 2.1-.9z" />
    </IconBase>
  );
}

export function Broom(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 4 20 10" />
      <path d="M12 6 18 12" />
      <path d="m4 20 9-9" />
      <path d="M11 13 7 9l-3 3 4 4" />
      <path d="M13 11 9 7" />
      <path d="M6 18 3 21" />
    </IconBase>
  );
}

export function Bold(props: IconProps) {
  return <TextIcon label="B" {...props} />;
}

export function Italic(props: IconProps) {
  return <TextIcon label="I" {...props} />;
}

export function Sigma(props: IconProps) {
  return <TextIcon label="Σ" {...props} />;
}

export function InlineFormula(props: IconProps) {
  return (
    <IconBase {...props}>
      <text
        x="9.4"
        y="17.2"
        textAnchor="middle"
        fontSize="16.4"
        fontFamily="'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace"
        fill="currentColor"
        stroke="none"
      >
        x
      </text>
      <text
        x="15.9"
        y="9.4"
        textAnchor="middle"
        fontSize="10.2"
        fontFamily="'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace"
        fill="currentColor"
        stroke="none"
      >
        2
      </text>
    </IconBase>
  );
}

export function BlockFormula(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <text
        x="10.3"
        y="16"
        textAnchor="middle"
        fontSize="11.8"
        fontFamily="'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace"
        fill="currentColor"
        stroke="none"
      >
        x
      </text>
      <text
        x="14.5"
        y="10.4"
        textAnchor="middle"
        fontSize="6.6"
        fontFamily="'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace"
        fill="currentColor"
        stroke="none"
      >
        2
      </text>
    </IconBase>
  );
}

export function Heading1(props: IconProps) {
  return <TextIcon label="H1" {...props} />;
}

export function Heading2(props: IconProps) {
  return <TextIcon label="H2" {...props} />;
}

export function Heading3(props: IconProps) {
  return <TextIcon label="H3" {...props} />;
}

export function Code(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 18-6-6 6-6" />
      <path d="m15 6 6 6-6 6" />
    </IconBase>
  );
}

export function FileOutput(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 12h7" />
      <path d="m13 9 3 3-3 3" />
    </IconBase>
  );
}

export function FolderOpen(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3z" />
      <path d="M3 10h18l-2 8a2 2 0 0 1-2 1H5a2 2 0 0 1-2-2z" />
    </IconBase>
  );
}

export function ImagePlus(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 16-4.5-4.5L8 20" />
      <path d="M17 4v4" />
      <path d="M15 6h4" />
    </IconBase>
  );
}

export function Link(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
      <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
    </IconBase>
  );
}

export function List(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" />
      <path d="M9 7h10" />
      <path d="M9 12h10" />
      <path d="M9 17h10" />
    </IconBase>
  );
}

export function ListOrdered(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 7h10" />
      <path d="M10 12h10" />
      <path d="M10 17h10" />
      <text x="4" y="8" fontSize="6" fill="currentColor" stroke="none">
        1
      </text>
      <text x="4" y="13" fontSize="6" fill="currentColor" stroke="none">
        2
      </text>
      <text x="4" y="18" fontSize="6" fill="currentColor" stroke="none">
        3
      </text>
    </IconBase>
  );
}

export function MessageSquareText(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path d="M7 10h10" />
      <path d="M7 13h6" />
    </IconBase>
  );
}

export function Minus(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function Quote(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 9H6a2 2 0 0 0-2 2v3h4V9z" />
      <path d="M18 9h-2a2 2 0 0 0-2 2v3h4V9z" />
    </IconBase>
  );
}

export function Save(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 4h12l2 2v14H5z" />
      <path d="M8 4v5h7V4" />
      <rect x="8" y="14" width="8" height="4" rx="1" />
      <path d="M16 4v5" />
    </IconBase>
  );
}

export function Settings2(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h10" />
      <path d="M18 6h2" />
      <circle cx="16" cy="6" r="2" />
      <path d="M4 12h4" />
      <path d="M12 12h8" />
      <circle cx="10" cy="12" r="2" />
      <path d="M4 18h8" />
      <path d="M16 18h4" />
      <circle cx="14" cy="18" r="2" />
    </IconBase>
  );
}

export function SplitSquareVertical(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 4v16" />
    </IconBase>
  );
}

export function SquarePen(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m14.5 8.5 1 1" />
      <path d="m10 15 5.5-5.5 1.5 1.5L11.5 16H10z" />
    </IconBase>
  );
}

export function Table2(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M3 14h18" />
      <path d="M10 5v14" />
      <path d="M16 5v14" />
    </IconBase>
  );
}

export function PanelRight(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
      <path d="M7 8h4" />
      <path d="M7 12h4" />
      <path d="M7 16h4" />
    </IconBase>
  );
}

export function Wrench(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m14.5 6.5 3-3 .8.8a3.4 3.4 0 0 1-4.7 4.9L8.9 14l-1.8-1.8 4.7-4.7a3.4 3.4 0 0 1 2.7-1z" />
      <path d="m5.2 13.8-1.5 1.5a2.3 2.3 0 1 0 3.2 3.2l1.5-1.5" />
      <path d="m6.2 17.8.8.8" />
    </IconBase>
  );
}

export function TerminalSquare(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 11 3 3-3 3" />
      <path d="M12.5 17h4.5" />
    </IconBase>
  );
}

export function Globe(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </IconBase>
  );
}

export function ChartColumn(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 19V9" />
      <path d="M12 19V5" />
      <path d="M19 19v-7" />
      <path d="M3 19h18" />
    </IconBase>
  );
}

export function InfoSquare(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 10v5" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function Smile(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
      <path d="M8 14.5c1 1.4 2.4 2 4 2s3-.6 4-2" />
    </IconBase>
  );
}

export function FileText(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </IconBase>
  );
}

export function Plus(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function ArrowUp(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 19V5" />
      <path d="m7 10 5-5 5 5" />
    </IconBase>
  );
}

export function ArrowDown(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="m7 14 5 5 5-5" />
    </IconBase>
  );
}

export function ArrowLeft(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 12H5" />
      <path d="m10 7-5 5 5 5" />
    </IconBase>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </IconBase>
  );
}

export function X(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </IconBase>
  );
}

export function RotateCcw(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 11a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
    </IconBase>
  );
}

export function RotateCw(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 11a9 9 0 1 1-3-6.7" />
      <path d="M21 4v6h-6" />
    </IconBase>
  );
}

export function ShieldCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}

export function Trash2(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12h10l1-12" />
      <path d="M9 4h6" />
    </IconBase>
  );
}

export function Merge(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 5v5" />
      <path d="M16 5v5" />
      <path d="M5 14h14" />
      <path d="m10 10 2 4 2-4" />
      <path d="M5 19h14" />
    </IconBase>
  );
}

export function SplitSquareHorizontal(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 12h16" />
      <path d="m9 9 3 3-3 3" />
      <path d="m15 15-3-3 3-3" />
    </IconBase>
  );
}

export function WrapText(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h12a3 3 0 1 1 0 6H9" />
      <path d="m9 13 3 3-3 3" />
      <path d="M4 17h7" />
    </IconBase>
  );
}

export function Rows2(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16" />
    </IconBase>
  );
}

export function Columns2(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M12 5v14" />
    </IconBase>
  );
}

export function Rows3(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="2" />
      <path d="M4 9.5h16" />
      <path d="M4 14.5h16" />
      <path d="M9 4.5v15" />
      <path d="m13.5 8.5 3 3-3 3" />
    </IconBase>
  );
}

export function Columns3(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="2" />
      <path d="M9.5 4.5v15" />
      <path d="M14.5 4.5v15" />
      <path d="m11 8.5 3 3-3 3" />
    </IconBase>
  );
}

export function BookOpenText(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21z" />
      <path d="M7.5 8H10" />
      <path d="M14 8h2.5" />
      <path d="M7.5 11H10" />
      <path d="M14 11h2.5" />
    </IconBase>
  );
}

export function Bot(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2v3" />
      <rect x="5" y="7" width="14" height="11" rx="3" />
      <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M9 16h6" />
      <path d="M3 10h2" />
      <path d="M19 10h2" />
    </IconBase>
  );
}

export function Search(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4-4" />
    </IconBase>
  );
}

export function TextQuote(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h12" />
      <path d="M4 11h10" />
      <path d="M4 15h8" />
      <path d="M18 9h-1.5a1.5 1.5 0 0 0-1.5 1.5V13h3V9z" />
      <path d="M22 9h-1.5A1.5 1.5 0 0 0 19 10.5V13h3V9z" />
    </IconBase>
  );
}
