import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const isValidEmail = (value: string) => {
    const trimmed = value.trim();
    // Basic RFC-ish email pattern; prevents common typos like missing TLD
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return re.test(trimmed);
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirect = redirectAfterAuth || "/";
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirectAfterAuth]);

  const handleGuestLogin = () => {
    setError("Guest login is currently unavailable. Please sign in with your email.");
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const trimmed = email.trim().toLowerCase();
      if (!isValidEmail(trimmed)) {
        setError("Please enter a valid email address (e.g., name@example.com).");
        setIsLoading(false);
        return;
      }

      const formData = new FormData();
      formData.set("email", trimmed);

      await signIn("email-otp", formData);
      setStep({ email: trimmed });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // Ensure code is 6 digits
      const code = otp.trim();
      if (!/^\d{6}$/.test(code)) {
        setError("Enter the 6‑digit code sent to your email.");
        setIsLoading(false);
        return;
      }

      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);

      console.log("signed in");

      const redirect = redirectAfterAuth || "/";
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);

      setError("The verification code you entered is incorrect.");
      setIsLoading(false);

      setOtp("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(236, 72, 153, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(236, 72, 153, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Auth Content */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
        <Card className="w-full pb-0 border-2 shadow-2xl backdrop-blur-sm bg-card/95">
          {step === "signIn" ? (
            <>
              <CardHeader className="text-center space-y-4 pt-8 pb-6">
                <div className="flex justify-center">
                  <div className="relative group cursor-pointer" onClick={() => navigate("/")}>
                    <img
                      src="https://harmless-tapir-303.convex.cloud/api/storage/fbcf8f6c-2e72-4311-8879-4b1ddcd707b7"
                      alt="SPIN CITY Logo"
                      width={80}
                      height={80}
                      className="transition-transform group-hover:scale-105"
                    />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-primary mb-2">Welcome to SPIN CITY</CardTitle>
                  <CardDescription className="text-base">
                    Enter your email to continue
                  </CardDescription>
                </div>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent className="space-y-4 px-8">
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="pl-10 h-12 text-base border-2 focus:border-primary transition-colors"
                        disabled={isLoading}
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => {
                          if (email && !isValidEmail(email)) {
                            setError("Please enter a valid email address (e.g., name@example.com).");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && email.trim() && isValidEmail(email) && !isLoading) {
                            e.currentTarget.form?.requestSubmit();
                          }
                        }}
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive flex items-start gap-1">
                        <span className="text-base">⚠️</span>
                        <span>{error}</span>
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 transition-all"
                    disabled={isLoading || !email.trim() || !isValidEmail(email)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                  
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-3 text-muted-foreground font-medium">
                        Or
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 border-2"
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                  >
                    <UserX className="mr-2 h-5 w-5" />
                    Continue as Guest
                  </Button>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="text-center space-y-3 pt-8 pb-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold mb-2">Check your email</CardTitle>
                  <CardDescription className="text-base">
                    We've sent a 6-digit code to<br />
                    <span className="font-medium text-foreground">{step.email}</span>
                  </CardDescription>
                </div>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="pb-6 px-8 space-y-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) {
                              form.requestSubmit();
                            }
                          }
                        }}
                      >
                        <InputOTPGroup className="gap-2">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot 
                              key={index} 
                              index={index}
                              className="w-12 h-14 text-lg border-2"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="text-sm text-destructive text-center flex items-center justify-center gap-1">
                        <span>⚠️</span>
                        <span>{error}</span>
                      </p>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground text-center">
                    Didn't receive a code?{" "}
                    <Button
                      variant="link"
                      className="p-0 h-auto text-primary hover:text-primary/80 font-medium"
                      onClick={() => {
                        setStep("signIn");
                        setOtp("");
                        setError(null);
                      }}
                    >
                      Resend code
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-3 px-8 pb-8">
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify & Continue
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep("signIn");
                      setOtp("");
                      setError(null);
                    }}
                    disabled={isLoading}
                    className="w-full h-10 text-sm"
                  >
                    Use different email
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-muted/50 border-t rounded-b-lg">
            🔒 Secured by{" "}
            <a
              href="https://vly.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              vly.ai
            </a>
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}