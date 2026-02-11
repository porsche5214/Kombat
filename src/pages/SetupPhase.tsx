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

const CHARACTERS: Character[] = [
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

  const [selectedId, setSelectedId] = useState<string>(CHARACTERS[0].id);
  const [strategies, setStrategies] = useState<Record<string, string>>(
    Object.fromEntries(CHARACTERS.map((c) => [c.id, c.strategy]))
  );

  const selected = CHARACTERS.find((c) => c.id === selectedId) || CHARACTERS[0];

  const handleStrategyChange = (value: string) => {
    setStrategies((prev) => ({ ...prev, [selectedId]: value }));
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
              {CHARACTERS.map((c) => (
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

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="font-display text-xs tracking-wider text-destructive mb-1">HP</p>
              <p className="font-display text-2xl font-bold">{selected.hp}</p>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="font-display text-xs tracking-wider text-game-orange mb-1">ATK</p>
              <p className="font-display text-2xl font-bold">{selected.atk}</p>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="font-display text-xs tracking-wider text-game-blue mb-1">DEF</p>
              <p className="font-display text-2xl font-bold">{selected.def}</p>
            </div>
          </div>

          {/* Strategy code editor */}
          <div>
            <label className="font-display text-xs tracking-wider text-muted-foreground block mb-2">
              STRATEGY CODE
            </label>
            <textarea
              value={strategies[selectedId] || ""}
              onChange={(e) => handleStrategyChange(e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full bg-muted rounded-lg px-4 py-3 font-mono text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
            />
          </div>
        </motion.div>

        <div className="flex justify-end">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(`/shopping?mode=${mode}`)}
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
