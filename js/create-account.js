const form = document.getElementById("signup-form");
const message = document.getElementById("signup-message");

function showMessage(text, type) {
  message.textContent = text;
  message.className = type ? `form-message ${type}` : "form-message";
}

if (typeof Auth !== "undefined" && Auth.getCurrentUser()) {
  const user = Auth.getCurrentUser();
  if (user.accountKind === "admin") {
    window.location.replace("admin.html");
  } else if (Auth.needsPasswordChange(user)) {
    window.location.replace("set-password.html");
  } else {
    window.location.replace("member-home.html");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMessage("", "");

  const email = document.getElementById("signup-email").value.trim();
  const memberId = document.getElementById("signup-member-id").value.trim();
  const temporaryPassword = document.getElementById("signup-password").value;

  try {
    await Auth.activateMemberAccount({ email, memberId, temporaryPassword });
    showMessage("Verified. Opening create password…", "success");
    window.location.replace("set-password.html");
  } catch (err) {
    showMessage(err.message, "error");
  }
});
