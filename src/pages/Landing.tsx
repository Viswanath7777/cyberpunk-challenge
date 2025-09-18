import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Zap, Trophy, Target, Users, ArrowRight, Crown } from "lucide-react";
import { useNavigate } from "react-router";

export default function Landing() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-black text-cyan-400 font-mono overflow-hidden">
      {/* Animated cyberpunk grid background */}
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0 animate-pulse" style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'grid-move 20s linear infinite'
        }} />
      </div>

      {/* Scan lines effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-10" style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.1) 2px, rgba(0,255,255,0.1) 4px)',
          animation: 'scan-lines 0.1s linear infinite'
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-cyan-400/30 bg-black/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold text-cyan-400 glitch-text"
          >
            CYBER_CLASS
          </motion.div>
          
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-green-400">
                    Welcome back, {user?.name}
                  </span>
                  <Button
                    onClick={() => navigate("/dashboard")}
                    className="bg-cyan-400/20 border border-cyan-400 text-cyan-400 hover:bg-cyan-400/30"
                  >
                    Dashboard
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => navigate("/auth")}
                  variant="outline"
                  className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
                >
                  Login
                </Button>
              )}
            </motion.div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center space-y-8">
            {/* Logo/Icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex justify-center"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-cyan-400 to-pink-500 rounded-lg flex items-center justify-center border-2 border-cyan-400 shadow-lg shadow-cyan-400/50">
                <Zap className="w-12 h-12 text-black" />
              </div>
            </motion.div>

            {/* Main Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="space-y-4"
            >
              <h1 className="text-6xl md:text-8xl font-bold glitch-text">
                CYBER_CLASS
              </h1>
              <p className="text-xl md:text-2xl text-pink-500 font-medium">
                Level Up Through Real-World Challenges
              </p>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Compete with your classmates, complete challenges, earn XP, and climb the leaderboard 
                in this cyberpunk-themed gamification system.
              </p>
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-gradient-to-r from-cyan-400 to-pink-500 text-black font-bold text-lg px-8 py-6 hover:shadow-lg hover:shadow-cyan-400/50 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  "Loading..."
                ) : isAuthenticated ? (
                  <>
                    Enter Dashboard
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                ) : (
                  <>
                    Jack In
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </motion.div>
          </div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="grid md:grid-cols-3 gap-8 mt-20"
          >
            <div className="bg-gray-900/50 border border-cyan-400/30 p-6 rounded-lg hover:border-cyan-400/60 transition-all">
              <Target className="w-12 h-12 text-cyan-400 mb-4" />
              <h3 className="text-xl font-bold text-cyan-400 mb-2">Daily Challenges</h3>
              <p className="text-gray-400">
                Complete real-world tasks and submit proof to earn XP and level up your character.
              </p>
            </div>

            <div className="bg-gray-900/50 border border-pink-500/30 p-6 rounded-lg hover:border-pink-500/60 transition-all">
              <Trophy className="w-12 h-12 text-pink-500 mb-4" />
              <h3 className="text-xl font-bold text-pink-500 mb-2">Leaderboard</h3>
              <p className="text-gray-400">
                Compete with classmates and climb the ranks. Top performers earn special badges.
              </p>
            </div>

            <div className="bg-gray-900/50 border border-green-500/30 p-6 rounded-lg hover:border-green-500/60 transition-all">
              <Users className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="text-xl font-bold text-green-500 mb-2">Class Competition</h3>
              <p className="text-gray-400">
                Built for 38 students with character progression, XP system, and weekly competitions.
              </p>
            </div>
          </motion.div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="mt-20 text-center"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-cyan-400">38</div>
                <div className="text-sm text-gray-400 uppercase">Students</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-pink-500">∞</div>
                <div className="text-sm text-gray-400 uppercase">Challenges</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-500">100</div>
                <div className="text-sm text-gray-400 uppercase">XP per Level</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-yellow-400">3</div>
                <div className="text-sm text-gray-400 uppercase">Weekly Badges</div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-cyan-400/30 bg-black/80 backdrop-blur">
        <div className="container mx-auto px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Crown className="w-4 h-4" />
            Powered by{" "}
            <a
              href="https://vly.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              vly.ai
            </a>
          </div>
        </div>
      </footer>

      <style>{`
        .glitch-text {
          text-shadow: 
            0.05em 0 0 #ff0080,
            -0.05em -0.025em 0 #00ffff,
            0.025em 0.05em 0 #00ff00;
        }
        
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        
        @keyframes scan-lines {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
      `}</style>
    </div>
  );
}