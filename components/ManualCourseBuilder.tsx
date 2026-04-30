"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Chessboard, getSelectableMoves } from "@/components/Chessboard";
import type { BoardAnnotations } from "@/components/BoardAnnotations";
import { buildManualCourse, type RecordedLineMove } from "@/lib/manualCourses";
import type { OpeningCourse } from "@/lib/courses";
import { playTrainerSound } from "@/lib/trainerSounds";
import { boardToFen, cloneBoard, createEmptyBoard, emptyCastlingRights, getGameStatus, getNextEnPassantTarget, getUpdatedCastlingRights, isKingInCheck, makeMove, moveToUci, parseFen, sameSquare as sameBoardSquare, startingFen } from "@/lib/chess";
import type { Board, CastlingRights, PieceColor, PieceType, Square } from "@/types/chess";

type ManualCourseBuilderProps = {
  onSaveCourse: (course: OpeningCourse) => void;
  soundEnabled: boolean;
};

type BuilderBoardState = {
  board: Board;
  turn: PieceColor;
  castlingRights: CastlingRights;
  enPassantTarget: Square | null;
};

type DraftLine = {
  id: string;
  name: string;
  moves: RecordedLineMove[];
  startingFen: string;
};

type CourseType = "opening" | "endgame";
type BuilderPhase = "setup" | "record";
type SetupSelection = `${"white" | "black"}-${PieceType}` | "erase";
type SavedBuilderDraft = {
  courseName: string;
  description: string;
  creatorName: string;
  lineName: string;
  courseType: CourseType;
  builderPhase: BuilderPhase;
  sideToTrain: PieceColor;
  shareWithCommunity: boolean;
  draftLines: DraftLine[];
  recordedMoves: RecordedLineMove[];
  boardState: BuilderBoardState;
  lineStartFen: string;
  setupSelection: SetupSelection;
};

type EngineSuggestion = {
  multipv: number;
  uci: string;
  san: string;
  evaluation: {
    type: "cp" | "mate";
    value: number;
    label: string;
  };
  pv: string[];
};

const manualBuilderDraftStorageKey = "blounderproof:manual-builder-draft:v1";

