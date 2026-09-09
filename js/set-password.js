if (!Auth.getCurrentUser()) {
  window.location.replace("login.html");
} else {
  const user = Auth.getCurrentUser();
  document.getElementById("password-login").value = user.email || "";
  const usernameInput = document.getElementById("setup-username");
  if (usernameInput && user.username) {
    usernameInput.value = user.username;
  }
}

document.getElementById("password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = document.getElementById("password-message");
  message.textContent = "";
  message.className = "form-message";

  const username = document.getElementById("setup-username").value.trim();
  const newPassword = document.getElementById("setup-new-password").value;
  const confirmPassword = document.getElementById("setup-confirm-password").value;

  try {
    if (!username) {
      throw new Error("Choose a username.");
    }
    if (newPassword !== confirmPassword) {
      throw new Error("New passwords do not match.");
    }
    await Auth.updatePassword(newPassword, {
      username,
      requireUsername: true,
    });
    await Auth.signOutQuiet();
    message.textContent = "Saved. Sign in with your username or email and new password.";
    message.className = "form-message success";
    window.location.replace("login.html");
  } catch (err) {
    message.textContent = err.message;
    message.className = "form-message error";
  }
});
