"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function ConnectionsPage() {
  const supabase = createClient();
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [mlsStatus, setMlsStatus] = useState<{ configured: boolean; message?: string } | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<{ configured: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      // Fetch all statuses in parallel
      const [googleRes, mlsRes, voiceRes] = await Promise.all([
        fetch("/api/gmail/status"),
        fetch("/api/mls/status"),
        fetch("/api/voice/samples/status"),
      ]);

      const [googleData, mlsData, voiceData] = await Promise.all([
        googleRes.json(),
        mlsRes.json(),
        voiceRes.json(),
      ]);

      setGoogleStatus(googleData);
      setMlsStatus(mlsData);
      setVoiceStatus(voiceData);
      setLoading(false);
    })();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] pb-32" style={{ color: "var(--oc-text-1)" }}>
      <div className="px-4 pt-6">
        <h1 className="text-[22px] font-semibold mb-6">Connections</h1>
        <p className="mb-6 text-[13px] leading-relaxed" style={{ color: "#6B7280" }}>
          Manage your integrations and connected services below.
        </p>
        
        <div className="space-y-4">
          {/* Google */}
          <div className="bg-[rgba(20,20,22,0.6)] rounded-xl border border-[rgba(255,255,255,0.06)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[rgba(59,130,246,0.2)]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                </div>
                <div>
                  <h2 className="text-[18px] font-bold">Google Workspace</h2>
                  <p className="mt-1 text-[13px] leading-relaxed">
                    Connect your Google account to sync Gmail, Calendar, and Contacts.
                  </p>
                </div>
              </div>
              {googleStatus?.connected ? (
                <button
                  onClick={() => { window.location.href = "/api/auth/google/connect"; }}
                  className="px-3 py-1 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20"
                >
                  Reconnect
                </button>
              ) : (
                <button
                  onClick={() => { window.location.href = "/api/auth/google/connect"; }}
                  className="px-3 py-1 rounded-md text-sm font-medium bg-primary text-primary/hover:bg-primary/90"
                >
                  Connect
                </button>
              )}
            </div>
            {googleStatus?.connected ? (
              <>
                <p className="mt-2 text-[12px] text-success">
                  Connected as {googleStatus.email}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Gmail, Calendar, and Contacts are synced
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[12px] text-muted">
                  Not connected
                </p>
              </>
            )}
          </div>

          {/* MLS Feed */}
          <div className="bg-[rgba(20,20,22,0.6)] rounded-xl border border-[rgba(255,255,255,0.06)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[rgba(16,185,129,0.2)]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2v-3a2 2 0 012-2h2a2 2 0 012 2v3a2 2 0 002 2h2a2 2 0 002-2zm-7-4V9a2 2 0 012-2h2a2 2 0 012 2v2h2a2 2 0 01-2 2h-1a2 2 0 01-1.758-.97l-.742-.207A6.012 6.012 0 005 12a6.012 6.012 0 00-4.742 3.43l-.742.207A2 2 0 012 13v2z"></path></svg>
                </div>
                <div>
                  <h2 className="text-[18px] font-bold">MLS Feed (SimplyRETS)</h2>
                  <p className="mt-1 text-[13px] leading-relaxed">
                    Access live MLS data for property matching and client notifications.
                  </p>
                </div>
              </div>
              {mlsStatus?.configured ? (
                <button
                  onClick={() => {
                    // TODO: Implement reconnect functionality
                    alert("Reconnect functionality coming soon");
                  }}
                  className="px-3 py-1 rounded-md text-sm font-medium bg-success/10 text-success hover:bg-success/20"
                >
                  Refresh
                </button>
              ) : (
                <button
                  onClick={() => {
                    // TODO: Implement setup functionality
                    alert("Setup functionality coming soon");
                  }}
                  className="px-3 py-1 rounded-md text-sm font-medium bg-success text-success/hover:bg-success/90"
                >
                  Configure
                </button>
              )}
            </div>
            {mlsStatus?.configured ? (
              <>
                <p className="mt-2 text-[12px] text-success">
                  {mlsStatus.message ?? "MLS feed is connected"}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Property data is being synced from your MLS
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[12px] text-muted">
                  {mlsStatus?.message ?? "MLS feed requires board credentials"}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Add your SimplyRETS API key and secret to enable MLS integration
                </p>
              </>
            )}
          </div>

          {/* Voice Samples */}
          <div className="bg-[rgba(20,20,22,0.6)] rounded-xl border border-[rgba(255,255,255,0.06)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[rgba(139,92,246,0.2)]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2z"></path></svg>
                </div>
                <div>
                  <h2 className="text-[18px] font-bold">Voice Samples</h2>
                  <p className="mt-1 text-[13px] leading-relaxed">
                    Personalize AI-generated messages with your unique communication style.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  // Navigate to voice settings
                  window.location.href = "/settings/voice";
                }}
                className="px-3 py-1 rounded-md text-sm font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20"
              >
                Manage Samples
              </button>
            </div>
            {voiceStatus?.configured ? (
              <>
                <p className="mt-2 text-[12px] text-success">
                  Voice samples are recorded and ready
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  AI will match your tone when generating messages
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[12px] text-muted">
                  No voice samples recorded
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Record 5 sample messages to train Aria&apos;s voice matching
                </p>
              </>
            )}
          </div>

          {/* Lead Sources */}
          <div className="bg-[rgba(20,20,22,0.6)] rounded-xl border border-[rgba(255,255,255,0.06)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[rgba(245,158,11,0.2)]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <div>
                  <h2 className="text-[18px] font-bold">Lead Sources</h2>
                  <p className="mt-1 text-[13px] leading-relaxed">
                    Automatically capture leads from Zillow, Facebook, Realtor.com via your connected email.
                  </p>
                </div>
              </div>
              {googleStatus?.connected ? (
                <>
                  <button
                    onClick={() => {
                      // TODO: Implement lead source management
                      alert("Lead source management coming soon");
                    }}
                    className="px-3 py-1 rounded-md text-sm font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Implement toggle functionality
                      alert("Toggle functionality coming soon");
                    }}
                    className="ml-2 px-3 py-1 rounded-md text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20"
                  >
                    Pause
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { window.location.href = "/api/auth/google/connect"; }}
                  className="px-3 py-1 rounded-md text-sm font-medium bg-amber-500 text-amber-500/hover:bg-amber-500/90"
                >
                  Connect Email for Lead Capture
                </button>
              )}
            </div>
            {googleStatus?.connected ? (
              <>
                <p className="mt-2 text-[12px] text-success">
                  Active - capturing leads from connected email
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Lead capture is enabled and working
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[12px] text-muted">
                  Not active - connect Google email to enable lead capture
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Once connected, Aria will automatically capture leads from your email
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
