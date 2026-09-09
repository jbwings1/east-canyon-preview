(async function () {
  const sessionUser = Auth.requireAuth();
  if (!sessionUser) return;

  try {
    await Auth.ready();
  } catch {
    /* cached profile */
  }

  const user = Auth.getCurrentUser() || sessionUser;
  const typeLabel = Auth.reservationTypeLabel(user.reservationType || user.accountType) || "Member";

  document.getElementById("welcome-name").textContent = user.name
    ? `Hello, ${user.name.split(" ")[0]}`
    : "My Account";
  document.getElementById("account-type-label").textContent = typeLabel;

  document.getElementById("profile-member-id").value = user.memberId || "";
  document.getElementById("profile-login").value = user.email || "";
  document.getElementById("profile-username").value = user.username || "";
  document.getElementById("profile-name").value = user.name || "";
  document.getElementById("profile-email").value = user.profileEmail || "";
  document.getElementById("profile-phone").value = user.phone || "";
  document.getElementById("profile-address").value = user.address || "";
  document.getElementById("profile-city").value = user.city || "";
  document.getElementById("profile-state").value = user.state || "";
  document.getElementById("profile-zip").value = user.zip || "";
  document.getElementById("profile-rv").value = user.rv || "";
  const typeSelect = document.getElementById("profile-type");
  if (typeSelect) typeSelect.value = user.reservationType || "";

  const spotContent = document.getElementById("spot-content");
  const bookingsContent = document.getElementById("bookings-content");

  if (user.assignedSpot) {
    const spots = window.CAMPGROUND_SPOTS || window.MAP_UNITS || [];
    const spot = spots.find((s) => s.id === user.assignedSpot);
    const spotType =
      spot && window.SPOT_TYPE_LABELS ? window.SPOT_TYPE_LABELS[spot.type] : "Assigned site";
    spotContent.innerHTML = `
      <p class="dashboard-spot-number">Site <strong>${user.assignedSpot}</strong></p>
      <p>${spotType}</p>
      <a href="map.html?spot=${user.assignedSpot}" class="btn btn-outline">View on Map</a>
    `;
  } else {
    spotContent.innerHTML = `
      <p>No assigned spot — book a Condo, Family reunion, or RV stay on the map.</p>
      <a href="reservation-book.html" class="btn btn-primary">Make a Reservation</a>
    `;
  }

  async function renderBookings() {
    let bookings = [];
    try {
      bookings = await Auth.listBookings();
    } catch {
      bookings = [];
    }

    if (!bookings.length) {
      bookingsContent.innerHTML = `<p class="dashboard-empty">No bookings yet.</p>`;
      return;
    }

    bookingsContent.innerHTML = bookings
      .map((b) => {
        const label = Auth.reservationTypeLabel(b.reservation_type) || "Reservation";
        const status = b.status || "confirmed";
        const spot = b.spot ? ` · ${b.spot}` : "";
        return `
      <article class="booking-item">
        <p><strong>${label}${spot}</strong> · ${b.check_in} → ${b.check_out}</p>
        <span class="status-pill ${status === "confirmed" ? "available" : "reserved"}">${status}</span>
      </article>`;
      })
      .join("");
  }

  await renderBookings();

  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("password-message");
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    try {
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match.");
      }
      await Auth.changePassword(currentPassword, newPassword);
      msg.textContent = "Password updated.";
      msg.className = "form-message success";
      e.target.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "form-message error";
    }
  });

  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("profile-message");
    try {
      const updated = await Auth.updateProfile({
        name: document.getElementById("profile-name").value.trim(),
        profileEmail: document.getElementById("profile-email").value.trim(),
        phone: document.getElementById("profile-phone").value.trim(),
        address: document.getElementById("profile-address").value.trim(),
        city: document.getElementById("profile-city").value.trim(),
        state: document.getElementById("profile-state").value.trim().toUpperCase(),
        zip: document.getElementById("profile-zip").value.trim(),
        rv: document.getElementById("profile-rv").value.trim(),
        reservationType: typeSelect ? typeSelect.value : user.reservationType,
      });
      msg.textContent = "Profile saved.";
      msg.className = "form-message success";
      document.getElementById("welcome-name").textContent = updated.name
        ? `Hello, ${updated.name.split(" ")[0]}`
        : "My Account";
      document.getElementById("account-type-label").textContent =
        Auth.reservationTypeLabel(updated.reservationType) || "Member";
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "form-message error";
    }
  });

  Auth.showAdminLinks();

  document.getElementById("logout-btn").addEventListener("click", () => Auth.logout());
})();
