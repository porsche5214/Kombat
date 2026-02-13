import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
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
  strategy: string;
}

const DEFAULT_CHARACTERS: Character[] = [
  { id: "warrior", name: "Warrior", emoji: "⚔️", hp: 120, atk: 15, def: 10, strategy: "// Attack nearest enemy\nif (enemy.distance < 2) {\n  attack(enemy);\n}" },
  { id: "mage", name: "Mage", emoji: "🔮", hp: 80, atk: 25, def: 5, strategy: "// Cast spell on weakest\nconst target = enemies.sortBy('hp')[0];\ncastSpell(target);" },
  { id: "tank", name: "Tank", emoji: "🛡️", hp: 200, atk: 8, def: 20, strategy: "// Defend allies\nif (ally.hp < 50) {\n  defend(ally);\n}" },
  { id: "assassin", name: "Assassin", emoji: "🗡️", hp: 70, atk: 30, def: 3, strategy: "// Strike from behind\nif (canFlank(enemy)) {\n  backstab(enemy);\n}" },
  { id: "healer", name: "Healer", emoji: "💚", hp: 90, atk: 10, def: 8, strategy: "// Heal lowest HP ally\nconst wounded = allies.sortBy('hp')[0];\nheal(wounded);" },
];

const SetupPhase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "duel";

  const [selectedId, setSelectedId] = useState<string>(DEFAULT_CHARACTERS[0].id);
  const [characters, setCharacters] = useState<Character[]>(
    DEFAULT_CHARACTERS.map((c) => ({ ...c }))
  );
  const [maxTurns, setMaxTurns] = useState(10);
  const [maxGold, setMaxGold] = useState(50);

  const selected = characters.find((c) => c.id === selectedId) || characters[0];

  const updateCharField = (field: keyof Character, value: string | number) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, [field]: value } : c))
    );
  };

  const handleStatChange = (field: "hp" | "atk" | "def", raw: string) => {
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 0) {
      updateCharField(field, num);
    } else if (raw === "") {
      updateCharField(field, 0);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background relative overflow-hidden px-4 py-8">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/select-mode")}
        className="absolute top-6 left-6 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-display text-sm font-bold tracking-wider z-10"
      >
        Exit
      </motion.button>

      <div className="max-w-2xl mx-auto w-full mt-16">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold tracking-wider mb-2"
        >
          SETUP
        </motion.h1>
        <p className="text-muted-foreground font-body text-sm mb-8 uppercase tracking-wider">
          Mode: {mode}
        </p>

        {/* Character selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <label className="font-display text-xs tracking-wider text-muted-foreground block mb-2">
            SELECT CHARACTER
          </label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full bg-secondary border-border font-body">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {characters.map((c) => (
                <SelectItem key={c.id} value={c.id} className="font-body">
                  <span className="flex items-center gap-2">
                    <span>{c.emoji}</span>
                    <span>{c.name}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      HP:{c.hp} ATK:{c.atk} DEF:{c.def}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Character card */}
        <motion.div
          key={selectedId}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="game-card p-6 mb-6"
        >
          {/* Avatar & name */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center text-4xl border border-border">
              {selected.emoji}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold tracking-wider">
                {selected.name}
              </h2>
              <p className="text-muted-foreground font-body text-sm">
                ID: {selected.id}
              </p>
            </div>
          </div>

          {/* Editable Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {(["hp", "atk", "def"] as const).map((stat) => {
              const colors = {
                hp: "text-destructive",
                atk: "text-game-orange",
                def: "text-game-blue",
              };
              return (
                <div key={stat} className="bg-secondary rounded-lg p-3 text-center">
                  <p className={`font-display text-xs tracking-wider ${colors[stat]} mb-1`}>
                    {stat.toUpperCase()}
                  </p>
                  <input
                    type="number"
                    min={0}
                    value={selected[stat]}
                    onChange={(e) => handleStatChange(stat, e.target.value)}
                    className="w-full bg-transparent text-center font-display text-2xl font-bold text-foreground outline-none focus:ring-1 focus:ring-primary rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              );
            })}
          </div>

          {/* Strategy code editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-display text-xs tracking-wider text-muted-foreground">
                STRATEGY CODE
              </label>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  const def = DEFAULT_CHARACTERS.find((c) => c.id === selectedId);
                  if (def) updateCharField("strategy", def.strategy);
                }}
                className="px-3 py-1 rounded bg-secondary border border-border text-muted-foreground font-display text-[10px] tracking-wider hover:border-destructive/50 hover:text-destructive transition-colors"
              >
                RESET
              </motion.button>
            </div>
            <textarea
              value={selected.strategy}
              onChange={(e) => updateCharField("strategy", e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full bg-muted rounded-lg px-4 py-3 font-mono text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
            />
          </div>
        </motion.div>

        {/* Game limits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="game-card p-6 mb-6"
        >
          <h3 className="font-display text-xs tracking-wider text-muted-foreground mb-4">GAME LIMITS</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="font-display text-xs tracking-wider text-primary mb-1">MAX TURNS</p>
              <input
                type="number"
                min={1}
                max={99}
                value={maxTurns}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 99) setMaxTurns(v);
                }}
                className="w-full bg-transparent text-center font-display text-2xl font-bold text-foreground outline-none focus:ring-1 focus:ring-primary rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="font-display text-xs tracking-wider text-game-orange mb-1">MAX GOLD</p>
              <input
                type="number"
                min={1}
                max={999}
                value={maxGold}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 999) setMaxGold(v);
                }}
                className="w-full bg-transparent text-center font-display text-2xl font-bold text-foreground outline-none focus:ring-1 focus:ring-primary rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </motion.div>

        <div className="flex justify-end">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              localStorage.setItem("gameSettings", JSON.stringify({ maxTurns, maxGold }));
              navigate(`/shopping?mode=${mode}&turn=1`);
            }}
            className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm tracking-wider glow-primary"
          >
            Start Game
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default SetupPhase;
