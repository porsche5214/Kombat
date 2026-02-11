import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Character {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  atk: number;
  def: number;
}

const CHARACTERS: Character[] = [
  { id: "warrior", name: "Warrior", emoji: "⚔️", hp: 120, atk: 15, def: 10 },
  { id: "mage", name: "Mage", emoji: "🔮", hp: 80, atk: 25, def: 5 },
  { id: "tank", name: "Tank", emoji: "🛡️", hp: 200, atk: 8, def: 20 },
  { id: "assassin", name: "Assassin", emoji: "🗡️", hp: 70, atk: 30, def: 3 },
  { id: "healer", name: "Healer", emoji: "💚", hp: 90, atk: 10, def: 8 },
];

const ROWS = 8;
const COLS = 8;
const INITIAL_GOLD = 20;
const HEX_COST = 3;
const CHAR_COST = 5;

type CellOwner = null | 1 | 2;
interface HexCell {
  row: number;
  col: number;
  owner: CellOwner;
  character: Character | null;
}

function createInitialGrid(): HexCell[][] {
  const grid: HexCell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: HexCell[] = [];
    for (let c = 0; c < COLS; c++) {
      let owner: CellOwner = null;
      let character: Character | null = null;
      // Player 1 starts bottom-left
      if (r === ROWS - 1 && c === 0) {
        owner = 1;
        character = CHARACTERS[0];
      }
      // Player 2 starts top-right
      if (r === 0 && c === COLS - 1) {
        owner = 2;
        character = CHARACTERS[0];
      }
      row.push({ row: r, col: c, owner, character });
    }
    grid.push(row);
  }
  return grid;
}

