import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";

interface Character {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  owner: 1 | 2;
  spawnOrder: number;
  strategy: string;
}

interface HexCell {
  row: number;
  col: number;
  owner: null | 1 | 2;
  character: Character | null;
}

interface LogEntry {
  turn: number;
  characterName: string;
  emoji: string;
  owner: 1 | 2;
  action: string;
}

const ROWS = 8;
const COLS = 8;

// Mock initial grid with some characters for demo
function createDemoGrid(): HexCell[][] {
  const grid: HexCell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: HexCell[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push({ row: r, col: c, owner: null, character: null });
    }
    grid.push(row);
  }

  // P1 units (mid-left area, close to center)
  const p1Units: Omit<Character, "owner" | "spawnOrder" | "maxHp">[] = [
    { id: "warrior", name: "Warrior", emoji: "⚔️", hp: 120, atk: 15, def: 10, strategy: "attack nearest" },
    { id: "healer", name: "Healer", emoji: "💚", hp: 90, atk: 10, def: 8, strategy: "heal lowest" },
    { id: "mage", name: "Mage", emoji: "🔮", hp: 80, atk: 25, def: 5, strategy: "attack weakest" },
  ];
  const p1Positions = [
    [4, 2], [5, 1], [5, 3],
  ];

  p1Units.forEach((u, i) => {
    const [r, c] = p1Positions[i];
    const char: Character = { ...u, maxHp: u.hp, owner: 1, spawnOrder: i };
    grid[r][c] = { row: r, col: c, owner: 1, character: char };
  });

  // P2 units (mid-right area, close to center)
  const p2Units: Omit<Character, "owner" | "spawnOrder" | "maxHp">[] = [
    { id: "tank", name: "Tank", emoji: "🛡️", hp: 200, atk: 8, def: 20, strategy: "defend ally" },
    { id: "assassin", name: "Assassin", emoji: "🗡️", hp: 70, atk: 30, def: 3, strategy: "attack nearest" },
  ];
  const p2Positions = [
    [3, 5], [2, 4],
  ];

  p2Units.forEach((u, i) => {
    const [r, c] = p2Positions[i];
    const char: Character = { ...u, maxHp: u.hp, owner: 2, spawnOrder: i };
    grid[r][c] = { row: r, col: c, owner: 2, character: char };
  });

  // Set hex ownership
  p1Positions.forEach(([r, c]) => { grid[r][c].owner = 1; });
  p2Positions.forEach(([r, c]) => { grid[r][c].owner = 2; });

  return grid;
}

function getHexNeighbors(r: number, c: number): [number, number][] {
  const offsets = r % 2 === 0
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  return offsets
    .map(([dr, dc]) => [r + dr, c + dc] as [number, number])
    .filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS);
}

function hexDistance(r1: number, c1: number, r2: number, c2: number): number {
  // Convert offset to cube coordinates
  const toCube = (r: number, c: number) => {
    const x = c - (r - (r & 1)) / 2;
    const z = r;
    const y = -x - z;
    return { x, y, z };
  };
  const a = toCube(r1, c1);
  const b = toCube(r2, c2);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

// Gather all characters sorted by execution order for a given turn
function getExecutionOrder(grid: HexCell[][], turn: number): { char: Character; r: number; c: number }[] {
  const allChars: { char: Character; r: number; c: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].character && grid[r][c].character!.hp > 0) {
        allChars.push({ char: grid[r][c].character!, r, c });
      }
    }
  }

  // Odd turn: P1 first, Even turn: P2 first
  const firstPlayer = turn % 2 === 1 ? 1 : 2;
  const secondPlayer = firstPlayer === 1 ? 2 : 1;

  const first = allChars.filter((e) => e.char.owner === firstPlayer).sort((a, b) => a.char.spawnOrder - b.char.spawnOrder);
  const second = allChars.filter((e) => e.char.owner === secondPlayer).sort((a, b) => a.char.spawnOrder - b.char.spawnOrder);

  return [...first, ...second];
}

// Find character position in grid
function findChar(grid: HexCell[][], char: Character): { r: number; c: number } | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].character === char) return { r, c };
    }
  }
  return null;
}

