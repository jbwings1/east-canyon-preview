/**
 * Auth + member data via the official Supabase JS client.
 * Config/keys live in js/supabase-config.js — never put a service_role key in the frontend.
 */
const SESSION_KEY = "eastCanyonSupabaseSession";
const PROFILE_CACHE_KEY = "eastCanyonProfileCache";
const PENDING_PROFILE_KEY = "eastCanyonPendingProfile";
const LAST_BOOKING_KEY = "ecr-last-booking-confirmation";

const RESERVATION_TYPE_LABELS = {
  condo: "Condo",
  rv: "RV",
  "family-reunion": "Family reunion",
  family_reunion: "Family reunion",
  reunion: "Family reunion",
  "travel-trailer": "RV",
  motorhome: "RV",
  seasonal: "Member",
  guest: "Member",
};

function getClient() {
  if (!window.ecrSupabase) {
    throw new Error("Supabase client is not ready. Load js/supabase-client.js before js/auth.js.");
  }
  return window.ecrSupabase;
}

function storageAvailable() {
  try {
    const key = "__eastCanyonStorageTest";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readJson(key, fallback = null) {
  if (!storageAvailable()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!storageAvailable()) return;
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

function toDbReservationType(value) {
  if (value === "family-reunion" || value === "reunion") return "family_reunion";
  if (value === "travel-trailer" || value === "motorhome") return "rv";
  if (value === "condo" || value === "rv" || value === "family_reunion") return value;
  return null;
}

function toUiReservationType(value) {
  if (value === "family_reunion" || value === "reunion") return "family-reunion";
  if (value === "travel-trailer" || value === "motorhome") return "rv";
  if (value === "condo" || value === "rv" || value === "family-reunion") return value;
  return "";
}

function reservationTypeLabel(value) {
  return RESERVATION_TYPE_LABELS[value] || "";
}

function mapProfile(session, profile) {
  const authUser = session?.user || {};
  const email = profile?.email || authUser.email || "";
  const reservationType = toUiReservationType(profile?.reservation_type);
  const adminTasks = Array.isArray(profile?.admin_tasks) ? profile.admin_tasks : [];
  return {
    id: authUser.id || profile?.id || "",
    email,
    name: profile?.full_name || authUser.user_metadata?.full_name || "",
    phone: profile?.phone || authUser.user_metadata?.phone || "",
    profileEmail: email,
    address: profile?.address || "",
    city: profile?.city || "",
    state: profile?.state || "",
    zip: profile?.zip || "",
    rv: profile?.rv_details || authUser.user_metadata?.rv_details || "",
    assignedSpot: profile?.assigned_spot || null,
    accountType: reservationType || profile?.reservation_type || "",
    reservationType,
    profileComplete: profile?.profile_complete === true,
    isAdmin: profile?.is_admin === true && profile?.account_kind === "admin",
    accountKind: profile?.account_kind || "member",
    accountStatus: profile?.account_status || "active",
    memberId: profile?.member_id || "",
    username: profile?.username || "",
    mustChangePassword: profile?.must_change_password === true,
    adminLevel: profile?.admin_level || null,
    adminSeat: profile?.admin_seat || "",
    staffCode: profile?.staff_code || "",
    adminTasks,
    accessToken: session?.access_token || "",
  };
}

function siteOrigin() {
  return window.location.origin + window.location.pathname.replace(/[^/]+$/, "");
}

function officialStorageKey() {
  try {
    const host = new URL(window.SUPABASE_CONFIG.url).hostname;
    const ref = host.split(".")[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return "sb-jmxlewxczfnxciamrtze-auth-token";
  }
}

function readOfficialSession() {
  try {
    const raw = localStorage.getItem(officialStorageKey());
    if (!raw) return readJson(SESSION_KEY);
    const parsed = JSON.parse(raw);
    if (parsed?.access_token) return parsed;
    if (parsed?.currentSession?.access_token) return parsed.currentSession;
    return parsed || readJson(SESSION_KEY);
  } catch {
    return readJson(SESSION_KEY);
  }
}

function cacheSession(session) {
  if (!session?.access_token) {
    writeJson(SESSION_KEY, null);
    return;
  }
  writeJson(SESSION_KEY, {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user,
  });
}

function formatClientError(error) {
  const code = error?.code || error?.error_code || "";
  const msg = error?.message || error?.msg || "";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) {
    return "Confirm your email before signing in. Check your inbox for the East Canyon link.";
  }
  if (code === "invalid_credentials" || /invalid login/i.test(msg)) {
    return "Invalid username/email or password.";
  }
  if (code === "user_already_exists" || /already registered/i.test(msg)) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (code === "email_address_invalid") {
    return "Enter a real email address.";
  }
  if (code === "over_email_send_rate_limit") {
    return "Too many emails were sent. Wait a minute and try again.";
  }
  if (/already booked for overlapping dates/i.test(msg)) {
    return "That site is already booked for overlapping dates. Choose different dates or another open site.";
  }
  return msg || "Request failed.";
}

function throwIfError(error) {
  if (error) throw new Error(formatClientError(error));
}

const Auth = {
  storageAvailable,
  toDbReservationType,
  toUiReservationType,
  reservationTypeLabel,
  LAST_BOOKING_KEY,

  getSession() {
    return readOfficialSession();
  },

  getCurrentUser() {
    const session = this.getSession();
    if (!session?.access_token || !session.user) return null;
    const cached = readJson(PROFILE_CACHE_KEY);
    return mapProfile(session, cached);
  },

  needsPasswordChange(user = this.getCurrentUser()) {
    return Boolean(user?.mustChangePassword);
  },

  canAccessMembers(user = this.getCurrentUser()) {
    if (!user) return false;
    if (user.accountKind === "admin") return false;
    if (user.accountStatus === "suspended" || user.accountStatus === "closed") return false;
    return true;
  },

  isMemberAccount(user = this.getCurrentUser()) {
    return Boolean(user && user.accountKind === "member");
  },

  isAdmin(user = this.getCurrentUser()) {
    return Boolean(user?.isAdmin && user?.accountKind === "admin" && user?.accountStatus === "active");
  },

  hasAdminTask(task, user = this.getCurrentUser()) {
    if (!this.isAdmin(user)) return false;
    if (user.adminLevel === 1) return true;
    return Array.isArray(user.adminTasks) && user.adminTasks.includes(task);
  },

  async verifyAdmin() {
    try {
      const { data, error } = await getClient().rpc("is_admin");
      if (!error && data === true) return true;
    } catch {
      /* fall back to the cached profile flag */
    }
    try {
      await this.refreshProfile();
    } catch {
      /* keep cached profile */
    }
    return this.isAdmin();
  },

  showAdminLinks() {
    if (!this.isAdmin()) return;
    document.querySelectorAll("[data-admin-link]").forEach((el) => {
      el.hidden = false;
    });
  },

  async listAllProfiles() {
    if (!this.isAdmin()) throw new Error("Admin access required.");
    const { data, error } = await getClient()
      .from("profiles")
      .select(
        "id,email,full_name,phone,address,city,state,zip,reservation_type,assigned_spot,profile_complete,is_admin,account_kind,account_status,member_id,username,must_change_password,admin_level,admin_seat,staff_code,admin_tasks"
      )
      .order("full_name", { ascending: true, nullsFirst: false });
    throwIfError(error);
    return data || [];
  },

  async listMemberProfiles() {
    const rows = await this.listAllProfiles();
    return rows.filter((p) => p.account_kind === "member");
  },

  async listStaffProfiles() {
    const rows = await this.listAllProfiles();
    return rows.filter((p) => p.account_kind === "admin");
  },

  async provisionUser(payload) {
    if (!this.isAdmin()) throw new Error("Admin access required.");
    const session = this.getSession();
    if (!session?.access_token) throw new Error("Not signed in.");
    const response = await fetch(
      `${window.SUPABASE_CONFIG.url}/functions/v1/admin-provision-user`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: window.SUPABASE_CONFIG.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      throw new Error(data.error || "Could not complete the admin request.");
    }
    return data;
  },

  async updateMember(payload) {
    return this.provisionUser({ kind: "update_member", ...payload });
  },

  async deleteMember(userId) {
    return this.provisionUser({ kind: "delete_member", user_id: userId });
  },

  async createBookingForMember({
    memberUserId,
    reservationType,
    spot,
    checkIn,
    checkOut,
    notes,
  }) {
    if (!this.hasAdminTask("reservations_manage")) {
      throw new Error("You are not assigned the Reservations manage task.");
    }
    const admin = this.getCurrentUser();
    if (!admin?.id) throw new Error("Admin sign in required.");
    if (!memberUserId) throw new Error("Choose a member.");
    if (memberUserId === admin.id) {
      throw new Error("Admins cannot book for themselves. Use a member account.");
    }
    const dbType = toDbReservationType(reservationType);
    if (!dbType) throw new Error("Choose Condo, Family reunion, or RV.");
    const now = new Date().toISOString();
    const { data, error } = await getClient()
      .from("bookings")
      .insert({
        user_id: memberUserId,
        reservation_type: dbType,
        spot: spot || null,
        check_in: checkIn,
        check_out: checkOut,
        original_check_in: checkIn,
        original_check_out: checkOut,
        status: "confirmed",
        notes: notes || null,
        confirmed_at: now,
        booked_by_kind: "admin",
        booked_by_user_id: admin.id,
      })
      .select()
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Booking could not be saved.");
    return data;
  },

  async clearMustChangePassword() {
    const { error } = await getClient().rpc("clear_must_change_password");
    throwIfError(error);
    await this.refreshProfile();
    return this.getCurrentUser();
  },

  async setMemberUsername(username) {
    const cleaned = String(username || "").trim();
    if (!cleaned) throw new Error("Choose a username.");
    const { data, error } = await getClient().rpc("set_member_username", {
      desired: cleaned,
    });
    throwIfError(error);
    await this.refreshProfile();
    return data || cleaned.toLowerCase();
  },

  async resolveMemberLoginEmail(identifier) {
    const value = String(identifier || "").trim();
    if (!value) throw new Error("Enter your username or email.");
    if (value.includes("@")) return value.toLowerCase();
    const { data, error } = await getClient().rpc("resolve_member_login", {
      identifier: value,
    });
    throwIfError(error);
    if (!data) {
      throw new Error("No member account found for that username or email.");
    }
    return String(data).trim().toLowerCase();
  },

  async activateMemberAccount({ email, memberId, temporaryPassword }) {
    const user = await this.signIn(email, temporaryPassword);
    if (!user || user.accountKind !== "member") {
      await this.signOutQuiet();
      throw new Error("This is not a member account. Use Admin Sign In for staff.");
    }
    if (String(user.memberId || "").trim() !== String(memberId || "").trim()) {
      await this.signOutQuiet();
      throw new Error("Member ID does not match this email.");
    }
    if (user.accountStatus === "suspended" || user.accountStatus === "closed") {
      await this.signOutQuiet();
      throw new Error("This member account is not active. Contact the office.");
    }
    return user;
  },

  async listAllBookings() {
    if (!this.isAdmin()) throw new Error("Admin access required.");
    const { data, error } = await getClient()
      .from("bookings")
      .select(
        "id,user_id,reservation_type,spot,check_in,check_out,original_check_in,original_check_out,status,notes,created_at,edited_at,last_edit_summary,confirmed_at,booked_by_kind,booked_by_user_id,office_checked_in_at,office_checked_in_by,office_check_in_notes"
      )
      .order("check_in", { ascending: false });
    throwIfError(error);
    return data || [];
  },

  async getSiteOccupancy(fromDate, toDate) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Sign in required.");
    const { data, error } = await getClient().rpc("get_site_occupancy", {
      p_from: fromDate,
      p_to: toDate,
    });
    throwIfError(error);
    return Array.isArray(data) ? data : [];
  },

  bookingConfirmationId(bookingOrId) {
    const id = typeof bookingOrId === "string" ? bookingOrId : bookingOrId?.id;
    if (!id) return "—";
    return `ECR-${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  },

  datesOverlap(aStart, aEnd, bStart, bEnd) {
    return Boolean(aStart && aEnd && bStart && bEnd && aStart < bEnd && bStart < aEnd);
  },

  /** Original stay window locked at create time (falls back to current dates if missing). */
  getOriginalStayWindow(booking) {
    if (!booking) return null;
    const start = booking.original_check_in || booking.check_in;
    const end = booking.original_check_out || booking.check_out;
    if (!start || !end) return null;
    return { start, end };
  },

  /**
   * Member edits may move or extend dates, but the new stay must share at least one
   * calendar day with the original booking (inclusive check-in through check-out).
   * Example: original 9-30→10-2 may become 9-29→10-2, 9-29→10-3, or 10-2→10-5.
   */
  stayOverlapsOriginal(checkIn, checkOut, booking) {
    const win = this.getOriginalStayWindow(booking);
    if (!win) return true;
    if (!checkIn || !checkOut || checkOut <= checkIn) return false;
    // Closed intervals [start, end] share a day when startA <= endB && startB <= endA.
    return checkIn <= win.end && win.start <= checkOut;
  },

  /** @deprecated Use stayOverlapsOriginal — kept for older callers. */
  stayWithinOriginal(checkIn, checkOut, booking) {
    return this.stayOverlapsOriginal(checkIn, checkOut, booking);
  },

  formatOriginalStayLabel(booking) {
    const win = this.getOriginalStayWindow(booking);
    if (!win) return "";
    if (typeof window.SpotAvailability?.formatOriginalStayRange === "function") {
      return window.SpotAvailability.formatOriginalStayRange(win.start, win.end);
    }
    return `${win.start} \u2192 ${win.end}`;
  },

  originalStayOverlapMessage(booking) {
    const originalLabel = this.formatOriginalStayLabel(booking);
    if (originalLabel) {
      return (
        `Edited dates must keep at least one day from your original booking (${originalLabel}). ` +
        "You can move or extend the stay as long as it still overlaps that original range."
      );
    }
    return (
      "Edited dates must keep at least one day from your original booking. " +
      "You can move or extend the stay as long as it still overlaps that original range."
    );
  },

  /**
   * Policy cancel/edit windows (calendar days before check-in):
   * RV §6.7 and Condo Regular/Bonus §5 = 2 days; Family Reunion §8.4 = 21 days.
   */
  bookingEditCancelMinDays(booking) {
    const dbType = toDbReservationType(booking?.reservation_type);
    if (dbType === "family_reunion") return 21;
    const unit = window.SpotAvailability?.findUnit?.(booking?.spot);
    if (unit?.category === "reunion") return 21;
    return 2;
  },

  /** Whole calendar days from `fromDate` (default today) until `dateStr` (YYYY-MM-DD). */
  calendarDaysUntil(dateStr, fromDateStr) {
    const to =
      (typeof window.SpotAvailability?.normalizeDate === "function"
        ? window.SpotAvailability.normalizeDate(dateStr)
        : String(dateStr || "").slice(0, 10)) || "";
    const from =
      fromDateStr ||
      (typeof window.SpotAvailability?.getToday === "function"
        ? window.SpotAvailability.getToday()
        : new Date().toISOString().split("T")[0]);
    if (!to || !from) return null;
    const ms = new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`);
    return Math.round(ms / 86400000);
  },

  bookingEditCancelBlockedMessage(booking, minDays = this.bookingEditCancelMinDays(booking)) {
    if (minDays >= 21) {
      return (
        "Online edit and cancel for family reunion reservations are only available at least " +
        "21 calendar days before check-in (resort policy §8.4). A late cancellation fee may apply. " +
        "Contact the office if you need changes this close to your stay."
      );
    }
    return (
      `Online edit and cancel are only available at least ${minDays} calendar days before check-in ` +
      "(resort policy). A late cancellation fee may apply. Contact the office if you need changes " +
      "this close to your stay."
    );
  },

  /**
   * Member online edit/cancel gate. Admins keep override via updateBookingStatus / admin tools.
   * Allowed when check_in - today >= policy min calendar days.
   */
  bookingCanEditOrCancel(booking, { asAdmin = false } = {}) {
    if (asAdmin) {
      return { allowed: true, reason: "", minDays: 0, daysUntil: null, code: "admin" };
    }
    if (!booking) {
      return {
        allowed: false,
        reason: "Reservation not found.",
        minDays: 2,
        daysUntil: null,
        code: "missing",
      };
    }
    if (booking.status === "cancelled") {
      return {
        allowed: false,
        reason: "This reservation is already cancelled.",
        minDays: this.bookingEditCancelMinDays(booking),
        daysUntil: null,
        code: "cancelled",
      };
    }
    const today =
      typeof window.SpotAvailability?.getToday === "function"
        ? window.SpotAvailability.getToday()
        : new Date().toISOString().split("T")[0];
    if (booking.check_out && booking.check_out < today) {
      return {
        allowed: false,
        reason: "Past stays cannot be edited or cancelled online.",
        minDays: this.bookingEditCancelMinDays(booking),
        daysUntil: null,
        code: "past",
      };
    }
    const minDays = this.bookingEditCancelMinDays(booking);
    const daysUntil = this.calendarDaysUntil(booking.check_in, today);
    if (daysUntil == null || !booking.check_in) {
      return {
        allowed: false,
        reason: "Check-in date is required.",
        minDays,
        daysUntil: null,
        code: "no-checkin",
      };
    }
    if (daysUntil < minDays) {
      return {
        allowed: false,
        reason: this.bookingEditCancelBlockedMessage(booking, minDays),
        minDays,
        daysUntil,
        code: "too-late",
      };
    }
    return { allowed: true, reason: "", minDays, daysUntil, code: "ok" };
  },

  async updateBookingStatus(bookingId, status) {
    if (!this.hasAdminTask("reservations_manage")) {
      throw new Error("You are not assigned the Reservations manage task.");
    }
    if (status !== "confirmed" && status !== "cancelled") {
      throw new Error("Status must be confirmed or cancelled.");
    }
    const payload = { status };
    if (status === "confirmed") payload.confirmed_at = new Date().toISOString();
    const { data, error } = await getClient()
      .from("bookings")
      .update(payload)
      .eq("id", bookingId)
      .select()
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Booking could not be updated.");
    return data;
  },

  /**
   * Admin edit of any member booking (dates, spot, type, notes).
   * Does not apply member cancel/edit windows or original-stay lock.
   */
  async updateBookingAsAdmin(
    bookingId,
    { reservationType, spot, checkIn, checkOut, notes } = {}
  ) {
    if (!this.hasAdminTask("reservations_manage")) {
      throw new Error("You are not assigned the Reservations manage task.");
    }
    if (!bookingId) throw new Error("Booking is required.");
    if (!checkIn || !checkOut) throw new Error("Check-in and check-out are required.");
    if (checkOut <= checkIn) throw new Error("Check-out must be after check-in.");

    const { data: existing, error: existingError } = await getClient()
      .from("bookings")
      .select(
        "id,user_id,reservation_type,spot,check_in,check_out,status,notes,original_check_in,original_check_out"
      )
      .eq("id", bookingId)
      .maybeSingle();
    throwIfError(existingError);
    if (!existing) throw new Error("Booking not found.");
    if (existing.status === "cancelled") {
      throw new Error("Cancelled bookings cannot be edited. Create a new reservation instead.");
    }

    const dbType = reservationType
      ? toDbReservationType(reservationType)
      : existing.reservation_type;
    if (!dbType) throw new Error("Choose Condo, Family reunion, or RV.");

    const nextSpot =
      spot === undefined || spot === null ? existing.spot : String(spot).trim() || null;
    const nextNotes =
      notes === undefined || notes === null ? existing.notes : String(notes).trim() || null;

    const summaryParts = [];
    if (existing.check_in !== checkIn || existing.check_out !== checkOut) {
      summaryParts.push(`dates ${existing.check_in}→${existing.check_out} to ${checkIn}→${checkOut}`);
    }
    if (existing.reservation_type !== dbType) {
      summaryParts.push(`type to ${dbType}`);
    }
    if ((existing.spot || "") !== (nextSpot || "")) {
      summaryParts.push(`spot to ${nextSpot || "(none)"}`);
    }

    const { data, error } = await getClient()
      .from("bookings")
      .update({
        reservation_type: dbType,
        spot: nextSpot,
        check_in: checkIn,
        check_out: checkOut,
        notes: nextNotes,
        edited_at: new Date().toISOString(),
        last_edit_summary: summaryParts.length
          ? `Admin edit: ${summaryParts.join("; ")}`
          : "Admin edit",
      })
      .eq("id", bookingId)
      .select()
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Booking could not be saved.");
    return data;
  },

  isProfileComplete(user = this.getCurrentUser()) {
    if (!user) return false;
    if (user.profileComplete === true) return true;
    return Boolean(
      user.name && user.profileEmail && user.phone && user.address && user.city && user.state && user.zip
    );
  },

  clearSession() {
    writeJson(SESSION_KEY, null);
    writeJson(PROFILE_CACHE_KEY, null);
    try {
      localStorage.removeItem(officialStorageKey());
    } catch {
      /* ignore */
    }
  },

  clearAllSiteData() {
    this.clearSession();
    try {
      sessionStorage.removeItem(PENDING_PROFILE_KEY);
      sessionStorage.removeItem(LAST_BOOKING_KEY);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(LAST_BOOKING_KEY);
    } catch {
      /* ignore */
    }
  },

  async signOutQuiet() {
    try {
      await getClient().auth.signOut();
    } catch {
      /* ignore */
    }
    this.clearSession();
  },

  logout(redirectTo = "login.html") {
    this.signOutQuiet().finally(() => {
      window.location.href = redirectTo || "login.html";
    });
  },

  requireAuth(redirectTo = "login.html") {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = redirectTo;
      return null;
    }
    return user;
  },

  redirectForAuth(options = {}) {
    const {
      requireMember = false,
      loginPage = "login.html",
      adminPage = "admin.html",
    } = options;
    const user = this.getCurrentUser();
    if (!requireMember) return user;
    if (!user) {
      window.location.href = loginPage;
      return null;
    }
    if (user.accountKind === "admin") {
      window.location.href = adminPage;
      return null;
    }
    if (!this.canAccessMembers(user)) {
      window.location.href = loginPage;
      return null;
    }
    return user;
  },

  async ready() {
    try {
      const { data, error } = await getClient().auth.getSession();
      if (!error && data?.session) cacheSession(data.session);
    } catch {
      /* keep cached session */
    }
    const session = this.getSession();
    if (!session?.access_token) return this.getCurrentUser();
    try {
      await this.refreshProfile();
    } catch {
      /* keep cached profile */
    }
    return this.getCurrentUser();
  },

  async refreshProfile() {
    const session = this.getSession();
    if (!session?.user?.id) return null;
    const { data, error } = await getClient()
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    throwIfError(error);
    if (data) writeJson(PROFILE_CACHE_KEY, data);
    await this._applyPendingProfile();
    return this.getCurrentUser();
  },

  async _waitForProfile(userId, attempts = 6) {
    for (let i = 0; i < attempts; i += 1) {
      const { data } = await getClient().from("profiles").select("*").eq("id", userId).maybeSingle();
      if (data) return data;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  },

  async _applyPendingProfile() {
    const session = this.getSession();
    if (!session?.user?.id) return;
    let pending = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PENDING_PROFILE_KEY) || "null");
    } catch {
      pending = null;
    }
    if (!pending || (pending.email && pending.email !== session.user.email)) return;

    const cached = readJson(PROFILE_CACHE_KEY) || {};
    const updates = {};
    if (pending.full_name && !cached.full_name) updates.full_name = pending.full_name;
    if (pending.phone && !cached.phone) updates.phone = pending.phone;
    if (pending.reservation_type && !cached.reservation_type) {
      updates.reservation_type = pending.reservation_type;
    }
    if (pending.rv_details && !cached.rv_details) updates.rv_details = pending.rv_details;
    if (!Object.keys(updates).length) {
      sessionStorage.removeItem(PENDING_PROFILE_KEY);
      return;
    }
    await this.updateProfileRaw(updates);
    sessionStorage.removeItem(PENDING_PROFILE_KEY);
  },

  async signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    throwIfError(error);
    cacheSession(data.session);
    try {
      await this.refreshProfile();
    } catch {
      writeJson(PROFILE_CACHE_KEY, null);
    }
    const user = this.getCurrentUser();
    if (user?.accountStatus === "suspended" || user?.accountStatus === "closed") {
      await this.signOutQuiet();
      throw new Error("This account is closed or suspended. Contact the office.");
    }
    return user;
  },

  async signInAsMember(loginId, password) {
    const email = await this.resolveMemberLoginEmail(loginId);
    const user = await this.signIn(email, password);
    if (user?.accountKind === "admin") {
      await this.signOutQuiet();
      throw new Error("Use Admin Sign In for staff accounts. Member Sign In is for members only.");
    }
    return user;
  },

  async signInAsAdmin(email, password) {
    const user = await this.signIn(email, password);
    const isAdmin = await this.verifyAdmin();
    if (!isAdmin || user?.accountKind !== "admin") {
      await this.signOutQuiet();
      throw new Error("This account does not have administrator access.");
    }
    return user;
  },

  async signUp({ email, password, name, phone, reservationType, rv }) {
    const dbType = toDbReservationType(reservationType);
    const metadata = {
      full_name: name || "",
      phone: phone || "",
    };
    if (dbType) metadata.reservation_type = dbType;
    if (rv) metadata.rv_details = rv;

    const pending = {
      email,
      full_name: name || "",
      phone: phone || "",
    };
    if (dbType) pending.reservation_type = dbType;
    if (rv) pending.rv_details = rv;

    const { data, error } = await getClient().auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${siteOrigin()}login.html`,
      },
    });
    throwIfError(error);

    try {
      sessionStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(pending));
    } catch {
      /* ignore */
    }

    if (data?.user?.identities && data.user.identities.length === 0) {
      throw new Error("An account with this email already exists. Sign in instead.");
    }

    if (data?.session) {
      cacheSession(data.session);
      try {
        const profile = await this._waitForProfile(data.user.id);
        if (profile) writeJson(PROFILE_CACHE_KEY, profile);
        const profileUpdates = {
          name,
          phone,
          profileEmail: email,
        };
        if (reservationType) profileUpdates.reservationType = reservationType;
        if (rv) profileUpdates.rv = rv;
        await this.updateProfile(profileUpdates);
      } catch {
        /* profile trigger may still be running */
      }
      return { user: this.getCurrentUser(), needsEmailConfirmation: false };
    }

    return { user: null, needsEmailConfirmation: true, email };
  },

  async updateProfileRaw(updates) {
    const session = this.getSession();
    if (!session?.user?.id) throw new Error("Not signed in.");
    const { data, error } = await getClient()
      .from("profiles")
      .update(updates)
      .eq("id", session.user.id)
      .select()
      .maybeSingle();
    throwIfError(error);
    if (data) writeJson(PROFILE_CACHE_KEY, data);
    return this.getCurrentUser();
  },

  async updateProfile(updates) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Not signed in.");
    const mergedName = updates.name ?? user.name;
    const mergedEmail = updates.profileEmail ?? user.profileEmail;
    const mergedPhone = updates.phone ?? user.phone;
    const mergedAddress = updates.address ?? user.address;
    const mergedCity = updates.city ?? user.city;
    const mergedState = updates.state ?? user.state;
    const mergedZip = updates.zip ?? user.zip;
    const complete = Boolean(
      mergedName && mergedEmail && mergedPhone && mergedAddress && mergedCity && mergedState && mergedZip
    );
    const payload = {
      full_name: mergedName || "",
      email: mergedEmail || user.email,
      phone: mergedPhone || "",
      address: mergedAddress || "",
      city: mergedCity || "",
      state: mergedState || "",
      zip: mergedZip || "",
      rv_details: updates.rv ?? user.rv ?? "",
      profile_complete: complete,
    };
    const dbType = toDbReservationType(updates.reservationType ?? user.reservationType);
    if (dbType) payload.reservation_type = dbType;
    return this.updateProfileRaw(payload);
  },

  async changePassword(currentPassword, newPassword) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Not signed in.");
    if (newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }
    await this.signIn(user.email, currentPassword);
    const { error } = await getClient().auth.updateUser({ password: newPassword });
    throwIfError(error);
    return this.getCurrentUser();
  },

  async requestPasswordReset(email) {
    const { error } = await getClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${siteOrigin()}reset-password.html`,
    });
    throwIfError(error);
    return { email };
  },

  async updatePassword(newPassword, options = {}) {
    if (newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }
    const session = this.getSession();
    if (!session?.access_token) {
      throw new Error("This reset link is invalid or has expired.");
    }
    const user = this.getCurrentUser();
    if (user?.accountKind === "member" && options.username) {
      await this.setMemberUsername(options.username);
    } else if (
      user?.accountKind === "member" &&
      !user.username &&
      options.requireUsername
    ) {
      throw new Error("Choose a username.");
    }
    const { error } = await getClient().auth.updateUser({ password: newPassword });
    throwIfError(error);
    try {
      await this.clearMustChangePassword();
    } catch {
      /* profile flag may already be clear */
    }
    return true;
  },

  async createBooking({ reservationType, spot, checkIn, checkOut, notes }) {
    const user = this.getCurrentUser();
    if (!user?.id) throw new Error("Sign in to complete a booking.");
    if (user.accountKind === "admin") {
      throw new Error("Admins cannot book while signed in as admin. Use a member account.");
    }
    if (!this.canAccessMembers(user)) {
      throw new Error("Member access required to book.");
    }
    const dbType = toDbReservationType(reservationType);
    if (!dbType) throw new Error("Choose Condo, Family reunion, or RV.");
    const now = new Date().toISOString();
    const { data, error } = await getClient()
      .from("bookings")
      .insert({
        user_id: user.id,
        reservation_type: dbType,
        spot: spot || null,
        check_in: checkIn,
        check_out: checkOut,
        original_check_in: checkIn,
        original_check_out: checkOut,
        status: "confirmed",
        notes: notes || null,
        confirmed_at: now,
        booked_by_kind: "member",
        booked_by_user_id: user.id,
      })
      .select()
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Booking could not be saved.");
    return data;
  },

  async updateOwnBooking(bookingId, { reservationType, spot, checkIn, checkOut, notes }) {
    const user = this.getCurrentUser();
    if (!user?.id) throw new Error("Sign in to update a booking.");
    if (!bookingId) throw new Error("Booking is required.");
    if (!checkIn || !checkOut) throw new Error("Check-in and check-out are required.");
    if (checkOut <= checkIn) throw new Error("Check-out must be after check-in.");

    const { data: existing, error: existingError } = await getClient()
      .from("bookings")
      .select(
        "id,user_id,status,check_in,check_out,original_check_in,original_check_out,reservation_type,spot"
      )
      .eq("id", bookingId)
      .eq("user_id", user.id)
      .maybeSingle();
    throwIfError(existingError);
    if (!existing) throw new Error("Reservation not found.");
    if (existing.status === "cancelled") {
      throw new Error("That reservation was already cancelled.");
    }

    const editGate = this.bookingCanEditOrCancel(existing);
    if (!editGate.allowed) {
      throw new Error(editGate.reason || "This reservation can no longer be edited online.");
    }

    const existingUiType = toUiReservationType(existing.reservation_type);
    const requestedUiType = toUiReservationType(reservationType) || reservationType;
    if (requestedUiType && existingUiType && requestedUiType !== existingUiType) {
      throw new Error("You cannot change reservation type. Delete and book a new stay instead.");
    }
    if (!this.stayOverlapsOriginal(checkIn, checkOut, existing)) {
      throw new Error(this.originalStayOverlapMessage(existing));
    }

    const { data, error } = await getClient()
      .from("bookings")
      .update({
        reservation_type: existing.reservation_type,
        spot: spot || null,
        check_in: checkIn,
        check_out: checkOut,
        notes: notes || null,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Reservation could not be updated.");
    return data;
  },

  async cancelOwnBooking(bookingId) {
    const user = this.getCurrentUser();
    if (!user?.id) throw new Error("Sign in to cancel a booking.");
    if (!bookingId) throw new Error("Booking is required.");

    const { data: existing, error: existingError } = await getClient()
      .from("bookings")
      .select("id,user_id,status,check_in,check_out,reservation_type,spot")
      .eq("id", bookingId)
      .eq("user_id", user.id)
      .maybeSingle();
    throwIfError(existingError);
    if (!existing) throw new Error("Reservation not found.");
    if (existing.status === "cancelled") {
      throw new Error("That reservation was already cancelled.");
    }

    const cancelGate = this.bookingCanEditOrCancel(existing);
    if (!cancelGate.allowed) {
      throw new Error(cancelGate.reason || "This reservation can no longer be cancelled online.");
    }

    const { data, error } = await getClient()
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Reservation could not be cancelled.");
    return data;
  },

  acceptRecoveryFromUrl() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const accessToken = hash.get("access_token") || query.get("access_token");
    const refreshToken = hash.get("refresh_token") || query.get("refresh_token");
    const type = hash.get("type") || query.get("type");
    if (!accessToken) return Boolean(this.getCurrentUser());
    const payload = decodeJwt(accessToken);
    cacheSession({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: payload?.exp,
      user: {
        id: payload?.sub,
        email: payload?.email,
      },
    });
    if (window.history.replaceState) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    return type === "recovery" || Boolean(accessToken);
  },

  /** True when edited_at is set and later than created_at (matches hub/view badges). */
  bookingWasEdited(booking) {
    if (!booking?.edited_at || !booking?.created_at) return false;
    const edited = new Date(booking.edited_at).getTime();
    const created = new Date(booking.created_at).getTime();
    return Number.isFinite(edited) && Number.isFinite(created) && edited > created;
  },

  /**
   * Member list order: active (non-cancelled) first by stay date, then cancelled.
   * Active: upcoming/current by soonest check_in, then past (most recent check_in first).
   * Cancelled: same date rules (upcoming cancelled ascending, then past descending).
   * Same check_in: original before edited, then created_at / id.
   */
  sortBookingsForDisplay(bookings = []) {
    const today = new Date().toISOString().split("T")[0];
    const isCancelled = (b) => b?.status === "cancelled";
    const isPast = (b) => Boolean(b?.check_out && b.check_out < today);
    const editedRank = (b) => (this.bookingWasEdited(b) ? 1 : 0);
    return [...bookings].sort((a, b) => {
      const cancelA = isCancelled(a) ? 1 : 0;
      const cancelB = isCancelled(b) ? 1 : 0;
      if (cancelA !== cancelB) return cancelA - cancelB;
      const pastA = isPast(a) ? 1 : 0;
      const pastB = isPast(b) ? 1 : 0;
      if (pastA !== pastB) return pastA - pastB;
      const checkInA = a?.check_in || "";
      const checkInB = b?.check_in || "";
      if (checkInA !== checkInB) {
        if (pastA) return checkInA > checkInB ? -1 : 1;
        return checkInA < checkInB ? -1 : 1;
      }
      const byEdited = editedRank(a) - editedRank(b);
      if (byEdited !== 0) return byEdited;
      const createdA = a?.created_at || "";
      const createdB = b?.created_at || "";
      if (createdA !== createdB) return createdA < createdB ? -1 : 1;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  },

  async listBookings() {
    const user = this.getCurrentUser();
    if (!user?.id) return [];
    const { data, error } = await getClient()
      .from("bookings")
      .select("*")
      .eq("user_id", user.id)
      .order("check_in", { ascending: true });
    throwIfError(error);
    return this.sortBookingsForDisplay(data || []);
  },

  /**
   * Confirmed stays that still count toward the max of 2.
   * Counts until office check-in (status → active), not merely until the check-in date.
   * Past stays (check-out on or before today) no longer count.
   */
  getActiveBookings(bookings = []) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return bookings.filter(
      (b) =>
        b.status === "confirmed" &&
        b.check_out &&
        b.check_out > today
    );
  },

  /** Human status: Confirmed → Active after office check-in → Completed after stay end. */
  bookingDisplayStatus(booking) {
    if (typeof window.BookingRuleFlags?.displayStatus === "function") {
      return window.BookingRuleFlags.displayStatus(booking);
    }
    const status = String(booking?.status || "").toLowerCase();
    if (status === "cancelled") return "Cancelled";
    if (status === "pending") return "Pending";
    if (status === "completed") return "Completed";
    if (status === "active") return "Active";
    if (status !== "confirmed") return booking?.status || "—";
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const checkOut = booking?.check_out || "";
    if (checkOut && checkOut <= today) return "Completed";
    return "Confirmed";
  },

  /**
   * Office check-in at the resort (staff activates the stay).
   */
  async checkInBookingAsAdmin(bookingId, { notes = "" } = {}) {
    if (!this.hasAdminTask("reservations_manage")) {
      throw new Error("You are not assigned the Reservations manage task.");
    }
    const admin = this.getCurrentUser();
    if (!admin?.id) throw new Error("Admin sign in required.");
    if (!bookingId) throw new Error("Booking is required.");

    const { data: existing, error: existingError } = await getClient()
      .from("bookings")
      .select("id,status,office_checked_in_at,check_in,check_out")
      .eq("id", bookingId)
      .maybeSingle();
    throwIfError(existingError);
    if (!existing) throw new Error("Booking not found.");
    if (existing.status === "cancelled") {
      throw new Error("Cancelled reservations cannot be checked in.");
    }
    if (existing.status === "active" || existing.office_checked_in_at) {
      throw new Error("This reservation is already checked in.");
    }
    const checkIn = existing.check_in || "";
    if (checkIn) {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
      if (today < checkIn) {
        throw new Error(
          `Office check-in opens on the first day of the stay (${checkIn}).`
        );
      }
    }

    const now = new Date().toISOString();
    const { data, error } = await getClient()
      .from("bookings")
      .update({
        status: "active",
        office_checked_in_at: now,
        office_checked_in_by: admin.id,
        office_check_in_notes: String(notes || "").trim(),
        edited_at: now,
        last_edit_summary: `Office check-in by ${admin.name || admin.email || "staff"}`,
      })
      .eq("id", bookingId)
      .select()
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Check-in could not be saved.");
    return data;
  },

  /** Update office check-in notes after check-in (does not change who/when). */
  async updateOfficeCheckInNotesAsAdmin(bookingId, notes) {
    if (!this.hasAdminTask("reservations_manage")) {
      throw new Error("You are not assigned the Reservations manage task.");
    }
    if (!bookingId) throw new Error("Booking is required.");
    const { data: existing, error: existingError } = await getClient()
      .from("bookings")
      .select("id,office_checked_in_at")
      .eq("id", bookingId)
      .maybeSingle();
    throwIfError(existingError);
    if (!existing) throw new Error("Booking not found.");
    if (!existing.office_checked_in_at) {
      throw new Error("Check the member in before saving check-in notes.");
    }
    const { data, error } = await getClient()
      .from("bookings")
      .update({
        office_check_in_notes: String(notes || "").trim(),
      })
      .eq("id", bookingId)
      .select()
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new Error("Check-in notes could not be saved.");
    return data;
  },

  saveLastBooking(record) {
    const payload = JSON.stringify(record);
    try {
      localStorage.setItem(LAST_BOOKING_KEY, payload);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.setItem(LAST_BOOKING_KEY, payload);
    } catch {
      /* ignore */
    }
  },

  getLastBooking() {
    try {
      const local = localStorage.getItem(LAST_BOOKING_KEY);
      if (local) return JSON.parse(local);
    } catch {
      /* ignore */
    }
    try {
      return JSON.parse(sessionStorage.getItem(LAST_BOOKING_KEY) || "null");
    } catch {
      return null;
    }
  },

  clearLastBooking() {
    try {
      localStorage.removeItem(LAST_BOOKING_KEY);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(LAST_BOOKING_KEY);
    } catch {
      /* ignore */
    }
  },
};

function decodeJwt(token) {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

window.Auth = Auth;
