import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";

// ─── Types ─────────────────────────────────────────────
interface Character {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  cost: number;
  tier: number;
  owner?: 1 | 2;
  spawnOrder?: number;
  strategy?: string;
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

// ─── Constants ─────────────────────────────────────────
const CHARACTERS: Character[] = [
  { id: "warrior", name: "Warrior", emoji: "⚔️", hp: 120, maxHp: 120, atk: 15, def: 10, cost: 1, tier: 1 },
  { id: "mage", name: "Mage", emoji: "🔮", hp: 80, maxHp: 80, atk: 25, def: 5, cost: 2, tier: 2 },
  { id: "tank", name: "Tank", emoji: "🛡️", hp: 200, maxHp: 200, atk: 8, def: 20, cost: 3, tier: 2 },
  { id: "assassin", name: "Assassin", emoji: "🗡️", hp: 70, maxHp: 70, atk: 30, def: 3, cost: 3, tier: 3 },
  { id: "healer", name: "Healer", emoji: "💚", hp: 90, maxHp: 90, atk: 10, def: 8, cost: 2, tier: 1 },
];

const ROWS = 8;
const COLS = 8;
const INITIAL_GOLD = 20;
const HEX_COST = 3;

// P1: top-left 5 hexes, P2: bottom-right 5 hexes (pointy-top, even-r offset)
const P1_INITIAL: [number, number][] = [[0, 1], [0, 2], [1, 0], [1, 1], [2, 0]];
const P2_INITIAL: [number, number][] = [[7, 6], [7, 5], [6, 7], [6, 6], [5, 7]];

const tierColors: Record<number, string> = {
  1: "border-muted-foreground",
  2: "border-game-blue",
  3: "border-game-orange",
};

// ─── Game Step State Machine ───────────────────────────
// Turn 1: shop_p1 → shop_p2 → exec_all → next turn
// Turn 2+: shop_p1 → exec_p1 → shop_p2 → exec_p2 → next turn
type GameStep =
  | { type: "shopping"; player: 1 | 2 }
  | { type: "executing"; player: 1 | 2 | "all" }
  | { type: "game_over" };

type PopupType = "buyHex" | "buyChar" | null;

// ─── Hex Helpers ───────────────────────────────────────
// Pointy-top hex: even-r offset (even rows shifted right)
function getHexNeighbors(r: number, c: number): [number, number][] {
  const offsets = r % 2 === 0
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  return offsets
    .map(([dr, dc]) => [r + dr, c + dc] as [number, number])
    .filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS);
}

function hexDistance(r1: number, c1: number, r2: number, c2: number): number {
  // Pointy-top offset (even-r) to cube
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

// ─── Execution Logic ───────────────────────────────────
function getExecutionOrder(grid: HexCell[][], playerFilter: 1 | 2 | "all", turn: number) {
  const allChars: { char: Character; r: number; c: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c].character;
      if (ch && ch.hp > 0) {
        if (playerFilter === "all" || ch.owner === playerFilter) {
          allChars.push({ char: ch, r, c });
        }
      }
    }
  }

  if (playerFilter === "all") {
    const firstPlayer = turn % 2 === 1 ? 1 : 2;
    const secondPlayer = firstPlayer === 1 ? 2 : 1;
    const first = allChars.filter(e => e.char.owner === firstPlayer).sort((a, b) => (a.char.spawnOrder || 0) - (b.char.spawnOrder || 0));
    const second = allChars.filter(e => e.char.owner === secondPlayer).sort((a, b) => (a.char.spawnOrder || 0) - (b.char.spawnOrder || 0));
    return [...first, ...second];
  }

  return allChars.sort((a, b) => (a.char.spawnOrder || 0) - (b.char.spawnOrder || 0));
}

