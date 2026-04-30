export type PieceColor = "white" | "black";

export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

export type Square = {
  file: number;
  rank: number;
};

export type ChessPiece = {
  type: PieceType;
  color: PieceColor;
};

export type Board = Array<Array<ChessPiece | null>>;

export type CastlingRights = {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
};

export type ChessMove = {
  from: Square;
  to: Square;
  piece: ChessPiece;
  captured?: ChessPiece | null;
  promotion?: PieceType;
  isCastle?: boolean;
  isEnPassant?: boolean;
  notation: string;
};

export type MoveOptions = {
  promotion?: PieceType;
  castlingRights?: CastlingRights;
  enPassantTarget?: Square | null;
};

export type ParsedFen = {
  board: Board;
  turn: PieceColor;
  castlingRights: CastlingRights;
  enPassantTarget: Square | null;
};

export type TrainingStatus = "idle" | "correct" | "incorrect" | "revealed";

export type ReviewGrade = "again" | "hard" | "good" | "easy";

export type GameStatus = "playing" | "check" | "checkmate" | "stalemate";
