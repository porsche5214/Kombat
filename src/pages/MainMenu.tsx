import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const MainMenu = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Glow orb */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 text-center"
      >
        <h1 className="font-display text-7xl font-black tracking-wider glow-text mb-2">
          KOMBAT
        </h1>
        <p className="text-muted-foreground font-body text-lg tracking-widest uppercase mb-12">
          Card Strategy Game
        </p>

        <div className="flex flex-col gap-4 items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/select-mode")}
            className="w-52 py-3 rounded-lg bg-primary text-primary-foreground font-display font-bold text-lg tracking-wider glow-primary transition-all"
          >
            Play
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/how-to-play")}
            className="w-52 py-3 rounded-lg border border-primary/40 text-primary font-display font-semibold text-sm tracking-wider hover:bg-primary/10 transition-all"
          >
            How to Play
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default MainMenu;
