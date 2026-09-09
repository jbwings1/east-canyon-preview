const STORAGE_KEY = "eastCanyonCommitteeApplications";
const form = document.getElementById("committee-form");
const message = document.getElementById("committee-message");

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);
  return {
    first: parts[0] || "",
    last: parts.slice(1).join(" ") || "",
  };
}

function prefill(user) {
  if (typeof Auth === "undefined" || !Auth.getCurrentUser) return;
  user = user || Auth.getCurrentUser();
  if (!user) return;
  const names = splitName(user.name);
  const first = document.getElementById("committee-first");
  const last = document.getElementById("committee-last");
  const email = document.getElementById("committee-email");
  const phone = document.getElementById("committee-phone");
  if (first && !first.value) first.value = names.first;
  if (last && !last.value) last.value = names.last;
  if (email && !email.value) email.value = user.profileEmail || user.email || "";
  if (phone && !phone.value) phone.value = user.phone || "";
}

function saveApplication(data) {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    list = [];
  }
  if (!Array.isArray(list)) list = [];
  list.push(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  message.className = "form-message";
  message.textContent = "";

  const committees = [...form.querySelectorAll('input[name="committees"]:checked')].map(
    (input) => input.value
  );
  if (!committees.length) {
    message.className = "form-message error";
    message.textContent = "Please select at least one committee.";
    return;
  }

  saveApplication({
    firstName: form.firstName.value.trim(),
    lastName: form.lastName.value.trim(),
    email: form.email.value.trim(),
    previous: form.previous.value,
    phone: form.phone.value.trim(),
    years: form.years.value,
    committees,
    why: form.why.value.trim(),
    experience: form.experience.value.trim(),
    comments: form.comments.value.trim(),
    submittedAt: new Date().toISOString(),
  });

  form.reset();
  form.querySelector('input[name="previous"][value="No"]').checked = true;
  message.className = "form-message success";
  message.textContent = "Thanks for submitting!";
});

if (typeof Auth !== "undefined" && Auth.ready) {
  Auth.ready().then(prefill);
} else {
  prefill();
}
