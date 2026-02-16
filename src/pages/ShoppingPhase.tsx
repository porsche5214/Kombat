import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useCallback } from "react";

interface Character {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  atk: number;
  def: number;
  cost: number;
  tier: number;
}

const CHARACTERS: Character[] = [
  { id: "warrior", name: "Warrior", emoji: "⚔️", hp: 120, atk: 15, def: 10, cost: 1, tier: 1 },
  { id: "mage", name: "Mage", emoji: "🔮", hp: 80, atk: 25, def: 5, cost: 2, tier: 2 },
  { id: "tank", name: "Tank", emoji: "🛡️", hp: 200, atk: 8, def: 20, cost: 3, tier: 2 },
  { id: "assassin", name: "Assassin", emoji: "🗡️", hp: 70, atk: 30, def: 3, cost: 3, tier: 3 },
  { id: "healer", name: "Healer", emoji: "💚", hp: 90, atk: 10, def: 8, cost: 2, tier: 1 },
];

const ROWS = 8;
const COLS = 8;
const INITIAL_GOLD = 20;
const HEX_COST = 3;

type CellOwner = null | 1 | 2;
interface HexCell {
  row: number;
  col: number;
  owner: CellOwner;
  character: Character | null;
}

// P1: top-left 5 hexes, P2: bottom-right 5 hexes (matching reference image)
const P1_INITIAL: [number, number][] = [[0, 1], [0, 2], [1, 0], [1, 1], [1, 2]];
const P2_INITIAL: [number, number][] = [[6, 6], [6, 7], [7, 5], [7, 6], [7, 7]];

function createInitialGrid(): HexCell[][] {
  const grid: HexCell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: HexCell[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push({ row: r, col: c, owner: null, character: null });
    }
    grid.push(row);
  }
  P1_INITIAL.forEach(([r, c]) => { grid[r][c].owner = 1; });
  P2_INITIAL.forEach(([r, c]) => { grid[r][c].owner = 2; });
  return grid;
}

const tierColors: Record<number, string> = {
  1: "border-muted-foreground",
  2: "border-game-blue",
  3: "border-game-orange",
};

type PopupType = "buyHex" | "buyChar" | null;

