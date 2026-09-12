const signinForm = document.getElementById("signin-form");
const message = document.getElementById("auth-message");
const signinPanel = document.getElementById("signin-panel");
const signedInPanel = document.getElementById("signed-in-panel");
const signedInMessage = document.getElementById("signed-in-message");
const resetSiteData = document.getElementById("reset-site-data");

function showMessage(text, type) {
  if (!message) return;
  message.textContent = text;
  message.className = type ? `form-message ${type}` : "form-message";
}

function getSafeNextUrl() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (
    next &&
    /^[a-z0-9./_-]+\.html(?:\?id=[a-z0-9-]+)?$/i.test(next) &&
    !next.includes("..")
  ) {
    if (next.startsWith("admin.html") || next.startsWith("admin-login.html")) return null;
    return next;
  }
  return null;
}

const nextUrl = getSafeNextUrl();
const signedInContinue = document.getElementById("signed-in-continue");
if (signedInContinue && nextUrl) {
  signedInContinue.href = nextUrl;
  signedInContinue.textContent = "Continue to Reservations";
}

function showSignedIn(user) {
  if (!signinPanel || !signedInPanel) return;
  signinPanel.hidden = true;
  signedInPanel.hidden = false;
  if (signedInMessage) {
    signedInMessage.textContent = `Signed in as ${user.name || user.email}.`;
  }
  if (typeof SiteHeaderAuth?.mount === "function") SiteHeaderAuth.mount();
}

function showSignInForm() {
  if (!signinPanel || !signedInPanel) return;
  signinPanel.hidden = false;
  signedInPanel.hidden = true;
}

function routeSignedInMember(user) {
  if (user.accountKind === "admin") {
    window.location.replace("admin.html");
    return;
  }
  if (Auth.needsPasswordChange(user)) {
    window.location.href = "set-password.html";
    return;
  }
  window.location.href = nextUrl || "member-home.html";
}

if (typeof Auth === "undefined") {
  showMessage("Login could not start. Make sure js/auth.js loaded correctly.", "error");
} else if (!Auth.storageAvailable()) {
  showMessage(
    "This browser is not saving login data. Use a normal window (not private browsing).",
    "error"
  );
} else {
  const currentUser = Auth.getCurrentUser();
  if (currentUser) {
    routeSignedInMember(currentUser);
  }
}

if (resetSiteData) {
  resetSiteData.addEventListener("click", () => {
    Auth.clearAllSiteData();
    showSignInForm();
    if (typeof SiteHeaderAuth?.mount === "function") SiteHeaderAuth.mount();
    showMessage("Saved sign-in data was cleared. Sign in again with your email.", "success");
    if (signinForm) signinForm.reset();
  });
}

if (signinForm && typeof Auth !== "undefined") {
  signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMessage("", "");

    const loginId = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value;

    if (!loginId || !password) {
      showMessage("Enter your username or email and password.", "error");
      return;
    }

    try {
      const user = await Auth.signInAsMember(loginId, password);
      routeSignedInMember(user);
    } catch (err) {
      showMessage(err.message, "error");
    }
  });
}