// Simple AI: execute one character's action
function executeCharAction(
  grid: HexCell[][],
  char: Character,
  cr: number,
  cc: number
): { grid: HexCell[][]; action: string } {
  const newGrid = grid.map((row) => row.map((cell) => ({ ...cell, character: cell.character ? { ...cell.character } : null })));
  const currentChar = newGrid[cr][cc].character!;

  // Find enemies
  const enemies: { char: Character; r: number; c: number; dist: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = newGrid[r][c].character;
      if (ch && ch.owner !== currentChar.owner && ch.hp > 0) {
        enemies.push({ char: ch, r, c, dist: hexDistance(cr, cc, r, c) });
      }
    }
  }

  // Find allies
  const allies: { char: Character; r: number; c: number; dist: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = newGrid[r][c].character;
      if (ch && ch.owner === currentChar.owner && ch !== currentChar && ch.hp > 0) {
        allies.push({ char: ch, r, c, dist: hexDistance(cr, cc, r, c) });
      }
    }
  }

  if (enemies.length === 0) {
    return { grid: newGrid, action: "No enemies — idle" };
  }

  // Strategy-based action
  const strategy = currentChar.strategy.toLowerCase();

  // Healer: heal lowest HP ally
  if (currentChar.id === "healer" || strategy.includes("heal")) {
    const wounded = allies.filter((a) => a.char.hp < a.char.maxHp).sort((a, b) => a.char.hp - b.char.hp);
    if (wounded.length > 0 && wounded[0].dist <= 2) {
      const target = wounded[0];
      const healAmt = currentChar.atk;
      target.char.hp = Math.min(target.char.maxHp, target.char.hp + healAmt);
      newGrid[target.r][target.c].character = target.char;
      return { grid: newGrid, action: `Healed ${target.char.emoji}${target.char.name} +${healAmt}HP` };
    }
    // Move toward wounded ally
    if (wounded.length > 0) {
      return moveToward(newGrid, currentChar, cr, cc, wounded[0].r, wounded[0].c, `Moving toward wounded ${wounded[0].char.emoji}`);
    }
  }

  // Tank: defend (taunt nearest enemy, reduce their ATK temporarily — simplified as just attack)
  // Default: attack nearest enemy
  const nearest = enemies.sort((a, b) => a.dist - b.dist)[0];

  // If adjacent (dist === 1), attack
  if (nearest.dist <= 1) {
    const dmg = Math.max(1, currentChar.atk - nearest.char.def);
    nearest.char.hp -= dmg;
    if (nearest.char.hp <= 0) {
      nearest.char.hp = 0;
      newGrid[nearest.r][nearest.c].character = null;
      return { grid: newGrid, action: `Attacked ${nearest.char.emoji}${nearest.char.name} for ${dmg} dmg — KILLED!` };
    }
    newGrid[nearest.r][nearest.c].character = nearest.char;
    return { grid: newGrid, action: `Attacked ${nearest.char.emoji}${nearest.char.name} for ${dmg} dmg (${nearest.char.hp}HP left)` };
  }

  // Move toward nearest enemy
  return moveToward(newGrid, currentChar, cr, cc, nearest.r, nearest.c, `Moving toward ${nearest.char.emoji}${nearest.char.name}`);
}

function moveToward(
  grid: HexCell[][],
  char: Character,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  actionDesc: string
): { grid: HexCell[][]; action: string } {
  const neighbors = getHexNeighbors(fromR, fromC);
  let bestPos: [number, number] | null = null;
  let bestDist = hexDistance(fromR, fromC, toR, toC);

  for (const [nr, nc] of neighbors) {
    if (grid[nr][nc].character !== null) continue;
    const d = hexDistance(nr, nc, toR, toC);
    if (d < bestDist) {
      bestDist = d;
      bestPos = [nr, nc];
    }
  }

  if (bestPos) {
    grid[bestPos[0]][bestPos[1]].character = char;
    grid[fromR][fromC].character = null;
    return { grid, action: actionDesc };
  }

  return { grid, action: "Blocked — cannot move" };
}

