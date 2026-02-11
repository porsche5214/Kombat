import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

type GameMode = "duel" | "solitaire" | "auto" | null;

const modes = [
  {
    id: "duel" as const,
    name: "Duel",
    description: "ต่อสู้กับผู้เล่นอีกคน แบบตัวต่อตัว วางแผนเพื่อเอาชนะคู่แข่ง",
    icon: "⚔️",
  },
  {
    id: "solitaire" as const,
    name: "Solitaire",
    description: "เล่นคนเดียว ฝึกฝนกลยุทธ์และทดลองคอมโบการ์ดต่างๆ",
    icon: "🃏",
  },
  {
    id: "auto" as const,
    name: "Auto",
    description: "ดู AI ต่อสู้กันแบบอัตโนมัติ เรียนรู้กลยุทธ์จากการสังเกต",
    icon: "🤖",
  },
];

const SelectMode = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<GameMode>(null);

  return (
    <div className="flex min-h-screen flex-col items-center bg-background relative overflow-hidden px-4 py-8">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold tracking-wider z-10"
      >
        Back
      </motion.button>

      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-3xl font-bold tracking-wider mt-16 mb-10"
      >
        SELECT MODE
      </motion.h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-10">
        {modes.map((mode, i) => (
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => setSelected(mode.id)}
            className={`game-card cursor-pointer p-6 flex flex-col items-center text-center ${
              selected === mode.id ? "game-card-selected" : ""
            }`}
          >
            {/* Mode label */}
            <span
              className={`font-display text-sm font-bold tracking-wider mb-4 px-3 py-1 rounded ${
                selected === mode.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              } transition-colors`}
            >
              {mode.name}
            </span>

            {/* Placeholder image area */}
            <div className="w-full aspect-[4/3] rounded-md bg-muted mb-4 flex items-center justify-center text-5xl">
              {mode.icon}
            </div>

            {/* Description */}
            <p
              className={`font-body text-sm leading-relaxed transition-colors ${
                selected === mode.id
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {mode.description}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: selected ? 1.05 : 1 }}
        whileTap={{ scale: selected ? 0.97 : 1 }}
        disabled={!selected}
        onClick={() => selected && navigate(`/setup?mode=${selected}`)}
        className={`px-8 py-3 rounded-lg font-display font-bold text-sm tracking-wider transition-all ${
          selected
            ? "bg-primary text-primary-foreground glow-primary cursor-pointer"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        Start Game
      </motion.button>
    </div>
  );
};

export default SelectMode;
