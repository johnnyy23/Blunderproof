import type { BoardAnnotations } from "@/components/BoardAnnotations";
import { startingFen } from "@/lib/chess";

export type TrainingMove = {
  uci: string;
  san: string;
  prompt: string;
  explanation: string;
  plan: string;
  commonMistake?: string;
  annotations?: BoardAnnotations;
  opponentReply?: {
    uci: string;
    san: string;
  };
};

export type PreludeMove = {
  uci: string;
  san: string;
};

export type TrainingLine = {
  id: string;
  name: string;
  section?: string;
  analysisTags?: string[];
  fen: string;
  sideToTrain: "white" | "black";
  prelude?: PreludeMove[];
  moves: TrainingMove[];
  dueLevel: "new" | "due" | "steady";
};

export type OpeningCourse = {
  id: string;
  name: string;
  repertoire: "white" | "black";
  level: string;
  description: string;
  lines: TrainingLine[];
  createdAt?: string;
  source?: "built-in" | "imported-pgn" | "manual" | "community";
  creator?: {
    id: string;
    name: string;
  };
  engagement?: {
    likes: number;
    rating: number;
    votes: number;
  };
  isShared?: boolean;
};

const analysisTagsByLineId: Record<string, string[]> = {
  "jobava-main-setup": ["jobava london", "jobava", "veresov", "jobava setup", "d4 nf6 nc3", "main setup"],
  "jobava-bf5-cxd3-structure": ["jobava london", "jobava", "bf5", "cxd3", "pawn mass", "classical london setup"],
  "jobava-c5-counterstrike": ["jobava london", "jobava", "c5", "e4 strike", "central strike"],
  "jobava-mainline-nxe4": ["jobava london", "jobava", "nxe4", "main line", "c5"],
  "jobava-e6-nb5": ["jobava london", "jobava", "e6", "nb5", "wins bishop pair"],
  "jobava-g4-h4-attack": ["jobava london", "jobava", "g4", "h4", "attack", "bf5"],
  "jobava-g6-exchange-sac": ["jobava london", "jobava", "g6", "exchange sac", "h pawn"],
  "jobava-qh3-mate-pattern": ["jobava london", "jobava", "qh3", "mate pattern", "attack"],
  "jobava-bb4-ne4-pawn-gambit": ["jobava london", "jobava", "bb4", "ne4", "pawn gambit"],
  "london-main-setup": ["london system", "london", "classical london setup", "main setup"],
  "london-c5-queenside-pressure": ["london system", "london", "c5", "queenside pressure"],
  "caro-advance-main-setup": ["caro-kann", "advance variation", "advance", "bf5", "e4 c6 d4 d5 e5"],
  "caro-classical-development": ["caro-kann", "classical", "two knights", "nc3", "classical / two knights"],
  "caro-exchange-simple-development": ["caro-kann", "exchange variation", "exchange", "simple development"],
  "caro-exchange-bd3-bf4-punish": ["caro-kann", "exchange variation", "exchange", "bd3", "bf4"],
  "caro-exchange-c3-solid-setup": ["caro-kann", "exchange variation", "exchange", "c3", "solid setup"],
  "caro-exchange-h3-fianchetto": ["caro-kann", "exchange variation", "exchange", "h3", "fianchetto"],
  "caro-panov-main-endgame": ["caro-kann", "panov", "panov main line", "endgame"],
  "caro-panov-bg5-active-dxc4": ["caro-kann", "panov", "bg5", "dxc4"],
  "caro-advance-h4-queen-trade": ["caro-kann", "advance variation", "advance", "h4", "queen trade"],
  "caro-advance-nd2-nf5": ["caro-kann", "advance variation", "advance", "nd2", "nf5", "c5 break"],
  "beginner-opposition-win": ["endgame", "king and pawn", "opposition", "win with opposition"],
  "beginner-opposition-draw": ["endgame", "king and pawn", "opposition", "draw with opposition"],
  "intermediate-rook-pawn-draw": ["endgame", "rook pawn draw", "defensive draw"],
  "intermediate-philidor": ["endgame", "rook endgame", "philidor"],
  "intermediate-lucena": ["endgame", "rook endgame", "lucena", "build the bridge"]
};