function executeCharAction(grid: HexCell[][], char: Character, cr: number, cc: number): { grid: HexCell[][]; action: string } {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell, character: cell.character ? { ...cell.character } : null })));
  const currentChar = newGrid[cr][cc].character!;

  const enemies: { char: Character; r: number; c: number; dist: number }[] = [];
  const allies: { char: Character; r: number; c: number; dist: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = newGrid[r][c].character;
      if (!ch || ch.hp <= 0) continue;
      if (ch.owner !== currentChar.owner) {
        enemies.push({ char: ch, r, c, dist: hexDistance(cr, cc, r, c) });
      } else if (ch !== currentChar) {
        allies.push({ char: ch, r, c, dist: hexDistance(cr, cc, r, c) });
      }
    }
  }

  if (enemies.length === 0) return { grid: newGrid, action: "No enemies — idle" };

  const strategy = (currentChar.strategy || "attack nearest").toLowerCase();

  // Healer logic
  if (currentChar.id === "healer" || strategy.includes("heal")) {
    const wounded = allies.filter(a => a.char.hp < a.char.maxHp).sort((a, b) => a.char.hp - b.char.hp);
    if (wounded.length > 0 && wounded[0].dist <= 2) {
      const target = wounded[0];
      const healAmt = currentChar.atk;
      target.char.hp = Math.min(target.char.maxHp, target.char.hp + healAmt);
      newGrid[target.r][target.c].character = target.char;
      return { grid: newGrid, action: `Healed ${target.char.emoji}${target.char.name} +${healAmt}HP` };
    }
    if (wounded.length > 0) {
      return moveToward(newGrid, currentChar, cr, cc, wounded[0].r, wounded[0].c, `Moving toward wounded ${wounded[0].char.emoji}`);
    }
  }

  const nearest = enemies.sort((a, b) => a.dist - b.dist)[0];
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

  return moveToward(newGrid, currentChar, cr, cc, nearest.r, nearest.c, `Moving toward ${nearest.char.emoji}${nearest.char.name}`);
}

function moveToward(grid: HexCell[][], char: Character, fromR: number, fromC: number, toR: number, toC: number, actionDesc: string) {
  const neighbors = getHexNeighbors(fromR, fromC);
  let bestPos: [number, number] | null = null;
  let bestDist = hexDistance(fromR, fromC, toR, toC);
  for (const [nr, nc] of neighbors) {
    if (grid[nr][nc].character !== null) continue;
    const d = hexDistance(nr, nc, toR, toC);
    if (d < bestDist) { bestDist = d; bestPos = [nr, nc]; }
  }
  if (bestPos) {
    grid[bestPos[0]][bestPos[1]].character = char;
    grid[fromR][fromC].character = null;
    return { grid, action: actionDesc };
  }
  return { grid, action: "Blocked — cannot move" };
}

