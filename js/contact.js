const STORAGE_KEY = "eastCanyonContactMessages";
const form = document.getElementById("contact-form");
const status = document.getElementById("contact-status");

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.className = "form-message";
    status.textContent = "";

    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      list = [];
    }
    if (!Array.isArray(list)) list = [];

    list.push({
      member: form.member.value,
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim(),
      submittedAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    form.reset();
    form.querySelector('input[name="member"][value="No"]').checked = true;
    status.className = "form-message success";
    status.textContent = "Thanks for submitting!";
  });
}
