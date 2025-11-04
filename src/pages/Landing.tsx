import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Zap, Trophy, Target, Users, ArrowRight, Crown } from "lucide-react";
import { useNavigate } from "react-router";

export default function Landing() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 overflow-hidden">
      {/* Modern animated background */}
      <div className="fixed inset-0 opacity-[0.05]">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(236, 72, 153, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(250, 204, 21, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 20%, rgba(168, 85, 247, 0.3) 0%, transparent 50%)
          `,
          animation: 'float 20s ease-in-out infinite'
        }} />
      </div>

      {/* Floating shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-36 h-36 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border bg-card/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <img 
              src="https://harmless-tapir-303.convex.cloud/api/storage/fbcf8f6c-2e72-4311-8879-4b1ddcd707b7" 
              alt="Spin City Logo" 
              className="h-10 w-auto"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              SPIN CITY
            </span>
          </motion.div>
          
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">
                    Welcome back, {user?.name}
                  </span>
                  <Button
                    onClick={() => navigate("/dashboard")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await signOut();
                      navigate("/auth");
                    }}
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    Logout
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => navigate("/auth")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
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
              <div className="w-24 h-24 bg-gradient-to-br from-primary via-accent to-secondary rounded-2xl flex items-center justify-center shadow-2xl pulse-glow">
                <Zap className="w-12 h-12 text-white" />
              </div>
            </motion.div>

            {/* Main Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="space-y-4"
            >
              <div className="flex flex-col items-center gap-4">
                <img 
                  src="https://harmless-tapir-303.convex.cloud/api/storage/fbcf8f6c-2e72-4311-8879-4b1ddcd707b7" 
                  alt="Spin City Logo" 
                  className="h-32 w-auto"
                />
                <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  SPIN CITY
                </h1>
              </div>
              <p className="text-xl md:text-2xl font-semibold text-primary">
                Level Up Through Real-World Challenges
              </p>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
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
                className="bg-gradient-to-r from-primary to-accent text-white font-bold text-lg px-8 py-6 hover:shadow-2xl hover:scale-105 transition-all duration-300 pulse-glow"
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
            <div className="bg-card border border-border p-6 rounded-2xl hover:shadow-xl hover:scale-105 transition-all duration-300">
              <Target className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Daily Challenges</h3>
              <p className="text-muted-foreground">
                Complete real-world tasks and submit proof to earn XP and level up your character.
              </p>
            </div>

            <div className="bg-card border border-border p-6 rounded-2xl hover:shadow-xl hover:scale-105 transition-all duration-300">
              <Trophy className="w-12 h-12 text-secondary mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Leaderboard</h3>
              <p className="text-muted-foreground">
                Compete with classmates and climb the ranks. Top performers earn special badges.
              </p>
            </div>

            <div className="bg-card border border-border p-6 rounded-2xl hover:shadow-xl hover:scale-105 transition-all duration-300">
              <Users className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Class Competition</h3>
              <p className="text-muted-foreground">
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
                <div className="text-3xl font-bold text-primary">38</div>
                <div className="text-sm text-muted-foreground uppercase">Students</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-accent">∞</div>
                <div className="text-sm text-muted-foreground uppercase">Challenges</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-secondary">100</div>
                <div className="text-sm text-muted-foreground uppercase">XP per Level</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">3</div>
                <div className="text-sm text-muted-foreground uppercase">Weekly Badges</div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Crown className="w-4 h-4 text-primary" />
            Powered by{" "}
            <a
              href="https://vly.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors font-medium"
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
        
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}