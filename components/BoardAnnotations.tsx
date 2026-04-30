"use client";

import type { PieceColor, Square } from "@/types/chess";

export type BoardAnnotationColor = "green" | "red" | "yellow" | "blue";

export type BoardArrow = {
  from: string;
  to: string;
  color?: BoardAnnotationColor;
};

export type BoardCircle = {
  square: string;
  color?: BoardAnnotationColor;
};

export type BoardAnnotations = {
  arrows?: BoardArrow[];
  circles?: BoardCircle[];
};

type BoardAnnotationsProps = {
  annotations?: BoardAnnotations;
  orientation: PieceColor;
};

const colorClass: Record<BoardAnnotationColor, string> = {
  green: "#fb923c",
  red: "#f87171",
  yellow: "#facc15",
  blue: "#60a5fa"
};

export function BoardAnnotationsOverlay({ annotations, orientation }: BoardAnnotationsProps) {
  const arrows = annotations?.arrows ?? [];
  const circles = annotations?.circles ?? [];

  if (arrows.length === 0 && circles.length === 0) {
    return null;
  }

  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 800 800" aria-hidden="true">
      <defs>
        {(["green", "red", "yellow", "blue"] as BoardAnnotationColor[]).map((color) => (
          <marker key={color} id={`arrowhead-${color}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L8,3 z" fill={colorClass[color]} opacity="0.8" />
          </marker>
        ))}
      </defs>

      {circles.map((circle, index) => {
        const center = getSquareCenter(circle.square, orientation);

        if (!center) {
          return null;
        }

        const color = circle.color ?? "green";

        return <circle key={`${circle.square}-${index}`} cx={center.x} cy={center.y} r="34" fill="none" stroke={colorClass[color]} strokeWidth="10" opacity="0.75" />;
      })}

      {arrows.map((arrow, index) => {
        const from = getSquareCenter(arrow.from, orientation);
        const to = getSquareCenter(arrow.to, orientation);

        if (!from || !to) {
          return null;
        }

        const color = arrow.color ?? "green";

        if (isKnightMove(arrow.from, arrow.to)) {
          const bend = getKnightBend(from, to);

          return (
            <path
              key={`${arrow.from}-${arrow.to}-${index}`}
              d={`M ${from.x} ${from.y} L ${bend.x} ${bend.y} L ${to.x} ${to.y}`}
              fill="none"
              stroke={colorClass[color]}
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.78"
              markerEnd={`url(#arrowhead-${color})`}
            />
          );
        }

        return (
          <line
            key={`${arrow.from}-${arrow.to}-${index}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={colorClass[color]}
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.78"
            markerEnd={`url(#arrowhead-${color})`}
          />
        );
      })}
    </svg>
  );
}

function getSquareCenter(squareName: string, orientation: PieceColor): { x: number; y: number } | null {
  const square = algebraicToSquare(squareName);

  if (!square) {
    return null;
  }

  const displayFile = orientation === "white" ? square.file : 7 - square.file;
  const displayRank = orientation === "white" ? square.rank : 7 - square.rank;

  return {
    x: displayFile * 100 + 50,
    y: displayRank * 100 + 50
  };
}

function algebraicToSquare(value: string): Square | null {
  if (!/^[a-h][1-8]$/.test(value)) {
    return null;
  }

  return {
    file: value.charCodeAt(0) - 97,
    rank: 8 - Number(value[1])
  };
}

function isKnightMove(from: string, to: string): boolean {
  const fromSquare = algebraicToSquare(from);
  const toSquare = algebraicToSquare(to);

  if (!fromSquare || !toSquare) {
    return false;
  }

  const fileDelta = Math.abs(fromSquare.file - toSquare.file);
  const rankDelta = Math.abs(fromSquare.rank - toSquare.rank);

  return (fileDelta === 1 && rankDelta === 2) || (fileDelta === 2 && rankDelta === 1);
}

function getKnightBend(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: to.x - Math.sign(dx) * 100,
      y: from.y
    };
  }

  return {
    x: from.x,
    y: to.y - Math.sign(dy) * 100
  };
}
