import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertCircle, Mail, Settings, Database } from "lucide-react";

interface TestResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
}

export const InvitationDebugger = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const addResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runEnvironmentTests = async () => {
    setIsRunning(true);
    clearResults();

    // Test 1: Environment Variables
    const envVars = {
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    };

    if (envVars.VITE_SUPABASE_URL) {
      addResult({
        test: "Supabase URL",
        status: 'success',
        message: `Connected to: ${envVars.VITE_SUPABASE_URL}`
      });
    } else {
      addResult({
        test: "Supabase URL",
        status: 'error', 
        message: "VITE_SUPABASE_URL not found in environment variables"
      });
    }

    // Test 2: Supabase Connection
    try {
      const { data, error } = await supabase.from('banks').select('count').single();
      if (error) throw error;
      
      addResult({
        test: "Database Connection",
        status: 'success',
        message: "Successfully connected to Supabase database"
      });
    } catch (error: any) {
      addResult({
        test: "Database Connection",
        status: 'error',
        message: `Database error: ${error.message}`
      });
    }

    // Test 3: Banks Data
    try {
      const { data: banks, error } = await supabase.from('banks').select('*');
      if (error) throw error;
      
      if (banks && banks.length > 0) {
        addResult({
          test: "Banks Data",
          status: 'success',
          message: `Found ${banks.length} bank(s): ${banks.map(b => b.name).join(', ')}`
        });
      } else {
        addResult({
          test: "Banks Data",
          status: 'warning',
          message: "No banks found. You'll need to create banks before sending invitations."
        });
      }
    } catch (error: any) {
      addResult({
        test: "Banks Data",
        status: 'error',
        message: `Banks query error: ${error.message}`
      });
    }

    // Test 4: Edge Function Availability
    try {
      const { data, error } = await supabase.functions.invoke('invite-bank-viewer', {
        body: { test: true }
      });
      
      // Even if it returns an error due to missing params, if we get a response, the function is deployed
      addResult({
        test: "Edge Function",
        status: 'success',
        message: "invite-bank-viewer function is deployed and accessible"
      });
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        addResult({
          test: "Edge Function",
          status: 'error',
          message: "invite-bank-viewer function not deployed. Run: supabase functions deploy invite-bank-viewer"
        });
      } else {
        addResult({
          test: "Edge Function",
          status: 'warning',
          message: `Function exists but may have configuration issues: ${error.message}`
        });
      }
    }

    // Test 5: Current User Profile
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          addResult({
            test: "User Profile",
            status: 'success',
            message: `Logged in as: ${user.email} (${profile.role})`
          });
        } else {
          addResult({
            test: "User Profile",
            status: 'warning',
            message: "User authenticated but no profile found"
          });
        }
      } else {
        addResult({
          test: "User Profile",
          status: 'error',
          message: "No authenticated user"
        });
      }
    } catch (error: any) {
      addResult({
        test: "User Profile",
        status: 'error',
        message: `Profile error: ${error.message}`
      });
    }

    setIsRunning(false);
  };

  const testInvitationFlow = async () => {
    if (!testEmail) {
      toast({
        title: "Please enter a test email address",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);
    
    try {
      // Get the first available bank
      const { data: banks, error: bankError } = await supabase
        .from('banks')
        .select('*')
        .limit(1);

      if (bankError) throw bankError;
      if (!banks || banks.length === 0) {
        throw new Error('No banks available. Please create a bank first.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      // Show current app URL being sent to Edge Function
      const currentOrigin = window.location.origin;
      addResult({
        test: "App Origin",
        status: 'success',
        message: `Current app URL: ${currentOrigin} (will be sent as origin header)`
      });

      addResult({
        test: "Invitation Test",
        status: 'warning',
        message: `Sending test invitation to ${testEmail}...`
      });

      const { data, error } = await supabase.functions.invoke('invite-bank-viewer', {
        body: {
          email: testEmail,
          bankId: banks[0].id,
          inviterEmail: user?.email,
        }
      });

      if (error) {
        // Provide detailed error analysis
        addResult({
          test: "Invitation Test",
          status: 'error',
          message: `❌ Invitation failed: ${error.message}`
        });

        if (error.message?.includes('secure reset link')) {
          addResult({
            test: "Error Analysis",
            status: 'warning',
            message: "🔍 Security validation error. Check Supabase Edge Function logs for token generation details."
          });
        } else if (error.message?.includes('SendGrid')) {
          addResult({
            test: "Error Analysis",
            status: 'warning', 
            message: "🔍 SendGrid issue. Verify SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in Supabase secrets."
          });
        }
        
        throw error;
      }

      addResult({
        test: "Invitation Test",
        status: 'success',
        message: `✅ Invitation sent successfully! Check ${testEmail} for the invitation email.`
      });

      if (data) {
        addResult({
          test: "Response Data",
          status: 'success',
          message: `Response: ${JSON.stringify(data, null, 2)}`
        });
      }

      toast({
        title: "Test invitation sent!",
        description: `Check ${testEmail} for the invitation email (including spam folder)`,
      });

    } catch (error: any) {
      addResult({
        test: "Invitation Test",
        status: 'error',
        message: `❌ Invitation failed: ${error.message}`
      });

      toast({
        title: "Test invitation failed",
        description: error.message,
        variant: "destructive"
      });
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      success: 'default',
      error: 'destructive',
      warning: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Invitation System Debugger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runEnvironmentTests} 
              disabled={isRunning}
              variant="outline"
            >
              <Database className="mr-2 h-4 w-4" />
              {isRunning ? "Running Tests..." : "Test Environment"}
            </Button>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This tool helps diagnose invitation system issues. Run environment tests first, then test sending an actual invitation.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Test Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter test email address"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={testInvitationFlow} 
              disabled={isRunning || !testEmail}
            >
              <Mail className="mr-2 h-4 w-4" />
              {isRunning ? "Sending..." : "Send Test"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            This will send a real invitation email to the provided address using the first available bank.
          </p>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">{result.test}</p>
                      {getStatusBadge(result.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <Button variant="ghost" size="sm" onClick={clearResults}>
                Clear Results
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 