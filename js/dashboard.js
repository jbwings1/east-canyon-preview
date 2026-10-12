(async function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

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

  const spotContent = document.getElementById("spot-content");
  const bookingsContent = document.getElementById("bookings-content");
  if (typeof BookingLimits !== "undefined") BookingLimits.bindStatusFlagClicks(bookingsContent);

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
        const statusLabel =
          typeof Auth.bookingDisplayStatus === "function"
            ? Auth.bookingDisplayStatus(b)
            : b.status || "confirmed";
        const statusClass =
          typeof Auth.bookingStatusClass === "function"
            ? Auth.bookingStatusClass(statusLabel)
            : statusLabel === "Past"
              ? "booked"
              : statusLabel === "Cancelled"
                ? "cancelled"
                : statusLabel === "Active" || statusLabel === "Confirmed" || statusLabel === "Edit confirmed"
                  ? "available"
                  : "partial";
        const spot = b.spot ? ` · ${b.spot}` : "";
        const conf =
          typeof Auth.bookingConfirmationId === "function" ? Auth.bookingConfirmationId(b) : "";
        const bookedOn = (() => {
          if (!b.created_at) return "—";
          const parsed = new Date(b.created_at);
          if (Number.isNaN(parsed.getTime())) return "—";
          return parsed.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        })();
        const dates =
          b.check_in && b.check_out && window.SpotAvailability?.formatDateRange
            ? window.SpotAvailability.formatDateRange(b.check_in, b.check_out) ||
              `${b.check_in} → ${b.check_out}`
            : `${b.check_in} → ${b.check_out}`;
        const pill = `<span class="status-pill ${statusClass}">${escapeHtml(statusLabel)}</span>`;
        const statusHtml =
          typeof BookingLimits !== "undefined"
            ? BookingLimits.statusWithFlags(pill, b.rule_overrides)
            : pill;
        const confLink = conf
          ? `<a class="reservation-id-link" href="reservation-view.html?id=${encodeURIComponent(b.id)}">${escapeHtml(conf)}</a> · `
          : "";
        return `
      <article class="booking-item">
        <div>
          <p>${confLink}<strong>${escapeHtml(label)}${escapeHtml(spot)}</strong></p>
          <p>${escapeHtml(dates)}</p>
          <p>Date booked ${escapeHtml(bookedOn)}</p>
        </div>
        ${statusHtml}
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
  if (typeof SiteHeaderAuth?.mount === "function") SiteHeaderAuth.mount();
})();
