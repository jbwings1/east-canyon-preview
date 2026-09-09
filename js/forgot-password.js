const form = document.getElementById("forgot-form");
const message = document.getElementById("forgot-message");
const demoLink = document.getElementById("demo-reset-link");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (demoLink) {
    demoLink.hidden = true;
    demoLink.innerHTML = "";
  }

  try {
    await Auth.requestPasswordReset(document.getElementById("forgot-login").value.trim());
    message.textContent =
      "If that email has an account, a reset link is on its way. Use the link to choose a new password.";
    message.className = "form-message success";
  } catch (err) {
    message.textContent = err.message;
    message.className = "form-message error";
  }
});
