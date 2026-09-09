const form = document.getElementById("admin-signin-form");
const message = document.getElementById("admin-auth-message");
const signinPanel = document.getElementById("signin-panel");
const signedInPanel = document.getElementById("signed-in-panel");
const signedInMessage = document.getElementById("signed-in-message");
const signedInContinue = document.getElementById("signed-in-continue");
const signedInLogout = document.getElementById("signed-in-logout");

function showMessage(text, type) {
  if (!message) return;
  message.textContent = text;
  message.className = type ? `form-message ${type}` : "form-message";
}

function showSignedIn(user, isAdmin) {
  if (!signinPanel || !signedInPanel) return;
  signinPanel.hidden = true;
  signedInPanel.hidden = false;
  if (signedInMessage) {
    signedInMessage.textContent = isAdmin
      ? `Signed in as ${user.name || user.email}.`
      : `Signed in as ${user.name || user.email}, but this account is not an administrator.`;
  }
  if (signedInContinue) {
    if (isAdmin) {
      signedInContinue.hidden = false;
      signedInContinue.href = "admin.html";
      signedInContinue.textContent = "Continue to Admin";
    } else {
      signedInContinue.hidden = false;
      signedInContinue.href = "login.html";
      signedInContinue.textContent = "Go to Member Sign In";
    }
  }
}

function showSignInForm() {
  if (!signinPanel || !signedInPanel) return;
  signinPanel.hidden = false;
  signedInPanel.hidden = true;
}

async function ensureAdminSession() {
  if (typeof Auth === "undefined") {
    showMessage("Admin sign-in could not start. Make sure js/auth.js loaded correctly.", "error");
    return;
  }
  if (!Auth.storageAvailable()) {
    showMessage(
      "This browser is not saving login data. Use a normal window (not private browsing).",
      "error"
    );
    return;
  }

  const currentUser = Auth.getCurrentUser();
  if (!currentUser) return;

  try {
    await Auth.ready();
  } catch {
    /* use cached profile */
  }

  const user = Auth.getCurrentUser() || currentUser;
  if (user.accountKind === "member") {
    showSignedIn(user, false);
    showMessage("Member accounts use Member Sign In. Staff use Admin Sign In with an office email.", "error");
    return;
  }

  const isAdmin = await Auth.verifyAdmin();
  if (isAdmin) {
    window.location.replace("admin.html");
    return;
  }

  showSignedIn(user, false);
}

if (signedInLogout) {
  signedInLogout.addEventListener("click", () => Auth.logout("admin-login.html"));
}

if (form && typeof Auth !== "undefined") {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMessage("", "");

    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    if (!email || !password) {
      showMessage("Enter your email and password.", "error");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await Auth.signInAsAdmin(email, password);
      showMessage("Signed in. Opening admin…", "success");
      window.location.replace("admin.html");
    } catch (err) {
      showSignInForm();
      showMessage(err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

ensureAdminSession();