const ExecutionPhase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "duel";
  const gameTurn = parseInt(searchParams.get("turn") || "1", 10);

  const gameSettings = JSON.parse(localStorage.getItem("gameSettings") || '{"maxTurns":10,"maxGold":50}');
  const { maxTurns, maxGold } = gameSettings;

  const [grid, setGrid] = useState<HexCell[][]>(() => {
    const saved = localStorage.getItem("gameGrid");
    if (saved) return JSON.parse(saved);
    return createDemoGrid();
  });
  const [turn, setTurn] = useState(1);
  const [stepIndex, setStepIndex] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [battleOver, setBattleOver] = useState(false);
  const [turnComplete, setTurnComplete] = useState(false);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [currentActing, setCurrentActing] = useState<{ name: string; emoji: string; owner: 1 | 2 } | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Check win condition
  const checkWin = useCallback((g: HexCell[][]) => {
    const p1Alive = g.flat().some((c) => c.character && c.character.owner === 1 && c.character.hp > 0);
    const p2Alive = g.flat().some((c) => c.character && c.character.owner === 2 && c.character.hp > 0);
    if (!p1Alive && !p2Alive) { setBattleOver(true); setWinner(null); return true; }
    if (!p1Alive) { setBattleOver(true); setWinner(2); return true; }
    if (!p2Alive) { setBattleOver(true); setWinner(1); return true; }
    return false;
  }, []);

  // Go back to shopping with interest
  const goToShopping = useCallback(() => {
    const nextTurn = gameTurn + 1;
    if (nextTurn > maxTurns) {
      setBattleOver(true);
      // Determine winner by remaining HP
      const p1Hp = grid.flat().filter(c => c.character?.owner === 1).reduce((s, c) => s + (c.character?.hp || 0), 0);
      const p2Hp = grid.flat().filter(c => c.character?.owner === 2).reduce((s, c) => s + (c.character?.hp || 0), 0);
      if (p1Hp > p2Hp) setWinner(1);
      else if (p2Hp > p1Hp) setWinner(2);
      else setWinner(null);
      return;
    }
    // Interest: 10% of current gold, capped at maxGold
    const savedGold = JSON.parse(localStorage.getItem("gameGold") || '{"1":0,"2":0}');
    const interest1 = Math.floor(savedGold["1"] * 0.1);
    const interest2 = Math.floor(savedGold["2"] * 0.1);
    const newGold = {
      "1": Math.min(maxGold, savedGold["1"] + interest1 + 5),
      "2": Math.min(maxGold, savedGold["2"] + interest2 + 5),
    };
    localStorage.setItem("gameGold", JSON.stringify(newGold));
    localStorage.setItem("gameGrid", JSON.stringify(grid));
    navigate(`/shopping?mode=${mode}&turn=${nextTurn}`);
  }, [gameTurn, maxTurns, maxGold, grid, navigate, mode]);

  // Execute one step
  const executeStep = useCallback(() => {
    if (turnComplete || battleOver) return;

    setGrid((prevGrid) => {
      const order = getExecutionOrder(prevGrid, gameTurn);
      if (stepIndex >= order.length) {
        // Turn complete - stop and show "Back to Shop" button
        setTurnComplete(true);
        setIsRunning(false);
        return prevGrid;
      }

      const entry = order[stepIndex];
      const pos = findChar(prevGrid, entry.char);
      if (!pos || entry.char.hp <= 0) {
        setStepIndex((s) => s + 1);
        return prevGrid;
      }

      const { grid: newGrid, action } = executeCharAction(prevGrid, entry.char, pos.r, pos.c);

      setCurrentActing({ name: entry.char.name, emoji: entry.char.emoji, owner: entry.char.owner });
      setLogs((prev) => [
        ...prev,
        { turn: gameTurn, characterName: entry.char.name, emoji: entry.char.emoji, owner: entry.char.owner, action },
      ]);
      setStepIndex((s) => s + 1);

      if (checkWin(newGrid)) {
        setIsRunning(false);
      }

      return newGrid;
    });
  }, [gameTurn, stepIndex, checkWin, turnComplete, battleOver]);

  // Auto-run
  useEffect(() => {
    if (!isRunning || battleOver) return;
    const timer = setTimeout(executeStep, 600);
    return () => clearTimeout(timer);
  }, [isRunning, battleOver, executeStep, stepIndex, turn]);

  // Hex rendering
  const hexSize = 36;
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
    if (cell.owner === 1) return "fill-game-blue/20 stroke-game-blue/50";
    if (cell.owner === 2) return "fill-game-orange/20 stroke-game-orange/50";
    return "fill-muted/30 stroke-border/50";
  };

  // Gather alive characters for status panel
  const aliveChars = grid.flat()
    .filter((c) => c.character && c.character.hp > 0)
    .map((c) => c.character!)
    .sort((a, b) => {
      if (a.owner !== b.owner) return a.owner - b.owner;
      return a.spawnOrder - b.spawnOrder;
    });

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-display text-lg font-bold text-primary">⚔️ BATTLE</span>
          <span className="font-display text-xs text-muted-foreground tracking-wider">
            GAME TURN {gameTurn}/{maxTurns}
          </span>
          <span className="font-display text-[10px] text-muted-foreground tracking-wider">
            {gameTurn % 2 === 1 ? "P1 FIRST" : "P2 FIRST"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!battleOver && !turnComplete && (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsRunning((r) => !r)}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-display text-xs font-bold tracking-wider"
              >
                {isRunning ? "⏸ PAUSE" : "▶ RUN"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={executeStep}
                disabled={isRunning}
                className="px-4 py-1.5 rounded-lg bg-secondary text-secondary-foreground font-display text-xs font-bold tracking-wider disabled:opacity-30 border border-border"
              >
                STEP
              </motion.button>
            </>
          )}
          {turnComplete && !battleOver && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={goToShopping}
              className="px-4 py-1.5 rounded-lg bg-accent text-accent-foreground font-display text-xs font-bold tracking-wider glow-primary"
            >
              🛒 BACK TO SHOP
            </motion.button>
          )}
          {battleOver && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/?mode=${mode}`)}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-display text-xs font-bold tracking-wider glow-primary"
            >
              BACK TO MENU
            </motion.button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Board */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {battleOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute z-10 bg-card border border-border rounded-xl px-8 py-6 text-center glow-primary"
            >
              <p className="font-display text-2xl font-bold tracking-wider text-primary mb-1">
                {winner ? `PLAYER ${winner} WINS!` : "DRAW!"}
              </p>
              <p className="font-body text-sm text-muted-foreground">Battle ended at turn {turn}</p>
            </motion.div>
          )}

          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[720px]">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const { x, y } = hexCenter(r, c);
                const isActing = currentActing && cell.character &&
                  cell.character.name === currentActing.name && cell.character.owner === currentActing.owner;
                return (
                  <g key={`${r}-${c}`}>
                    <polygon
                      points={hexPoints(x, y)}
                      className={`${getCellColor(cell)} transition-colors`}
                      strokeWidth={1}
                    />
                    {cell.character && cell.character.hp > 0 && (
                      <>
                        {isActing && (
                          <circle cx={x} cy={y} r={hexSize * 0.7} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} opacity={0.6}>
                            <animate attributeName="r" from={String(hexSize * 0.5)} to={String(hexSize * 0.8)} dur="0.6s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.8" to="0" dur="0.6s" repeatCount="indefinite" />
                          </circle>
                        )}
                        <text x={x} y={y - 3} textAnchor="middle" dominantBaseline="central" className="pointer-events-none select-none" fontSize="13">
                          {cell.character.emoji}
                        </text>
                        {/* HP bar */}
                        <rect x={x - 10} y={y + 8} width={20} height={3} rx={1} fill="hsl(var(--muted))" />
                        <rect
                          x={x - 10}
                          y={y + 8}
                          width={Math.max(0, (cell.character.hp / cell.character.maxHp) * 20)}
                          height={3}
                          rx={1}
                          fill={cell.character.hp / cell.character.maxHp > 0.5 ? "hsl(145, 72%, 45%)" : cell.character.hp / cell.character.maxHp > 0.25 ? "hsl(45, 90%, 50%)" : "hsl(0, 72%, 50%)"}
                        />
                      </>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>

        {/* Right panel: status + log */}
        <div className="w-64 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
          {/* Character Status */}
          <div className="p-3 border-b border-border">
            <p className="font-display text-[10px] tracking-wider text-muted-foreground mb-2">UNIT STATUS</p>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {aliveChars.map((ch, i) => {
                const hpPct = Math.round((ch.hp / ch.maxHp) * 100);
                const isActing = currentActing && ch.name === currentActing.name && ch.owner === currentActing.owner;
                return (
                  <div
                    key={`${ch.owner}-${ch.id}-${i}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
                      isActing ? "bg-primary/20 border border-primary/40" : "bg-secondary"
                    } transition-colors`}
                  >
                    <span className="text-sm">{ch.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`font-display text-[10px] tracking-wider ${ch.owner === 1 ? "text-game-blue" : "text-game-orange"}`}>
                          P{ch.owner} {ch.name}
                        </span>
                        <span className="font-display text-[9px] text-muted-foreground">{ch.hp}/{ch.maxHp}</span>
                      </div>
                      <div className="w-full h-1 bg-muted rounded-full mt-0.5">
                        <div
                          className="h-1 rounded-full transition-all"
                          style={{
                            width: `${hpPct}%`,
                            backgroundColor: hpPct > 50 ? "hsl(145, 72%, 45%)" : hpPct > 25 ? "hsl(45, 90%, 50%)" : "hsl(0, 72%, 50%)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {aliveChars.length === 0 && (
                <p className="font-body text-xs text-muted-foreground text-center py-2">No units alive</p>
              )}
            </div>
          </div>

          {/* Action Log */}
          <div className="flex-1 p-3 overflow-hidden flex flex-col">
            <p className="font-display text-[10px] tracking-wider text-muted-foreground mb-2">ACTION LOG</p>
            <div className="flex-1 overflow-y-auto space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-[11px] font-body leading-tight">
                  <span className="font-display text-[9px] text-muted-foreground mr-1">T{log.turn}</span>
                  <span className={log.owner === 1 ? "text-game-blue" : "text-game-orange"}>
                    {log.emoji}{log.characterName}
                  </span>
                  <span className="text-muted-foreground ml-1">{log.action}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionPhase;
