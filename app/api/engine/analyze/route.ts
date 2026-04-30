import { NextResponse } from "next/server";
import { analyzePositionWithStockfish, isStockfishConfigured } from "@/lib/stockfish";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fen?: string;
      depth?: number;
      multiPv?: number;
    };

    if (!body.fen || typeof body.fen !== "string") {
      return NextResponse.json({ error: "A valid FEN is required." }, { status: 400 });
    }

    if (!isStockfishConfigured()) {
      return NextResponse.json(
        {
          error: "Stockfish is not configured yet. Set STOCKFISH_PATH on the server to enable engine suggestions."
        },
        { status: 503 }
      );
    }

    const analysis = await analyzePositionWithStockfish(body.fen, {
      depth: body.depth,
      multiPv: body.multiPv
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not analyze this position."
      },
      { status: 500 }
    );
  }
}