// ─── Component ─────────────────────────────────────────
const GamePhase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "duel";
  const currentTurn = parseInt(searchParams.get("turn") || "1", 10);

  const gameSettings = JSON.parse(localStorage.getItem("gameSettings") || '{"maxTurns":10,"maxGold":50}');
  const { maxTurns, maxGold } = gameSettings;

  // ─── Core state ───
  const [grid, setGrid] = useState<HexCell[][]>(() => {
    const saved = localStorage.getItem("gameGrid");
    if (saved) {
      const parsed: HexCell[][] = JSON.parse(saved);
      // Validate grid dimensions match current ROWS/COLS
      if (parsed.length === ROWS && parsed[0]?.length === COLS) {
        let spawnCounters = { 1: 0, 2: 0 } as Record<number, number>;
        for (let r = 0; r < parsed.length; r++) {
          for (let c = 0; c < parsed[r].length; c++) {
            const ch = parsed[r][c].character;
            if (ch) {
              const owner = parsed[r][c].owner as 1 | 2;
              ch.owner = owner;
              ch.maxHp = ch.maxHp || ch.hp;
              ch.spawnOrder = ch.spawnOrder ?? spawnCounters[owner]++;
              ch.strategy = ch.strategy || "attack nearest";
            }
          }
        }
        return parsed;
      }
      // Old grid format — discard and start fresh
      localStorage.removeItem("gameGrid");
    }
    return createInitialGrid();
  });

  const [gold, setGold] = useState<Record<1 | 2, number>>(() => {
    const saved = localStorage.getItem("gameGold");
    if (saved) return JSON.parse(saved);
    return { 1: INITIAL_GOLD, 2: INITIAL_GOLD };
  });

  const [step, setStep] = useState<GameStep>({ type: "shopping", player: 1 });
  const [hexBoughtThisTurn, setHexBoughtThisTurn] = useState<Record<1 | 2, boolean>>({ 1: false, 2: false });
  const [popup, setPopup] = useState<PopupType>(null);
  const [popupHex, setPopupHex] = useState<{ r: number; c: number } | null>(null);

  // Execution state
  const [execStepIndex, setExecStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentActing, setCurrentActing] = useState<{ name: string; emoji: string; owner: 1 | 2 } | null>(null);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  const [spawnCounter, setSpawnCounter] = useState<Record<1 | 2, number>>(() => {
    // Count existing characters
    let counts = { 1: 0, 2: 0 } as Record<1 | 2, number>;
    const saved = localStorage.getItem("gameGrid");
    if (saved) {
      const parsed: HexCell[][] = JSON.parse(saved);
      for (const row of parsed) for (const cell of row) {
        if (cell.character && cell.owner) counts[cell.owner as 1 | 2]++;
      }
    }
    return counts;
  });

  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // Reset state when turn changes (React Router reuses the component)
  const prevTurnRef = useRef(currentTurn);
  useEffect(() => {
    if (prevTurnRef.current !== currentTurn) {
      prevTurnRef.current = currentTurn;
      setStep({ type: "shopping", player: 1 });
      setHexBoughtThisTurn({ 1: false, 2: false });
      setExecComplete(false);
      setExecStepIndex(0);
      setIsRunning(false);
      setCurrentActing(null);
      setPopup(null);
      setPopupHex(null);
      // Reload grid/gold from localStorage
      const savedGrid = localStorage.getItem("gameGrid");
      if (savedGrid) {
        const parsed: HexCell[][] = JSON.parse(savedGrid);
        if (parsed.length === ROWS && parsed[0]?.length === COLS) {
          let sc = { 1: 0, 2: 0 } as Record<number, number>;
          for (const row of parsed) for (const cell of row) {
            const ch = cell.character;
            if (ch) {
              ch.owner = cell.owner as 1 | 2;
              ch.maxHp = ch.maxHp || ch.hp;
              ch.spawnOrder = ch.spawnOrder ?? sc[ch.owner!]++;
              ch.strategy = ch.strategy || "attack nearest";
            }
          }
          setGrid(parsed);
          setSpawnCounter(sc as Record<1 | 2, number>);
        }
      }
      const savedGold = localStorage.getItem("gameGold");
      if (savedGold) setGold(JSON.parse(savedGold));
    }
  }, [currentTurn]);

  // ─── Derived ───
  const ownedCount = useCallback((p: 1 | 2) => grid.flat().filter(c => c.owner === p).length, [grid]);
  const charOnBoard = useCallback((p: 1 | 2) => grid.flat().filter(c => c.owner === p && c.character !== null).length, [grid]);
  const maxUnits = useCallback((p: 1 | 2) => ownedCount(p), [ownedCount]);

  const isAdjacentToOwned = (r: number, c: number, player: 1 | 2): boolean => {
    return getHexNeighbors(r, c).some(([nr, nc]) => grid[nr]?.[nc]?.owner === player);
  };

  // ─── Enabled characters from setup ───
  const enabledChars: Character[] = (() => {
    try {
      const saved = localStorage.getItem("enabledCharacters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return CHARACTERS.filter(c => parsed.some((e: any) => e.id === c.id));
      }
    } catch {}
    return CHARACTERS;
  })();

  // ─── Shopping handlers ───
  const handleHexClick = (r: number, c: number) => {
    if (step.type !== "shopping") return;
    const cell = grid[r][c];
    const player = step.player;
    if (cell.owner === null) {
      if (!isAdjacentToOwned(r, c, player)) return;
      setPopupHex({ r, c });
      setPopup("buyHex");
    } else if (cell.owner === player && cell.character === null) {
      setPopupHex({ r, c });
      setPopup("buyChar");
    }
  };

  const buyHex = () => {
    if (step.type !== "shopping" || !popupHex || hexBoughtThisTurn[step.player]) return;
    const player = step.player;
    if (gold[player] < HEX_COST) return;
    const { r, c } = popupHex;
    setGrid(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })));
      next[r][c].owner = player;
      return next;
    });
    setGold(prev => ({ ...prev, [player]: Math.max(0, prev[player] - HEX_COST) }));
    setHexBoughtThisTurn(prev => ({ ...prev, [player]: true }));
    setPopup(null);
    setPopupHex(null);
  };

  const placeCharacter = (char: Character) => {
    if (step.type !== "shopping" || !popupHex) return;
    const player = step.player;
    if (gold[player] < char.cost) return;
    if (charOnBoard(player) >= maxUnits(player)) return;
    const { r, c } = popupHex;
    const order = spawnCounter[player];
    setGrid(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })));
      next[r][c].character = {
        ...char,
        owner: player,
        spawnOrder: order,
        strategy: "attack nearest",
      };
      return next;
    });
    setGold(prev => ({ ...prev, [player]: Math.max(0, prev[player] - char.cost) }));
    setSpawnCounter(prev => ({ ...prev, [player]: prev[player] + 1 }));
    setPopup(null);
    setPopupHex(null);
  };

  // ─── Done button: advance state machine ───
  const handleDone = () => {
    setPopup(null);
    setPopupHex(null);

    if (step.type !== "shopping") return;

    if (currentTurn === 1) {
      // Turn 1: P1 → P2 → execute all
      if (step.player === 1) {
        setHexBoughtThisTurn(prev => ({ ...prev, 2: false }));
        setStep({ type: "shopping", player: 2 });
      } else {
        // Both done, start execution
        saveState();
        startExecution("all");
      }
    } else {
      // Turn 2+: shop → execute that player's units → then other player shops
      saveState();
      startExecution(step.player);
    }
  };

  const saveState = () => {
    localStorage.setItem("gameGrid", JSON.stringify(grid));
    localStorage.setItem("gameGold", JSON.stringify(gold));
  };

  const startExecution = (player: 1 | 2 | "all") => {
    setStep({ type: "executing", player });
    setExecStepIndex(0);
    setIsRunning(true);
    setCurrentActing(null);
  };

  // ─── Execution logic ───
  const checkWin = useCallback((g: HexCell[][]) => {
    const p1Alive = g.flat().some(c => c.character && c.character.owner === 1 && c.character.hp > 0);
    const p2Alive = g.flat().some(c => c.character && c.character.owner === 2 && c.character.hp > 0);
    if (!p1Alive && !p2Alive) { setStep({ type: "game_over" }); setWinner(null); return true; }
    if (!p1Alive) { setStep({ type: "game_over" }); setWinner(2); return true; }
    if (!p2Alive) { setStep({ type: "game_over" }); setWinner(1); return true; }
    return false;
  }, []);

  const [execComplete, setExecComplete] = useState(false);

  const executeStep = useCallback(() => {
    if (step.type !== "executing" || execComplete) return;
    const playerFilter = step.player;

    setGrid(prevGrid => {
      const order = getExecutionOrder(prevGrid, playerFilter, currentTurn);
      if (execStepIndex >= order.length) {
        setExecComplete(true);
        setIsRunning(false);
        return prevGrid;
      }

      const entry = order[execStepIndex];
      // Find current position
      let pos: { r: number; c: number } | null = null;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (prevGrid[r][c].character === entry.char) { pos = { r, c }; break; }
        }
        if (pos) break;
      }

      if (!pos || entry.char.hp <= 0) {
        setExecStepIndex(s => s + 1);
        return prevGrid;
      }

      const { grid: newGrid, action } = executeCharAction(prevGrid, entry.char, pos.r, pos.c);
      setCurrentActing({ name: entry.char.name, emoji: entry.char.emoji, owner: entry.char.owner! });
      setLogs(prev => [...prev, {
        turn: currentTurn,
        characterName: entry.char.name,
        emoji: entry.char.emoji,
        owner: entry.char.owner!,
        action,
      }]);
      setExecStepIndex(s => s + 1);

      if (checkWin(newGrid)) setIsRunning(false);
      return newGrid;
    });
  }, [step, execStepIndex, checkWin, currentTurn, execComplete]);

  // Auto-run execution
  useEffect(() => {
    if (!isRunning || step.type !== "executing") return;
    const timer = setTimeout(executeStep, 600);
    return () => clearTimeout(timer);
  }, [isRunning, step, executeStep, execStepIndex]);

  // Handle execution complete → transition to next step
  const handleExecDone = useCallback(() => {
    setExecComplete(false);
    setCurrentActing(null);

    if (currentTurn === 1) {
      // Turn 1 exec all done → go to turn 2
      goToNextTurn();
    } else {
      // Turn 2+
      if (step.type === "executing") {
        if (step.player === 1) {
          // P1 exec done → P2 shops
          setHexBoughtThisTurn(prev => ({ ...prev, 2: false }));
          setStep({ type: "shopping", player: 2 });
        } else if (step.player === 2) {
          // P2 exec done → next turn
          goToNextTurn();
        } else {
          // "all" — shouldn't happen for turn 2+
          goToNextTurn();
        }
      }
    }
  }, [currentTurn, step]);

  const goToNextTurn = () => {
    const nextTurn = currentTurn + 1;
    if (nextTurn > maxTurns) {
      // Determine winner by HP
      const p1Hp = grid.flat().filter(c => c.character?.owner === 1).reduce((s, c) => s + (c.character?.hp || 0), 0);
      const p2Hp = grid.flat().filter(c => c.character?.owner === 2).reduce((s, c) => s + (c.character?.hp || 0), 0);
      setWinner(p1Hp > p2Hp ? 1 : p2Hp > p1Hp ? 2 : null);
      setStep({ type: "game_over" });
      return;
    }
    // Interest
    const interest1 = Math.floor(gold[1] * 0.1);
    const interest2 = Math.floor(gold[2] * 0.1);
    const newGold = {
      1: Math.min(maxGold, gold[1] + interest1 + 5),
      2: Math.min(maxGold, gold[2] + interest2 + 5),
    };
    setGold(newGold);
    localStorage.setItem("gameGold", JSON.stringify(newGold));
    localStorage.setItem("gameGrid", JSON.stringify(grid));

    // Navigate to next turn (reload state)
    navigate(`/game?mode=${mode}&turn=${nextTurn}`);
  };

  // ─── Pointy-top hex rendering ───
  const hexSize = 36;
  const hexW = Math.sqrt(3) * hexSize; // pointy-top width
  const hexH = 2 * hexSize; // pointy-top height
  const svgW = hexW * COLS + hexW / 2 + 8;
  const svgH = hexH * 0.75 * (ROWS - 1) + hexH + 8;

  const hexPoints = (cx: number, cy: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top: starts at -30°
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

  // Alive characters for status panel
  const aliveChars = grid.flat()
    .filter(c => c.character && c.character.hp > 0)
    .map(c => c.character!)
    .sort((a, b) => {
      if (a.owner !== b.owner) return (a.owner || 0) - (b.owner || 0);
      return (a.spawnOrder || 0) - (b.spawnOrder || 0);
    });

  const isShopping = step.type === "shopping";
  const isExecuting = step.type === "executing";
  const isGameOver = step.type === "game_over";
  const activePlayer = step.type !== "game_over" ? step.player : null;
  const playerColor = activePlayer === 1 ? "text-game-blue" : activePlayer === 2 ? "text-game-orange" : "text-primary";

  const phaseLabel = isShopping ? "SHOPPING" : isExecuting ? "EXECUTING" : "GAME OVER";

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-4">
          {activePlayer && (
            <span className={`font-display text-lg font-bold ${playerColor}`}>
              P{activePlayer}
            </span>
          )}
          <span className="font-display text-xs text-muted-foreground tracking-wider">{phaseLabel}</span>
          <span className="font-display text-xs font-bold text-primary tracking-wider">TURN {currentTurn}/{maxTurns}</span>
        </div>
        <div className="flex items-center gap-5">
          {isShopping && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-lg">🪙</span>
                <span className="font-display text-lg font-bold text-primary">{gold[step.player]}</span>
              </div>
              <div className="flex items-center gap-1.5 font-display text-sm">
                <span className="text-muted-foreground">UNITS</span>
                <span className="font-bold">{charOnBoard(step.player)}/{maxUnits(step.player)}</span>
              </div>
              <div className="flex items-center gap-1.5 font-display text-sm">
                <span className="text-muted-foreground">HEX</span>
                <span className="font-bold">{ownedCount(step.player)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Board */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {isGameOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute z-10 bg-card border border-border rounded-xl px-8 py-6 text-center glow-primary"
            >
              <p className="font-display text-2xl font-bold tracking-wider text-primary mb-1">
                {winner ? `PLAYER ${winner} WINS!` : "DRAW!"}
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/")}
                className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display text-xs font-bold tracking-wider"
              >
                BACK TO MENU
              </motion.button>
            </motion.div>
          )}

          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[820px]">
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const { x, y } = hexCenter(r, c);
                const isClickable = isShopping && (
                  (cell.owner === null && isAdjacentToOwned(r, c, step.player)) ||
                  (cell.owner === step.player && cell.character === null)
                );
                const isActing = isExecuting && currentActing && cell.character &&
                  cell.character.name === currentActing.name && cell.character.owner === currentActing.owner;

                return (
                  <g key={`${r}-${c}`} onClick={() => handleHexClick(r, c)} className={isClickable ? "cursor-pointer" : ""}>
                    <polygon
                      points={hexPoints(x, y)}
                      className={`${getCellColor(cell)} transition-colors ${isClickable ? "hover:brightness-125" : ""}`}
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
                        <rect x={x - 10} y={y + 8} width={20} height={3} rx={1} fill="hsl(var(--muted))" />
                        <rect
                          x={x - 10} y={y + 8}
                          width={Math.max(0, (cell.character.hp / cell.character.maxHp) * 20)}
                          height={3} rx={1}
                          fill={cell.character.hp / cell.character.maxHp > 0.5 ? "hsl(145, 72%, 45%)" : cell.character.hp / cell.character.maxHp > 0.25 ? "hsl(45, 90%, 50%)" : "hsl(0, 72%, 50%)"}
                        />
                      </>
                    )}
                    {isShopping && cell.character && cell.character.hp <= 0 === false && !cell.character && cell.owner === step.player && (
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="pointer-events-none select-none fill-muted-foreground" fontSize="10" opacity={0.4}>+</text>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>

        {/* Right panel */}
        <div className="w-64 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
          {/* Info section (shopping) */}
          {isShopping && (
            <div className="p-3 border-b border-border">
              <p className="font-display text-[10px] tracking-wider text-muted-foreground mb-1">INFORMATION</p>
              <div className="font-body text-xs space-y-0.5 text-muted-foreground">
                <p>🔷 Hex cost: {HEX_COST}g</p>
                <p>📦 Hex buy: {hexBoughtThisTurn[step.player] ? "0" : "1"} left this turn</p>
                <p>👥 Click empty hex → buy territory</p>
                <p>🎯 Click your hex → place unit</p>
              </div>
            </div>
          )}

          {/* Unit Status */}
          <div className="p-3 border-b border-border">
            <p className="font-display text-[10px] tracking-wider text-muted-foreground mb-2">UNIT STATUS</p>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {aliveChars.map((ch, i) => {
                const hpPct = Math.round((ch.hp / ch.maxHp) * 100);
                const acting = currentActing && ch.name === currentActing.name && ch.owner === currentActing.owner;
                return (
                  <div key={`${ch.owner}-${ch.id}-${i}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${acting ? "bg-primary/20 border border-primary/40" : "bg-secondary"} transition-colors`}>
                    <span className="text-sm">{ch.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`font-display text-[10px] tracking-wider ${ch.owner === 1 ? "text-game-blue" : "text-game-orange"}`}>
                          P{ch.owner} {ch.name}
                        </span>
                        <span className="font-display text-[9px] text-muted-foreground">{ch.hp}/{ch.maxHp}</span>
                      </div>
                      <div className="w-full h-1 bg-muted rounded-full mt-0.5">
                        <div className="h-1 rounded-full transition-all"
                          style={{ width: `${hpPct}%`, backgroundColor: hpPct > 50 ? "hsl(145, 72%, 45%)" : hpPct > 25 ? "hsl(45, 90%, 50%)" : "hsl(0, 72%, 50%)" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {aliveChars.length === 0 && <p className="font-body text-xs text-muted-foreground text-center py-2">No units</p>}
            </div>
          </div>

          {/* Action Log */}
          <div className="flex-1 p-3 overflow-hidden flex flex-col">
            <p className="font-display text-[10px] tracking-wider text-muted-foreground mb-2">ACTION LOG</p>
            <div className="flex-1 overflow-y-auto bg-secondary rounded-lg p-2 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-[11px] font-body leading-tight">
                  <span className="font-display text-[9px] text-muted-foreground mr-1">T{log.turn}</span>
                  <span className={log.owner === 1 ? "text-game-blue" : "text-game-orange"}>
                    {log.emoji}{log.characterName}
                  </span>
                  <span className="text-muted-foreground ml-1">{log.action}</span>
                </div>
              ))}
              {logs.length === 0 && <p className="font-body text-[11px] text-muted-foreground">No actions yet</p>}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Bottom buttons */}
          <div className="p-3 border-t border-border">
            {isShopping && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleDone}
                className="w-full px-4 py-3 rounded-lg bg-accent text-accent-foreground font-display text-sm font-bold tracking-wider glow-primary"
              >
                {currentTurn === 1
                  ? (step.player === 1 ? "Done → P2" : "Done → Battle")
                  : `Done → Execute P${step.player}`
                }
              </motion.button>
            )}
            {isExecuting && !execComplete && (
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setIsRunning(r => !r)}
                  className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-display text-xs font-bold tracking-wider">
                  {isRunning ? "⏸ PAUSE" : "▶ RUN"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={executeStep} disabled={isRunning}
                  className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground font-display text-xs font-bold tracking-wider disabled:opacity-30 border border-border">
                  STEP
                </motion.button>
              </div>
            )}
            {isExecuting && execComplete && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExecDone}
                className="w-full px-4 py-3 rounded-lg bg-accent text-accent-foreground font-display text-sm font-bold tracking-wider glow-primary"
              >
                {currentTurn === 1 ? "→ Next Turn" :
                  step.player === 1 ? "→ P2 Shopping" : "→ Next Turn"
                }
              </motion.button>
            )}
            {isGameOver && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate("/")}
                className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold tracking-wider glow-primary">
                BACK TO MENU
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Shopping Popups */}
      <AnimatePresence>
        {popup === "buyHex" && popupHex && isShopping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setPopup(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl p-6 w-80">
              <h3 className="font-display text-sm tracking-wider text-foreground mb-1">BUY TERRITORY</h3>
              <p className="font-body text-xs text-muted-foreground mb-4">
                Hex ({popupHex.r}, {popupHex.c}) — Cost: {HEX_COST}g
              </p>
              {hexBoughtThisTurn[step.player] ? (
                <p className="font-body text-sm text-destructive mb-4">Already bought a hex this turn!</p>
              ) : gold[step.player] < HEX_COST ? (
                <p className="font-body text-sm text-destructive mb-4">Not enough gold!</p>
              ) : null}
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={buyHex}
                  disabled={hexBoughtThisTurn[step.player] || gold[step.player] < HEX_COST}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display text-xs font-bold tracking-wider disabled:opacity-30">
                  BUY ({HEX_COST}g)
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPopup(null)}
                  className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-display text-xs tracking-wider border border-border">
                  CANCEL
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {popup === "buyChar" && popupHex && isShopping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setPopup(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl p-6 w-96">
              <h3 className="font-display text-sm tracking-wider text-foreground mb-1">PLACE CHARACTER</h3>
              <p className="font-body text-xs text-muted-foreground mb-4">
                Hex ({popupHex.r}, {popupHex.c}) — Units: {charOnBoard(step.player)}/{maxUnits(step.player)}
              </p>
              {charOnBoard(step.player) >= maxUnits(step.player) && (
                <p className="font-body text-sm text-destructive mb-3">Unit limit reached!</p>
              )}
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {enabledChars.map(char => {
                  const canAfford = gold[step.player] >= char.cost;
                  const unitsFull = charOnBoard(step.player) >= maxUnits(step.player);
                  return (
                    <motion.button key={char.id} whileTap={{ scale: 0.97 }}
                      onClick={() => placeCharacter(char)} disabled={!canAfford || unitsFull}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 ${tierColors[char.tier]} bg-secondary hover:bg-muted transition-colors disabled:opacity-30 text-left`}>
                      <span className="text-2xl">{char.emoji}</span>
                      <div className="flex-1">
                        <p className="font-display text-xs tracking-wider">{char.name}</p>
                        <p className="font-body text-[10px] text-muted-foreground">HP:{char.hp} ATK:{char.atk} DEF:{char.def}</p>
                      </div>
                      <span className="font-display text-sm font-bold text-primary">{char.cost}g</span>
                    </motion.button>
                  );
                })}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPopup(null)}
                className="w-full mt-3 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-display text-xs tracking-wider border border-border">
                CANCEL
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GamePhase;
