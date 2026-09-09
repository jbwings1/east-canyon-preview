import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALL_TASKS = [
  "members",
  "passwords",
  "reservations_view",
  "reservations_manage",
  "website",
  "staff",
] as const;

type Task = (typeof ALL_TASKS)[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) return [];
  return value.filter((t): t is Task => ALL_TASKS.includes(t as Task));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendMemberWelcomeEmail(opts: {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: "Server configuration error" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { error: "Missing authorization" });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return json(401, { error: "Not signed in" });
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id,is_admin,account_kind,account_status,admin_level,admin_tasks")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileError || !callerProfile) {
    return json(403, { error: "Admin profile not found" });
  }
  if (
    !callerProfile.is_admin ||
    callerProfile.account_kind !== "admin" ||
    callerProfile.account_status !== "active"
  ) {
    return json(403, { error: "Admin access required" });
  }

  const isLevel1 = callerProfile.admin_level === 1;
  const callerTasks: string[] = Array.isArray(callerProfile.admin_tasks)
    ? callerProfile.admin_tasks
    : [];
  const can = (task: Task) => isLevel1 || callerTasks.includes(task);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const kind = String(body.kind || "member");
  if (kind !== "member" && kind !== "admin" && kind !== "reset_password") {
    return json(400, { error: "kind must be member, admin, or reset_password" });
  }

  if (kind === "member" && !can("members")) {
    return json(403, { error: "You are not assigned the Members task" });
  }
  if (kind === "admin" && !can("staff")) {
    return json(403, { error: "You are not assigned the Staff task" });
  }
  if (kind === "reset_password" && !can("passwords")) {
    return json(403, { error: "You are not assigned the Passwords task" });
  }

  if (kind === "reset_password") {
    const userId = String(body.user_id || "").trim();
    const password = String(body.temporary_password || body.password || "");
    if (!userId) {
      return json(400, { error: "Member is required" });
    }
    if (password.length < 8) {
      return json(400, {
        error: "Temporary password must be at least 8 characters",
      });
    }

    const { data: memberProfile, error: memberError } = await adminClient
      .from("profiles")
      .select("id,email,account_kind,account_status")
      .eq("id", userId)
      .maybeSingle();
    if (memberError || !memberProfile) {
      return json(404, { error: "Member not found" });
    }
    if (memberProfile.account_kind !== "member") {
      return json(400, { error: "Password reset here is for members only" });
    }

    const { error: passwordError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password },
    );
    if (passwordError) {
      return json(400, { error: passwordError.message });
    }

    const { error: profileError2 } = await adminClient
      .from("profiles")
      .update({
        must_change_password: true,
        account_status:
          memberProfile.account_status === "closed"
            ? "closed"
            : "pending_activation",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (profileError2) {
      return json(500, { error: profileError2.message });
    }

    return json(200, {
      ok: true,
      kind: "reset_password",
      user_id: userId,
      email: memberProfile.email,
      message: "Temporary password set. Member must change it after sign-in.",
    });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.temporary_password || body.password || "");
  const fullName = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  const address = String(body.address || "").trim();
  const city = String(body.city || "").trim();
  const state = String(body.state || "").trim();
  const zip = String(body.zip || "").trim();

  if (!email || !password) {
    return json(400, { error: "Email and temporary password are required" });
  }
  if (password.length < 8) {
    return json(400, { error: "Temporary password must be at least 8 characters" });
  }

  if (kind === "member") {
    const memberId = String(body.member_id || "").trim();
    if (!memberId) {
      return json(400, { error: "Member ID is required" });
    }
    if (!fullName || !phone || !address) {
      return json(400, {
        error: "Full name, phone, and address are required for members",
      });
    }

    const { data: existingMember } = await adminClient
      .from("profiles")
      .select("id")
      .eq("member_id", memberId)
      .maybeSingle();
    if (existingMember) {
      return json(409, { error: "That member ID is already in use" });
    }

    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone,
          address,
          city,
          state,
          zip,
          member_id: memberId,
          account_kind: "member",
          account_status: "pending_activation",
          must_change_password: true,
          is_admin: false,
        },
      });

    if (createError || !created.user) {
      return json(400, {
        error: createError?.message || "Could not create member account",
      });
    }

    const { error: upsertError } = await adminClient.from("profiles").upsert({
      id: created.user.id,
      email,
      full_name: fullName,
      phone,
      address,
      city,
      state,
      zip,
      member_id: memberId,
      account_kind: "member",
      account_status: "pending_activation",
      must_change_password: true,
      is_admin: false,
      admin_level: null,
      admin_seat: null,
      staff_code: null,
      admin_tasks: [],
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      return json(500, { error: upsertError.message });
    }

    const emailResult = await sendMemberWelcomeEmail({
      to: email,
      fullName,
      memberId,
      temporaryPassword: password,
    });

    return json(200, {
      ok: true,
      kind: "member",
      user_id: created.user.id,
      email,
      member_id: memberId,
      temporary_password: password,
      email_sent: emailResult.sent,
      email_error: emailResult.error || null,
      message: emailResult.sent
        ? "Member access created. A welcome email with sign-in information was sent."
        : `Member access created, but the welcome email was not sent${
            emailResult.error ? `: ${emailResult.error}` : "."
          } Give them the member ID, email, and temporary password.`,
    });
  }

  const adminLevel = Number(body.admin_level || 0);
  if (!Number.isInteger(adminLevel) || adminLevel < 2) {
    return json(400, {
      error: "New staff must be level 2 or lower (level 1 is reserved)",
    });
  }
  if (!isLevel1 && adminLevel <= Number(callerProfile.admin_level || 99)) {
    return json(403, {
      error: "You can only create staff below your level",
    });
  }

  const adminSeat = String(body.admin_seat || "").trim().toLowerCase();
  const staffCode = String(body.staff_code || "").trim();
  let tasks = asTasks(body.admin_tasks);
  if (!isLevel1) {
    tasks = tasks.filter((t) => callerTasks.includes(t) && t !== "staff");
  } else {
    tasks = tasks.filter((t) => t !== "staff" || adminLevel === 1);
  }
  if (!tasks.length) {
    return json(400, { error: "Assign at least one task" });
  }
  if (!staffCode) {
    return json(400, { error: "Staff code is required" });
  }
  if (!fullName) {
    return json(400, { error: "Full name is required" });
  }

  const { data: createdAdmin, error: createAdminError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
        account_kind: "admin",
        account_status: "active",
        must_change_password: true,
        is_admin: true,
        admin_level: String(adminLevel),
        admin_seat: adminSeat,
        staff_code: staffCode,
        admin_tasks: tasks,
      },
    });

  if (createAdminError || !createdAdmin.user) {
    return json(400, {
      error: createAdminError?.message || "Could not create admin account",
    });
  }

  const { error: upsertAdminError } = await adminClient.from("profiles").upsert({
    id: createdAdmin.user.id,
    email,
    full_name: fullName,
    phone,
    account_kind: "admin",
    account_status: "active",
    must_change_password: true,
    is_admin: true,
    admin_level: adminLevel,
    admin_seat: adminSeat || null,
    staff_code: staffCode,
    admin_tasks: tasks,
    updated_at: new Date().toISOString(),
  });

  if (upsertAdminError) {
    return json(500, { error: upsertAdminError.message });
  }

  return json(200, {
    ok: true,
    kind: "admin",
    user_id: createdAdmin.user.id,
    email,
    admin_level: adminLevel,
    admin_seat: adminSeat || null,
    staff_code: staffCode,
    admin_tasks: tasks,
    temporary_password: password,
    message: "Admin staff account created.",
  });
});
