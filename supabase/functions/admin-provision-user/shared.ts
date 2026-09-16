import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const ALL_TASKS = [
  "members",
  "passwords",
  "reservations_view",
  "reservations_manage",
  "website",
  "staff",
  "account_roles",
] as const;

export type Task = (typeof ALL_TASKS)[number];

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function asTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) return [];
  return value.filter((t): t is Task => ALL_TASKS.includes(t as Task));
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const MEMBER_STATUSES = [
  "pending_activation",
  "active",
  "suspended",
  "closed",
] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export function isMemberStatus(value: string): value is MemberStatus {
  return (MEMBER_STATUSES as readonly string[]).includes(value);
}

export function isBlockedStatus(status: string) {
  return status === "closed" || status === "suspended";
}

export function isStaffRow(row: {
  account_kind?: string | null;
  is_admin?: boolean | null;
  staff_code?: string | null;
} | null) {
  if (!row) return false;
  if (row.account_kind === "admin" || row.account_kind === "both") return true;
  if (row.is_admin === true) return true;
  return Boolean(String(row.staff_code || "").trim());
}

export function hasMemberId(row: { member_id?: string | null } | null) {
  return Boolean(String(row?.member_id || "").trim());
}

export function normalizeUsername(value: unknown): string | null {
  const cleaned = String(value ?? "").trim().toLowerCase();
  return cleaned || null;
}

export function usernameError(username: string): string | null {
  if (!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username)) {
    return "Username must be 3–30 characters and use only letters, numbers, underscore, or hyphen.";
  }
  return null;
}

export async function applyAuthAccess(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  blocked: boolean,
) {
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: blocked ? "876000h" : "none",
  });
  if (error) {
    console.error("Could not update Auth ban:", error.message);
  }
  if (blocked) {
    try {
      await adminClient.auth.admin.signOut(userId, "global");
    } catch (err) {
      console.error(
        "Could not revoke sessions:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export async function sendMemberWelcomeEmail(opts: {
  to: string;
  fullName: string;
  memberId: string;
  temporaryPassword: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return {
      sent: false,
      error:
        "RESEND_API_KEY is not set in Supabase Edge Function secrets. Account was created; email was not sent.",
    };
  }

  const from =
    Deno.env.get("MEMBER_EMAIL_FROM") ||
    "East Canyon Resort <onboarding@resend.dev>";
  const appUrl = (Deno.env.get("MEMBER_APP_URL") || "").replace(/\/$/, "");
  const activateUrl = appUrl
    ? `${appUrl}/create-account.html`
    : "create-account.html on the East Canyon website";
  const loginUrl = appUrl ? `${appUrl}/login.html` : "the Members sign-in page";

  const safeName = escapeHtml(opts.fullName || "Member");
  const safeEmail = escapeHtml(opts.to);
  const safeMemberId = escapeHtml(opts.memberId);
  const safePassword = escapeHtml(opts.temporaryPassword);

  const html = `
    <p>Hello ${safeName},</p>
    <p>East Canyon Resort has created your member website access.</p>
    <p><strong>Sign-in information</strong></p>
    <ul>
      <li>Email: ${safeEmail}</li>
      <li>Member ID: ${safeMemberId}</li>
      <li>Temporary password: ${safePassword}</li>
    </ul>
    <p>
      Activate your account here:
      ${
        appUrl
          ? `<a href="${activateUrl}">${activateUrl}</a>`
          : escapeHtml(activateUrl)
      }
    </p>
    <p>
      Enter your email, member ID, and temporary password, then choose a username and your own password.
      After that, sign in with your username or email at ${
        appUrl ? `<a href="${loginUrl}">${loginUrl}</a>` : escapeHtml(loginUrl)
      }.
    </p>
    <p>If you did not expect this message, contact the resort office at (801) 359-9030.</p>
    <p>East Canyon Resort</p>
  `;

  const text = [
    `Hello ${opts.fullName || "Member"},`,
    "",
    "East Canyon Resort has created your member website access.",
    "",
    `Email: ${opts.to}`,
    `Member ID: ${opts.memberId}`,
    `Temporary password: ${opts.temporaryPassword}`,
    "",
    `Activate: ${activateUrl}`,
    "Enter your email, member ID, and temporary password, then choose a username and your own password.",
    `Then sign in with your username or email at: ${loginUrl}`,
    "",
    "If you did not expect this message, contact the resort office at (801) 359-9030.",
    "East Canyon Resort",
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: "Your East Canyon Resort member website access",
        html,
        text,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        sent: false,
        error:
          (data && (data.message || data.error)) ||
          `Email provider returned ${response.status}`,
      };
    }
    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Could not send email",
    };
  }
}

