import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";

const ShoppingPhase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "duel";
  const [currentPlayer] = useState(1);

  return (
    <div className="flex min-h-screen flex-col bg-background relative overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <span className="font-display text-sm tracking-wider text-muted-foreground">
            Table 1/10
          </span>
        </div>
        <span className="font-display text-lg font-bold">
          Player {currentPlayer}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-display text-sm text-game-blue">⬡</span>
          <span className="font-display text-sm">0</span>
          <span className="font-display text-sm text-muted-foreground">/</span>
          <span className="font-display text-sm text-game-orange">♦</span>
          <span className="font-display text-sm">8/10</span>
        </div>
      </div>

      {/* Game board */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        {/* Opponent token */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-16 h-16 rounded-full bg-game-orange flex items-center justify-center"
        >
          <span className="font-display text-xl font-bold text-primary-foreground">P2</span>
        </motion.div>

        {/* Board area */}
        <div className="w-full max-w-lg aspect-square bg-game-surface rounded-xl border border-border flex items-center justify-center relative">
          <div className="absolute inset-4 border border-border/50 rounded-lg" />
          <span className="text-muted-foreground font-body">Game Board</span>

          {/* Player tokens */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            <div className="w-10 h-10 rounded-full bg-game-blue flex items-center justify-center">
              <span className="font-display text-xs font-bold text-primary-foreground">P1</span>
            </div>
          </div>
        </div>

        {/* Player token */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-game-blue flex items-center justify-center">
            <span className="font-display text-xs font-bold text-primary-foreground">P1</span>
          </div>
        </div>
      </div>

      {/* Bottom card bar */}
      <div className="border-t border-border px-6 py-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <div className="px-3 py-1 rounded bg-primary text-primary-foreground font-display text-xs font-bold shrink-0">
            My Deck
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="game-card w-16 h-20 shrink-0 flex items-center justify-center cursor-pointer"
            >
              <span className="text-muted-foreground font-body text-xs">Card</span>
            </motion.div>
          ))}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/")}
            className="ml-auto px-6 py-2 rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold tracking-wider shrink-0"
          >
            Done
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ShoppingPhase;
