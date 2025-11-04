import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { Home } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/10"
    >
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(219, 39, 119, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.25) 0%, transparent 50%),
            radial-gradient(circle at 40% 20%, rgba(236, 72, 153, 0.3) 0%, transparent 50%)
          `
        }} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <div className="max-w-5xl mx-auto relative px-4">
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center space-y-6">
              <h1 className="text-8xl font-bold text-primary mb-4">404</h1>
              <p className="text-2xl text-foreground mb-2">Page Not Found</p>
              <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist.</p>
              <Button
                onClick={() => navigate("/")}
                className="bg-primary/20 border border-primary text-primary hover:bg-primary/30"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}