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
const SHOP_SIZE = 5;

type CellOwner = null | 1 | 2;
interface HexCell {
  row: number;
  col: number;
  owner: CellOwner;
  character: Character | null;
}

function createShop(): Character[] {
  return [...CHARACTERS];
}

function createInitialGrid(): HexCell[][] {
  const grid: HexCell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: HexCell[] = [];
    for (let c = 0; c < COLS; c++) {
      let owner: CellOwner = null;
      let character: Character | null = null;
      if (r === ROWS - 1 && c === 0) { owner = 1; character = CHARACTERS[0]; }
      if (r === 0 && c === COLS - 1) { owner = 2; character = CHARACTERS[0]; }
      row.push({ row: r, col: c, owner, character });
    }
    grid.push(row);
  }
  return grid;
}

const tierColors: Record<number, string> = {
  1: "border-muted-foreground",
  2: "border-game-blue",
  3: "border-game-orange",
};

const ShoppingPhase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "duel";

  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [gold, setGold] = useState<Record<1 | 2, number>>({ 1: INITIAL_GOLD, 2: INITIAL_GOLD });
  const [grid, setGrid] = useState<HexCell[][]>(createInitialGrid);
  const [selectedHex, setSelectedHex] = useState<{ r: number; c: number } | null>(null);
  const [shop] = useState<Character[]>(createShop);
  const [selectedShopIdx, setSelectedShopIdx] = useState<number | null>(null);

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

  // Buy hex
  const buyHex = () => {
    if (!selectedHex) return;
    const { r, c } = selectedHex;
    const cell = grid[r][c];
    if (cell.owner !== null || gold[currentPlayer] < HEX_COST) return;
    if (!isAdjacentToOwned(r, c, currentPlayer)) return;

    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].owner = currentPlayer;
      return next;
    });
    setGold((prev) => ({ ...prev, [currentPlayer]: prev[currentPlayer] - HEX_COST }));
    setSelectedHex(null);
  };

  // Buy from shop → place directly on selected hex
  const placeFromShop = () => {
    if (selectedShopIdx === null || !selectedHex) return;
    const char = shop[selectedShopIdx];
    if (!char) return;
    if (gold[currentPlayer] < char.cost) return;
    const { r, c } = selectedHex;
    const cell = grid[r][c];
    if (cell.owner !== currentPlayer || cell.character !== null) return;
    if (charOnBoard(currentPlayer) >= maxUnits(currentPlayer)) return;

    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].character = { ...char };
      return next;
    });
    setGold((prev) => ({ ...prev, [currentPlayer]: prev[currentPlayer] - char.cost }));
    setSelectedShopIdx(null);
    setSelectedHex(null);
  };

  const handleDone = () => {
    if (currentPlayer === 1) {
      setCurrentPlayer(2);
      setSelectedHex(null);
      setSelectedShopIdx(null);
    } else {
      navigate(`/execution?mode=${mode}`);
    }
  };

  // Hex rendering
  const hexSize = 26;
  const hexW = Math.sqrt(3) * hexSize;
  const hexH = 2 * hexSize;
  const svgW = hexW * COLS + hexW / 2 + 8;
  const svgH = hexH * 0.75 * (ROWS - 1) + hexH + 8;

  const hexPoints = (cx: number, cy: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
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

  const getHighlight = (r: number, c: number) => {
    if (selectedHex?.r === r && selectedHex?.c === c) return "stroke-primary stroke-[2.5px]";
    return "";
  };

  const playerColor = currentPlayer === 1 ? "text-game-blue" : "text-game-orange";

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-4">
          <span className={`font-display text-lg font-bold ${playerColor}`}>
            P{currentPlayer}
          </span>
          <span className="font-display text-xs text-muted-foreground tracking-wider">SHOPPING</span>
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
        </div>
      </div>

      {/* Main area: board + side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Board center */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[520px]">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const { x, y } = hexCenter(r, c);
                return (
                  <g key={`${r}-${c}`} onClick={() => setSelectedHex({ r, c })} className="cursor-pointer">
                    <polygon
                      points={hexPoints(x, y)}
                      className={`${getCellColor(cell)} ${getHighlight(r, c)} transition-colors`}
                      strokeWidth={selectedHex?.r === r && selectedHex?.c === c ? 2.5 : 1}
                    />
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

          {/* Board actions */}
          <div className="flex gap-2 mt-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={buyHex}
              disabled={
                !selectedHex ||
                grid[selectedHex?.r ?? 0][selectedHex?.c ?? 0]?.owner !== null ||
                gold[currentPlayer] < HEX_COST ||
                (selectedHex ? !isAdjacentToOwned(selectedHex.r, selectedHex.c, currentPlayer) : true)
              }
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-display text-xs font-bold tracking-wider disabled:opacity-30 border border-border hover:border-primary/50 transition-colors"
            >
              Buy Hex ({HEX_COST}g)
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={placeFromShop}
              disabled={
                selectedShopIdx === null ||
                !selectedHex ||
                grid[selectedHex?.r ?? 0][selectedHex?.c ?? 0]?.owner !== currentPlayer ||
                grid[selectedHex?.r ?? 0][selectedHex?.c ?? 0]?.character !== null ||
                charOnBoard(currentPlayer) >= maxUnits(currentPlayer)
              }
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display text-xs font-bold tracking-wider disabled:opacity-30 glow-primary"
            >
              Place Unit
            </motion.button>
          </div>
        </div>

        {/* Right side panel */}
        <div className="w-52 shrink-0 border-l border-border bg-card flex flex-col p-3 gap-3">
          {/* Selected hex info */}
          <div className="bg-secondary rounded-lg p-3">
            <p className="font-display text-[10px] tracking-wider text-muted-foreground mb-1">SELECTED HEX</p>
            {selectedHex ? (
              <p className="font-body text-sm">
                ({selectedHex.r},{selectedHex.c}) —{" "}
                {grid[selectedHex.r][selectedHex.c].owner ? `P${grid[selectedHex.r][selectedHex.c].owner}` : "Empty"}
                {grid[selectedHex.r][selectedHex.c].character && (
                  <span className="ml-1">{grid[selectedHex.r][selectedHex.c].character!.emoji}</span>
                )}
              </p>
            ) : (
              <p className="font-body text-xs text-muted-foreground">Click a hex</p>
            )}
          </div>

          {/* Costs */}
          <div className="bg-secondary rounded-lg p-3">
            <p className="font-display text-[10px] tracking-wider text-muted-foreground mb-1">COSTS</p>
            <div className="font-body text-xs space-y-0.5 text-muted-foreground">
              <p>🔷 Hex: {HEX_COST}g</p>
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

      {/* Bottom: Shop */}
      <div className="shrink-0 border-t border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="font-display text-[10px] tracking-wider text-muted-foreground mr-1 shrink-0">SHOP</span>
          {shop.map((char, idx) => (
              <motion.button
                key={char.id}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedShopIdx(selectedShopIdx === idx ? null : idx)}
                disabled={gold[currentPlayer] < char.cost}
                className={`flex-1 h-16 rounded-lg border-2 ${tierColors[char.tier]} bg-secondary flex flex-col items-center justify-center gap-0.5 disabled:opacity-30 hover:bg-muted transition-colors cursor-pointer min-w-0 ${
                  selectedShopIdx === idx ? "ring-2 ring-primary bg-primary/20" : ""
                }`}
              >
                <span className="text-xl">{char.emoji}</span>
                <span className="font-display text-[9px] tracking-wider">{char.name}</span>
                <span className="font-display text-[9px] text-primary font-bold">{char.cost}g</span>
              </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShoppingPhase;
