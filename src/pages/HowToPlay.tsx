import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const phases = [
  {
    num: "1",
    title: "Setup Phase",
    desc: "เลือกโหมดเกมและจัดเตรียมการ์ดเริ่มต้น",
    color: "text-primary",
  },
  {
    num: "2",
    title: "Shopping Phase",
    desc: "ซื้อการ์ดจากร้านค้าเพื่อเสริมสร้างกลยุทธ์ของคุณ",
    color: "text-game-blue",
  },
  {
    num: "3",
    title: "Execution Phase",
    desc: "ใช้การ์ดเพื่อโจมตีคู่ต่อสู้และป้องกันตัวเอง",
    color: "text-game-orange",
  },
  {
    num: "4",
    title: "Win Condition",
    desc: "ลด HP ของคู่ต่อสู้ให้เหลือ 0 เพื่อชนะ",
    color: "text-destructive",
  },
];

const HowToPlay = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background relative overflow-hidden px-4 py-8">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold tracking-wider z-10"
      >
        Back
      </motion.button>

      <div className="max-w-3xl mx-auto w-full mt-16">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold tracking-wider mb-10 text-center"
        >
          HOW TO PLAY
        </motion.h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phases */}
          <div className="space-y-4">
            {phases.map((phase, i) => (
              <motion.div
                key={phase.num}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="game-card p-5"
              >
                <div className="flex items-start gap-4">
                  <span className={`font-display text-2xl font-black ${phase.color}`}>
                    {phase.num}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-wide mb-1">
                      {phase.title}
                    </h3>
                    <p className="font-body text-sm text-muted-foreground leading-relaxed">
                      {phase.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Card examples */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <h3 className="font-display text-lg font-bold tracking-wide mb-4">
              ตัวอย่างการ์ด
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {["Hero", "Hero", "Hero", "Hero"].map((name, i) => (
                <div
                  key={i}
                  className="game-card aspect-[3/4] flex items-center justify-center"
                >
                  <span className="font-body text-muted-foreground text-sm">{name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay;