export function ManualCourseBuilder({ onSaveCourse, soundEnabled }: ManualCourseBuilderProps) {
  const [courseName, setCourseName] = useState("My New Course");
  const [description, setDescription] = useState("A practical course I built by hand.");
  const [creatorName, setCreatorName] = useState("Blounderproof user");
  const [lineName, setLineName] = useState("Main Line");
  const [courseType, setCourseType] = useState<CourseType>("opening");
  const [builderPhase, setBuilderPhase] = useState<BuilderPhase>("record");
  const [sideToTrain, setSideToTrain] = useState<PieceColor>("white");
  const [shareWithCommunity, setShareWithCommunity] = useState(false);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [recordedMoves, setRecordedMoves] = useState<RecordedLineMove[]>([]);
  const [boardState, setBoardState] = useState<BuilderBoardState>(() => createBuilderBoardState());
  const [lineStartFen, setLineStartFen] = useState(startingFen);
  const [setupSelection, setSetupSelection] = useState<SetupSelection>("white-king");
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [error, setError] = useState("");
  const [engineSuggestions, setEngineSuggestions] = useState<EngineSuggestion[]>([]);
  const [isAnalyzingPosition, setIsAnalyzingPosition] = useState(false);
  const [engineMessage, setEngineMessage] = useState("");
  const [hoveredEngineSuggestionUci, setHoveredEngineSuggestionUci] = useState<string | null>(null);
  const [lastPlayedMove, setLastPlayedMove] = useState<{ from: Square; to: Square } | null>(null);

  const gameStatus = useMemo(
    () => getGameStatus(boardState.board, boardState.turn, boardState.castlingRights, boardState.enPassantTarget),
    [boardState]
  );
  const setupValidation = useMemo(
    () => (courseType === "endgame" ? validateEndgameSetup(boardState) : { errors: [] as string[], warnings: [] as string[] }),
    [boardState, courseType]
  );
  const whiteMoveCount = Math.ceil(recordedMoves.length / 2);
  const blackMoveCount = Math.floor(recordedMoves.length / 2);
  const currentFen = useMemo(
    () => boardToFen(boardState.board, boardState.turn, boardState.castlingRights, boardState.enPassantTarget),
    [boardState]
  );
  const hoveredEngineSuggestion = useMemo(
    () => engineSuggestions.find((suggestion) => suggestion.uci === hoveredEngineSuggestionUci) ?? null,
    [engineSuggestions, hoveredEngineSuggestionUci]
  );
  const engineAnnotations = useMemo<BoardAnnotations | undefined>(() => {
    if (!hoveredEngineSuggestion) {
      return undefined;
    }

    const parsed = parseUci(hoveredEngineSuggestion.uci);

    return {
      arrows: [
        {
          from: squareToAlgebraic(parsed.from),
          to: squareToAlgebraic(parsed.to),
          color: "yellow"
        }
      ]
    };
  }, [hoveredEngineSuggestion]);

  useEffect(() => {
    const savedDraft = loadBuilderDraft();

    if (!savedDraft) {
      return;
    }

    setCourseName(savedDraft.courseName);
    setDescription(savedDraft.description);
    setCreatorName(savedDraft.creatorName);
    setLineName(savedDraft.lineName);
    setCourseType(savedDraft.courseType);
    setBuilderPhase(savedDraft.builderPhase);
    setSideToTrain(savedDraft.sideToTrain);
    setShareWithCommunity(savedDraft.shareWithCommunity);
    setDraftLines(savedDraft.draftLines);
    setRecordedMoves(savedDraft.recordedMoves);
    setBoardState(savedDraft.boardState);
    setLineStartFen(savedDraft.lineStartFen);
    setSetupSelection(savedDraft.setupSelection);
  }, []);

  useEffect(() => {
    saveBuilderDraft({
      courseName,
      description,
      creatorName,
      lineName,
      courseType,
      builderPhase,
      sideToTrain,
      shareWithCommunity,
      draftLines,
      recordedMoves,
      boardState,
      lineStartFen,
      setupSelection
    });
  }, [boardState, builderPhase, courseName, courseType, creatorName, description, draftLines, lineName, lineStartFen, recordedMoves, setupSelection, shareWithCommunity, sideToTrain]);

  useEffect(() => {
    if (courseType === "endgame" && builderPhase === "setup" && setupValidation.errors.length) {
      setEngineSuggestions([]);
      setIsAnalyzingPosition(false);
      setEngineMessage("Fix the setup issues first, then engine suggestions can load.");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsAnalyzingPosition(true);
      setEngineMessage("");

      try {
        const response = await fetch("/api/engine/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fen: currentFen,
            depth: 14,
            multiPv: 3
          }),
          signal: controller.signal
        });

        const payload = (await response.json()) as {
          analysis?: { suggestions?: EngineSuggestion[] };
          error?: string;
        };

        if (!response.ok) {
          setEngineSuggestions([]);
          setEngineMessage(payload.error || "Engine suggestions are unavailable right now.");
          return;
        }

        setEngineSuggestions(payload.analysis?.suggestions ?? []);
        setEngineMessage(payload.analysis?.suggestions?.length ? "" : "No engine suggestions were returned for this position.");
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setEngineSuggestions([]);
        setEngineMessage(fetchError instanceof Error ? fetchError.message : "Engine suggestions are unavailable right now.");
      } finally {
        if (!controller.signal.aborted) {
          setIsAnalyzingPosition(false);
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [builderPhase, courseType, currentFen, setupValidation.errors.length]);

  function handleSquareClick(square: Square) {
    if (courseType === "endgame" && builderPhase === "setup") {
      const nextBoard = cloneBoard(boardState.board);

      if (setupSelection === "erase") {
        nextBoard[square.rank][square.file] = null;
      } else {
        const [color, type] = setupSelection.split("-") as [PieceColor, PieceType];
        nextBoard[square.rank][square.file] = { color, type };
      }

      setBoardState((current) => ({
        ...current,
        board: nextBoard,
        castlingRights: emptyCastlingRights(),
        enPassantTarget: null
      }));
      setLastPlayedMove(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setError("");
      return;
    }

    if (selectedSquare && legalMoves.some((move) => sameSquare(move, square))) {
      const result = makeMove(boardState.board, selectedSquare, square, {
        castlingRights: boardState.castlingRights,
        enPassantTarget: boardState.enPassantTarget
      });

      if (!result) {
        return;
      }

      const nextTurn = boardState.turn === "white" ? "black" : "white";
      setBoardState({
        board: result.board,
        turn: nextTurn,
        castlingRights: getUpdatedCastlingRights(boardState.board, selectedSquare, square, boardState.castlingRights),
        enPassantTarget: getNextEnPassantTarget(boardState.board, selectedSquare, square)
      });
      setRecordedMoves((current) => [...current, { uci: moveToUci(selectedSquare, square), san: result.move.notation }]);
      playTrainerSound(result.move.captured ? "capture" : "move", soundEnabled);
      setLastPlayedMove({ from: selectedSquare, to: square });
      setSelectedSquare(null);
      setLegalMoves([]);
      setError("");
      return;
    }

    const moves = getSelectableMoves(boardState.board, square, boardState.turn, boardState.castlingRights, boardState.enPassantTarget);
    setSelectedSquare(moves.length ? square : null);
    setLegalMoves(moves);
  }

  function handleUndoMove() {
    if (!recordedMoves.length) {
      return;
    }

    rebuildFromMoves(recordedMoves.slice(0, -1));
  }

  function handleResetLine() {
    rebuildFromMoves([]);
  }

  function handleCompleteLine() {
    if (!recordedMoves.length) {
      setError("Record at least one move before completing the line.");
      return;
    }

    if (!recordedMoves.some((_, index) => (index % 2 === 0 ? "white" : "black") === sideToTrain)) {
      setError(`Record at least one ${sideToTrain} move before completing the line.`);
      return;
    }

    setDraftLines((current) => {
      if (editingLineId) {
        return current.map((line) =>
          line.id === editingLineId
            ? {
                ...line,
                name: lineName.trim() || line.name,
                moves: recordedMoves,
                startingFen: lineStartFen
              }
            : line
        );
      }

      return [
        ...current,
        {
          id: `draft-line-${Date.now()}`,
          name: lineName.trim() || `Line ${current.length + 1}`,
          moves: recordedMoves,
          startingFen: lineStartFen
        }
      ];
    });
    setLineName(editingLineId ? lineName : `Line ${draftLines.length + 2}`);
    setEditingLineId(null);
    resetBuilderForCurrentMode();
    setError("");
  }

  function handleSaveCourse() {
    if (!draftLines.length) {
      setError("Complete at least one line before saving the course.");
      return;
    }

    const course = buildManualCourse({
      courseName,
      description,
      creatorName,
      sideToTrain,
      courseType,
      shareWithCommunity,
      lines: draftLines.map((line) => ({
        name: line.name,
        moves: line.moves,
        startingFen: line.startingFen
      }))
    });

    onSaveCourse(course);
    setDraftLines([]);
    setEditingLineId(null);
    resetBuilderForCurrentMode();
    setLineName("Main Line");
    setError("");
    clearBuilderDraft();
  }

  function handleRenameDraftLine(lineId: string, nextName: string) {
    setDraftLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, name: nextName } : line))
    );
  }

  function handleRemoveDraftLine(lineId: string) {
    setDraftLines((current) => current.filter((line) => line.id !== lineId));

    if (editingLineId === lineId) {
      setEditingLineId(null);
      setLineName(`Line ${Math.max(1, draftLines.length)}`);
      resetBuilderForCurrentMode();
      setError("");
    }
  }

  function handleMoveDraftLine(lineId: string, direction: -1 | 1) {
    setDraftLines((current) => {
      const index = current.findIndex((line) => line.id === lineId);

      if (index === -1) {
        return current;
      }

      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [line] = next.splice(index, 1);
      next.splice(nextIndex, 0, line);
      return next;
    });
  }

  function handleEditDraftLine(lineId: string) {
    const line = draftLines.find((draftLine) => draftLine.id === lineId);

    if (!line) {
      return;
    }

    setEditingLineId(line.id);
    setLineName(line.name);
    setLineStartFen(line.startingFen);
    setBuilderPhase("record");
    rebuildFromMovesFromFen(line.moves, line.startingFen);
    setError("");
  }

  function handleCourseTypeChange(nextType: CourseType) {
    setCourseType(nextType);
    setDraftLines([]);
    setEditingLineId(null);
    setRecordedMoves([]);
    setSelectedSquare(null);
    setLegalMoves([]);
    setError("");

    if (nextType === "endgame") {
      const endgameBoard = createEmptyBoard();
      endgameBoard[7][4] = { color: "black", type: "king" };
      endgameBoard[0][4] = { color: "white", type: "king" };
      const nextState = {
        board: endgameBoard,
        turn: sideToTrain,
        castlingRights: emptyCastlingRights(),
        enPassantTarget: null
      };
      setBuilderPhase("setup");
    setBoardState(nextState);
    setLineStartFen(boardToFen(nextState.board, nextState.turn, nextState.castlingRights, nextState.enPassantTarget));
    setLastPlayedMove(null);
    return;
  }

    setBuilderPhase("record");
    setBoardState(createBuilderBoardState());
    setLineStartFen(startingFen);
  }

  function handleSetupTurnChange(turn: PieceColor) {
    setBoardState((current) => ({
      ...current,
      turn
    }));
  }

  function handleStartRecordingFromSetup() {
    if (setupValidation.errors.length) {
      setError(setupValidation.errors[0]);
      return;
    }

    const nextFen = boardToFen(boardState.board, boardState.turn, emptyCastlingRights(), null);
    setLineStartFen(nextFen);
    setRecordedMoves([]);
    setSelectedSquare(null);
    setLegalMoves([]);
    setBuilderPhase("record");
    setError("");
  }

  function resetBuilderForCurrentMode() {
    if (courseType === "endgame") {
      const parsed = parseFen(lineStartFen);
      setBoardState({
        board: parsed.board,
        turn: parsed.turn,
        castlingRights: parsed.castlingRights,
        enPassantTarget: parsed.enPassantTarget
      });
      setRecordedMoves([]);
      setLastPlayedMove(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    rebuildFromMoves([]);
  }

  function handleClearSetupBoard() {
    const cleared = createEmptyBoard();
    setBoardState({
      board: cleared,
      turn: sideToTrain,
      castlingRights: emptyCastlingRights(),
      enPassantTarget: null
    });
    setLastPlayedMove(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function handleResetEndgameShell() {
    const endgameBoard = createEmptyBoard();
    endgameBoard[7][4] = { color: "black", type: "king" };
    endgameBoard[0][4] = { color: "white", type: "king" };
    setBoardState({
      board: endgameBoard,
      turn: sideToTrain,
      castlingRights: emptyCastlingRights(),
      enPassantTarget: null
    });
    setLastPlayedMove(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function rebuildFromMoves(nextMoves: RecordedLineMove[]) {
    rebuildFromMovesFromFen(nextMoves, lineStartFen);
  }

  function rebuildFromMovesFromFen(nextMoves: RecordedLineMove[], fen: string) {
    const nextBoardState = createBuilderBoardStateFromFen(fen);
    let latestMove: { from: Square; to: Square } | null = null;

    for (const move of nextMoves) {
      const parsed = parseUci(move.uci);
      const previousBoard = nextBoardState.board;
      const previousCastlingRights = nextBoardState.castlingRights;
      const result = makeMove(nextBoardState.board, parsed.from, parsed.to, {
        promotion: parsed.promotion,
        castlingRights: nextBoardState.castlingRights,
        enPassantTarget: nextBoardState.enPassantTarget
      });

      if (!result) {
        break;
      }

      nextBoardState.board = result.board;
      nextBoardState.turn = nextBoardState.turn === "white" ? "black" : "white";
      nextBoardState.castlingRights = getUpdatedCastlingRights(previousBoard, parsed.from, parsed.to, previousCastlingRights);
      nextBoardState.enPassantTarget = getNextEnPassantTarget(previousBoard, parsed.from, parsed.to);
      latestMove = { from: parsed.from, to: parsed.to };
    }

    setBoardState(nextBoardState);
    setRecordedMoves(nextMoves);
    setLastPlayedMove(latestMove);
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function handleApplyEngineSuggestion(suggestion: EngineSuggestion) {
    if (courseType === "endgame" && builderPhase === "setup") {
      setError("Finish the setup first, then you can play engine suggestions into the line.");
      return;
    }

    const parsed = parseUci(suggestion.uci);
    const legalTargets = getSelectableMoves(
      boardState.board,
      parsed.from,
      boardState.turn,
      boardState.castlingRights,
      boardState.enPassantTarget
    );

    if (!legalTargets.some((square) => sameSquare(square, parsed.to))) {
      setError("That engine suggestion does not fit the current board state.");
      return;
    }

    const previousBoard = boardState.board;
    const previousCastlingRights = boardState.castlingRights;
    const result = makeMove(boardState.board, parsed.from, parsed.to, {
      promotion: parsed.promotion,
      castlingRights: boardState.castlingRights,
      enPassantTarget: boardState.enPassantTarget
    });

    if (!result) {
      setError("The engine suggestion could not be applied.");
      return;
    }

    setBoardState({
      board: result.board,
      turn: boardState.turn === "white" ? "black" : "white",
      castlingRights: getUpdatedCastlingRights(previousBoard, parsed.from, parsed.to, previousCastlingRights),
      enPassantTarget: getNextEnPassantTarget(previousBoard, parsed.from, parsed.to)
    });
    setRecordedMoves((current) => [...current, { uci: suggestion.uci, san: result.move.notation }]);
    playTrainerSound(result.move.captured ? "capture" : "move", soundEnabled);
    setLastPlayedMove({ from: parsed.from, to: parsed.to });
    setSelectedSquare(null);
    setLegalMoves([]);
    setError("");
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(420px,1fr)_420px]">
      <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Manual builder</p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {courseType === "endgame" ? "Set up an endgame and record it" : "Create lines on the board"}
            </h2>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-sm capitalize text-zinc-300">
            {boardState.turn} to move
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {(["opening", "endgame"] as CourseType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleCourseTypeChange(type)}
              className={[
                "rounded-md border px-3 py-3 text-sm font-semibold capitalize transition",
                courseType === type
                  ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
              ].join(" ")}
            >
              {type}
            </button>
          ))}
        </div>

        {courseType === "endgame" ? (
          <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Endgame builder</h3>
              <div className="inline-flex rounded-md border border-white/10 bg-white/[0.03] p-1">
                {(["setup", "record"] as BuilderPhase[]).map((phase) => (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => {
                      if (phase === "setup") {
                        setBuilderPhase("setup");
                      }
                    }}
                    disabled={phase === "record"}
                    className={[
                      "rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition",
                      builderPhase === phase ? "bg-emerald-300 text-zinc-950" : "text-zinc-300"
                    ].join(" ")}
                  >
                    {phase === "setup" ? "Setup position" : "Record line"}
                  </button>
                ))}
              </div>
            </div>
            {builderPhase === "setup" ? (
              <>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Place pieces on the board, choose whose turn it is, then start recording from that exact endgame position.
                </p>
                {setupValidation.errors.length ? (
                  <div className="mt-4 rounded-lg border border-rose-300/25 bg-rose-300/10 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-100">Fix before recording</p>
                    <ul className="mt-2 space-y-1 text-sm text-rose-100/90">
                      {setupValidation.errors.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {setupValidation.warnings.length ? (
                  <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">Setup warnings</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-50/90">
                      {setupValidation.warnings.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Piece palette</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">White pieces</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {setupPieceOptions.filter((option) => option.value.startsWith("white-")).map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSetupSelection(option.value)}
                            className={[
                              "rounded-md border px-2 py-2 text-xs font-semibold transition",
                              setupSelection === option.value
                                ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                                : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                            ].join(" ")}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Black pieces</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {setupPieceOptions.filter((option) => option.value.startsWith("black-")).map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSetupSelection(option.value)}
                            className={[
                              "rounded-md border px-2 py-2 text-xs font-semibold transition",
                              setupSelection === option.value
                                ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                                : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                            ].join(" ")}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setSetupSelection("erase")}
                      className={[
                        "rounded-md border px-3 py-2 text-xs font-semibold transition",
                        setupSelection === "erase"
                          ? "border-rose-300/35 bg-rose-300/10 text-rose-100"
                          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                      ].join(" ")}
                    >
                      Erase
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Side to move</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["white", "black"] as PieceColor[]).map((turn) => (
                      <button
                        key={turn}
                        type="button"
                        onClick={() => handleSetupTurnChange(turn)}
                        className={[
                          "rounded-md border px-3 py-2 text-sm font-semibold capitalize transition",
                          boardState.turn === turn
                            ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                            : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                        ].join(" ")}
                      >
                        {turn}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleClearSetupBoard}
                    className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                  >
                    Clear board
                  </button>
                  <button
                    type="button"
                    onClick={handleResetEndgameShell}
                    className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                  >
                    Kings only
                  </button>
                  <button
                    type="button"
                    onClick={handleStartRecordingFromSetup}
                    disabled={setupValidation.errors.length > 0}
                    className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
                  >
                    Start recording
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-400">Recording now from your saved custom endgame position.</p>
                <button
                  type="button"
                  onClick={() => setBuilderPhase("setup")}
                  className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                >
                  Back to setup
                </button>
              </div>
            )}
          </div>
        ) : null}

        <Chessboard
          board={boardState.board}
          turn={boardState.turn}
          orientation={sideToTrain}
          annotations={engineAnnotations}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          gameStatus={gameStatus}
          hintedSquare={null}
          revealedSquare={null}
          computerSquare={lastPlayedMove?.from ?? null}
          computerTargetSquare={lastPlayedMove?.to ?? null}
          onSquareClick={handleSquareClick}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Side to train</p>
            <p className="mt-2 text-sm font-semibold capitalize text-white">{sideToTrain}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">White moves</p>
            <p className="mt-2 text-sm font-semibold text-white">{whiteMoveCount}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {courseType === "endgame" ? "Builder phase" : "Black moves"}
            </p>
            <p className="mt-2 text-sm font-semibold capitalize text-white">
              {courseType === "endgame" ? builderPhase : blackMoveCount}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Current line</h3>
            <span className="text-xs text-zinc-400">{editingLineId ? "Editing draft line" : `${recordedMoves.length} ply recorded`}</span>
          </div>
          <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-300">
            {formatRecordedMoves(recordedMoves)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUndoMove}
              disabled={courseType === "endgame" && builderPhase === "setup"}
              className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
            >
              Undo move
            </button>
            <button
              type="button"
              onClick={courseType === "endgame" && builderPhase === "setup" ? handleResetEndgameShell : handleResetLine}
              className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
            >
              {courseType === "endgame" && builderPhase === "setup" ? "Reset setup" : "Reset line"}
            </button>
            <button
              type="button"
              onClick={handleCompleteLine}
              disabled={courseType === "endgame" && builderPhase === "setup"}
              className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
            >
              {editingLineId ? "Update line" : "Complete line"}
            </button>
            {editingLineId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingLineId(null);
                  setLineName(`Line ${draftLines.length + 1}`);
                  resetBuilderForCurrentMode();
                }}
                className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>

      </div>

      <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">New course</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Build your own repertoire</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Record a line on the board, give it a useful name, then save a course once your draft list looks right.
        </p>

        <div className="mt-5 space-y-4">
          <div
            className={[
              "rounded-lg border p-4 transition-all",
              recordedMoves.length
                ? "border-sky-300/25 bg-sky-300/[0.08] shadow-[0_0_0_1px_rgba(125,211,252,0.08)]"
                : "border-sky-300/15 bg-sky-300/[0.05]"
            ].join(" ")}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Engine assist</p>
                <h3 className="mt-2 text-sm font-semibold text-white">Top engine moves</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="rounded-full border border-white/10 px-2 py-1">
                  {courseType === "endgame" && builderPhase === "setup" ? "Setup position" : "Record line"}
                </span>
                {isAnalyzingPosition ? (
                  <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-sky-100">Analyzing...</span>
                ) : null}
              </div>
            </div>

            {engineMessage ? (
              <div className="mt-4 rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-300">
                {engineMessage}
              </div>
            ) : engineSuggestions.length ? (
              <div className="mt-4 space-y-3">
                {engineSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.multipv}-${suggestion.uci}`}
                    type="button"
                    onClick={() => handleApplyEngineSuggestion(suggestion)}
                    className={[
                      "block w-full rounded-md border px-3 py-2 text-left transition hover:border-sky-300/30 hover:bg-sky-300/[0.07]",
                      suggestion.multipv === 1
                        ? "border-sky-300/25 bg-black/30 shadow-[0_0_0_1px_rgba(125,211,252,0.07)]"
                        : "border-white/10 bg-black/20"
                    ].join(" ")}
                    onMouseEnter={() => setHoveredEngineSuggestionUci(suggestion.uci)}
                    onMouseLeave={() => setHoveredEngineSuggestionUci((current) => (current === suggestion.uci ? null : current))}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Line {suggestion.multipv}</p>
                        <p className="mt-1 text-base font-semibold text-white">{suggestion.san}</p>
                      </div>
                      <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
                        {suggestion.evaluation.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      PV: {suggestion.pv.join(" ")}
                    </p>
                    <div className="mt-2 flex justify-end">
                      <span className="text-xs text-zinc-500">Hover to preview on the board</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-400">
                Start building and the engine will surface the best candidate moves here.
              </div>
            )}
          </div>

          <Field label="Course name">
            <input
              value={courseName}
              onChange={(event) => setCourseName(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
              placeholder="My Sicilian Defense"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
              placeholder={courseType === "endgame" ? "Learn the key ideas and technique in this endgame." : "Learn the key ideas and traps in this opening."}
            />
          </Field>

          <Field label="Creator">
            <input
              value={creatorName}
              onChange={(event) => setCreatorName(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
              placeholder="Your name"
            />
          </Field>

          <Field label="Line name">
            <input
              value={lineName}
              onChange={(event) => setLineName(event.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
              placeholder="Main line"
            />
          </Field>

          <Field label="Play as">
            <div className="grid grid-cols-2 gap-2">
              {(["white", "black"] as PieceColor[]).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setSideToTrain(side)}
                  className={[
                    "rounded-md border px-3 py-3 text-sm font-semibold capitalize transition",
                    sideToTrain === side
                      ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  {side}
                </button>
              ))}
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={shareWithCommunity}
              onChange={(event) => setShareWithCommunity(event.target.checked)}
              className="h-4 w-4 accent-emerald-300"
            />
            Mark this as community-ready
          </label>

          <button
            type="button"
            onClick={handleSaveCourse}
            className="w-full rounded-md bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
          >
            Save course
          </button>
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Draft lines</h3>
            <span className="text-xs text-zinc-400">{draftLines.length} saved</span>
          </div>
          <div className="mt-3 space-y-2">
            {draftLines.length ? (
              draftLines.map((line, index) => (
                <div key={line.id} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Line {index + 1}</label>
                      <input
                        value={line.name}
                        onChange={(event) => handleRenameDraftLine(line.id, event.target.value)}
                        className="mt-2 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-zinc-500"
                        placeholder="Line name"
                      />
                    </div>
                    <span className="shrink-0 text-xs text-zinc-400">{line.moves.length} ply</span>
                  </div>
                  <p className="mt-2 truncate text-xs text-zinc-500">{formatRecordedMoves(line.moves)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditDraftLine(line.id)}
                      className="rounded-md border border-sky-300/25 px-2.5 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDraftLine(line.id, -1)}
                      disabled={index === 0}
                      className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDraftLine(line.id, 1)}
                      disabled={index === draftLines.length - 1}
                      className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDraftLine(line.id)}
                      className="rounded-md border border-rose-300/25 px-2.5 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-400">Complete a line on the board and it will show up here.</p>
            )}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </section>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-zinc-300">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function createBuilderBoardState(): BuilderBoardState {
  return createBuilderBoardStateFromFen(startingFen);
}

function createBuilderBoardStateFromFen(fen: string): BuilderBoardState {
  const parsed = parseFen(fen);
  return {
    board: parsed.board,
    turn: parsed.turn,
    castlingRights: parsed.castlingRights ?? emptyCastlingRights(),
    enPassantTarget: parsed.enPassantTarget
  };
}

function parseUci(uci: string): { from: Square; to: Square; promotion?: "queen" | "rook" | "bishop" | "knight" } {
  return {
    from: algebraicToSquare(uci.slice(0, 2)),
    to: algebraicToSquare(uci.slice(2, 4)),
    promotion: undefined
  };
}

function algebraicToSquare(value: string): Square {
  const files = "abcdefgh";
  return {
    file: files.indexOf(value[0]),
    rank: 8 - Number(value[1])
  };
}

function squareToAlgebraic(square: Square): string {
  return `${String.fromCharCode(97 + square.file)}${8 - square.rank}`;
}

function sameSquare(left: Square, right: Square): boolean {
  return left.file === right.file && left.rank === right.rank;
}

function formatRecordedMoves(moves: RecordedLineMove[]): string {
  if (!moves.length) {
    return "No moves recorded yet.";
  }

  const chunks: string[] = [];

  for (let index = 0; index < moves.length; index += 2) {
    const moveNumber = Math.floor(index / 2) + 1;
    const whiteMove = moves[index]?.san ?? "";
    const blackMove = moves[index + 1]?.san ?? "";
    chunks.push(`${moveNumber}. ${whiteMove}${blackMove ? ` ${blackMove}` : ""}`);
  }

  return chunks.join(" ");
}

function countPiece(board: Board, color: PieceColor, type: PieceType): number {
  return board.flat().filter((piece) => piece?.color === color && piece.type === type).length;
}

function validateEndgameSetup(boardState: BuilderBoardState): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const whiteKingSquares = findPieces(boardState.board, "white", "king");
  const blackKingSquares = findPieces(boardState.board, "black", "king");
  const pawnsOnBackRank = findBackRankPawns(boardState.board);

  if (whiteKingSquares.length !== 1) {
    errors.push("The setup needs exactly one white king.");
  }

  if (blackKingSquares.length !== 1) {
    errors.push("The setup needs exactly one black king.");
  }

  if (whiteKingSquares[0] && blackKingSquares[0] && kingsTouching(whiteKingSquares[0], blackKingSquares[0])) {
    errors.push("The kings cannot stand on touching squares.");
  }

  if (pawnsOnBackRank.length) {
    errors.push("Pawns cannot start on the first or eighth rank in a legal endgame setup.");
  }

  if (!errors.length && isKingInCheck(boardState.board, boardState.turn)) {
    warnings.push(`${boardState.turn === "white" ? "White" : "Black"} is already in check in this starting position.`);
  }

  if (!errors.length && (gameStatusFromBoardState(boardState) === "checkmate" || gameStatusFromBoardState(boardState) === "stalemate")) {
    warnings.push("This setup is already a finished position, so recording may feel odd.");
  }

  if (boardState.board.flat().filter(Boolean).length < 3) {
    warnings.push("This is a very sparse setup. That can be fine, but double-check that it teaches the endgame idea you want.");
  }

  return { errors, warnings };
}

function findPieces(board: Board, color: PieceColor, type: PieceType): Square[] {
  const matches: Square[] = [];

  board.forEach((rank, rankIndex) => {
    rank.forEach((piece, fileIndex) => {
      if (piece?.color === color && piece.type === type) {
        matches.push({ file: fileIndex, rank: rankIndex });
      }
    });
  });

  return matches;
}

function findBackRankPawns(board: Board): Square[] {
  const matches: Square[] = [];

  board.forEach((rank, rankIndex) => {
    if (rankIndex !== 0 && rankIndex !== 7) {
      return;
    }

    rank.forEach((piece, fileIndex) => {
      if (piece?.type === "pawn") {
        matches.push({ file: fileIndex, rank: rankIndex });
      }
    });
  });

  return matches;
}

function kingsTouching(left: Square, right: Square): boolean {
  return Math.abs(left.file - right.file) <= 1 && Math.abs(left.rank - right.rank) <= 1 && !sameBoardSquare(left, right);
}

function gameStatusFromBoardState(boardState: BuilderBoardState) {
  return getGameStatus(boardState.board, boardState.turn, boardState.castlingRights, boardState.enPassantTarget);
}

const setupPieceOptions: Array<{ value: SetupSelection; label: string }> = [
  { value: "white-king", label: "White king" },
  { value: "white-queen", label: "White queen" },
  { value: "white-rook", label: "White rook" },
  { value: "white-bishop", label: "White bishop" },
  { value: "white-knight", label: "White knight" },
  { value: "white-pawn", label: "White pawn" },
  { value: "black-king", label: "Black king" },
  { value: "black-queen", label: "Black queen" },
  { value: "black-rook", label: "Black rook" },
  { value: "black-bishop", label: "Black bishop" },
  { value: "black-knight", label: "Black knight" },
  { value: "black-pawn", label: "Black pawn" },
  { value: "erase", label: "Erase" }
];

function loadBuilderDraft(): SavedBuilderDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(manualBuilderDraftStorageKey);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<SavedBuilderDraft>;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (
      typeof parsed.courseName !== "string" ||
      typeof parsed.description !== "string" ||
      typeof parsed.creatorName !== "string" ||
      typeof parsed.lineName !== "string" ||
      (parsed.courseType !== "opening" && parsed.courseType !== "endgame") ||
      (parsed.builderPhase !== "setup" && parsed.builderPhase !== "record") ||
      (parsed.sideToTrain !== "white" && parsed.sideToTrain !== "black") ||
      typeof parsed.shareWithCommunity !== "boolean" ||
      typeof parsed.lineStartFen !== "string" ||
      (parsed.setupSelection !== "erase" &&
        !setupPieceOptions.some((option) => option.value === parsed.setupSelection)) ||
      !Array.isArray(parsed.draftLines) ||
      !Array.isArray(parsed.recordedMoves) ||
      !parsed.boardState
    ) {
      return null;
    }

    return {
      courseName: parsed.courseName,
      description: parsed.description,
      creatorName: parsed.creatorName,
      lineName: parsed.lineName,
      courseType: parsed.courseType,
      builderPhase: parsed.builderPhase,
      sideToTrain: parsed.sideToTrain,
      shareWithCommunity: parsed.shareWithCommunity,
      draftLines: parsed.draftLines as DraftLine[],
      recordedMoves: parsed.recordedMoves as RecordedLineMove[],
      boardState: parsed.boardState as BuilderBoardState,
      lineStartFen: parsed.lineStartFen,
      setupSelection: parsed.setupSelection as SetupSelection
    };
  } catch {
    return null;
  }
}

function saveBuilderDraft(draft: SavedBuilderDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(manualBuilderDraftStorageKey, JSON.stringify(draft));
}

function clearBuilderDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(manualBuilderDraftStorageKey);
}