export const courses: OpeningCourse[] = [
  {
    id: "jobava-london",
    name: "Jobava London Starter",
    repertoire: "white",
    level: "900-1700",
    description: "A punchy Jobava London course built around Nc3, Bf4, fast development, and practical attacking plans.",
    lines: [
      {
        id: "jobava-main-setup",
        name: "Main Setup vs ...Nf6 and ...d5",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "g8f6", san: "...Nf6" }
        ],
        dueLevel: "due",
        moves: [
          {
            uci: "b1c3",
            san: "Nc3",
            prompt: "Black starts with ...Nf6. What is the Jobava move that makes this different from a normal London?",
            explanation: "Nc3 is the Jobava signature. White blocks the c-pawn but gains fast pressure on d5 and prepares Bf4 with active piece play.",
            plan: "Develop Bf4, Nf3, e3, and Bd3. You are aiming for quick activity, not a slow London triangle.",
            commonMistake: "A common mistake here is playing Nf3 first and drifting into a normal London instead of committing to the Jobava setup with Nc3.",
            annotations: {
              arrows: [{ from: "b1", to: "c3", color: "green" }],
              circles: [{ square: "d5", color: "yellow" }]
            },
            opponentReply: {
              uci: "d7d5",
              san: "...d5"
            }
          },
          {
            uci: "c1f4",
            san: "Bf4",
            prompt: "Black takes the center. Which bishop move creates the Jobava attacking setup?",
            explanation: "Bf4 develops actively and points at c7 and h2-b8 themes. It also supports later Nb5 ideas.",
            plan: "Keep development simple: Nf3, e3, Bd3, and castle. If Black is careless, Nb5 can become annoying very quickly.",
            commonMistake: "A common mistake here is delaying Bf4 and letting Black settle into an easy ...e6 and ...Bd6 setup without being asked any questions.",
            opponentReply: {
              uci: "e7e6",
              san: "...e6"
            }
          },
          {
            uci: "g1f3",
            san: "Nf3",
            prompt: "Black builds a solid center. What knight move keeps White's attack flexible?",
            explanation: "Nf3 develops and prepares Ne5 in many Jobava structures. The kingside knight often becomes the attacking piece.",
            plan: "Watch for Ne5, Bd3, and sometimes a kingside pawn push. Do not rush tactics before your pieces are out.",
            opponentReply: {
              uci: "f8d6",
              san: "...Bd6"
            }
          },
          {
            uci: "e2e3",
            san: "e3",
            prompt: "Black challenges your bishop with ...Bd6. What quiet move keeps the center safe and opens development?",
            explanation: "e3 supports d4 and opens the f1 bishop. It also keeps White ready to recapture or continue developing calmly.",
            plan: "If Black trades bishops, recapture in the way that fits the structure. Otherwise, Bd3 and castling are next.",
            opponentReply: {
              uci: "e8g8",
              san: "...O-O"
            }
          },
          {
            uci: "f1d3",
            san: "Bd3",
            prompt: "Black castles. Which developing move points at the kingside and completes White's setup?",
            explanation: "Bd3 lines up pressure toward h7 and makes castling possible. This is the natural attacking square in many Jobava lines.",
            plan: "Castle next. Then look for Nb5, Ne5, or kingside expansion depending on Black's setup.",
            opponentReply: {
              uci: "c7c5",
              san: "...c5"
            }
          },
          {
            uci: "e1g1",
            san: "O-O",
            prompt: "Black strikes with ...c5. What should White do before calculating pawn breaks?",
            explanation: "Castling keeps the king safe. Jobava attacks work best when development is complete and the rooks are connected.",
            plan: "After castling, Nb5 can pressure the d6 bishop and c7 square. Keep the initiative practical.",
            opponentReply: {
              uci: "b8c6",
              san: "...Nc6"
            }
          },
          {
            uci: "c3b5",
            san: "Nb5",
            prompt: "Black develops the queen knight. Which Jobava jump creates immediate pressure?",
            explanation: "Nb5 is a typical Jobava resource. The knight attacks d6 and eyes c7, forcing Black to respond carefully.",
            plan: "If Black trades or retreats, continue with c3, Re1, or Ne5 depending on the position. The point is active piece pressure."
          }
        ]
      },
      {
        id: "jobava-bf5-cxd3-structure",
        name: "Vs ...Bf5: Recapture with the Pawn",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "g8f6", san: "...Nf6" },
          { uci: "b1c3", san: "Nc3" },
          { uci: "d7d5", san: "...d5" },
          { uci: "c1f4", san: "Bf4" },
          { uci: "c8f5", san: "...Bf5" }
        ],
        dueLevel: "new",
        moves: [
          {
            uci: "g1f3",
            san: "Nf3",
            prompt: "Black mirrors your bishop with ...Bf5. What normal developing move supports the Jobava plan?",
            explanation: "Nf3 develops and prepares e3 and Bd3. The knight can later jump to e5, a key Jobava square.",
            plan: "Develop calmly first. The exciting pawn storms only work when your pieces support them.",
            commonMistake: "A common mistake here is launching pawns too early and forgetting that the Jobava attack only works when the kingside knight and bishops are developed.",
            opponentReply: {
              uci: "e7e6",
              san: "...e6"
            }
          },
          {
            uci: "e2e3",
            san: "e3",
            prompt: "Black supports the center. Which move opens your light-squared bishop and protects d4?",
            explanation: "e3 is the glue move. It keeps the center stable and prepares Bd3 to challenge Black's bishop.",
            plan: "Play Bd3 next. If Black captures, the pawn recapture is often the Jobava structure you want.",
            opponentReply: {
              uci: "f8d6",
              san: "...Bd6"
            }
          },
          {
            uci: "f1d3",
            san: "Bd3",
            prompt: "Black develops to d6. How should White challenge the active bishop?",
            explanation: "Bd3 offers a trade and points at the kingside. White is happy if Black gives up the bishop pair or allows Ne5 ideas.",
            plan: "If Black plays ...Bxd3, recapture with the c-pawn to build a strong central mass.",
            opponentReply: {
              uci: "f5d3",
              san: "...Bxd3"
            }
          },
          {
            uci: "c2d3",
            san: "cxd3",
            prompt: "Black trades on d3. Which recapture gives White the typical Jobava pawn mass?",
            explanation: "cxd3 looks unusual, but it supports e4 and opens the c-file. White often uses this structure for central expansion.",
            plan: "Castle, play Ne5 when available, and consider e4-e5 or queenside pressure with Rc1 and Qb3.",
            opponentReply: {
              uci: "e8g8",
              san: "...O-O"
            }
          },
          {
            uci: "f3e5",
            san: "Ne5",
            prompt: "Black castles. Which knight jump activates White's main attacking piece?",
            explanation: "Ne5 is one of the core Jobava ideas. The knight supports kingside expansion and makes Black's development less comfortable.",
            plan: "Follow with h4 or g4 when the position allows. The knight on e5 often makes those pawn moves tactically sound.",
            opponentReply: {
              uci: "c7c5",
              san: "...c5"
            }
          },
          {
            uci: "h2h4",
            san: "h4",
            prompt: "Black challenges the center. Which Jobava attacking move starts kingside expansion?",
            explanation: "h4 is a thematic attacking move. White prepares h5 or g4-g5 ideas while Black is still solving center problems.",
            plan: "Do not push pawns blindly. Use h4 to gain space, then choose between h5, g4, Rc1, or Qb3 based on Black's reaction."
          }
        ]
      },
      {
        id: "jobava-c5-counterstrike",
        name: "Vs Early ...c5: Strike with e4",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "g8f6", san: "...Nf6" },
          { uci: "b1c3", san: "Nc3" },
          { uci: "d7d5", san: "...d5" },
          { uci: "c1f4", san: "Bf4" },
          { uci: "c7c5", san: "...c5" }
        ],
        dueLevel: "new",
        moves: [
          {
            uci: "e2e4",
            san: "e4",
            prompt: "Black immediately hits the center with ...c5. What is the sharp Jobava counterstrike?",
            explanation: "e4 uses White's lead in development to challenge the center directly. This is more ambitious than quietly playing e3.",
            plan: "If Black captures, develop quickly and use open lines. The point is initiative, not holding every pawn.",
            commonMistake: "A common mistake here is retreating into a quiet London structure when this exact position calls for an energetic central strike.",
            opponentReply: {
              uci: "d5e4",
              san: "...dxe4"
            }
          },
          {
            uci: "d4c5",
            san: "dxc5",
            prompt: "Black captures on e4. Which recapture asks Black an immediate question?",
            explanation: "dxc5 grabs the c-pawn and interferes with Black's queenside development. Black must decide how to regain material.",
            plan: "If Black goes queen hunting with ...Qa5, calmly develop and prepare queenside castling.",
            opponentReply: {
              uci: "d8a5",
              san: "...Qa5"
            }
          },
          {
            uci: "d1d2",
            san: "Qd2",
            prompt: "Black pins along the a5-e1 diagonal. What queen move prepares safe queenside castling?",
            explanation: "Qd2 connects the plan: defend, develop, and prepare O-O-O. White is not trying to win a pawn; White wants initiative.",
            plan: "After Black recaptures on c5, castle long and bring pieces into the attack.",
            opponentReply: {
              uci: "a5c5",
              san: "...Qxc5"
            }
          },
          {
            uci: "e1c1",
            san: "O-O-O",
            prompt: "Black wins back the c5 pawn. How does White finish development with tempo and purpose?",
            explanation: "O-O-O places the king safely and brings the rook to the d-file. White's lead in development becomes easy to use.",
            plan: "Develop Nge2 and look for pressure on e4, d5, and the d-file. Keep the initiative flowing.",
            opponentReply: {
              uci: "b8c6",
              san: "...Nc6"
            }
          },
          {
            uci: "g1e2",
            san: "Nge2",
            prompt: "Black develops. Which knight move adds pressure without blocking your attacking pieces?",
            explanation: "Nge2 heads toward g3 or f4 and helps attack the e4 pawn. It also keeps the f-pawn flexible in some sharp lines.",
            plan: "Continue with Ng3 or Be3. The big idea is rapid development and pressure, not slow material grabbing."
          }
        ]
      },
      {
        id: "jobava-c5-nxe4-main",
        name: "Vs ...c5: Main ...Nxe4 Line",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "g8f6", san: "...Nf6" },
          { uci: "b1c3", san: "Nc3" },
          { uci: "d7d5", san: "...d5" },
          { uci: "c1f4", san: "Bf4" },
          { uci: "c7c5", san: "...c5" },
          { uci: "e2e4", san: "e4" },
          { uci: "f6e4", san: "...Nxe4" }
        ],
        dueLevel: "new",
        moves: [
          {
            uci: "c3e4",
            san: "Nxe4",
            prompt: "Black chooses the serious ...Nxe4 capture. What should White do first?",
            explanation: "Nxe4 removes Black's active knight and keeps the center from becoming chaotic on Black's terms.",
            plan: "Trade the knight, then use dxc5 and quick queen activity to keep Black solving problems.",
            commonMistake: "A common mistake here is reacting passively to ...Nxe4 instead of simplifying first and keeping the initiative under control.",
            opponentReply: {
              uci: "d5e4",
              san: "...dxe4"
            }
          },
          {
            uci: "d4c5",
            san: "dxc5",
            prompt: "Black recaptures with the d-pawn. Which capture keeps White's initiative alive?",
            explanation: "dxc5 grabs space and makes Black spend time recovering the pawn instead of developing smoothly.",
            plan: "Expect ...Qa5+. Block with c3, then use Qa4+ and Qxe4 to regain material with activity.",
            opponentReply: {
              uci: "d8a5",
              san: "...Qa5+"
            }
          },
          {
            uci: "c2c3",
            san: "c3",
            prompt: "Black checks from a5. What calm move blocks the check and prepares queen activity?",
            explanation: "c3 covers the diagonal and gives White time to use the queen actively. It also stops the position from becoming loose.",
            plan: "After Black takes c5, Qa4+ is the key tempo move.",
            opponentReply: {
              uci: "a5c5",
              san: "...Qxc5"
            }
          },
          {
            uci: "d1a4",
            san: "Qa4+",
            prompt: "Black grabs the c5 pawn. Which check keeps Black's king and pieces awkward?",
            explanation: "Qa4+ develops with tempo and makes it harder for Black to consolidate the extra central pawn.",
            plan: "Use the check to force a reply, then recover on e4.",
            opponentReply: {
              uci: "b8c6",
              san: "...Nc6"
            }
          },
          {
            uci: "a4e4",
            san: "Qxe4",
            prompt: "Black blocks with ...Nc6. What queen move restores material and keeps White active?",
            explanation: "Qxe4 wins back the pawn and leaves White with a playable initiative. The point of the line is activity, not memorizing a long engine branch.",
            plan: "Develop quickly with Nf3, Be2 or O-O-O ideas depending on Black's setup."
          }
        ]
      },
      {
        id: "jobava-e6-nb5-bishop-pair",
        name: "Vs ...e6: Nb5 Wins the Bishop Pair",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "g8f6", san: "...Nf6" },
          { uci: "b1c3", san: "Nc3" },
          { uci: "d7d5", san: "...d5" },
          { uci: "c1f4", san: "Bf4" },
          { uci: "e7e6", san: "...e6" }
        ],
        dueLevel: "new",
        moves: [
          {
            uci: "c3b5",
            san: "Nb5",
            prompt: "Black plays the common ...e6. Which Jobava knight jump immediately asks a question?",
            explanation: "Nb5 attacks c7 and forces Black to make a concession. This is one of the main reasons the c3 knight belongs in the Jobava.",
            plan: "If Black answers with ...Bd6, take the bishop pair and then build pressure against d6.",
            commonMistake: "A common mistake here is playing a quiet setup move and missing the immediate Nb5 jump that gives the Jobava its practical sting.",
            opponentReply: {
              uci: "f8d6",
              san: "...Bd6"
            }
          },
          {
            uci: "b5d6",
            san: "Nxd6+",
            prompt: "Black blocks the fork with ...Bd6. What should White take?",
            explanation: "Nxd6+ gives White the bishop pair and leaves Black with a slightly clumsy pawn structure.",
            plan: "After ...cxd6, play e3, Nf3, c3, and keep long-term pressure on d6.",
            opponentReply: {
              uci: "c7d6",
              san: "...cxd6"
            }
          },
          {
            uci: "e2e3",
            san: "e3",
            prompt: "The tactical moment is over. Which quiet move starts White's clean setup?",
            explanation: "e3 opens the light-squared bishop and supports the center. White's advantage is practical and long-term.",
            plan: "Develop Nf3, Bd3 or Be2, castle, and make Black defend d6 for a long time.",
            opponentReply: {
              uci: "b8c6",
              san: "...Nc6"
            }
          },
          {
            uci: "g1f3",
            san: "Nf3",
            prompt: "Black develops. What simple move keeps White coordinated?",
            explanation: "Nf3 develops and supports central play. White does not need to force tactics after winning the bishop pair.",
            plan: "Use c3 and Bd3/Be2 to finish development, then target d6 and e5.",
            opponentReply: {
              uci: "e8g8",
              san: "...O-O"
            }
          },
          {
            uci: "c2c3",
            san: "c3",
            prompt: "Black castles. Which structure move keeps the d4 pawn solid?",
            explanation: "c3 makes the center harder to undermine and prepares a comfortable middlegame where the bishop pair matters.",
            plan: "Play Bd3, castle, and improve slowly. This line is about a stable edge, not a quick knockout."
          }
        ]
      },
      {
        id: "jobava-bf5-ne5-g4-attack",
        name: "Vs ...Bf5: Ne5 and g4 Attack",
        section: "Sidelines",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "d7d5", san: "...d5" },
          { uci: "b1c3", san: "Nc3" },
          { uci: "g8f6", san: "...Nf6" },
          { uci: "c1f4", san: "Bf4" },
          { uci: "c8f5", san: "...Bf5" },
          { uci: "g1f3", san: "Nf3" },
          { uci: "e7e6", san: "...e6" },
          { uci: "e2e3", san: "e3" },
          { uci: "f8d6", san: "...Bd6" }
        ],
        dueLevel: "due",
        moves: [
          {
            uci: "f3e5",
            san: "Ne5",
            prompt: "In the symmetrical ...Bf5 setup, where does the kingside knight belong?",
            explanation: "Ne5 is the engine of many Jobava attacks. It supports g4 and makes Black's normal development uncomfortable.",
            plan: "If Black castles casually, use the knight to support a fast pawn storm.",
            commonMistake: "A common mistake here is castling or playing e3 too passively when Ne5 is the move that gives the whole attack its bite.",
            opponentReply: {
              uci: "e8g8",
              san: "...O-O"
            }
          },
          {
            uci: "g2g4",
            san: "g4",
            prompt: "Black castles into your setup. What attacking move hits the bishop?",
            explanation: "g4 gains time on the bishop and starts the classic Jobava kingside expansion. The knight on e5 helps make this possible.",
            plan: "Chase the bishop, add h4, and look for g5 or h5 breaks depending on Black's reaction.",
            opponentReply: {
              uci: "f5g6",
              san: "...Bg6"
            }
          },
          {
            uci: "h2h4",
            san: "h4",
            prompt: "Black retreats to g6. Which pawn move threatens to trap or tear open the kingside?",
            explanation: "h4 threatens h5 and forces Black to make a concession. Even when the bishop survives, Black's king becomes much easier to attack.",
            plan: "If Black creates a hook with ...h6 or ...h5, be ready for g5 or Nxg6 ideas."
          }
        ]
      },
      {
        id: "jobava-g6-h-pawn-sac",
        name: "Vs ...g6: h-Pawn Exchange Sac",
        section: "Sidelines",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "d7d5", san: "...d5" },
          { uci: "b1c3", san: "Nc3" },
          { uci: "g8f6", san: "...Nf6" },
          { uci: "c1f4", san: "Bf4" },
          { uci: "g7g6", san: "...g6" },
          { uci: "e2e3", san: "e3" },
          { uci: "f8g7", san: "...Bg7" }
        ],
        dueLevel: "new",
        moves: [
          {
            uci: "h2h4",
            san: "h4",
            prompt: "Black fianchettoes against the Jobava. What direct move starts White's main attacking idea?",
            explanation: "h4 is a practical weapon against ...g6 setups. White wants h5 and an open h-file if Black castles too casually.",
            plan: "If Black castles and takes on h5, the rook sacrifice can open the h-file and pull Black's king into danger.",
            commonMistake: "A common mistake here is playing routine development and letting Black finish the fianchetto comfortably instead of asking kingside questions right away.",
            opponentReply: {
              uci: "e8g8",
              san: "...O-O"
            }
          },
          {
            uci: "h4h5",
            san: "h5",
            prompt: "Black castles. Which move asks whether Black understands the danger?",
            explanation: "h5 forces Black to decide how much of the kingside to open. Many club players take the pawn and underestimate the attack.",
            plan: "If ...Nxh5 appears, the rook lift sacrifice is the thematic follow-up.",
            opponentReply: {
              uci: "f6h5",
              san: "...Nxh5"
            }
          },
          {
            uci: "h1h5",
            san: "Rxh5",
            prompt: "Black takes on h5. What is the thematic exchange sacrifice?",
            explanation: "Rxh5 removes the defender and opens the h-file. This is a practical attacking idea you should recognize instantly.",
            plan: "After ...gxh5, Qxh5 brings the queen into the attack with tempo and real threats.",
            opponentReply: {
              uci: "g6h5",
              san: "...gxh5"
            }
          },
          {
            uci: "d1h5",
            san: "Qxh5",
            prompt: "Black accepts the rook. Where does the queen go?",
            explanation: "Qxh5 puts the queen on the open h-file and makes Black's castled king the main target.",
            plan: "Develop Bd3, Nf3, and castle long when possible. The attack matters more than the exchange.",
            opponentReply: {
              uci: "c7c6",
              san: "...c6"
            }
          },
          {
            uci: "f1d3",
            san: "Bd3",
            prompt: "Black tries to stabilize the center. Which developing move points straight at h7?",
            explanation: "Bd3 adds another attacker and makes Black defend constant mate threats around h7 and h5.",
            plan: "Bring the knight out and consider castling long. Do not rush; keep adding attackers."
          }
        ]
      },
      {
        id: "jobava-queen-h3-mate-pattern",
        name: "Queen to h3 Mate Pattern",
        section: "Traps",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "d7d5", san: "...d5" },
          { uci: "b1c3", san: "Nc3" },
          { uci: "g8f6", san: "...Nf6" },
          { uci: "c1f4", san: "Bf4" },
          { uci: "e7e6", san: "...e6" },
          { uci: "e2e3", san: "e3" },
          { uci: "c7c5", san: "...c5" },
          { uci: "g1f3", san: "Nf3" },
          { uci: "b8c6", san: "...Nc6" },
          { uci: "f1d3", san: "Bd3" },
          { uci: "f8d6", san: "...Bd6" },
          { uci: "f3e5", san: "Ne5" },
          { uci: "e8g8", san: "...O-O" }
        ],
        dueLevel: "due",
        moves: [
          {
            uci: "d1f3",
            san: "Qf3",
            prompt: "Your knight is on e5 and bishop points at h7. How does the queen join the attack?",
            explanation: "Qf3 starts the queen transfer to h3. This is a classic Jobava pattern when Black has little queenside counterplay.",
            plan: "Move the queen to h3, then look for sacrifices on h6 or h7 if Black weakens the king.",
            commonMistake: "A common mistake here is rushing a sacrifice before bringing the queen over. In this pattern, the queen lift is what makes the attack real.",
            opponentReply: {
              uci: "c8d7",
              san: "...Bd7"
            }
          },
          {
            uci: "f3h3",
            san: "Qh3",
            prompt: "Black develops. Where does the queen belong?",
            explanation: "Qh3 creates direct pressure on h7 and makes Black's defensive moves awkward.",
            plan: "If Black plays ...h6, Bxh6 can rip open the king.",
            opponentReply: {
              uci: "h7h6",
              san: "...h6"
            }
          },
          {
            uci: "f4h6",
            san: "Bxh6",
            prompt: "Black weakens h6. What sacrifice opens the king?",
            explanation: "Bxh6 removes the pawn shield. The queen is already close enough to punish Black's loose king.",
            plan: "After ...gxh6, recapture with the queen and keep the attack moving.",
            opponentReply: {
              uci: "g7h6",
              san: "...gxh6"
            }
          },
          {
            uci: "h3h6",
            san: "Qxh6",
            prompt: "Black accepts the bishop. What is the forcing recapture?",
            explanation: "Qxh6 keeps the attack alive and threatens both material and mating patterns.",
            plan: "Remove defenders, then use the bishop on d3 to create the h7 mating net.",
            opponentReply: {
              uci: "f8e8",
              san: "...Re8"
            }
          },
          {
            uci: "e5d7",
            san: "Nxd7",
            prompt: "Black defends with the rook. Which knight move removes a key defender?",
            explanation: "Nxd7 clears the e5 knight with tempo and pulls another black piece into a vulnerable square.",
            plan: "If Black recaptures with the knight, the bishop checks on h7 and g6 create a mating pattern.",
            opponentReply: {
              uci: "f6d7",
              san: "...Nxd7"
            }
          },
          {
            uci: "d3h7",
            san: "Bh7+",
            prompt: "Black recaptures. Which bishop check starts the mate net?",
            explanation: "Bh7+ forces the king into the pattern. This is the kind of forcing sequence worth drilling.",
            plan: "Use Bg6+ and Qh7+ to keep the king boxed in.",
            opponentReply: {
              uci: "g8h8",
              san: "...Kh8"
            }
          },
          {
            uci: "h7g6",
            san: "Bg6+",
            prompt: "The king goes to h8. Which quiet-looking bishop move keeps it trapped?",
            explanation: "Bg6+ covers key escape squares and lets the queen deliver the final checks.",
            plan: "Force ...Kg8, then use Qh7+ and Qxf7 mate.",
            opponentReply: {
              uci: "h8g8",
              san: "...Kg8"
            }
          },
          {
            uci: "h6h7",
            san: "Qh7+",
            prompt: "Black returns to g8. What queen check keeps the attack forcing?",
            explanation: "Qh7+ drives the king to f8, where the queen can finish the job.",
            plan: "Check first, then take f7 with mate.",
            opponentReply: {
              uci: "g8f8",
              san: "...Kf8"
            }
          },
          {
            uci: "h7f7",
            san: "Qxf7#",
            prompt: "The king lands on f8. What is the mate?",
            explanation: "Qxf7# is the final pattern: queen and bishop coordinate perfectly around the exposed king.",
            plan: "Remember the shape: queen on h-file, bishop checks, knight removes a defender."
          }
        ]
      },
      {
        id: "jobava-bb4-ne4-pawn-sac",
        name: "Vs ...Bb4 and ...Ne4: Give the Pawn",
        section: "Traps",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "d7d5", san: "...d5" },
          { uci: "b1c3", san: "Nc3" },
          { uci: "g8f6", san: "...Nf6" },
          { uci: "c1f4", san: "Bf4" },
          { uci: "e7e6", san: "...e6" },
          { uci: "e2e3", san: "e3" },
          { uci: "f8b4", san: "...Bb4" }
        ],
        dueLevel: "new",
        moves: [
          {
            uci: "g1f3",
            san: "Nf3",
            prompt: "Black pins with ...Bb4. What calm move develops and invites Black to overextend?",
            explanation: "Nf3 keeps development moving. In many Jobava structures, ...Ne4 is not as scary as it looks.",
            plan: "If Black jumps in with ...Ne4, castle and give the c3 pawn for activity.",
            opponentReply: {
              uci: "f6e4",
              san: "...Ne4"
            }
          },
          {
            uci: "e1g1",
            san: "O-O",
            prompt: "Black jumps to e4. What is the key response before allowing captures on c3?",
            explanation: "Castling removes tactical problems on the e-file and lets White sacrifice the c3 pawn for a lead in activity.",
            plan: "After ...Nxc3 and ...Bxc3, use bxc3 and Rb1 to seize the b-file.",
            opponentReply: {
              uci: "e4c3",
              san: "...Nxc3"
            }
          },
          {
            uci: "b2c3",
            san: "bxc3",
            prompt: "Black takes on c3. Which recapture opens useful files?",
            explanation: "bxc3 opens the b-file and gives White dynamic compensation. The damaged pawns are less important than piece activity.",
            plan: "If Black grabs another pawn, Rb1 will make the bishop and queenside targets uncomfortable.",
            opponentReply: {
              uci: "b4c3",
              san: "...Bxc3"
            }
          },
          {
            uci: "a1b1",
            san: "Rb1",
            prompt: "Black grabs the second pawn. Which rook move shows White's compensation?",
            explanation: "Rb1 takes over the open file and attacks Black's queenside. White has active pieces and clear targets.",
            plan: "Follow with Qd3, Ne5, and pressure on b7. This is practical compensation, not blind sacrifice."
          }
        ]
      }
    ]
  },
  {
    id: "london-system",
    name: "London System Starter",
    repertoire: "white",
    level: "Beginner friendly",
    description: "A simple setup-based course for getting playable middlegames without memorizing a giant tree.",
    lines: [
      {
        id: "london-main-setup",
        name: "Main Setup vs ...d5",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "d7d5", san: "...d5" }
        ],
        dueLevel: "due",
        moves: [
          {
            uci: "c1f4",
            san: "Bf4",
            prompt: "Black answered 1.d4 with ...d5. What is the clean London developing move?",
            explanation: "Bf4 develops the dark-squared bishop before e3 closes it in. This keeps White's setup simple and active.",
            plan: "Build the triangle with e3 and c3, develop Nf3 and Bd3, then castle. Aim for a calm attack if Black castles short.",
            commonMistake: "A common mistake here is playing e3 first and burying the bishop, which turns a smooth London into a cramped setup.",
            opponentReply: {
              uci: "g8f6",
              san: "...Nf6"
            }
          },
          {
            uci: "e2e3",
            san: "e3",
            prompt: "Black develops naturally. Which move supports d4 and prepares smooth development?",
            explanation: "e3 reinforces the center and opens the diagonal for the f1 bishop without creating early weaknesses.",
            plan: "Finish development first. The usual setup is Nf3, Bd3, c3, Nbd2, and castling before any pawn storm.",
            opponentReply: {
              uci: "e7e6",
              san: "...e6"
            }
          },
          {
            uci: "g1f3",
            san: "Nf3",
            prompt: "Your center is stable. What simple developing move keeps the London setup flexible?",
            explanation: "Nf3 develops a piece, supports e5 control, and gets White closer to castling without forcing a pawn decision.",
            plan: "Next you can play Bd3 and c3, then castle. Do not start wing attacks before your pieces are ready.",
            commonMistake: "A common mistake here is starting a London kingside plan before the kingside knight is even developed.",
            opponentReply: {
              uci: "f8d6",
              san: "...Bd6"
            }
          },
          {
            uci: "f1d3",
            san: "Bd3",
            prompt: "Black mirrors development and eyes your bishop. What natural move finishes your kingside development?",
            explanation: "Bd3 develops the last minor piece toward the kingside and supports the classic London attacking pattern.",
            plan: "If Black trades bishops, recapture calmly. Your priority is castling, c3, and keeping the position easy to play.",
            opponentReply: {
              uci: "e8g8",
              san: "...O-O"
            }
          },
          {
            uci: "e1g1",
            san: "O-O",
            prompt: "Black castles. What should White do before starting any attack?",
            explanation: "Castling keeps your king safe and connects the rook. This is the practical club-player habit: finish safety first.",
            plan: "After castling, add c3 and Nbd2. Only then think about Ne5, Qf3, or a kingside pawn push.",
            opponentReply: {
              uci: "b8d7",
              san: "...Nbd7"
            }
          },
          {
            uci: "c2c3",
            san: "c3",
            prompt: "Both sides are developed. Which London structure move reinforces d4 and prepares a stable middlegame?",
            explanation: "c3 builds the London triangle and makes d4 harder to undermine. It also gives White a clear setup against many black plans.",
            plan: "A simple next plan is Nbd2, Re1, and e4 if Black gives you time. If Black plays ...c5, be ready to meet tension calmly."
          }
        ]
      },
      {
        id: "london-knight-before-c3",
        name: "Avoid Blocking the Knight",
        section: "Sidelines",
        fen: startingFen,
        sideToTrain: "white",
        prelude: [
          { uci: "d2d4", san: "d4" },
          { uci: "d7d5", san: "...d5" },
          { uci: "c1f4", san: "Bf4" },
          { uci: "g8f6", san: "...Nf6" }
        ],
        dueLevel: "new",
        moves: [
          {
            uci: "g1f3",
            san: "Nf3",
            prompt: "Black develops naturally. What should White develop before locking in the c-pawn setup?",
            explanation: "Nf3 fights for e5 and keeps the London structure flexible. Beginners often rush c3, but development comes first.",
            plan: "After Nf3, play e3, Bd3, and castle. If Black plays ...c5, be ready to support d4 or capture at the right moment.",
            commonMistake: "A common mistake here is rushing c3 too early and leaving the kingside knight undeveloped, which makes the London slower and clumsier.",
            opponentReply: {
              uci: "c7c5",
              san: "...c5"
            }
          },
          {
            uci: "e2e3",
            san: "e3",
            prompt: "Black hits the center with ...c5. What calm London move keeps the structure sound?",
            explanation: "e3 keeps d4 defended and prepares quick development. You do not need to solve the whole center immediately.",
            plan: "Develop Bd3 and castle. If Black captures on d4 later, recapture with the e-pawn or c-pawn based on piece activity.",
            opponentReply: {
              uci: "b8c6",
              san: "...Nc6"
            }
          },
          {
            uci: "b1d2",
            san: "Nbd2",
            prompt: "Black adds pressure to d4. Which knight move reinforces the center without blocking your c-pawn?",
            explanation: "Nbd2 supports e4 and f3 ideas while keeping the London shape intact. It is quiet but very useful.",
            plan: "Next develop Bd3 and castle. If Black takes on d4, recapture in the way that keeps your pieces active.",
            opponentReply: {
              uci: "c5d4",
              san: "...cxd4"
            }
          },
          {
            uci: "e3d4",
            san: "exd4",
            prompt: "Black captures on d4. Which recapture keeps White's pieces coordinated?",
            explanation: "exd4 keeps the c-pawn available and opens the e-file for a rook later. The structure is simple and playable.",
            plan: "Develop Bd3, castle, and watch for Ne5 ideas. You are not trying to refute Black, just get a familiar middlegame.",
            opponentReply: {
              uci: "f8d6",
              san: "...Bd6"
            }
          },
          {
            uci: "f1d3",
            san: "Bd3",
            prompt: "Black develops actively. What move keeps your development smooth and points at the kingside?",
            explanation: "Bd3 is the natural London square. It contests the diagonal and helps White build pressure around h7.",
            plan: "Castle next. If Black trades bishops, recapture and continue with Re1 or c3 depending on the center."
          }
        ]
      }
    ]
  },
  {
    id: "caro-kann",
    name: "Caro-Kann Basics",
    repertoire: "black",
    level: "800-1600",
    description: "Practical Caro-Kann lines focused on structure, development, and surviving common club-player attacks.",
    lines: [
      {
        id: "caro-advance-response",
        name: "Advance Variation First Step",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "due",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "White opens with 1.e4. What move begins the Caro-Kann?",
            explanation: "...c6 prepares ...d5 and gives Black a sturdy, practical center without committing the king pawn.",
            plan: "Think structure first: ...c6, ...d5, then develop the light-squared bishop before ...e6.",
            commonMistake: "A common mistake here is treating ...c6 like a waiting move. The whole point is to follow it with an immediate challenge to the center.",
            opponentReply: {
              uci: "e4e5",
              san: "e5"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White grabs space with e5. How should Black challenge the center?",
            explanation: "...d5 is the backbone of the Caro-Kann. Black accepts a little less space but attacks White's center immediately.",
            plan: "Develop Bf5 or Bg4 before e6 when possible, play e6 and c5 later, and target the advanced e5 pawn.",
            commonMistake: "A common mistake here is playing ...e6 first and accepting a cramped French-style position when the Caro is supposed to challenge the center right away.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "c8f5",
            san: "...Bf5",
            prompt: "White supports the advanced pawn. Which bishop move solves Black's biggest opening problem?",
            explanation: "...Bf5 develops the light-squared bishop before ...e6 closes it in. This is one of the main practical ideas of the Caro-Kann.",
            plan: "After ...e6, develop ...Nd7 and ...c5. Trade the cramped feeling for a solid structure and pressure on d4/e5.",
            commonMistake: "A common mistake here is leaving the bishop at home and playing ...e6 too soon, which throws away one of the Caro-Kann's biggest practical advantages.",
            annotations: {
              arrows: [{ from: "c8", to: "f5", color: "green" }],
              circles: [
                { square: "d4", color: "yellow" },
                { square: "e5", color: "yellow" }
              ]
            },
            opponentReply: {
              uci: "g1f3",
              san: "Nf3"
            }
          },
          {
            uci: "e7e6",
            san: "...e6",
            prompt: "Your bishop is outside the pawn chain. What move now builds the solid Caro-Kann structure?",
            explanation: "...e6 supports d5 and prepares normal development. The key is that the bishop is already active.",
            plan: "Develop ...Nd7 and look for ...c5. Your main target is White's d4/e5 pawn chain.",
            opponentReply: {
              uci: "f1e2",
              san: "Be2"
            }
          },
          {
            uci: "b8d7",
            san: "...Nd7",
            prompt: "White develops quietly. Which knight move supports ...c5 and keeps the position sturdy?",
            explanation: "...Nd7 reinforces f6 and c5 ideas without allowing White to gain time attacking the knight.",
            plan: "Castle kingside when ready, then challenge the center with ...c5. Do not rush pawn breaks before development.",
            opponentReply: {
              uci: "e1g1",
              san: "O-O"
            }
          },
          {
            uci: "g8e7",
            san: "...Ne7",
            prompt: "White castles. How can Black develop the kingside knight without blocking the c-pawn break?",
            explanation: "...Ne7 supports f5/c8-g4 ideas and keeps Black flexible. It is a simple development move for club games.",
            plan: "Castle next and prepare ...c5. If White plays c3, keep pressure on d4 and look for trades that reduce White's space."
          }
        ]
      },
      {
        id: "caro-classical-develop",
        name: "Classical Development",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "steady",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "White opens with 1.e4. What first move gets you into the Caro-Kann?",
            explanation: "...c6 supports the later ...d5 break and keeps Black's structure solid from the start.",
            plan: "Follow with ...d5 and challenge White's center before it gets too comfortable.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White builds a big pawn center. What is Black's principled Caro-Kann strike?",
            explanation: "...d5 challenges White before the center becomes too comfortable. This is simple, sturdy, and easy to remember.",
            plan: "If White advances e5, develop the light bishop outside the pawn chain. If White captures, recapture and develop naturally.",
            opponentReply: {
              uci: "e4e5",
              san: "e5"
            }
          },
          {
            uci: "c8f5",
            san: "...Bf5",
            prompt: "White advances. What development habit should Black remember before playing ...e6?",
            explanation: "...Bf5 gets the bishop active outside the pawn chain. This one idea prevents many cramped beginner Caro-Kann positions.",
            plan: "Then play ...e6, ...c5, and ...Nc6 or ...Nd7. Your goal is to chip away at White's space, not win instantly.",
            opponentReply: {
              uci: "g1f3",
              san: "Nf3"
            }
          },
          {
            uci: "e7e6",
            san: "...e6",
            prompt: "The bishop is active and White develops. What solid move supports d5 and opens Black's kingside development?",
            explanation: "...e6 locks in the center and prepares ...Nd7 and ...c5. It is the practical Caro-Kann skeleton.",
            plan: "Keep the structure compact. Your breaks are ...c5 and sometimes ...f6, but only after your pieces are ready.",
            commonMistake: "A common mistake here is rushing a pawn break before Black has finished the simple Caro structure.",
            opponentReply: {
              uci: "f1d3",
              san: "Bd3"
            }
          },
          {
            uci: "f8d3",
            san: "...Bxd3",
            prompt: "White challenges your active bishop. What simple trade removes White's attacking piece?",
            explanation: "...Bxd3 trades before White can build pressure on h7. For beginners, reducing attacking pieces is often the practical choice.",
            plan: "After White recaptures, develop ...Nd7 and ...Ne7, then strike with ...c5 when ready.",
            opponentReply: {
              uci: "d1d3",
              san: "Qxd3"
            }
          },
          {
            uci: "b8d7",
            san: "...Nd7",
            prompt: "White recaptures with the queen. Which developing move supports the center and prepares counterplay?",
            explanation: "...Nd7 protects key squares and supports ...c5. Black does not need tactics; Black needs a clean setup.",
            plan: "Follow with ...Ne7 and ...c5. Your dream is to make White's space less comfortable."
          }
        ]
      },
      {
        id: "caro-exchange-simple-development",
        name: "Exchange: Simple Development",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "new",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "What move starts the Caro-Kann against 1.e4?",
            explanation: "...c6 prepares ...d5 and invites White into Caro-Kann structures.",
            plan: "Meet 2.d4 with ...d5, then recapture cleanly if White exchanges.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White builds the center. How should Black strike?",
            explanation: "...d5 is the principled Caro-Kann response, challenging the center immediately.",
            plan: "If White exchanges, recapture with the c-pawn and develop smoothly.",
            opponentReply: {
              uci: "e4d5",
              san: "exd5"
            }
          },
          {
            uci: "c6d5",
            san: "...cxd5",
            prompt: "White exchanges in the center. Which recapture keeps Black's Caro structure healthy?",
            explanation: "...cxd5 restores the center and gives Black a clear, easy structure.",
            plan: "Now develop pieces and keep steady pressure on d4.",
            opponentReply: {
              uci: "g1f3",
              san: "Nf3"
            }
          },
          {
            uci: "b8c6",
            san: "...Nc6",
            prompt: "White enters the Exchange Caro-Kann with Nf3. What should Black develop first?",
            explanation: "...Nc6 hits d4 and develops before committing the bishops. In the Exchange, Black should keep steady pressure on White's center.",
            plan: "Develop both knights, then bring the light-squared bishop out before locking the structure.",
            commonMistake: "A common mistake here is drifting with quiet pawn moves when the Exchange calls for simple, active piece development and pressure on d4.",
            opponentReply: {
              uci: "f1e2",
              san: "Be2"
            }
          },
          {
            uci: "g8f6",
            san: "...Nf6",
            prompt: "White develops quietly. Which knight move keeps Black's setup simple?",
            explanation: "...Nf6 adds pressure and prepares smooth development. This is the practical Caro habit: pieces first, no drama.",
            plan: "If White plays Nc3, develop the bishop actively to f5.",
            commonMistake: "A common mistake here is trying to force tactics in the Exchange instead of just developing both knights and squeezing the center.",
            opponentReply: {
              uci: "b1c3",
              san: "Nc3"
            }
          },
          {
            uci: "c8f5",
            san: "...Bf5",
            prompt: "White develops Nc3. Where should Black's light-squared bishop go?",
            explanation: "...Bf5 is active because White's bishop is already on e2. Black solves the usual Caro-Kann bishop problem.",
            plan: "Follow with ...e6, ...Be7, and castle. Later look for queenside play with ...a6 and ...b5.",
            opponentReply: {
              uci: "e1g1",
              san: "O-O"
            }
          },
          {
            uci: "e7e6",
            san: "...e6",
            prompt: "White castles. Which move builds the solid Caro-Kann center?",
            explanation: "...e6 supports d5 and opens the f8 bishop. The key is that the c8 bishop is already developed.",
            plan: "Develop ...Be7 and castle. Black's game is equal, simple, and easy to improve."
          }
        ]
      },
      {
        id: "caro-exchange-bd3-bf4-tactic",
        name: "Exchange: Punish Bd3 and Bf4",
        section: "Traps",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "due",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "What first move starts the Caro-Kann?",
            explanation: "...c6 prepares ...d5 and keeps the structure controlled.",
            plan: "Develop with purpose, then notice when Exchange tactics appear.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White builds the center. How should Black challenge it?",
            explanation: "...d5 is the Caro-Kann backbone and leads to the Exchange if White captures.",
            plan: "Recapture with the c-pawn and keep the pieces active.",
            opponentReply: {
              uci: "e4d5",
              san: "exd5"
            }
          },
          {
            uci: "c6d5",
            san: "...cxd5",
            prompt: "White exchanges. Which recapture keeps Black's structure ideal?",
            explanation: "...cxd5 gives Black a healthy center and clear development squares.",
            plan: "If White develops Bd3 and Bf4 carelessly, tactical pressure can appear on d4.",
            opponentReply: {
              uci: "f1d3",
              san: "Bd3"
            }
          },
          {
            uci: "b8c6",
            san: "...Nc6",
            prompt: "White puts the bishop on d3 in the Exchange. What central developing move comes first?",
            explanation: "...Nc6 increases pressure on d4 and keeps Black flexible. The d3 bishop changes which bishop square Black should use later.",
            plan: "Develop ...Nf6. If White plays Nc3 and Bf4 too casually, ...Bg4 and ...Nxd4 can win material.",
            opponentReply: {
              uci: "b1c3",
              san: "Nc3"
            }
          },
          {
            uci: "g8f6",
            san: "...Nf6",
            prompt: "White develops Nc3. Which knight move prepares the tactical idea?",
            explanation: "...Nf6 develops and supports ...Bg4. Black should notice when White's d4 pawn becomes tactically loose.",
            plan: "Pin with ...Bg4 if White allows it.",
            commonMistake: "A common mistake here is playing automatic bishop development and missing that the knight move is what sets up the whole tactic.",
            opponentReply: {
              uci: "c1f4",
              san: "Bf4"
            }
          },
          {
            uci: "c8g4",
            san: "...Bg4",
            prompt: "White plays Bf4. Which bishop move creates pressure on the knight?",
            explanation: "...Bg4 pins the f3 knight. In this exact structure, White's Bf4 has left d4 vulnerable.",
            plan: "If White does not solve the pressure, ...Nxd4 can win a pawn cleanly.",
            opponentReply: {
              uci: "f1e2",
              san: "Be2"
            }
          },
          {
            uci: "f6d4",
            san: "...Nxd4",
            prompt: "White blocks the pin with Be2. What tactical capture wins material?",
            explanation: "...Nxd4 works because Black's pieces are coordinated and White's d4 pawn is overloaded.",
            plan: "After Be2, trade on f3 and keep the extra pawn with a simple position.",
            opponentReply: {
              uci: "e2f3",
              san: "Bxf3"
            }
          },
          {
            uci: "d4f3",
            san: "...Nxf3+",
            prompt: "White recaptures on f3. How does Black finish the sequence?",
            explanation: "...Nxf3+ removes the defender and leaves Black a clean pawn up with easy development.",
            plan: "Continue with ...e6, ...Be7 or ...Bc5, and castle. Do not rush; convert the better structure."
          }
        ]
      },
      {
        id: "caro-exchange-c3-solid",
        name: "Exchange: c3 Solid Setup",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "new",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "What is Black's first Caro-Kann move against 1.e4?",
            explanation: "...c6 prepares ...d5 and keeps Black's structure dependable.",
            plan: "Challenge the center, then recapture cleanly if White exchanges.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White builds the center. How should Black react?",
            explanation: "...d5 immediately questions White's center in standard Caro-Kann fashion.",
            plan: "If White exchanges, recapture with the c-pawn and keep development simple.",
            opponentReply: {
              uci: "e4d5",
              san: "exd5"
            }
          },
          {
            uci: "c6d5",
            san: "...cxd5",
            prompt: "White exchanges in the center. Which recapture gives Black the right structure?",
            explanation: "...cxd5 keeps Black's pawn structure sound and preserves a healthy central presence.",
            plan: "Now react to White's setup, not to ghosts.",
            opponentReply: {
              uci: "c2c3",
              san: "c3"
            }
          },
          {
            uci: "g8f6",
            san: "...Nf6",
            prompt: "White supports d4 with c3. What is Black's clean developing move?",
            explanation: "...Nf6 develops and keeps control of e4 and g4. Black does not need to force anything.",
            plan: "Develop ...Bg4, ...e6, and often trade bishops to simplify.",
            commonMistake: "A common mistake here is overreacting to White's solid setup instead of just developing naturally and aiming for an easy equal game.",
            opponentReply: {
              uci: "f1d3",
              san: "Bd3"
            }
          },
          {
            uci: "c8g4",
            san: "...Bg4",
            prompt: "White plays Bd3. Which bishop move develops actively?",
            explanation: "...Bg4 pins the knight and avoids getting boxed in. This gives Black a comfortable Exchange setup.",
            plan: "If White plays Bf4, answer with ...e6 and ...Bd6 to challenge the bishop.",
            opponentReply: {
              uci: "c1f4",
              san: "Bf4"
            }
          },
          {
            uci: "e7e6",
            san: "...e6",
            prompt: "White develops Bf4. Which move supports d5 and prepares bishop development?",
            explanation: "...e6 keeps the d5 pawn secure. In the Exchange, never casually allow d4-d5 breaks.",
            plan: "Develop ...Bd6 and offer bishop trades. Simplification is good for Black here.",
            opponentReply: {
              uci: "e1g1",
              san: "O-O"
            }
          },
          {
            uci: "f8d6",
            san: "...Bd6",
            prompt: "White castles. How should Black challenge the active bishop?",
            explanation: "...Bd6 contests White's bishop and moves Black closer to castling. The position is equal but easy to play.",
            plan: "Trade if offered, castle, and keep d5 protected."
          }
        ]
      },
      {
        id: "caro-exchange-h3-fianchetto",
        name: "Exchange h3: Fianchetto Solution",
        section: "Sidelines",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "new",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "What move starts the Caro-Kann against 1.e4?",
            explanation: "...c6 prepares the standard ...d5 break and a solid structure.",
            plan: "Build the Caro shell first, then adapt to White's setup.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White builds the center. How should Black challenge it?",
            explanation: "...d5 is the central Caro-Kann strike.",
            plan: "If White exchanges, recapture and develop naturally.",
            opponentReply: {
              uci: "e4d5",
              san: "exd5"
            }
          },
          {
            uci: "c6d5",
            san: "...cxd5",
            prompt: "White exchanges. Which recapture keeps Black's structure healthy?",
            explanation: "...cxd5 restores the center and leaves Black with a clear plan.",
            plan: "Develop first, then solve the bishop issue based on White's setup.",
            opponentReply: {
              uci: "f1d3",
              san: "Bd3"
            }
          },
          {
            uci: "b8c6",
            san: "...Nc6",
            prompt: "White develops the bishop. What active piece move fits the Exchange setup?",
            explanation: "...Nc6 develops and adds pressure to d4 before committing the bishops.",
            plan: "If White uses h3, the fianchetto plan becomes practical.",
            opponentReply: {
              uci: "h2h3",
              san: "h3"
            }
          },
          {
            uci: "g8f6",
            san: "...Nf6",
            prompt: "White includes h3. Which knight move keeps Black flexible?",
            explanation: "...Nf6 develops naturally and prepares to choose the bishop plan based on White's setup.",
            plan: "If White has discouraged ...Bg4, a kingside fianchetto is often the clean answer.",
            opponentReply: {
              uci: "g1f3",
              san: "Nf3"
            }
          },
          {
            uci: "g7g6",
            san: "...g6",
            prompt: "White uses h3 to restrict your light-squared bishop. What is Black's practical solution?",
            explanation: "...g6 changes the plan. Black develops the dark-squared bishop and creates a path for ...Bf5 later.",
            plan: "Fianchetto, then develop the light-squared bishop to f5 when the moment is right.",
            commonMistake: "A common mistake here is stubbornly forcing the bishop to g4 ideas even after White has already made that awkward.",
            opponentReply: {
              uci: "g1f3",
              san: "Nf3"
            }
          },
          {
            uci: "f8g7",
            san: "...Bg7",
            prompt: "White develops Nf3. Where does the dark-squared bishop belong?",
            explanation: "...Bg7 completes the fianchetto and puts pressure on the long diagonal.",
            plan: "If White castles, solve the light-squared bishop with ...Bf5.",
            opponentReply: {
              uci: "e1g1",
              san: "O-O"
            }
          },
          {
            uci: "c8f5",
            san: "...Bf5",
            prompt: "White castles. Which move solves Black's bishop problem?",
            explanation: "...Bf5 gets the bishop outside the pawn chain. If White trades, Black recaptures with the g-pawn and gains e4 control.",
            plan: "After Bxf5, recapture ...gxf5 and use the f5/d5 pawns to support a future knight on e4.",
            opponentReply: {
              uci: "d3f5",
              san: "Bxf5"
            }
          },
          {
            uci: "g6f5",
            san: "...gxf5",
            prompt: "White trades on f5. Which recapture gives Black a strong central grip?",
            explanation: "...gxf5 looks ugly at first, but it controls e4 and gives Black clear piece squares.",
            plan: "Castle, play ...e6 and ...Ne7-g6-e4. The e4 square is the long-term prize."
          }
        ]
      },
      {
        id: "caro-panov-main-endgame",
        name: "Panov: Main Endgame Line",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "new",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "What move starts the Caro-Kann against 1.e4?",
            explanation: "...c6 prepares the central ...d5 break and leads into the Panov if White chooses it.",
            plan: "Meet White's center directly and then develop quickly.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White builds the center. How should Black challenge it?",
            explanation: "...d5 is the standard Caro-Kann central strike.",
            plan: "If White exchanges and then plays c4, the Panov begins.",
            opponentReply: {
              uci: "e4d5",
              san: "exd5"
            }
          },
          {
            uci: "c6d5",
            san: "...cxd5",
            prompt: "White exchanges. Which recapture keeps Black's structure correct?",
            explanation: "...cxd5 restores the center and allows Black to meet the Panov setup with normal development.",
            plan: "Develop fast and keep pressure on d4.",
            opponentReply: {
              uci: "c2c4",
              san: "c4"
            }
          },
          {
            uci: "g8f6",
            san: "...Nf6",
            prompt: "White plays the Panov with c4. What is Black's most natural developing move?",
            explanation: "...Nf6 develops and attacks the center. The Panov is sharper, so Black should develop quickly.",
            plan: "Add ...Nc6 and ...Bg4. Black often reaches a solid endgame if White grabs pawns.",
            commonMistake: "A common mistake here is grabbing a pawn or drifting with slow moves when the Panov punishes undeveloped positions.",
            opponentReply: {
              uci: "b1c3",
              san: "Nc3"
            }
          },
          {
            uci: "b8c6",
            san: "...Nc6",
            prompt: "White develops Nc3. Which move increases central pressure?",
            explanation: "...Nc6 attacks d4 and supports the standard Panov setup.",
            plan: "If Nf3, pin with ...Bg4.",
            opponentReply: {
              uci: "g1f3",
              san: "Nf3"
            }
          },
          {
            uci: "c8g4",
            san: "...Bg4",
            prompt: "White develops Nf3. Which bishop move increases pressure on the center?",
            explanation: "...Bg4 pins the knight and prepares to trade on f3 in many main lines.",
            plan: "If cxd5, recapture with the knight and be ready for Bxf3.",
            opponentReply: {
              uci: "c4d5",
              san: "cxd5"
            }
          },
          {
            uci: "f6d5",
            san: "...Nxd5",
            prompt: "White captures on d5. How should Black recapture?",
            explanation: "...Nxd5 keeps piece activity and central control. This is the main Panov structure.",
            plan: "If Qb3 attacks b7 and d5, trade on f3 and play ...e6.",
            opponentReply: {
              uci: "d1b3",
              san: "Qb3"
            }
          },
          {
            uci: "g4f3",
            san: "...Bxf3",
            prompt: "White attacks b7 and d5 with Qb3. What trade reduces the pressure?",
            explanation: "...Bxf3 removes a defender and simplifies. Black is willing to enter a stable endgame.",
            plan: "After gxf3, play ...e6 and meet Qxb7 with active central play.",
            opponentReply: {
              uci: "g2f3",
              san: "gxf3"
            }
          },
          {
            uci: "e7e6",
            san: "...e6",
            prompt: "White recaptures with the g-pawn. What move supports the center?",
            explanation: "...e6 reinforces d5 and prepares development. Black's position is solid even if the queens come off.",
            plan: "The endgame is usually hard for Black to lose: develop, activate the king later, and pressure White's pawns."
          }
        ]
      },
      {
        id: "caro-panov-bg5-active",
        name: "Panov Bg5: Active ...dxc4",
        section: "Sidelines",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "new",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "What first move starts the Caro-Kann against 1.e4?",
            explanation: "...c6 prepares the later ...d5 strike and keeps Black's structure sturdy.",
            plan: "Challenge the center and develop quickly if White chooses the Panov.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White builds the center. How should Black strike back?",
            explanation: "...d5 is the principled Caro response and invites Panov structures if White exchanges.",
            plan: "Recapture and keep development active.",
            opponentReply: {
              uci: "e4d5",
              san: "exd5"
            }
          },
          {
            uci: "c6d5",
            san: "...cxd5",
            prompt: "White exchanges. Which recapture keeps Black's structure healthy?",
            explanation: "...cxd5 restores the center and prepares normal Panov development.",
            plan: "If White plays c4, develop toward pressure on d4.",
            opponentReply: {
              uci: "c2c4",
              san: "c4"
            }
          },
          {
            uci: "g8f6",
            san: "...Nf6",
            prompt: "White chooses the Panov. What natural developing move comes first?",
            explanation: "...Nf6 develops and hits the center right away.",
            plan: "Add ...Nc6 and then react to White's bishop move.",
            opponentReply: {
              uci: "b1c3",
              san: "Nc3"
            }
          },
          {
            uci: "b8c6",
            san: "...Nc6",
            prompt: "White develops Nc3. Which move increases central pressure?",
            explanation: "...Nc6 is standard Panov development and keeps pressure on d4.",
            plan: "If White pins with Bg5, take active measures.",
            opponentReply: {
              uci: "c1g5",
              san: "Bg5"
            }
          },
          {
            uci: "d5c4",
            san: "...dxc4",
            prompt: "In the Panov, White pins with Bg5. What active capture starts Black's line?",
            explanation: "...dxc4 accepts the tension and asks White to prove compensation. Black gets active piece play.",
            plan: "After Bxc4, play ...h6 and be ready to trade queens.",
            commonMistake: "A common mistake here is playing passively against the pin instead of taking on c4 and forcing White to justify the Panov activity.",
            opponentReply: {
              uci: "f1c4",
              san: "Bxc4"
            }
          },
          {
            uci: "h7h6",
            san: "...h6",
            prompt: "White recaptures on c4. Which move questions the bishop?",
            explanation: "...h6 gains time and makes White decide where the bishop belongs.",
            plan: "If Bh4, Black can take on d4 and simplify.",
            opponentReply: {
              uci: "g5h4",
              san: "Bh4"
            }
          },
          {
            uci: "d8d4",
            san: "...Qxd4",
            prompt: "White retreats to h4. What central capture simplifies the position?",
            explanation: "...Qxd4 trades into an active queenless position. Black is not trying to mate; Black is neutralizing the Panov.",
            plan: "After Qxd4 Nxd4, use ...e5 and piece activity.",
            opponentReply: {
              uci: "d1d4",
              san: "Qxd4"
            }
          },
          {
            uci: "c6d4",
            san: "...Nxd4",
            prompt: "White trades queens. Which knight recapture keeps Black active?",
            explanation: "...Nxd4 centralizes the knight. Black's pieces are active and the structure is playable.",
            plan: "If White castles long, strike with ...e5.",
            opponentReply: {
              uci: "e1c1",
              san: "O-O-O"
            }
          },
          {
            uci: "e7e5",
            san: "...e5",
            prompt: "White castles long. Which central move challenges White immediately?",
            explanation: "...e5 fights for space and keeps the Panov from becoming a comfortable attacking setup for White.",
            plan: "Develop actively and use the open files. This line is sharp but practical."
          }
        ]
      },
      {
        id: "caro-advance-h4-queen-trade",
        name: "Advance h4: Queen Trade Plan",
        section: "Traps",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "due",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "What move starts the Caro-Kann against 1.e4?",
            explanation: "...c6 prepares ...d5 and keeps Black's center structure sound.",
            plan: "Challenge the center, then react practically to White's Tal-style h-pawn ideas.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White builds the center. How should Black challenge it?",
            explanation: "...d5 is the standard Caro-Kann strike against White's center.",
            plan: "If White advances, get the light-squared bishop out before ...e6.",
            opponentReply: {
              uci: "e4e5",
              san: "e5"
            }
          },
          {
            uci: "c8f5",
            san: "...Bf5",
            prompt: "White advances. Which bishop move solves Black's opening problem?",
            explanation: "...Bf5 develops the bishop outside the pawn chain before the center gets locked.",
            plan: "If White tries h4, use ...h5 and trade queens when possible.",
            opponentReply: {
              uci: "h2h4",
              san: "h4"
            }
          },
          {
            uci: "h7h5",
            san: "...h5",
            prompt: "White plays the Tal-style h4 against your Advance Caro. How do you save the bishop?",
            explanation: "...h5 gives the bishop a retreat square and stops g4 from trapping it immediately.",
            plan: "Trade the bishop on d3 if allowed, then use ...Qa5+ and ...Qa6 to trade queens.",
            commonMistake: "A common mistake here is panicking about the h-pawn and retreating the bishop passively instead of using ...h5 to solve the problem cleanly.",
            opponentReply: {
              uci: "f1d3",
              san: "Bd3"
            }
          },
          {
            uci: "f5d3",
            san: "...Bxd3",
            prompt: "White develops Bd3. What trade removes an attacking piece?",
            explanation: "...Bxd3 trades off White's active bishop before it causes kingside pressure.",
            plan: "After Qxd3, check with ...Qa5+ to guide the game toward a better queenless position.",
            opponentReply: {
              uci: "d1d3",
              san: "Qxd3"
            }
          },
          {
            uci: "d8a5",
            san: "...Qa5+",
            prompt: "White recaptures with the queen. What check starts Black's practical plan?",
            explanation: "...Qa5+ gains time and prepares a queen trade. White's advanced h- and e-pawns can become targets later.",
            plan: "If Bd2, play ...Qa6 and offer the queen trade.",
            opponentReply: {
              uci: "c1d2",
              san: "Bd2"
            }
          },
          {
            uci: "a5a6",
            san: "...Qa6",
            prompt: "White blocks with Bd2. Which queen move offers the trade?",
            explanation: "...Qa6 asks White to enter an endgame where Black can attack the advanced pawns.",
            plan: "After Qxa6, recapture with the knight and continue ...e6, ...c5, and queenside pressure.",
            opponentReply: {
              uci: "d3a6",
              san: "Qxa6"
            }
          },
          {
            uci: "b8a6",
            san: "...Nxa6",
            prompt: "White accepts the queen trade. Which recapture keeps Black's structure healthy?",
            explanation: "...Nxa6 develops and removes queens. Black has a comfortable game against White's stretched pawns.",
            plan: "Play ...e6, ...c5, and use the queenside majority. Keep the position simple."
          }
        ]
      },
      {
        id: "caro-advance-nd2-nf5-c5",
        name: "Advance Nd2: Knight to f5 and ...c5",
        section: "Main Lines",
        fen: startingFen,
        sideToTrain: "black",
        prelude: [{ uci: "e2e4", san: "e4" }],
        dueLevel: "new",
        moves: [
          {
            uci: "c7c6",
            san: "...c6",
            prompt: "What move starts the Caro-Kann against 1.e4?",
            explanation: "...c6 prepares the standard ...d5 break and gives Black a sturdy opening shell.",
            plan: "Challenge the center, then develop the bishop before ...e6.",
            opponentReply: {
              uci: "d2d4",
              san: "d4"
            }
          },
          {
            uci: "d7d5",
            san: "...d5",
            prompt: "White builds the center. How should Black challenge it?",
            explanation: "...d5 is the principled Caro-Kann response.",
            plan: "If White advances, get the bishop active first.",
            opponentReply: {
              uci: "e4e5",
              san: "e5"
            }
          },
          {
            uci: "c8f5",
            san: "...Bf5",
            prompt: "White advances. Which bishop move belongs in every healthy Caro-Kann?",
            explanation: "...Bf5 develops the bishop before the pawn chain closes.",
            plan: "Now react calmly to White's kingside space grab.",
            opponentReply: {
              uci: "h2h4",
              san: "h4"
            }
          },
          {
            uci: "h7h5",
            san: "...h5",
            prompt: "White goes for the Tal-style h-pawn push. How does Black save the bishop?",
            explanation: "...h5 gives the bishop a retreat and stops g4 from trapping it immediately.",
            plan: "Use the queen and knight later to pressure White's advanced pawns.",
            opponentReply: {
              uci: "f1d3",
              san: "Bd3"
            }
          },
          {
            uci: "f5d3",
            san: "...Bxd3",
            prompt: "White develops the bishop. What trade makes Black's life easier?",
            explanation: "...Bxd3 trades an attacking piece and leaves White with advanced pawns to defend.",
            plan: "After the queen recaptures, use a queen check to steer the game into a practical setup.",
            opponentReply: {
              uci: "d1d3",
              san: "Qxd3"
            }
          },
          {
            uci: "d8a5",
            san: "...Qa5+",
            prompt: "White recaptures with the queen. Which check gains time and sets up the next plan?",
            explanation: "...Qa5+ forces White to respond and gives Black time to coordinate against the center.",
            plan: "If White blocks with Nd2, build with ...e6 and the ...Nh6-f5 route.",
            opponentReply: {
              uci: "b1d2",
              san: "Nd2"
            }
          },
          {
            uci: "e7e6",
            san: "...e6",
            prompt: "White blocks the check with Nd2. How should Black build the center?",
            explanation: "...e6 supports d5 and prepares normal development. White's knight blocks the c1 bishop, so Black has time.",
            plan: "Develop the knight to h6-f5, where it attacks d4 and h4.",
            commonMistake: "A common mistake here is chasing White's kingside pawns too early instead of calmly finishing the central setup first.",
            opponentReply: {
              uci: "g1f3",
              san: "Nf3"
            }
          },
          {
            uci: "g8h6",
            san: "...Nh6",
            prompt: "White develops Nf3. Which knight route targets White's advanced pawns?",
            explanation: "...Nh6 heads to f5, a strong square that attacks h4 and d4.",
            plan: "Put the knight on f5, then develop ...Nd7, ...Be7, ...Rc8, and prepare ...c5.",
            opponentReply: {
              uci: "e1g1",
              san: "O-O"
            }
          },
          {
            uci: "h6f5",
            san: "...Nf5",
            prompt: "White castles. Where should the knight go?",
            explanation: "...Nf5 is the point of ...Nh6. The knight pressures h4 and d4 and is hard to chase effectively.",
            plan: "Complete development and aim for the central ...c5 break.",
            opponentReply: {
              uci: "d2b3",
              san: "Nb3"
            }
          },
          {
            uci: "b8d7",
            san: "...Nd7",
            prompt: "White reroutes the knight. Which developing move supports the center?",
            explanation: "...Nd7 supports c5 and keeps Black's pieces coordinated.",
            plan: "Develop ...Be7 and put a rook on c8 before breaking with ...c5.",
            opponentReply: {
              uci: "c1f4",
              san: "Bf4"
            }
          },
          {
            uci: "f8e7",
            san: "...Be7",
            prompt: "White develops Bf4. What quiet developing move prepares castling?",
            explanation: "...Be7 develops safely and asks White to justify the advanced kingside pawns.",
            plan: "After g3 or c3, use ...Rc8 and ...c5.",
            opponentReply: {
              uci: "g2g3",
              san: "g3"
            }
          },
          {
            uci: "a8c8",
            san: "...Rc8",
            prompt: "White supports the kingside. Which rook move prepares Black's main break?",
            explanation: "...Rc8 lines up on the c-file and supports ...c5. Black's earlier moves have all pointed at this break.",
            plan: "Play ...c5 when ready to undermine White's d4/e5 chain.",
            opponentReply: {
              uci: "c2c3",
              san: "c3"
            }
          },
          {
            uci: "c6c5",
            san: "...c5",
            prompt: "White reinforces d4 with c3. What is Black's thematic break?",
            explanation: "...c5 challenges White's center. In the Advance Caro, Black's long-term goal is to undermine d4 and e5.",
            plan: "Trade or increase pressure depending on White's response. The position is strategically healthy for Black."
          }
        ]
      }
    ]
  },
  {
    id: "beginner-endgames",
    name: "Beginner Endgames You Must Know",
    repertoire: "white",
    level: "Beginner-1600",
    description: "Essential checkmates, rook technique, opposition, and king-and-pawn fundamentals for club players.",
    lines: [
      {
        id: "endgame-staircase-mate",
        name: "Staircase Mate",
        section: "Technique",
        fen: "8/8/8/8/4k3/Q7/1Q6/4K3 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "b2b4",
            san: "Qbb4+",
            prompt: "Two queens can force mate by controlling ranks together. What is the first staircase check?",
            explanation: "Qbb4+ keeps both queens protected and cuts the black king off from the fourth rank.",
            plan: "Alternate queen checks so the king is pushed toward the edge without stalemate risk.",
            commonMistake: "A common mistake here is checking with the wrong queen and breaking the protected staircase pattern.",
            opponentReply: {
              uci: "e4d5",
              san: "...Kd5"
            }
          },
          {
            uci: "a3a5",
            san: "Qaa5+",
            prompt: "Black steps up the board. Which queen continues the staircase?",
            explanation: "Qaa5+ keeps the queens working together on adjacent ranks.",
            plan: "Keep checking with the rear queen and force the king toward the back rank.",
            opponentReply: {
              uci: "d5c6",
              san: "...Kc6"
            }
          },
          {
            uci: "b4b6",
            san: "Qbb6+",
            prompt: "The king keeps running. Which protected queen check comes next?",
            explanation: "Qbb6+ continues the same pattern. The queens protect each other, so the king cannot capture either one.",
            plan: "Do not change the method. Keep the staircase rhythm.",
            opponentReply: {
              uci: "c6d7",
              san: "...Kd7"
            }
          },
          {
            uci: "a5a7",
            san: "Qaa7+",
            prompt: "Black is nearly boxed in. Which queen pushes him to the final rank?",
            explanation: "Qaa7+ takes away the seventh rank and forces the king into the mating net.",
            plan: "One more protected queen check will finish the game.",
            opponentReply: {
              uci: "d7c8",
              san: "...Kc8"
            }
          },
          {
            uci: "b6b8",
            san: "Qbb8#",
            prompt: "The king is on the back rank. What is the mate?",
            explanation: "Qbb8# ends the staircase. The queens cover every escape square.",
            plan: "Remember the pattern: protected queen checks, one rank at a time."
          }
        ]
      },
      {
        id: "endgame-sideways-staircase",
        name: "Sideways Staircase Mate",
        section: "Technique",
        fen: "8/8/8/4k3/2Q5/3Q4/8/4K3 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "c4e4",
            san: "Qce4+",
            prompt: "The staircase can also work sideways. What is the first file-cutting check?",
            explanation: "Qce4+ begins pushing the king toward the side of the board instead of upward.",
            plan: "Use the same logic: two heavy pieces control adjacent files.",
            opponentReply: {
              uci: "e5f6",
              san: "...Kf6"
            }
          },
          {
            uci: "d3f3",
            san: "Qdf3+",
            prompt: "Black moves right. Which queen check keeps the sideways ladder going?",
            explanation: "Qdf3+ controls the next file and keeps the queens protected.",
            plan: "Keep alternating checks until the king reaches the edge.",
            opponentReply: {
              uci: "f6g5",
              san: "...Kg5"
            }
          },
          {
            uci: "e4g4",
            san: "Qeg4+",
            prompt: "The king is nearly trapped. Which check drives him to the corner?",
            explanation: "Qeg4+ cuts off the g-file and leaves Black with only the edge square.",
            plan: "Finish with the other queen once the king reaches h6.",
            opponentReply: {
              uci: "g5h6",
              san: "...Kh6"
            }
          },
          {
            uci: "f3h3",
            san: "Qfh3#",
            prompt: "Black reaches h6. What is the mate?",
            explanation: "Qfh3# covers the h-file and leaves the king with no escape.",
            plan: "Same staircase idea, just rotated sideways."
          }
        ]
      },
      {
        id: "endgame-staircase-rook",
        name: "Staircase Mate with Queen and Rook",
        section: "Technique",
        fen: "8/8/8/2k5/1R6/Q7/8/4K3 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "a3a5",
            san: "Qa5+",
            prompt: "With queen and rook, which piece starts the staircase safely?",
            explanation: "Qa5+ works because the rook is closer to the king and stays protected.",
            plan: "Keep the rook between the queen and the enemy king when possible.",
            opponentReply: {
              uci: "c5c6",
              san: "...Kc6"
            }
          },
          {
            uci: "b4b6",
            san: "Rb6+",
            prompt: "Black steps away. Which rook check continues the staircase?",
            explanation: "Rb6+ is protected by the queen and pushes the king toward the back rank.",
            plan: "Alternate queen and rook checks just like the two-queen staircase.",
            opponentReply: {
              uci: "c6d7",
              san: "...Kd7"
            }
          },
          {
            uci: "a5a7",
            san: "Qa7+",
            prompt: "Which queen check brings Black to the last rank?",
            explanation: "Qa7+ takes away the seventh rank and keeps the pattern clean.",
            plan: "The rook will deliver mate once the king is forced to c8.",
            opponentReply: {
              uci: "d7c8",
              san: "...Kc8"
            }
          },
          {
            uci: "b6b8",
            san: "Rb8#",
            prompt: "What is the final rook mate?",
            explanation: "Rb8# works because the queen protects the rook and covers the escape squares.",
            plan: "Queen and rook can staircase just like two queens, but piece order matters."
          }
        ]
      },
      {
        id: "endgame-ladder-mate",
        name: "Ladder Mate",
        section: "Technique",
        fen: "8/8/8/8/8/1k6/R7/2Q1K3 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "a2a3",
            san: "Ra3+",
            prompt: "Queen and rook are not set up for a staircase. What starts the ladder mate?",
            explanation: "Ra3+ begins the ladder by checking from far away and keeping the rook safe.",
            plan: "Alternate rook and queen checks while walking the king down the board.",
            opponentReply: {
              uci: "b3b4",
              san: "...Kb4"
            }
          },
          {
            uci: "c1c3",
            san: "Qc3+",
            prompt: "Black has only one move. Which queen check continues the ladder?",
            explanation: "Qc3+ keeps the king confined and sets up the next rook check.",
            plan: "The pieces climb in a ladder shape: rook, queen, rook, queen.",
            opponentReply: {
              uci: "b4b5",
              san: "...Kb5"
            }
          },
          {
            uci: "a3a5",
            san: "Ra5+",
            prompt: "Which rook check keeps the king boxed in?",
            explanation: "Ra5+ is important because the rook checks from distance and cannot be captured.",
            plan: "Avoid starting with the queen when it can be captured.",
            opponentReply: {
              uci: "b5b6",
              san: "...Kb6"
            }
          },
          {
            uci: "c3c5",
            san: "Qc5+",
            prompt: "What is the next queen check in the ladder?",
            explanation: "Qc5+ keeps the pattern moving and removes the king's safe squares.",
            plan: "Continue alternating until the king has no room.",
            opponentReply: {
              uci: "b6b7",
              san: "...Kb7"
            }
          },
          {
            uci: "a5a7",
            san: "Ra7+",
            prompt: "Which rook move gives the final forcing check?",
            explanation: "Ra7+ drives the king to b8 where the queen can finish.",
            plan: "The queen controls the final rank after the king is forced back.",
            opponentReply: {
              uci: "b7b8",
              san: "...Kb8"
            }
          },
          {
            uci: "c5c7",
            san: "Qc7#",
            prompt: "What is the ladder mate?",
            explanation: "Qc7# completes the ladder. The rook and queen cover every escape square.",
            plan: "Use this when your heavy pieces are staggered instead of lined up."
          }
        ]
      },
      {
        id: "endgame-two-rook-shuffle",
        name: "Two Rook Shuffle",
        section: "Technique",
        fen: "8/8/8/8/8/3k4/1R6/R3K3 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "a1a3",
            san: "Ra3+",
            prompt: "With two rooks, how do you start pushing the king?",
            explanation: "Ra3+ starts the staircase idea, but two rooks cannot protect each other diagonally like queens.",
            plan: "If the king attacks your setup, move a rook far away before checking again.",
            opponentReply: {
              uci: "d3c4",
              san: "...Kc4"
            }
          },
          {
            uci: "b2h2",
            san: "Rh2",
            prompt: "Black attacks your rook pattern. What quiet rook move keeps both rooks safe?",
            explanation: "Rh2 gives the rook distance. Rooks need space to check safely.",
            plan: "Do not check from too close if the king can capture you.",
            opponentReply: {
              uci: "c4b4",
              san: "...Kb4"
            }
          },
          {
            uci: "a3g3",
            san: "Rg3",
            prompt: "How do you reposition the other rook safely?",
            explanation: "Rg3 moves the rook away from the king and restores the staircase setup.",
            plan: "Once both rooks have room, resume checking rank by rank.",
            opponentReply: {
              uci: "b4c4",
              san: "...Kc4"
            }
          },
          {
            uci: "h2h4",
            san: "Rh4+",
            prompt: "Now that both rooks have space, what check resumes the mate?",
            explanation: "Rh4+ pushes the king while staying far enough away to avoid capture.",
            plan: "Keep checking from distance and alternate rooks.",
            opponentReply: {
              uci: "c4d5",
              san: "...Kd5"
            }
          },
          {
            uci: "g3g5",
            san: "Rg5+",
            prompt: "Which rook check keeps the king moving upward?",
            explanation: "Rg5+ continues the two-rook staircase after the shuffle.",
            plan: "If the king approaches, create space again before checking.",
            opponentReply: {
              uci: "d5e6",
              san: "...Ke6"
            }
          },
          {
            uci: "h4h6",
            san: "Rh6+",
            prompt: "Which rook check drives the king closer to mate?",
            explanation: "Rh6+ keeps control of the sixth rank while the other rook supports the pattern.",
            plan: "The final mate will look like a normal rook staircase once the king reaches the edge.",
            opponentReply: {
              uci: "e6f7",
              san: "...Kf7"
            }
          },
          {
            uci: "g5a5",
            san: "Ra5",
            prompt: "Why move the rook sideways instead of checking immediately?",
            explanation: "Ra5 gives the rook space for the next checks. Rooks work best from far away.",
            plan: "Make room first, then finish the staircase.",
            opponentReply: {
              uci: "f7g7",
              san: "...Kg7"
            }
          },
          {
            uci: "h6b6",
            san: "Rb6",
            prompt: "Which rook move resets the final mating net?",
            explanation: "Rb6 lines up the final staircase while keeping the rook safe.",
            plan: "The king is almost on the back rank; now checks finish.",
            opponentReply: {
              uci: "g7f7",
              san: "...Kf7"
            }
          },
          {
            uci: "a5a7",
            san: "Ra7+",
            prompt: "What check forces the king to the final rank?",
            explanation: "Ra7+ cuts off the seventh rank and forces Black to e8.",
            plan: "Finish with the other rook on b8.",
            opponentReply: {
              uci: "f7e8",
              san: "...Ke8"
            }
          },
          {
            uci: "b6b8",
            san: "Rb8#",
            prompt: "What is the two-rook mate?",
            explanation: "Rb8# completes the shuffle. The rooks cover the back rank and the king has no escape.",
            plan: "Main lesson: rooks need distance, then they can staircase."
          }
        ]
      },
      {
        id: "endgame-queen-box",
        name: "Queen Box Mate",
        section: "Technique",
        fen: "8/8/8/3k4/8/2Q5/4K3/8 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "c3b4",
            san: "Qb4",
            prompt: "With king and queen vs king, how do you start shrinking the box?",
            explanation: "Qb4 keeps the queen a knight's move away from the king and cuts down Black's space.",
            plan: "Shrink the box without checking too early. Avoid stalemate once the king is trapped.",
            commonMistake: "A common mistake here is giving random checks too soon instead of calmly shrinking the box first.",
            opponentReply: {
              uci: "d5c6",
              san: "...Kc6"
            }
          },
          {
            uci: "b4a5",
            san: "Qa5",
            prompt: "Black moves inside the box. Which queen move makes the box smaller?",
            explanation: "Qa5 cuts more squares while staying safe from the king.",
            plan: "Keep the queen a knight's move away when possible.",
            opponentReply: {
              uci: "c6b7",
              san: "...Kb7"
            }
          },
          {
            uci: "a5c5",
            san: "Qc5",
            prompt: "Which central queen move keeps reducing the king's space?",
            explanation: "Qc5 controls key files and ranks while avoiding stalemate.",
            plan: "Once the king is boxed near the edge, bring your king up.",
            opponentReply: {
              uci: "b7a6",
              san: "...Ka6"
            }
          },
          {
            uci: "c5b4",
            san: "Qb4",
            prompt: "Black goes to a6. Which queen move keeps the king boxed?",
            explanation: "Qb4 controls the fourth rank and b-file, pushing the king toward the corner.",
            plan: "Do not rush mate before your king is close enough.",
            opponentReply: {
              uci: "a6a7",
              san: "...Ka7"
            }
          },
          {
            uci: "b4b5",
            san: "Qb5",
            prompt: "How do you trap the king to two squares without stalemating?",
            explanation: "Qb5 leaves Black with legal moves while nearly completing the box.",
            plan: "Now improve the king. A lone queen cannot finish mate safely by herself.",
            opponentReply: {
              uci: "a7a8",
              san: "...Ka8"
            }
          },
          {
            uci: "e2d3",
            san: "Kd3",
            prompt: "The king is boxed in. What must White do before checkmate?",
            explanation: "Kd3 brings the king closer. This avoids stalemate and prepares a supported mate.",
            plan: "Walk your king toward the trapped king before delivering mate.",
            opponentReply: {
              uci: "a8a7",
              san: "...Ka7"
            }
          },
          {
            uci: "d3c4",
            san: "Kc4",
            prompt: "How should White continue?",
            explanation: "Kc4 keeps improving the king while Black remains boxed.",
            plan: "Keep bringing the king closer until the queen can mate safely.",
            opponentReply: {
              uci: "a7a8",
              san: "...Ka8"
            }
          },
          {
            uci: "c4c5",
            san: "Kc5",
            prompt: "Which king move brings White into the mating net?",
            explanation: "Kc5 helps control b6 and b7, preparing the final queen mate.",
            plan: "Use king and queen together.",
            opponentReply: {
              uci: "a8a7",
              san: "...Ka7"
            }
          },
          {
            uci: "c5c6",
            san: "Kc6",
            prompt: "What final king move supports the mate?",
            explanation: "Kc6 controls the escape squares so the queen can mate on b7.",
            plan: "The king covers the nearby squares; the queen delivers the check.",
            opponentReply: {
              uci: "a7a8",
              san: "...Ka8"
            }
          },
          {
            uci: "b5b7",
            san: "Qb7#",
            prompt: "What is the queen box mate?",
            explanation: "Qb7# works because White's king controls the escape squares.",
            plan: "Box first, king up second, mate third."
          }
        ]
      },
      {
        id: "endgame-rook-box",
        name: "Rook Box Mate",
        section: "Technique",
        fen: "8/8/8/8/8/3k4/1R6/3K4 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "due",
        moves: [
          {
            uci: "b2e2",
            san: "Re2",
            prompt: "With king and rook vs king, what is the simple first step?",
            explanation: "Re2 creates a box. The rook cuts off the enemy king from crossing the second rank.",
            plan: "Shrink the box with the rook when possible. If not, improve your king.",
            commonMistake: "A common mistake here is checking immediately instead of using the rook to build the box first.",
            opponentReply: {
              uci: "d3c3",
              san: "...Kc3"
            }
          },
          {
            uci: "e2d2",
            san: "Rd2",
            prompt: "Black stays in the box. How do you shrink it?",
            explanation: "Rd2 cuts off another file and makes the box smaller.",
            plan: "Use quiet rook moves to reduce space before checking.",
            opponentReply: {
              uci: "c3b3",
              san: "...Kb3"
            }
          },
          {
            uci: "d2c2",
            san: "Rc2",
            prompt: "Which rook move shrinks the box again?",
            explanation: "Rc2 continues the squeeze. Black's king is being pushed toward the edge.",
            plan: "When the rook can no longer shrink the box, bring your king closer.",
            opponentReply: {
              uci: "b3a3",
              san: "...Ka3"
            }
          },
          {
            uci: "d1c1",
            san: "Kc1",
            prompt: "The rook cannot safely shrink the box further. What should White improve?",
            explanation: "Kc1 brings the king into the action. Rook mates require the king's help.",
            plan: "Use the king to take opposition and force Black backward.",
            opponentReply: {
              uci: "a3b3",
              san: "...Kb3"
            }
          },
          {
            uci: "c1b1",
            san: "Kb1",
            prompt: "How does White keep improving the king?",
            explanation: "Kb1 moves closer and prepares to support the final squeeze.",
            plan: "When the king is close enough, the rook can trap Black on one file.",
            opponentReply: {
              uci: "b3a3",
              san: "...Ka3"
            }
          },
          {
            uci: "c2b2",
            san: "Rb2",
            prompt: "Which rook move traps Black on the a-file?",
            explanation: "Rb2 cuts off the b-file and leaves Black stuck near the wall.",
            plan: "Once the king is trapped on a file, use opposition to finish.",
            opponentReply: {
              uci: "a3a4",
              san: "...Ka4"
            }
          },
          {
            uci: "b1c2",
            san: "Kc2",
            prompt: "What should White do while Black is boxed on one file?",
            explanation: "Kc2 brings the king closer while the rook maintains the box.",
            plan: "Chase the king up the board until opposition allows mate.",
            opponentReply: {
              uci: "a4a3",
              san: "...Ka3"
            }
          },
          {
            uci: "c2c3",
            san: "Kc3",
            prompt: "Which king move continues the chase?",
            explanation: "Kc3 moves into opposition territory and keeps Black squeezed.",
            plan: "The king does the close work; the rook delivers mate from distance.",
            opponentReply: {
              uci: "a3a4",
              san: "...Ka4"
            }
          },
          {
            uci: "b2b1",
            san: "Rb1",
            prompt: "What waiting rook move forces progress?",
            explanation: "Rb1 keeps the box and waits for Black to run out of useful moves.",
            plan: "If Black steps into opposition, mate immediately. Otherwise keep chasing.",
            opponentReply: {
              uci: "a4a5",
              san: "...Ka5"
            }
          },
          {
            uci: "c3c4",
            san: "Kc4",
            prompt: "Which king move keeps the chase going?",
            explanation: "Kc4 keeps Black from escaping downward and moves toward the final opposition.",
            plan: "Continue until Black reaches the corner.",
            opponentReply: {
              uci: "a5a6",
              san: "...Ka6"
            }
          },
          {
            uci: "c4c5",
            san: "Kc5",
            prompt: "How does White force Black closer to the corner?",
            explanation: "Kc5 cuts off key squares and keeps Black boxed.",
            plan: "The final mate comes when the kings line up and the rook checks from the edge.",
            opponentReply: {
              uci: "a6a7",
              san: "...Ka7"
            }
          },
          {
            uci: "c5c6",
            san: "Kc6",
            prompt: "What final king move forces Black into mate?",
            explanation: "Kc6 takes the opposition and leaves Black no useful move.",
            plan: "When Black reaches a8, the rook mates on a1.",
            opponentReply: {
              uci: "a7a8",
              san: "...Ka8"
            }
          },
          {
            uci: "b1a1",
            san: "Ra1#",
            prompt: "What is the rook box mate?",
            explanation: "Ra1# uses the rook from distance while the king controls the escape squares.",
            plan: "Shrink the box, improve the king, then checkmate from far away."
          }
        ]
      },
      {
        id: "endgame-king-pawn-win-opposition",
        name: "King and Pawn: Win with Opposition",
        section: "Core",
        fen: "8/3k4/8/8/3PK3/8/8/8 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "due",
        moves: [
          {
            uci: "e4d5",
            san: "Kd5",
            prompt: "In king and pawn endings, what should White do before pushing?",
            explanation: "Kd5 takes opposition and forces Black backward. The king must lead the pawn.",
            plan: "Get the king in front of the pawn, win the queening square, then push.",
            commonMistake: "A common mistake here is pushing the pawn first and giving away the opposition before the king has done its job.",
            annotations: {
              arrows: [{ from: "e4", to: "d5", color: "green" }],
              circles: [{ square: "d8", color: "yellow" }]
            },
            opponentReply: {
              uci: "d7c7",
              san: "...Kc7"
            }
          },
          {
            uci: "d5e6",
            san: "Ke6",
            prompt: "Black retreats. How does White continue taking space?",
            explanation: "Ke6 brings the king closer to the queening square and keeps Black boxed out.",
            plan: "Use opposition again when Black tries to hold the back rank.",
            opponentReply: {
              uci: "c7d8",
              san: "...Kd8"
            }
          },
          {
            uci: "e6d6",
            san: "Kd6",
            prompt: "Black returns to d8. What king move takes opposition?",
            explanation: "Kd6 takes opposition and forces Black to give ground.",
            plan: "Once White controls d8, the pawn can run.",
            opponentReply: {
              uci: "d8e8",
              san: "...Ke8"
            }
          },
          {
            uci: "d6c7",
            san: "Kc7",
            prompt: "Black steps aside. Which king move wins the queening square?",
            explanation: "Kc7 controls d8, so the pawn can promote safely.",
            plan: "Now push the pawn all the way to promotion.",
            opponentReply: {
              uci: "e8e7",
              san: "...Ke7"
            }
          },
          {
            uci: "d4d5",
            san: "d5",
            prompt: "White controls the queening square. What should happen now?",
            explanation: "d5 starts the pawn run. The king has already done the hard work.",
            plan: "Push until promotion.",
            opponentReply: {
              uci: "e7e8",
              san: "...Ke8"
            }
          },
          {
            uci: "d5d6",
            san: "d6",
            prompt: "Continue the plan. What is the next pawn move?",
            explanation: "d6 keeps moving toward promotion while the king controls the key squares.",
            plan: "Do not move the king away from the queening square.",
            opponentReply: {
              uci: "e8f7",
              san: "...Kf7"
            }
          },
          {
            uci: "d6d7",
            san: "d7",
            prompt: "What pawn move reaches the seventh rank?",
            explanation: "d7 puts the pawn one step from queening. Black cannot stop it.",
            plan: "Promote with check.",
            opponentReply: {
              uci: "f7e7",
              san: "...Ke7"
            }
          },
          {
            uci: "d7d8q",
            san: "d8=Q+",
            prompt: "How does White finish the king and pawn win?",
            explanation: "d8=Q+ promotes. Once the pawn queens, White wins with the queen mate technique.",
            plan: "King first, pawn second. That is the beginner rule."
          }
        ]
      },
      {
        id: "endgame-king-pawn-draw-opposition",
        name: "King and Pawn: Draw with Opposition",
        section: "Defensive Draws",
        fen: "8/8/3k4/3P4/3K4/8/8/8 b - - 0 1",
        sideToTrain: "black",
        dueLevel: "new",
        moves: [
          {
            uci: "d6d7",
            san: "...Kd7",
            prompt: "White has pushed the pawn too far. How should Black start drawing?",
            explanation: "...Kd7 steps back while staying ready to take opposition.",
            plan: "Do not run away. Meet White's king with opposition whenever possible.",
            opponentReply: {
              uci: "d4e5",
              san: "Ke5"
            }
          },
          {
            uci: "d7e7",
            san: "...Ke7",
            prompt: "White tries to enter. What is the drawing move?",
            explanation: "...Ke7 takes opposition. White cannot make progress on the kingside.",
            plan: "Keep mirroring the king and force White to either retreat or stalemate you.",
            opponentReply: {
              uci: "e5e4",
              san: "Ke4"
            }
          },
          {
            uci: "e7d6",
            san: "...Kd6",
            prompt: "White retreats. Where should Black centralize?",
            explanation: "...Kd6 returns to the pawn and keeps the king active.",
            plan: "The defending king must stay close to the pawn.",
            opponentReply: {
              uci: "e4d4",
              san: "Kd4"
            }
          },
          {
            uci: "d6d7",
            san: "...Kd7",
            prompt: "White returns to d4. How does Black reset the drawing position?",
            explanation: "...Kd7 keeps the blockade and prepares to take opposition again.",
            plan: "If White goes to c5, answer with ...Kc7.",
            opponentReply: {
              uci: "d4c5",
              san: "Kc5"
            }
          },
          {
            uci: "d7c7",
            san: "...Kc7",
            prompt: "White tries the queenside. What is the opposition move?",
            explanation: "...Kc7 takes opposition on the other side. White still cannot enter.",
            plan: "Opposition works left, right, and center.",
            opponentReply: {
              uci: "d5d6",
              san: "d6+"
            }
          },
          {
            uci: "c7d7",
            san: "...Kd7",
            prompt: "White pushes with check. Where should Black go?",
            explanation: "...Kd7 keeps the king in front of the pawn and maintains the draw.",
            plan: "Stay in front. Do not allow the white king to control the queening square.",
            opponentReply: {
              uci: "c5d5",
              san: "Kd5"
            }
          },
          {
            uci: "d7d8",
            san: "...Kd8",
            prompt: "White heads back to the center. What defensive move holds?",
            explanation: "...Kd8 is ready for opposition on either e8 or c8.",
            plan: "When the pawn reaches the seventh rank, stalemate saves Black.",
            opponentReply: {
              uci: "d5e6",
              san: "Ke6"
            }
          },
          {
            uci: "d8e8",
            san: "...Ke8",
            prompt: "White tries to enter with Ke6. What is the opposition move?",
            explanation: "...Ke8 takes opposition and prevents the king from supporting promotion.",
            plan: "Keep the king directly in front or in opposition.",
            opponentReply: {
              uci: "d6d7",
              san: "d7+"
            }
          },
          {
            uci: "e8d8",
            san: "...Kd8",
            prompt: "White pushes to the seventh rank. What draws?",
            explanation: "...Kd8 moves in front of the pawn. If White plays Kd6, Black is stalemated.",
            plan: "This is the key defensive pattern: king in front of a seventh-rank pawn.",
            opponentReply: {
              uci: "e6d6",
              san: "Kd6"
            }
          }
        ]
      }
    ]
  },
  {
    id: "intermediate-endgames",
    name: "Intermediate Endgames You Must Know",
    repertoire: "white",
    level: "1500-2000",
    description: "Practical pawn races, opposition tricks, rook endgame basics, and queen-vs-piece technique.",
    lines: [
      {
        id: "intermediate-rule-square",
        name: "Rule of the Square",
        section: "Core",
        fen: "8/1k6/8/8/8/7P/8/K7 b - - 0 1",
        sideToTrain: "black",
        dueLevel: "new",
        moves: [
          {
            uci: "b7c7",
            san: "...Kc7",
            prompt: "Can Black catch the h-pawn? What king move enters the square?",
            explanation: "...Kc7 steps into the pawn's square. If the king can enter the square, the pawn can be stopped.",
            plan: "Visualize the square from the pawn to promotion instead of calculating every move.",
            commonMistake: "A common mistake here is calculating move by move and missing the simple square rule entirely.",
            annotations: {
              arrows: [{ from: "b7", to: "c7", color: "green" }],
              circles: [{ square: "h8", color: "yellow" }]
            },
            opponentReply: {
              uci: "h3h4",
              san: "h4"
            }
          },
          {
            uci: "c7d7",
            san: "...Kd7",
            prompt: "The pawn advances and the square shrinks. How does Black stay inside it?",
            explanation: "...Kd7 keeps the king inside the new square.",
            plan: "Keep moving diagonally toward the queening square.",
            opponentReply: {
              uci: "h4h5",
              san: "h5"
            }
          },
          {
            uci: "d7e7",
            san: "...Ke7",
            prompt: "White keeps running. Which move stays on track?",
            explanation: "...Ke7 keeps Black close enough to stop the pawn.",
            plan: "The king heads straight toward h8.",
            opponentReply: {
              uci: "h5h6",
              san: "h6"
            }
          },
          {
            uci: "e7f7",
            san: "...Kf7",
            prompt: "The pawn reaches h6. What move keeps Black in the square?",
            explanation: "...Kf7 keeps the king close enough to catch the pawn on h8.",
            plan: "Do not drift away from the queening square.",
            opponentReply: {
              uci: "h6h7",
              san: "h7"
            }
          },
          {
            uci: "f7g7",
            san: "...Kg7",
            prompt: "White is one move from queening. What is the only drawing move?",
            explanation: "...Kg7 gets to the promotion corner just in time.",
            plan: "If the pawn queens with check, capture it.",
            opponentReply: {
              uci: "h7h8q",
              san: "h8=Q+"
            }
          },
          {
            uci: "g7h8",
            san: "...Kxh8",
            prompt: "White promotes. How does Black finish the draw?",
            explanation: "...Kxh8 captures the new queen. The rule of the square worked.",
            plan: "Use this shortcut in every pawn race."
          }
        ]
      },
      {
        id: "intermediate-rule-square-caveat",
        name: "Rule of the Square: Two-Square Caveat",
        section: "Core",
        fen: "8/k7/8/8/8/8/7P/K7 b - - 0 1",
        sideToTrain: "black",
        dueLevel: "new",
        moves: [
          {
            uci: "a7b7",
            san: "...Kb7",
            prompt: "Black appears able to enter the pawn square. What move tries to catch it?",
            explanation: "...Kb7 is the natural try, but this position teaches the caveat: pawns on their starting square can move two squares.",
            plan: "Remember to draw the pawn square one rank smaller when the pawn has a two-square first move.",
            commonMistake: "A common mistake here is drawing the normal pawn square and forgetting that the first double-step changes the race.",
            opponentReply: {
              uci: "h2h4",
              san: "h4"
            }
          },
          {
            uci: "b7c7",
            san: "...Kc7",
            prompt: "White jumps two squares. Can Black still catch the pawn?",
            explanation: "...Kc7 continues the chase, but Black is now too late.",
            plan: "The lesson is the mistake: account for the first double-step before deciding.",
            opponentReply: {
              uci: "h4h5",
              san: "h5"
            }
          },
          {
            uci: "c7d7",
            san: "...Kd7",
            prompt: "Continue the chase. What happens?",
            explanation: "...Kd7 is logical, but the king remains outside the shrunken square.",
            plan: "Once the king is outside the true square, the pawn wins.",
            opponentReply: {
              uci: "h5h6",
              san: "h6"
            }
          },
          {
            uci: "d7e7",
            san: "...Ke7",
            prompt: "Black keeps chasing. What is the problem?",
            explanation: "...Ke7 still cannot reach h8 in time because White gained a tempo with h2-h4.",
            plan: "This is why the caveat matters.",
            opponentReply: {
              uci: "h6h7",
              san: "h7"
            }
          },
          {
            uci: "e7f7",
            san: "...Kf7",
            prompt: "The pawn is on h7. Can Black stop promotion?",
            explanation: "...Kf7 is too slow. White queens next.",
            plan: "In real games, calculate the first move carefully if the pawn has not moved.",
            opponentReply: {
              uci: "h7h8q",
              san: "h8=Q"
            }
          }
        ]
      },
      {
        id: "intermediate-rook-pawn-draw",
        name: "Rook Pawn Draw",
        section: "Defensive Draws",
        fen: "8/7k/8/8/6KP/8/8/8 b - - 0 1",
        sideToTrain: "black",
        dueLevel: "new",
        moves: [
          {
            uci: "h7g7",
            san: "...Kg7",
            prompt: "White is trying to escort the rook pawn. What king move starts Black's drawing method?",
            explanation: "...Kg7 keeps Black close to the corner and the promotion square. Against a rook pawn, the defender often draws by staying glued to the queening corner.",
            plan: "Stay near h8 and do not let White drag your king too far from the corner squares.",
            commonMistake: "A common mistake here is stepping away from the corner too early and turning a drawn rook-pawn ending into a losing king ending.",
            opponentReply: {
              uci: "g4h5",
              san: "Kh5"
            }
          },
          {
            uci: "g7h8",
            san: "...Kh8",
            prompt: "White steps up with the king. How does Black keep the fortress?",
            explanation: "...Kh8 sits directly on the promotion corner. That is the key drawing square in rook-pawn endings like this.",
            plan: "If you can live on h8, White usually cannot force you out.",
            opponentReply: {
              uci: "h5g5",
              san: "Kg5"
            }
          },
          {
            uci: "h8g8",
            san: "...Kg8",
            prompt: "White tries to improve the king. What calm move keeps Black's drawing route alive?",
            explanation: "...Kg8 keeps the king bouncing between g8 and h8. White still cannot create outflanking room on the board edge.",
            plan: "Shift between the corner squares and refuse to drift away.",
            opponentReply: {
              uci: "g5h6",
              san: "Kh6"
            }
          },
          {
            uci: "g8h8",
            san: "...Kh8",
            prompt: "White pushes the rook pawn. What should Black remember?",
            explanation: "...Kh8 restores the exact corner setup. The pawn advance does not matter if the defender still owns the corner.",
            plan: "The corner matters more than opposition in this rook-pawn draw.",
            opponentReply: {
              uci: "h4h5",
              san: "h5"
            }
          },
          {
            uci: "h8g8",
            san: "...Kg8",
            prompt: "White repositions the king. How does Black keep the draw under control?",
            explanation: "...Kg8 keeps the same fortress. The attacking king still has no extra file to outflank on.",
            plan: "Keep shuffling between g8 and h8 until White runs out of useful progress.",
            opponentReply: {
              uci: "h6g6",
              san: "Kg6"
            }
          },
          {
            uci: "g8h8",
            san: "...Kh8",
            prompt: "White pushes again. What is Black aiming for now?",
            explanation: "...Kh8 heads straight back to the final stalemate setup. Once the pawn gets too far with no room, the defender is happy.",
            plan: "Rook-pawn defense is mostly patience and knowing the corner fortress.",
            opponentReply: {
              uci: "h5h6",
              san: "h6"
            }
          },
          {
            uci: "h8g8",
            san: "...Kg8",
            prompt: "White reaches the final setup. Why is Black still drawing?",
            explanation: "...Kg8 keeps the same deadlock idea alive: White cannot make progress without allowing the corner stalemate pattern.",
            plan: "The lesson is simple: when defending against a rook pawn, get to the corner and stay there."
          }
        ]
      },
      {
        id: "intermediate-knight-pawn-stalemate",
        name: "Knight Pawn Stalemate Trap",
        section: "Defensive Draws",
        fen: "6k1/8/6K1/6P1/8/8/8/8 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "g6h6",
            san: "Kh6",
            prompt: "With a knight pawn, which direction should White choose?",
            explanation: "Kh6 is precise. White must move toward the rook-file side, not toward the center, to avoid stalemate tricks.",
            plan: "Do not allow Black to sit in h8 while your own king blocks escape squares.",
            opponentReply: {
              uci: "g8h8",
              san: "...Kh8"
            }
          },
          {
            uci: "g5g6",
            san: "g6",
            prompt: "Black keeps opposition. How does White make progress?",
            explanation: "g6 forces Black to g8 and prepares the final push.",
            plan: "The pawn advances while the king controls h-file escape squares.",
            opponentReply: {
              uci: "h8g8",
              san: "...Kg8"
            }
          },
          {
            uci: "g6g7",
            san: "g7",
            prompt: "What pawn move breaks the blockade?",
            explanation: "g7 forces the black king away from g8 because White's king controls h7.",
            plan: "The defending king must leave the promotion square.",
            opponentReply: {
              uci: "g8f7",
              san: "...Kf7"
            }
          },
          {
            uci: "h6h7",
            san: "Kh7",
            prompt: "Black leaves g8. What king move secures promotion?",
            explanation: "Kh7 protects the pawn and makes promotion unstoppable.",
            plan: "Choose the correct side first, then the win is simple."
          }
        ]
      },
      {
        id: "intermediate-wrong-color-bishop",
        name: "Wrong-Color Bishop Draw",
        section: "Defensive Draws",
        fen: "7k/8/8/7P/5K2/8/2B5/8 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "f4g5",
            san: "Kg5",
            prompt: "White is up a bishop and rook pawn. What is the natural try?",
            explanation: "Kg5 heads toward the corner, but the bishop does not control h8, the promotion square.",
            plan: "If the defender reaches the wrong-color corner, the game is drawn.",
            opponentReply: {
              uci: "h8g7",
              san: "...Kg7"
            }
          },
          {
            uci: "c2d3",
            san: "Bd3",
            prompt: "How might White try to improve the bishop?",
            explanation: "Bd3 tries to control nearby squares, but it still cannot control h7/h8 in the needed way.",
            plan: "Material is not enough if the bishop is the wrong color.",
            opponentReply: {
              uci: "g7h8",
              san: "...Kh8"
            }
          },
          {
            uci: "g5h6",
            san: "Kh6",
            prompt: "White reaches h6. Why is Black still drawing?",
            explanation: "Black stays in the corner. Any attempt to force the king out risks stalemate.",
            plan: "Wrong-color bishop plus rook pawn is a key defensive resource.",
            opponentReply: {
              uci: "h8g8",
              san: "...Kg8"
            }
          },
          {
            uci: "d3c4",
            san: "Bc4+",
            prompt: "White gives check. What should Black remember?",
            explanation: "The defender must not leave the corner permanently. If forced, return immediately.",
            plan: "Stay near h8 and do not get pushed out to f8.",
            opponentReply: {
              uci: "g8h8",
              san: "...Kh8"
            }
          },
          {
            uci: "h5h6",
            san: "h6",
            prompt: "White pushes the pawn. What is the defensive idea?",
            explanation: "Black remains in the corner. The bishop cannot force promotion without stalemate.",
            plan: "The wrong-color bishop cannot control the queening corner.",
            opponentReply: {
              uci: "h8h7",
              san: "...Kh7"
            }
          },
          {
            uci: "d3g6",
            san: "Bg6+",
            prompt: "White checks again. How does Black hold?",
            explanation: "Black returns to h8/g8 and keeps the blockade.",
            plan: "The drawing concept matters more than move memorization.",
            opponentReply: {
              uci: "h7h8",
              san: "...Kh8"
            }
          },
          {
            uci: "h6h7",
            san: "h7",
            prompt: "White reaches h7. What is the result?",
            explanation: "h7 leaves Black stalemated or stuck in the drawn corner. White cannot force mate or promotion.",
            plan: "If your bishop does not control the promotion square, the rook pawn may not win."
          }
        ]
      },
      {
        id: "intermediate-retake-opposition",
        name: "Retaking the Opposition",
        section: "Core",
        fen: "8/8/3k4/8/8/5K2/4P3/8 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "f3e4",
            san: "Ke4",
            prompt: "White's king is far ahead of the pawn. What active king move starts the win?",
            explanation: "Ke4 brings the king up. With the king two squares ahead of the pawn, White can retake opposition at the right moment.",
            plan: "Use the reserve pawn move to flip opposition when Black confronts you.",
            commonMistake: "A common mistake here is focusing on the pawn move instead of bringing the king far enough forward first.",
            opponentReply: {
              uci: "d6e6",
              san: "...Ke6"
            }
          },
          {
            uci: "e2e3",
            san: "e3",
            prompt: "Black takes opposition. How does White retake it?",
            explanation: "e3 is the spare tempo. It gives Black the move and flips opposition back to White.",
            plan: "Reserve pawn moves are powerful in king-and-pawn endings.",
            opponentReply: {
              uci: "e6d6",
              san: "...Kd6"
            }
          },
          {
            uci: "e4f5",
            san: "Kf5",
            prompt: "Black retreats. How does White outflank?",
            explanation: "Kf5 goes around the king and keeps progress toward the queening square.",
            plan: "Outflank after winning opposition.",
            opponentReply: {
              uci: "d6e7",
              san: "...Ke7"
            }
          },
          {
            uci: "f5e5",
            san: "Ke5",
            prompt: "How does White return to the winning setup?",
            explanation: "Ke5 puts the king in front of the pawn and keeps Black pushed back.",
            plan: "Now use the beginner opposition technique to finish.",
            opponentReply: {
              uci: "e7d7",
              san: "...Kd7"
            }
          },
          {
            uci: "e5f6",
            san: "Kf6",
            prompt: "Which king move keeps making progress?",
            explanation: "Kf6 outflanks and approaches the promotion square.",
            plan: "The pawn moves only after the king wins the key squares.",
            opponentReply: {
              uci: "d7e8",
              san: "...Ke8"
            }
          },
          {
            uci: "f6e6",
            san: "Ke6",
            prompt: "What opposition move pushes Black back?",
            explanation: "Ke6 takes opposition and forces Black away from the queening square.",
            plan: "Once the king controls e8, push the pawn.",
            opponentReply: {
              uci: "e8d8",
              san: "...Kd8"
            }
          },
          {
            uci: "e3e4",
            san: "e4",
            prompt: "White has control. What starts the pawn run?",
            explanation: "e4 begins advancing only after the king has done the work.",
            plan: "King first, pawn second.",
            opponentReply: {
              uci: "d8e8",
              san: "...Ke8"
            }
          },
          {
            uci: "e4e5",
            san: "e5",
            prompt: "Continue the pawn run. What is next?",
            explanation: "e5 moves closer to promotion while Black is boxed out.",
            plan: "Keep control of e8.",
            opponentReply: {
              uci: "e8f8",
              san: "...Kf8"
            }
          },
          {
            uci: "e6d7",
            san: "Kd7",
            prompt: "Which king move controls the queening square?",
            explanation: "Kd7 controls e8, so the pawn can promote.",
            plan: "Once the queening square is yours, the pawn wins."
          }
        ]
      },
      {
        id: "intermediate-distant-opposition",
        name: "Distant Opposition",
        section: "Core",
        fen: "5k2/8/8/8/8/1P3K2/8/8 b - - 0 1",
        sideToTrain: "black",
        dueLevel: "new",
        moves: [
          {
            uci: "f8f7",
            san: "...Kf7",
            prompt: "The kings are far away. How does Black take distant opposition?",
            explanation: "...Kf7 keeps an odd number of squares between the kings and prevents White from gaining direct opposition.",
            plan: "Match the king's file at distance, then take direct opposition when White approaches.",
            opponentReply: {
              uci: "f3e3",
              san: "Ke3"
            }
          },
          {
            uci: "f7e7",
            san: "...Ke7",
            prompt: "White approaches. How does Black maintain distant opposition?",
            explanation: "...Ke7 keeps the same opposition relationship. If White steps closer, Black can meet him directly.",
            plan: "Do not rush forward and give White the opposition.",
            opponentReply: {
              uci: "e3d3",
              san: "Kd3"
            }
          },
          {
            uci: "e7d7",
            san: "...Kd7",
            prompt: "White continues toward the pawn. What keeps the draw?",
            explanation: "...Kd7 keeps opposition at distance and prepares to meet Kc3 with ...Kc7.",
            plan: "Move in parallel with the attacking king.",
            opponentReply: {
              uci: "d3c3",
              san: "Kc3"
            }
          },
          {
            uci: "d7c7",
            san: "...Kc7",
            prompt: "White reaches c3. How does Black hold?",
            explanation: "...Kc7 keeps distant opposition and prevents White's king from entering decisively.",
            plan: "If the pawn advances too far, take direct opposition.",
            opponentReply: {
              uci: "b3b4",
              san: "b4"
            }
          },
          {
            uci: "c7b6",
            san: "...Kb6",
            prompt: "White pushes. Which king move shows Black understands the draw?",
            explanation: "...Kb6 keeps contact and prepares direct opposition against Kc4 or Kb4.",
            plan: "The pawn is too far from its king, so Black can draw.",
            opponentReply: {
              uci: "c3c4",
              san: "Kc4"
            }
          },
          {
            uci: "b6c6",
            san: "...Kc6",
            prompt: "White steps to c4. What direct opposition move draws?",
            explanation: "...Kc6 takes direct opposition. White cannot make progress.",
            plan: "Distant opposition turns into direct opposition at the critical moment."
          }
        ]
      },
      {
        id: "intermediate-philidor-position",
        name: "Philidor Position",
        section: "Defensive Draws",
        fen: "4k3/1R6/r7/4PK2/8/8/8/8 b - - 0 1",
        sideToTrain: "black",
        dueLevel: "due",
        moves: [
          {
            uci: "a6c6",
            san: "...Rc6",
            prompt: "In Philidor, where should the defending rook wait?",
            explanation: "...Rc6 keeps the rook on the third rank and prevents the white king from advancing.",
            plan: "Hold the third rank until the pawn advances, then check from behind.",
            commonMistake: "A common mistake here is checking too early and letting the attacking king use the rook as a shield.",
            annotations: {
              arrows: [{ from: "a6", to: "c6", color: "green" }],
              circles: [{ square: "e6", color: "yellow" }]
            },
            opponentReply: {
              uci: "b7b8",
              san: "Rb8+"
            }
          },
          {
            uci: "e8e7",
            san: "...Ke7",
            prompt: "White checks. How should Black keep the blockade?",
            explanation: "...Ke7 stays in front of the pawn. The king blockades while the rook waits.",
            plan: "Do not abandon the queening square.",
            opponentReply: {
              uci: "b8b7",
              san: "Rb7+"
            }
          },
          {
            uci: "e7e8",
            san: "...Ke8",
            prompt: "White checks again. What keeps the draw?",
            explanation: "...Ke8 returns to the blockade. White is not making progress.",
            plan: "Keep waiting until the pawn moves.",
            opponentReply: {
              uci: "b7h7",
              san: "Rh7"
            }
          },
          {
            uci: "c6a6",
            san: "...Ra6",
            prompt: "White waits. What should Black do with the rook?",
            explanation: "...Ra6 keeps the third-rank defense. The exact file is less important than the rank.",
            plan: "Stay on the third rank until e6.",
            opponentReply: {
              uci: "h7h8",
              san: "Rh8+"
            }
          },
          {
            uci: "e8e7",
            san: "...Ke7",
            prompt: "White checks again. What is the king's job?",
            explanation: "...Ke7 maintains the blockade.",
            plan: "The king stays in front; the rook waits.",
            opponentReply: {
              uci: "h8h7",
              san: "Rh7+"
            }
          },
          {
            uci: "e7e8",
            san: "...Ke8",
            prompt: "How does Black continue the waiting defense?",
            explanation: "...Ke8 repeats. White still cannot progress without pushing.",
            plan: "Be patient.",
            opponentReply: {
              uci: "e5e6",
              san: "e6"
            }
          },
          {
            uci: "a6a1",
            san: "...Ra1",
            prompt: "White finally pushes the pawn. What is the key Philidor switch?",
            explanation: "...Ra1! switches from third-rank defense to checking from behind. The white king has no shelter.",
            plan: "Once the pawn reaches the third rank, check from far behind.",
            opponentReply: {
              uci: "f5f6",
              san: "Kf6"
            }
          },
          {
            uci: "a1f1",
            san: "...Rf1+",
            prompt: "White king steps forward. What check starts the perpetual?",
            explanation: "...Rf1+ checks from far away, so the king cannot attack the rook.",
            plan: "Keep checking from behind.",
            opponentReply: {
              uci: "f6e5",
              san: "Ke5"
            }
          },
          {
            uci: "f1e1",
            san: "...Re1+",
            prompt: "White moves toward the center. What is the next check?",
            explanation: "...Re1+ continues the perpetual checking pattern.",
            plan: "Distance is the defender's friend.",
            opponentReply: {
              uci: "e5d6",
              san: "Kd6"
            }
          },
          {
            uci: "e1d1",
            san: "...Rd1+",
            prompt: "How does Black keep checking?",
            explanation: "...Rd1+ keeps the white king from hiding.",
            plan: "Repeat checks until the draw is clear."
          }
        ]
      },
      {
        id: "intermediate-lucena-bridge",
        name: "Lucena: Build the Bridge",
        section: "Technique",
        fen: "4K3/2k1P3/8/8/8/8/3R4/4r3 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "due",
        moves: [
          {
            uci: "d2c2",
            san: "Rc2+",
            prompt: "In Lucena, what is the first move before building the bridge?",
            explanation: "Rc2+ drives the black king farther from the pawn. The defender's king must be cut off.",
            plan: "Force the king away, then put your rook on the fourth rank.",
            commonMistake: "A common mistake here is trying to build the bridge before the defending king has been driven far enough away.",
            opponentReply: {
              uci: "c7b6",
              san: "...Kb6"
            }
          },
          {
            uci: "c2c4",
            san: "Rc4",
            prompt: "Black stays away from the pawn. What is the famous bridge-building move?",
            explanation: "Rc4 is the bridge. The rook will later block checks so the pawn can queen.",
            plan: "Rook to the fourth rank, king out, block checks.",
            annotations: {
              arrows: [{ from: "c2", to: "c4", color: "green" }],
              circles: [{ square: "e8", color: "yellow" }]
            },
            opponentReply: {
              uci: "e1e2",
              san: "...Re2"
            }
          },
          {
            uci: "e8d7",
            san: "Kd7",
            prompt: "Black waits. Where should the king go?",
            explanation: "Kd7 threatens promotion, forcing Black to give checks.",
            plan: "Walk the king out while keeping the pawn protected.",
            opponentReply: {
              uci: "e2d2",
              san: "...Rd2+"
            }
          },
          {
            uci: "d7e6",
            san: "Ke6",
            prompt: "Black checks. Which king move keeps the pawn protected?",
            explanation: "Ke6 avoids abandoning the pawn and keeps the winning setup.",
            plan: "Do not step too far and drop the pawn.",
            opponentReply: {
              uci: "d2e2",
              san: "...Re2+"
            }
          },
          {
            uci: "e6d6",
            san: "Kd6",
            prompt: "Black checks again. Where should the king hide next?",
            explanation: "Kd6 keeps the king close and prepares to use the rook bridge.",
            plan: "The rook on c4 will eventually block checks.",
            opponentReply: {
              uci: "e2d2",
              san: "...Rd2+"
            }
          },
          {
            uci: "d6e5",
            san: "Ke5",
            prompt: "What king move sets up the bridge block?",
            explanation: "Ke5 walks toward the rook's shield. The pawn remains protected.",
            plan: "Now the rook can block on e4.",
            opponentReply: {
              uci: "d2e2",
              san: "...Re2+"
            }
          },
          {
            uci: "c4e4",
            san: "Re4",
            prompt: "What move completes the bridge?",
            explanation: "Re4 blocks the check. White's king is safe for one move, and the pawn queens next.",
            plan: "This is the Lucena pattern: bridge with the rook, then promote.",
            opponentReply: {
              uci: "e2e4",
              san: "...Rxe4+"
            }
          },
          {
            uci: "e5e4",
            san: "Kxe4",
            prompt: "Black sacrifices the rook. How does White recapture?",
            explanation: "Kxe4 wins the rook and leaves the pawn ready to queen.",
            plan: "Promote next.",
            opponentReply: {
              uci: "b6c7",
              san: "...Kc7"
            }
          },
          {
            uci: "e7e8q",
            san: "e8=Q",
            prompt: "How does White finish Lucena?",
            explanation: "e8=Q promotes. Building the bridge converted the rook endgame.",
            plan: "Remember: cut off king, rook to fourth rank, bridge."
          }
        ]
      },
      {
        id: "intermediate-queen-vs-knight",
        name: "Queen vs Knight Setup",
        section: "Technique",
        fen: "8/8/8/8/3kn3/8/2K1Q3/8 w - - 0 1",
        sideToTrain: "white",
        dueLevel: "new",
        moves: [
          {
            uci: "e2f3",
            san: "Qf3",
            prompt: "Against king and knight, what setup should White aim for?",
            explanation: "Qf3 reaches the key setup: the queen controls a rank and the king stays two diagonal squares from the knight.",
            plan: "Avoid knight forks. Push the king back while keeping important pieces on safe squares.",
            commonMistake: "A common mistake here is bringing the queen too close and allowing a knight fork that turns a winning ending into chaos.",
            annotations: {
              arrows: [{ from: "e2", to: "f3", color: "green" }],
              circles: [{ square: "e4", color: "red" }]
            },
            opponentReply: {
              uci: "d4e5",
              san: "...Ke5"
            }
          },
          {
            uci: "c2d3",
            san: "Kd3",
            prompt: "Black moves up. How should White's king approach safely?",
            explanation: "Kd3 heads toward the key setup while avoiding knight fork squares.",
            plan: "Respect the knight's jumps. The win is simple only if you avoid forks.",
            opponentReply: {
              uci: "e4c5",
              san: "...Nc5+"
            }
          },
          {
            uci: "d3e3",
            san: "Ke3",
            prompt: "Black checks. Where should White move?",
            explanation: "Ke3 stays coordinated and avoids letting the knight fork the queen.",
            plan: "Keep the queen active and the king safe from forks.",
            opponentReply: {
              uci: "c5e6",
              san: "...Ne6"
            }
          },
          {
            uci: "f3g4",
            san: "Qg4",
            prompt: "Black retreats the knight. How does White keep pushing?",
            explanation: "Qg4 controls important squares and keeps the black king under pressure.",
            plan: "Use queen checks and quiet moves to force the king back.",
            opponentReply: {
              uci: "e5d5",
              san: "...Kd5"
            }
          },
          {
            uci: "g4e4",
            san: "Qe4+",
            prompt: "What queen check pushes the king back?",
            explanation: "Qe4+ forces Black away while keeping the queen safe.",
            plan: "Repeatedly force the king toward the edge.",
            opponentReply: {
              uci: "d5d6",
              san: "...Kd6"
            }
          },
          {
            uci: "e4f5",
            san: "Qf5",
            prompt: "Which quiet queen move keeps the squeeze?",
            explanation: "Qf5 controls key squares and maintains the setup without allowing a fork.",
            plan: "Quiet moves matter in queen vs knight.",
            opponentReply: {
              uci: "e6c5",
              san: "...Nc5"
            }
          },
          {
            uci: "e3d4",
            san: "Kd4",
            prompt: "How does White improve the king safely?",
            explanation: "Kd4 moves closer while avoiding the knight's dangerous squares.",
            plan: "The king helps force the knight away from its defender.",
            opponentReply: {
              uci: "c5e6",
              san: "...Ne6+"
            }
          },
          {
            uci: "d4c4",
            san: "Kc4",
            prompt: "Where should White's king go after the knight check?",
            explanation: "Kc4 reaches the recurring key setup. Black is running out of useful moves.",
            plan: "Once the king reaches the edge, the knight becomes loose."
          }
        ]
      }
    ]
  }
];

for (const course of courses) {
  for (const line of course.lines) {
    if (analysisTagsByLineId[line.id]) {
      line.analysisTags = analysisTagsByLineId[line.id];
    }
  }
}

const importedCoursesStorageKey = "blounderproof:imported-courses:v1";

export function loadImportedCourses(): OpeningCourse[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(importedCoursesStorageKey);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isOpeningCourse) : [];
  } catch {
    return [];
  }
}

export function saveImportedCourses(importedCourses: OpeningCourse[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(importedCoursesStorageKey, JSON.stringify(importedCourses));
}

function isOpeningCourse(value: unknown): value is OpeningCourse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const course = value as Partial<OpeningCourse>;

  return typeof course.id === "string" && typeof course.name === "string" && Array.isArray(course.lines);
}
