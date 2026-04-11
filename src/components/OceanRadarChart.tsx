import { colors, typography } from "@/lib/theme";
import {
  Circle,
  G,
  Line,
  Polygon,
  Svg,
  Text as SvgText,
} from "react-native-svg";

export interface OceanScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

const DIMENSIONS: Array<{
  key: keyof OceanScores;
  label: string;
  shortLabel: string;
}> = [
  { key: "openness", label: "Openness", shortLabel: "O" },
  { key: "conscientiousness", label: "Conscientiousness", shortLabel: "C" },
  { key: "extraversion", label: "Extraversion", shortLabel: "E" },
  { key: "agreeableness", label: "Agreeableness", shortLabel: "A" },
  { key: "neuroticism", label: "Neuroticism", shortLabel: "N" },
];

const GRID_LEVELS = [0.25, 0.5, 0.75, 1.0];
const TOTAL = DIMENSIONS.length;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function vertex(
  score: number,
  index: number,
  cx: number,
  cy: number,
  r: number,
): { x: number; y: number } {
  // Start at the top (-90°) and distribute evenly clockwise
  const angle = toRad(-90 + (index * 360) / TOTAL);
  return {
    x: cx + r * score * Math.cos(angle),
    y: cy + r * score * Math.sin(angle),
  };
}

function labelAnchor(index: number): "middle" | "start" | "end" {
  const angle = toRad(-90 + (index * 360) / TOTAL);
  const cos = Math.cos(angle);
  if (cos > 0.15) return "start";
  if (cos < -0.15) return "end";
  return "middle";
}

function labelOffset(
  index: number,
  r: number,
  padding: number,
): { x: number; y: number } {
  const angle = toRad(-90 + (index * 360) / TOTAL);
  return {
    x: (r + padding) * Math.cos(angle),
    y: (r + padding) * Math.sin(angle),
  };
}

interface Props {
  scores: OceanScores;
  size?: number;
}

export function OceanRadarChart({ scores, size = 280 }: Props) {
  const labelPad = 26;
  const r = (size / 2) * 0.52; // radar radius — leave room for labels
  const cx = size / 2;
  const cy = size / 2;

  // Score polygon points string
  const scorePoints = DIMENSIONS.map((d, i) => {
    const { x, y } = vertex(scores[d.key], i, cx, cy, r);
    return `${x},${y}`;
  }).join(" ");

  // Axis lines (center → outer vertex)
  const axisLines = DIMENSIONS.map((_, i) => {
    const outer = vertex(1, i, cx, cy, r);
    return { x1: cx, y1: cy, x2: outer.x, y2: outer.y };
  });

  // Grid polygon points for each level
  const gridPolygons = GRID_LEVELS.map((level) =>
    DIMENSIONS.map((_, i) => {
      const { x, y } = vertex(level, i, cx, cy, r);
      return `${x},${y}`;
    }).join(" "),
  );

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid polygons */}
      {gridPolygons.map((pts, li) => (
        <Polygon
          key={`grid-${GRID_LEVELS[li]}`}
          points={pts}
          fill="none"
          stroke={colors.surfaceContainerHigh}
          strokeWidth={li === gridPolygons.length - 1 ? 1.5 : 1}
          opacity={0.9}
        />
      ))}

      {/* Axis lines */}
      {axisLines.map((l, i) => (
        <Line
          key={`axis-${DIMENSIONS[i]?.key}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={colors.surfaceContainerHigh}
          strokeWidth={1}
          opacity={0.7}
        />
      ))}

      {/* Center dot */}
      <Circle
        cx={cx}
        cy={cy}
        r={3}
        fill={colors.outlineVariant}
        opacity={0.5}
      />

      {/* Score fill */}
      <Polygon
        points={scorePoints}
        fill={colors.primary}
        fillOpacity={0.18}
        stroke={colors.primary}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      {/* Score vertex dots */}
      {DIMENSIONS.map((d, i) => {
        const { x, y } = vertex(scores[d.key], i, cx, cy, r);
        return (
          <G key={`dot-${d.key}`}>
            <Circle cx={x} cy={y} r={6} fill={colors.primary} opacity={0.2} />
            <Circle cx={x} cy={y} r={4} fill={colors.primary} />
          </G>
        );
      })}

      {/* Axis labels */}
      {DIMENSIONS.map((d, i) => {
        const off = labelOffset(i, r, labelPad);
        const anchor = labelAnchor(i);
        // Nudge vertical centre slightly for top/bottom labels
        const dy =
          Math.abs(Math.cos(toRad(-90 + (i * 360) / TOTAL))) < 0.1 ? 4 : 0;
        return (
          <SvgText
            key={`label-${d.key}`}
            x={cx + off.x}
            y={cy + off.y + dy}
            textAnchor={anchor}
            fontSize={11}
            fontFamily="PlusJakartaSans_600SemiBold"
            fill={colors.onSurface}
            opacity={0.85}
          >
            {d.label}
          </SvgText>
        );
      })}

      {/* Grid level labels (0.25 → 25 etc.) — placed on the top axis */}
      {GRID_LEVELS.map((level) => {
        const { y } = vertex(level, 0, cx, cy, r);
        return (
          <SvgText
            key={`pct-${level}`}
            x={cx + 5}
            y={y - 3}
            fontSize={8}
            fontFamily="PlusJakartaSans_400Regular"
            fill={colors.outlineVariant}
            opacity={0.7}
          >
            {Math.round(level * 100)}
          </SvgText>
        );
      })}
    </Svg>
  );
}
