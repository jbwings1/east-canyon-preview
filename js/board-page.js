/**
 * Public Board Information — load board_members roster from Supabase.
 */
(async function () {
  const listEl = document.getElementById("board-member-list");
  const status = document.getElementById("board-members-status");
  if (!listEl) return;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveUrl(url) {
    return window.EcrGalleryUrl ? window.EcrGalleryUrl.resolve(url) : url || "";
  }

  function telHref(phone) {
    const digits = String(phone || "").replace(/[^\d+]/g, "");
    return digits ? `tel:${digits.startsWith("+") ? digits : `+1${digits.replace(/^1/, "")}`}` : "";
  }

  if (!window.ecrSupabase) {
    if (status) {
      status.hidden = false;
      status.textContent = "Board members could not be loaded right now.";
    }
    return;
  }

  try {
    const { data, error } = await window.ecrSupabase
      .from("board_members")
      .select("id,full_name,title,phone,email,committee,photo_url,sort_order")
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) throw error;

    const members = data || [];
    if (!members.length) {
      listEl.innerHTML = "";
      if (status) {
        status.hidden = false;
        status.textContent = "Board member listings are being updated.";
      }
      return;
    }

    listEl.innerHTML = members
      .map((m) => {
        const name = escapeHtml(m.full_name);
        const title = String(m.title || "").trim();
        const phone = String(m.phone || "").trim();
        const email = String(m.email || "").trim();
        const committee = String(m.committee || "").trim();
        const photo = resolveUrl(m.photo_url);
        const img = photo
          ? `<img src="${escapeHtml(photo)}" alt="${name}" loading="lazy">`
          : "";
        const titleHtml = title ? `<span>${escapeHtml(title)}</span>` : "";
        const phoneHtml = phone
          ? `<a href="${escapeHtml(telHref(phone))}">${escapeHtml(phone)}</a>`
          : "";
        const emailHtml = email
          ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`
          : "";
        const committeeHtml = committee
          ? `<span class="board-member-committee">${escapeHtml(committee)}</span>`
          : "";
        return `<li>
          ${img}
          <div>
            <strong>${name}</strong>
            ${titleHtml}
            ${phoneHtml}
            ${emailHtml}
            ${committeeHtml}
          </div>
        </li>`;
      })
      .join("");

    if (status) {
      status.hidden = true;
      status.textContent = "";
    }
  } catch (err) {
    if (status) {
      status.hidden = false;
      status.textContent = "Board members could not be loaded right now.";
    }
    console.error(err);
  }
})();
