import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify authentication
    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const { data: { user: adminUser }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: "Not authenticated", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get admin profile
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", adminUser.id)
      .single();

    if (profileError || !adminProfile) {
      throw new Error("Admin profile not found");
    }

    // Security check: Only admins can impersonate
    if (!["admin", "system_admin", "Administrator", "System Administrator"].includes(adminProfile.role)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, targetUserId, reason } = await req.json();

    // START IMPERSONATION
    if (action === "start") {
      if (!targetUserId) {
        throw new Error("Target user ID required");
      }

      // Get client IP and user agent
      // x-forwarded-for can contain multiple IPs (proxy chain), take the first one
      const forwardedFor = req.headers.get("x-forwarded-for");
      const clientIp = forwardedFor 
        ? forwardedFor.split(',')[0].trim() 
        : (req.headers.get("x-real-ip") || "unknown");
      const userAgent = req.headers.get("user-agent") || "unknown";

      // Start impersonation session (uses RPC function with audit logging)
      const { data: sessionId, error: sessionError } = await supabaseAdmin.rpc(
        "start_user_impersonation",
        {
          p_admin_user_id: adminUser.id,
          p_target_user_id: targetUserId,
          p_reason: reason || "Admin support",
          p_ip_address: clientIp,
          p_user_agent: userAgent,
        }
      );

      if (sessionError) {
        console.error("Failed to start impersonation:", sessionError);
        throw sessionError;
      }

      // Generate a custom token for the target user
      // This allows the admin to act as the target user
      const { data: targetAuthData, error: targetAuthError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: "", // Will be fetched from target user
        options: {
          redirectTo: "",
        },
      });

      // Alternative: Create session for target user
      const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      
      if (targetUserError || !targetUser.user) {
        throw new Error("Target user not found");
      }

      // Create a new session for the target user using admin privileges
      // We'll return user data that frontend can use to "switch" context
      const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("user_id", targetUserId)
        .single();

      if (targetProfileError) {
        throw new Error("Target user profile not found");
      }

      return new Response(
        JSON.stringify({
          success: true,
          sessionId,
          impersonation: {
            targetUserId: targetUser.user.id,
            targetEmail: targetUser.user.email,
            targetRole: targetProfile.role,
            targetProfile: targetProfile,
            adminUserId: adminUser.id,
            adminEmail: adminUser.email,
            startedAt: new Date().toISOString(),
            reason: reason || "Admin support",
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // END IMPERSONATION
    if (action === "end") {
      const { sessionId } = await req.json();
      
      // End impersonation session
      const { data: success, error: endError } = await supabaseAdmin.rpc(
        "end_user_impersonation",
        { 
          p_admin_user_id: adminUser.id,
          p_session_id: sessionId || null 
        }
      );

      if (endError) {
        console.error("Failed to end impersonation:", endError);
        throw endError;
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // GET ACTIVE IMPERSONATION
    if (action === "getActive") {
      const { data: activeSession, error: activeError } = await supabaseAdmin.rpc("get_active_impersonation");

      if (activeError) {
        throw activeError;
      }

      return new Response(
        JSON.stringify({ 
          active: activeSession && activeSession.length > 0,
          session: activeSession?.[0] || null 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // LOG ACTION
    if (action === "logAction") {
      const { 
        sessionId, 
        actionType, 
        actionDescription, 
        pageUrl, 
        apiEndpoint, 
        requestData, 
        responseStatus, 
        durationMs 
      } = await req.json();

      await supabaseAdmin.rpc("log_impersonation_action", {
        p_session_id: sessionId,
        p_action_type: actionType,
        p_action_description: actionDescription,
        p_page_url: pageUrl,
        p_api_endpoint: apiEndpoint,
        p_request_data: requestData,
        p_response_status: responseStatus,
        p_duration_ms: durationMs,
      });

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    console.error("Impersonation error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        details: error.details || null
      }),
      {
        status: error.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