const ShoppingPhase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "duel";

  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [turn, setTurn] = useState(1);
  const [gold, setGold] = useState<Record<1 | 2, number>>({ 1: INITIAL_GOLD, 2: INITIAL_GOLD });
  const [grid, setGrid] = useState<HexCell[][]>(createInitialGrid);
  const [selectedHex, setSelectedHex] = useState<{ r: number; c: number } | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string>(CHARACTERS[0].id);

  const ownedCount = useCallback(
    (player: 1 | 2) =>
      grid.flat().filter((c) => c.owner === player).length,
    [grid]
  );

  const charCount = useCallback(
    (player: 1 | 2) =>
      grid.flat().filter((c) => c.owner === player && c.character !== null).length,
    [grid]
  );

  const maxChars = useCallback(
    (player: 1 | 2) => ownedCount(player),
    [ownedCount]
  );

  const isAdjacentToOwned = (r: number, c: number, player: 1 | 2): boolean => {
    const offsets =
      r % 2 === 0
        ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
        : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    return offsets.some(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
      return grid[nr][nc].owner === player;
    });
  };

  const buyHex = () => {
    if (!selectedHex) return;
    const { r, c } = selectedHex;
    const cell = grid[r][c];
    if (cell.owner !== null) return;
    if (gold[currentPlayer] < HEX_COST) return;
    if (!isAdjacentToOwned(r, c, currentPlayer)) return;

    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].owner = currentPlayer;
      return next;
    });
    setGold((prev) => ({ ...prev, [currentPlayer]: prev[currentPlayer] - HEX_COST }));
    setSelectedHex(null);
  };

  const placeCharacter = () => {
    if (!selectedHex) return;
    const { r, c } = selectedHex;
    const cell = grid[r][c];
    if (cell.owner !== currentPlayer) return;
    if (cell.character !== null) return;
    if (charCount(currentPlayer) >= maxChars(currentPlayer)) return;
    if (gold[currentPlayer] < CHAR_COST) return;
    const char = CHARACTERS.find((ch) => ch.id === selectedCharId)!;

    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].character = { ...char };
      return next;
    });
    setGold((prev) => ({ ...prev, [currentPlayer]: prev[currentPlayer] - CHAR_COST }));
  };

  const handleDone = () => {
    if (currentPlayer === 1) {
      setCurrentPlayer(2);
      setSelectedHex(null);
    } else {
      // Both done — go to battle or back
      navigate(`/?mode=${mode}`);
    }
  };

  const getCellColor = (cell: HexCell) => {
    if (cell.owner === 1) return "fill-game-blue/30 stroke-game-blue";
    if (cell.owner === 2) return "fill-game-orange/30 stroke-game-orange";
    return "fill-muted/50 stroke-border";
  };

  const getHighlight = (r: number, c: number) => {
    if (selectedHex?.r === r && selectedHex?.c === c) return "stroke-primary stroke-[2px]";
    return "";
  };

  const hexSize = 28;
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

  return (
    <div className="flex min-h-screen flex-col bg-background relative overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-6">
          <span className="font-display text-sm tracking-wider text-muted-foreground">
            Turn {turn}
          </span>
          <span className={`font-display text-lg font-bold ${currentPlayer === 1 ? "text-game-blue" : "text-game-orange"}`}>
            Player {currentPlayer}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-xs text-muted-foreground">GOLD</span>
            <span className="font-display text-lg font-bold text-primary">{gold[currentPlayer]}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-xs text-muted-foreground">UNITS</span>
            <span className="font-display text-sm font-bold">
              {charCount(currentPlayer)}/{maxChars(currentPlayer)}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-auto">
        {/* Hex grid */}
        <div className="flex-1 flex items-center justify-center">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full max-w-[560px]"
          >
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const { x, y } = hexCenter(r, c);
                return (
                  <g
                    key={`${r}-${c}`}
                    onClick={() => setSelectedHex({ r, c })}
                    className="cursor-pointer"
                  >
                    <polygon
                      points={hexPoints(x, y)}
                      className={`${getCellColor(cell)} ${getHighlight(r, c)} transition-colors`}
                      strokeWidth={selectedHex?.r === r && selectedHex?.c === c ? 2 : 1}
                    />
                    {cell.character && (
                      <text
                        x={x}
                        y={y + 1}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-xs pointer-events-none select-none"
                        fontSize="16"
                      >
                        {cell.character.emoji}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3">
          {/* Selected hex info */}
          <div className="game-card p-4">
            <p className="font-display text-xs tracking-wider text-muted-foreground mb-2">
              SELECTED HEX
            </p>
            {selectedHex ? (
              <p className="font-body text-sm">
                ({selectedHex.r}, {selectedHex.c}) —{" "}
                {grid[selectedHex.r][selectedHex.c].owner
                  ? `Player ${grid[selectedHex.r][selectedHex.c].owner}`
                  : "Empty"}
                {grid[selectedHex.r][selectedHex.c].character && (
                  <span className="ml-1">
                    {grid[selectedHex.r][selectedHex.c].character!.emoji}{" "}
                    {grid[selectedHex.r][selectedHex.c].character!.name}
                  </span>
                )}
              </p>
            ) : (
              <p className="font-body text-sm text-muted-foreground">Click a hex</p>
            )}
          </div>

          {/* Buy hex */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={buyHex}
            disabled={
              !selectedHex ||
              grid[selectedHex?.r ?? 0][selectedHex?.c ?? 0]?.owner !== null ||
              gold[currentPlayer] < HEX_COST ||
              (selectedHex ? !isAdjacentToOwned(selectedHex.r, selectedHex.c, currentPlayer) : true)
            }
            className="w-full px-4 py-3 rounded-lg bg-secondary text-secondary-foreground font-display text-sm font-bold tracking-wider disabled:opacity-40 disabled:cursor-not-allowed border border-border hover:border-primary/50 transition-colors"
          >
            Buy Hex ({HEX_COST}g)
          </motion.button>

          {/* Place character */}
          <div className="game-card p-4 flex flex-col gap-3">
            <p className="font-display text-xs tracking-wider text-muted-foreground">
              PLACE CHARACTER ({CHAR_COST}g)
            </p>
            <Select value={selectedCharId} onValueChange={setSelectedCharId}>
              <SelectTrigger className="w-full bg-muted border-border font-body text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {CHARACTERS.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id} className="font-body">
                    <span className="flex items-center gap-2">
                      <span>{ch.emoji}</span>
                      <span>{ch.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={placeCharacter}
              disabled={
                !selectedHex ||
                grid[selectedHex?.r ?? 0][selectedHex?.c ?? 0]?.owner !== currentPlayer ||
                grid[selectedHex?.r ?? 0][selectedHex?.c ?? 0]?.character !== null ||
                charCount(currentPlayer) >= maxChars(currentPlayer) ||
                gold[currentPlayer] < CHAR_COST
              }
              className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold tracking-wider disabled:opacity-40 disabled:cursor-not-allowed glow-primary"
            >
              Place Unit
            </motion.button>
          </div>

          {/* Costs reference */}
          <div className="game-card p-4">
            <p className="font-display text-xs tracking-wider text-muted-foreground mb-2">COSTS</p>
            <div className="font-body text-sm space-y-1">
              <p>🔷 Hex: {HEX_COST}g (adjacent only)</p>
              <p>👤 Unit: {CHAR_COST}g (1 per hex owned)</p>
            </div>
          </div>

          {/* Done */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleDone}
            className="w-full px-6 py-3 rounded-lg bg-accent text-accent-foreground font-display text-sm font-bold tracking-wider glow-primary mt-auto"
          >
            {currentPlayer === 1 ? "Done → P2 Shop" : "Done → Battle"}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ShoppingPhase;
