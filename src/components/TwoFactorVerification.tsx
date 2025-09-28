import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, Shield, RefreshCw, Mail, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateDeviceFingerprint, getDeviceInfo, getDeviceDescription, isDeviceFingerprintingSupported } from "@/lib/deviceFingerprint";

interface TwoFactorVerificationProps {
  email: string;
  userRole: string;
  onVerificationSuccess: () => void;
  onBack: () => void;
}

export const TwoFactorVerification = ({ 
  email, 
  userRole, 
  onVerificationSuccess, 
  onBack 
}: TwoFactorVerificationProps) => {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");
  const [deviceDescription, setDeviceDescription] = useState<string>("");
  const [deviceFingerprintSupported, setDeviceFingerprintSupported] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize device fingerprinting
  useEffect(() => {
    const initDeviceFingerprint = async () => {
      const supported = isDeviceFingerprintingSupported();
      setDeviceFingerprintSupported(supported);
      
      if (supported) {
        try {
          const fingerprint = await generateDeviceFingerprint();
          const description = getDeviceDescription();
          setDeviceFingerprint(fingerprint);
          setDeviceDescription(description);
        } catch (error) {
          console.error('Failed to generate device fingerprint:', error);
        }
      }
    };
    
    initDeviceFingerprint();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sendVerificationCode = useCallback(async () => {
    setIsSendingCode(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-2fa-code', {
        body: { email, userRole }
      });

      if (error) {
        console.error('🔐 Edge Function error:', error);
        throw error;
      }
      toast({
        title: "Verification code sent",
        description: `A 6-digit code has been sent to ${email}`,
      });

      setTimeLeft(300); // Reset timer
      setCanResend(false);
      setCode(""); // Clear any existing code
      setAttempts(0); // Reset attempts

    } catch (error: unknown) {
      console.error('🔐 Send code error:', error);
      
      let title = "Failed to send code";
      let description = "Please try again";
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Handle specific error cases with user-friendly messages
        if (errorMessage.includes('too many verification codes') || errorMessage.includes('wait 10 minutes')) {
          title = "Too Many Requests";
          description = "You've requested too many verification codes. Please wait 10 minutes before trying again.";
        } else if (errorMessage.includes('sendgrid') || errorMessage.includes('email')) {
          title = "Email Service Issue";
          description = "Unable to send email. Please contact support if this continues.";
        } else if (errorMessage.includes('api key') || errorMessage.includes('configuration')) {
          title = "Service Configuration Issue";
          description = "Email service is temporarily unavailable. Please try again later.";
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          title = "Network Error";
          description = "Network connection issue. Please check your internet and try again.";
        } else if (error.message) {
          // Use the actual error message if it's user-friendly
          description = error.message;
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setIsSendingCode(false);
    }
  }, [email, userRole]);

  // Send initial 2FA code when component mounts
  useEffect(() => {
    sendVerificationCode();
  }, [sendVerificationCode]);

  const handleCodeChange = (value: string, index: number) => {
    // Only allow digits
    const newValue = value.replace(/\D/g, '');
    
    if (newValue.length > 1) return;

    const newCode = code.split('');
    newCode[index] = newValue;
    
    const updatedCode = newCode.join('');
    setCode(updatedCode);

    // Auto-focus next input
    if (newValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits are entered
    if (updatedCode.length === 6 && updatedCode.replace(/\D/g, '').length === 6) {
      verifyCode(updatedCode);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedData.length === 6) {
      setCode(pastedData);
      verifyCode(pastedData);
    } else {
      toast({
        title: "Invalid paste",
        description: "Please paste a 6-digit verification code",
        variant: "destructive",
      });
    }
  };

  const verifyCode = async (codeToVerify?: string) => {
    const verificationCode = codeToVerify || code;
    
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter all 6 digits",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setAttempts(prev => prev + 1);

    try {
      const requestBody = { email, code: verificationCode };
      
      // Add device trust information if remember device is enabled
      if (rememberDevice && deviceFingerprint && deviceFingerprintSupported) {
        const deviceInfo = await getDeviceInfo();
        requestBody.rememberDevice = true;
        requestBody.deviceFingerprint = deviceFingerprint;
        requestBody.deviceInfo = deviceInfo;
      }

      const { data, error } = await supabase.functions.invoke('verify-2fa-code', {
        body: requestBody
      });

      if (error) throw error;

      if (data.verified) {
        toast({
          title: "Verification successful!",
          description: rememberDevice 
            ? "Device trusted for 30 days. You will be redirected to your dashboard"
            : "You will be redirected to your dashboard",
        });
        onVerificationSuccess();
      } else {
        throw new Error('Verification failed');
      }

    } catch (error: unknown) {
      let title = "Verification failed";
      let description = "Invalid verification code";
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Handle specific verification error cases
        if (errorMessage.includes('expired') || errorMessage.includes('timeout')) {
          title = "Code Expired";
          description = "Your verification code has expired. Please request a new one.";
          setCanResend(true);
        } else if (errorMessage.includes('invalid') || errorMessage.includes('incorrect')) {
          title = "Incorrect Code";
          description = attempts >= 2 ? "Invalid code. Try requesting a new verification code." : "Please check your code and try again.";
        } else if (errorMessage.includes('too many') || errorMessage.includes('rate limit')) {
          title = "Too Many Attempts";
          description = "Too many failed attempts. Please wait a moment and try again.";
        } else if (errorMessage.includes('not found') || errorMessage.includes('no code')) {
          title = "Code Not Found";
          description = "No verification code found. Please request a new one.";
          setCanResend(true);
        } else if (error.message && !errorMessage.includes('function') && !errorMessage.includes('edge')) {
          // Use the actual error message if it's user-friendly (not technical)
          description = error.message;
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
      
      // Clear the code for retry
      setCode("");
      inputRefs.current[0]?.focus();
      
      // If too many attempts, suggest resending
      if (attempts >= 2) {
        setCanResend(true);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const codeDigits = code.padEnd(6, '').split('');

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Futuristic Agri-Finance Background - Same as Login */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-blue-50 to-green-50"></div>
      
      {/* Geometric Pattern Overlay - Representing Crop Fields & Financial Growth */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(34,197,94,0.1) 1px, transparent 1px),
            linear-gradient(rgba(34,197,94,0.1) 1px, transparent 1px),
            linear-gradient(45deg, rgba(59,130,246,0.05) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(59,130,246,0.05) 25%, transparent 25%)
          `,
          backgroundSize: '60px 60px, 60px 60px, 120px 120px, 120px 120px',
          backgroundPosition: '0 0, 0 0, 0 0, 30px 30px'
        }}
      ></div>

      {/* Floating Elements - Technology & Agriculture Symbols */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-emerald-400/20 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-3 h-3 bg-blue-400/20 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-16 w-1.5 h-1.5 bg-green-400/20 rounded-full animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-12 w-2.5 h-2.5 bg-teal-400/20 rounded-full animate-pulse delay-500"></div>
        <div className="absolute top-1/3 left-1/4 w-1 h-1 bg-emerald-300/30 rounded-full animate-pulse delay-1500"></div>
        <div className="absolute top-2/3 right-1/3 w-2 h-2 bg-blue-300/30 rounded-full animate-pulse delay-700"></div>
      </div>

      {/* Content Container with Glass Morphism Effect */}
      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-white/60 backdrop-blur-md border-white/30 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-emerald-100/50 backdrop-blur-sm rounded-full w-fit border border-emerald-200/30">
              <Shield className="h-8 w-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-heading-primary">
              🔐 Two-Factor Authentication
            </CardTitle>
            <p className="text-sm text-body-secondary">
              We've sent a verification code to<br />
              <span className="font-medium text-heading-primary">{email}</span>
            </p>
          </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3 text-center">
              Enter your 6-digit verification code
            </label>
            

            
            <div className="flex gap-3 justify-center mb-4">
              {codeDigits.map((digit, index) => (
                <Input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-14 h-14 text-center text-2xl font-bold border-2 border-emerald-200/50 rounded-lg focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 bg-white/80 backdrop-blur-sm shadow-md"
                  placeholder="•"
                  disabled={isVerifying}
                />
              ))}
            </div>
            
            {/* Fallback single input for testing */}
            <div className="mt-4">
              <label className="block text-xs text-muted-foreground mb-2 text-center">
                Or paste the full 6-digit code here:
              </label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 6) {
                    setCode(value);
                    if (value.length === 6) {
                      verifyCode(value);
                    }
                  }
                }}
                onPaste={handlePaste}
                className="w-full text-center text-xl font-mono tracking-widest bg-white/80 backdrop-blur-sm border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20"
                placeholder="123456"
                disabled={isVerifying}
              />
            </div>
          </div>

          {timeLeft > 0 && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Code expires in <span className="font-medium text-orange-600">{formatTime(timeLeft)}</span>
              </p>
            </div>
          )}

          {/* Remember Device Option */}
          {deviceFingerprintSupported && (
            <div className="bg-gradient-to-r from-emerald-50/80 to-teal-50/80 backdrop-blur-sm border border-emerald-200/50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="remember-device"
                  checked={rememberDevice}
                  onCheckedChange={setRememberDevice}
                  className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <div className="flex-1">
                  <label htmlFor="remember-device" className="text-sm font-medium text-heading-primary cursor-pointer">
                    Remember this device for 30 days
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <Smartphone className="h-3 w-3 text-slate-500" />
                    <p className="text-xs text-slate-500">
                      {deviceDescription} - You won't need 2FA on this device for 30 days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => verifyCode()}
              disabled={code.length !== 6 || isVerifying}
              className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={sendVerificationCode}
                disabled={!canResend || isSendingCode}
                className="group flex-1 h-12 text-base border-2 border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-lg active:scale-95 transform transition-all duration-300 hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isSendingCode ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
                    Resend Code
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                className="flex-1 h-12 text-base text-body-secondary hover:text-slate-800 hover:bg-slate-200 active:scale-95 transform transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-md"
              >
                Back to Login
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">Didn't receive the code?</p>
                <ul className="text-blue-700 mt-1 space-y-1">
                  <li>• Check your spam/junk folder</li>
                  <li>• Wait a few minutes for delivery</li>
                  <li>• Click "Resend Code" if expired</li>
                </ul>
              </div>
            </div>
          </div>

          {attempts >= 3 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Need help?</strong> If you continue having issues, contact your administrator.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}; 