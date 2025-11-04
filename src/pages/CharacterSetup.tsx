import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Zap, User, Coins } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function CharacterSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initializeCharacter = useMutation(api.characters.initializeCharacter);
  
  const [characterName, setCharacterName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCharacter = async () => {
    if (!characterName.trim()) {
      toast.error("Please enter a character name");
      return;
    }

    setIsCreating(true);
    try {
      await initializeCharacter({
        characterName: characterName.trim(),
      });
      
      toast.success("Character created! Welcome to the competition!");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create character");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 text-foreground font-sans flex items-center justify-center">
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

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <Card className="w-full max-w-md bg-card/95 border-2 border-primary/30 backdrop-blur shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center border-2 border-primary">
                <User className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-primary">
              Initialize Character
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Create your persona for the class competition
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="characterName" className="text-foreground">
                Character Name
              </Label>
              <Input
                id="characterName"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Enter your alias..."
                className="bg-background/50 border-border text-foreground placeholder-muted-foreground"
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    handleCreateCharacter();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Choose wisely - this will be your identity in the competition
              </p>
            </div>

            <div className="bg-background/50 p-4 rounded border border-border">
              <h3 className="text-sm font-medium text-primary mb-2">Starting Stats:</h3>
              <div className="space-y-1 text-sm text-foreground">
                <div className="flex justify-between">
                  <span>Level:</span>
                  <span className="text-primary">1</span>
                </div>
                <div className="flex justify-between">
                  <span>XP:</span>
                  <span className="text-secondary flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    0
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Credits:</span>
                  <span className="text-accent flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    1000
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Rank:</span>
                  <span className="text-muted-foreground">Rookie</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreateCharacter}
              disabled={isCreating || !characterName.trim()}
              className="w-full bg-primary/20 border border-primary text-primary hover:bg-primary/30 disabled:opacity-50"
            >
              {isCreating ? "Initializing..." : "Enter the Game"}
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              Welcome, {user?.name || "Anonymous"}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}