const ShoppingPhase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "duel";
  const currentTurn = parseInt(searchParams.get("turn") || "1", 10);

  const gameSettings = JSON.parse(localStorage.getItem("gameSettings") || '{"maxTurns":10,"maxGold":50}');
  const { maxTurns, maxGold } = gameSettings;

  // After execution, both players always shop simultaneously
  const shoppingPlayers: (1 | 2)[] = [1, 2];

  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [gold, setGold] = useState<Record<1 | 2, number>>(() => {
    const saved = localStorage.getItem("gameGold");
    if (saved) return JSON.parse(saved);
    return { 1: INITIAL_GOLD, 2: INITIAL_GOLD };
  });
  const [grid, setGrid] = useState<HexCell[][]>(() => {
    const saved = localStorage.getItem("gameGrid");
    if (saved) return JSON.parse(saved);
    return createInitialGrid();
  });

  // Track hex purchases per turn per player
  const [hexBoughtThisTurn, setHexBoughtThisTurn] = useState<Record<1 | 2, boolean>>({ 1: false, 2: false });

  // Popup state
  const [popup, setPopup] = useState<PopupType>(null);
  const [popupHex, setPopupHex] = useState<{ r: number; c: number } | null>(null);

  const ownedCount = useCallback(
    (player: 1 | 2) => grid.flat().filter((c) => c.owner === player).length,
    [grid]
  );

  const charOnBoard = useCallback(
    (player: 1 | 2) => grid.flat().filter((c) => c.owner === player && c.character !== null).length,
    [grid]
  );

  const maxUnits = useCallback(
    (player: 1 | 2) => ownedCount(player),
    [ownedCount]
  );

  const isAdjacentToOwned = (r: number, c: number, player: 1 | 2): boolean => {
    const offsets = r % 2 === 0
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    return offsets.some(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
      return grid[nr][nc].owner === player;
    });
  };

  const handleHexClick = (r: number, c: number) => {
    const cell = grid[r][c];
    if (cell.owner === null) {
      // Empty hex → buy territory popup
      if (!isAdjacentToOwned(r, c, currentPlayer)) return;
      setPopupHex({ r, c });
      setPopup("buyHex");
    } else if (cell.owner === currentPlayer && cell.character === null) {
      // Own hex without character → buy character popup
      setPopupHex({ r, c });
      setPopup("buyChar");
    }
  };

  // Buy hex
  const buyHex = () => {
    if (!popupHex || hexBoughtThisTurn[currentPlayer]) return;
    const { r, c } = popupHex;
    if (gold[currentPlayer] < HEX_COST) return;

    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].owner = currentPlayer;
      return next;
    });
    setGold((prev) => ({ ...prev, [currentPlayer]: Math.max(0, prev[currentPlayer] - HEX_COST) }));
    setHexBoughtThisTurn((prev) => ({ ...prev, [currentPlayer]: true }));
    setPopup(null);
    setPopupHex(null);
  };

  // Place character from popup
  const placeCharacter = (char: Character) => {
    if (!popupHex) return;
    if (gold[currentPlayer] < char.cost) return;
    if (charOnBoard(currentPlayer) >= maxUnits(currentPlayer)) return;
    const { r, c } = popupHex;

    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].character = { ...char };
      return next;
    });
    setGold((prev) => ({ ...prev, [currentPlayer]: Math.max(0, prev[currentPlayer] - char.cost) }));
    setPopup(null);
    setPopupHex(null);
  };

  const handleDone = () => {
    const saveAndGo = () => {
      localStorage.setItem("gameGrid", JSON.stringify(grid));
      localStorage.setItem("gameGold", JSON.stringify(gold));
      navigate(`/execution?mode=${mode}&turn=${currentTurn}`);
    };

    if (currentPlayer === 1) {
      // P1 done → switch to P2
      setCurrentPlayer(2);
      setPopup(null);
      setPopupHex(null);
      setHexBoughtThisTurn((prev) => ({ ...prev })); // keep P2's hex bought status
    } else {
      saveAndGo();
    }
  };

  // Hex rendering
  const hexSize = 36;
  const hexW = Math.sqrt(3) * hexSize;
  const hexH = 2 * hexSize;
  const svgW = hexW * COLS + hexW / 2 + 8;
  const svgH = hexH * 0.75 * (ROWS - 1) + hexH + 8;

  const hexPoints = (cx: number, cy: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i);
      pts.push(`${cx + hexSize * Math.cos(angle)},${cy + hexSize * Math.sin(angle)}`);
    }
    return pts.join(" ");
  };

  const hexCenter = (r: number, c: number) => {
    const x = 4 + hexW / 2 + c * hexW + (r % 2 === 1 ? hexW / 2 : 0);
    const y = 4 + hexSize + r * hexH * 0.75;
    return { x, y };
  };

  const getCellColor = (cell: HexCell) => {
    if (cell.owner === 1) return "fill-game-blue/30 stroke-game-blue";
    if (cell.owner === 2) return "fill-game-orange/30 stroke-game-orange";
    return "fill-muted/50 stroke-border";
  };

  const playerColor = currentPlayer === 1 ? "text-game-blue" : "text-game-orange";

  // Get enabled characters from setup
  const enabledChars: Character[] = (() => {
    try {
      const saved = localStorage.getItem("enabledCharacters");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Map to shop characters with costs
        return CHARACTERS.filter((c) => parsed.some((e: any) => e.id === c.id));
      }
    } catch {}
    return CHARACTERS;
  })();

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-4">
          <span className={`font-display text-lg font-bold ${playerColor}`}>
            P{currentPlayer}
          </span>
          <span className="font-display text-xs text-muted-foreground tracking-wider">SHOPPING</span>
          <span className="font-display text-xs font-bold text-primary tracking-wider">TURN {currentTurn}/{maxTurns}</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🪙</span>
            <span className="font-display text-lg font-bold text-primary">{gold[currentPlayer]}</span>
          </div>
          <div className="flex items-center gap-1.5 font-display text-sm">
            <span className="text-muted-foreground">UNITS</span>
            <span className="font-bold">{charOnBoard(currentPlayer)}/{maxUnits(currentPlayer)}</span>
          </div>
          <div className="flex items-center gap-1.5 font-display text-sm">
            <span className="text-muted-foreground">HEX</span>
            <span className="font-bold">{ownedCount(currentPlayer)}</span>
          </div>
          {hexBoughtThisTurn[currentPlayer] && (
            <span className="font-display text-[10px] text-muted-foreground tracking-wider">HEX BOUGHT ✓</span>
          )}
        </div>
      </div>

      {/* Main area: board + side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Board center */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[720px]">
            <defs>
              <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor="hsl(210, 90%, 55%)" floodOpacity="0.6" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                <feMerge>
                  <feMergeNode in="shadow" />
                  <feMergeNode in="shadow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-orange" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feFlood floodColor="hsl(25, 95%, 55%)" floodOpacity="0.6" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                <feMerge>
                  <feMergeNode in="shadow" />
                  <feMergeNode in="shadow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const { x, y } = hexCenter(r, c);
                const canBuyHex = cell.owner === null && isAdjacentToOwned(r, c, currentPlayer);
                const canPlaceChar = cell.owner === currentPlayer && cell.character === null;
                const isClickable = canBuyHex || canPlaceChar;
                const glowFilter = canBuyHex
                  ? currentPlayer === 1 ? "url(#glow-blue)" : "url(#glow-orange)"
                  : undefined;
                return (
                  <g
                    key={`${r}-${c}`}
                    onClick={() => handleHexClick(r, c)}
                    className={isClickable ? "cursor-pointer" : ""}
                  >
                    {canBuyHex && (
                      <polygon
                        points={hexPoints(x, y)}
                        fill={currentPlayer === 1 ? "hsl(210, 90%, 55%)" : "hsl(25, 95%, 55%)"}
                        fillOpacity={0.15}
                        stroke={currentPlayer === 1 ? "hsl(210, 90%, 55%)" : "hsl(25, 95%, 55%)"}
                        strokeWidth={1.5}
                        filter={glowFilter}
                        className="animate-pulse"
                      />
                    )}
                    {!canBuyHex && (
                      <polygon
                        points={hexPoints(x, y)}
                        className={`${getCellColor(cell)} transition-colors ${
                          isClickable ? "hover:brightness-125" : ""
                        }`}
                        strokeWidth={1}
                      />
                    )}
                    {cell.character && (
                      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" className="pointer-events-none select-none" fontSize="14">
                        {cell.character.emoji}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>

        {/* Right side panel */}
        <div className="w-52 shrink-0 border-l border-border bg-card flex flex-col p-3 gap-3">
          {/* Info */}
          <div className="bg-secondary rounded-lg p-3">
            <p className="font-display text-[10px] tracking-wider text-muted-foreground mb-1">INFO</p>
            <div className="font-body text-xs space-y-0.5 text-muted-foreground">
              <p>🔷 Hex cost: {HEX_COST}g</p>
              <p>📦 Hex buy: {hexBoughtThisTurn[currentPlayer] ? "0" : "1"} left this turn</p>
              <p>👥 Click empty hex → buy territory</p>
              <p>🎯 Click your hex → place unit</p>
            </div>
          </div>

          {/* Done */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleDone}
            className="w-full px-4 py-3 rounded-lg bg-accent text-accent-foreground font-display text-sm font-bold tracking-wider glow-primary mt-auto"
          >
            {currentPlayer === 1 ? "Done → P2" : "Done → Battle"}
          </motion.button>
        </div>
      </div>

      {/* Popups */}
      <AnimatePresence>
        {popup === "buyHex" && popupHex && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            onClick={() => setPopup(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 w-80"
            >
              <h3 className="font-display text-sm tracking-wider text-foreground mb-1">BUY TERRITORY</h3>
              <p className="font-body text-xs text-muted-foreground mb-4">
                Hex ({popupHex.r}, {popupHex.c}) — Cost: {HEX_COST}g
              </p>
              {hexBoughtThisTurn[currentPlayer] ? (
                <p className="font-body text-sm text-destructive mb-4">Already bought a hex this turn!</p>
              ) : gold[currentPlayer] < HEX_COST ? (
                <p className="font-body text-sm text-destructive mb-4">Not enough gold!</p>
              ) : null}
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={buyHex}
                  disabled={hexBoughtThisTurn[currentPlayer] || gold[currentPlayer] < HEX_COST}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display text-xs font-bold tracking-wider disabled:opacity-30"
                >
                  BUY ({HEX_COST}g)
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPopup(null)}
                  className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-display text-xs tracking-wider border border-border"
                >
                  CANCEL
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {popup === "buyChar" && popupHex && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            onClick={() => setPopup(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 w-96"
            >
              <h3 className="font-display text-sm tracking-wider text-foreground mb-1">PLACE CHARACTER</h3>
              <p className="font-body text-xs text-muted-foreground mb-4">
                Hex ({popupHex.r}, {popupHex.c}) — Units: {charOnBoard(currentPlayer)}/{maxUnits(currentPlayer)}
              </p>
              {charOnBoard(currentPlayer) >= maxUnits(currentPlayer) && (
                <p className="font-body text-sm text-destructive mb-3">Unit limit reached! Buy more hexes first.</p>
              )}
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {enabledChars.map((char) => {
                  const canAfford = gold[currentPlayer] >= char.cost;
                  const unitsFull = charOnBoard(currentPlayer) >= maxUnits(currentPlayer);
                  return (
                    <motion.button
                      key={char.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => placeCharacter(char)}
                      disabled={!canAfford || unitsFull}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 ${tierColors[char.tier]} bg-secondary hover:bg-muted transition-colors disabled:opacity-30 text-left`}
                    >
                      <span className="text-2xl">{char.emoji}</span>
                      <div className="flex-1">
                        <p className="font-display text-xs tracking-wider">{char.name}</p>
                        <p className="font-body text-[10px] text-muted-foreground">
                          HP:{char.hp} ATK:{char.atk} DEF:{char.def}
                        </p>
                      </div>
                      <span className="font-display text-sm font-bold text-primary">{char.cost}g</span>
                    </motion.button>
                  );
                })}
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setPopup(null)}
                className="w-full mt-3 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-display text-xs tracking-wider border border-border"
              >
                CANCEL
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShoppingPhase;
