import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";

const SetupPhase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "duel";

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

      <div className="max-w-4xl mx-auto w-full mt-16">
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

        {/* Main setup area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="game-card p-6 mb-6"
        >
          <div className="aspect-video bg-muted rounded-md flex items-center justify-center mb-6">
            <span className="text-muted-foreground font-body text-lg">
              เลือกการ์ดเริ่มต้น
            </span>
          </div>

          {/* Player info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-secondary rounded-lg p-4">
              <label className="font-display text-xs tracking-wider text-muted-foreground block mb-2">
                Name
              </label>
              <input
                type="text"
                placeholder="Player 1"
                className="w-full bg-muted rounded px-3 py-2 font-body text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="bg-secondary rounded-lg p-4">
              <label className="font-display text-xs tracking-wider text-muted-foreground block mb-2">
                D.4
              </label>
              <input
                type="text"
                placeholder="0"
                className="w-full bg-muted rounded px-3 py-2 font-body text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </motion.div>

        <div className="flex justify-end">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
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
