/**
 * Office temporary passwords. Member picker matches the other admin member lists.
 */
(async function () {
  const me = await AdminCommon.requireAdmin("passwords");
  if (!me) return;

  const form = document.getElementById("admin-reset-password-form");
  const message = document.getElementById("admin-message");
  const search = document.getElementById("password-member-search");
  const list = document.getElementById("password-member-list");
  const hidden = document.getElementById("password-member");
  const MEMBER_LIST_LIMIT = 20;
  let profiles = [];
  let highlight = -1;

  function memberChoiceLabel(member) {
    const name = member.full_name || member.email || "Member";
    return member.member_id ? `${name} · ${member.member_id}` : name;
  }

  function memberChoices() {
    return profiles
      .filter((member) => AdminCommon.profileHasMembership(member) && member.account_status !== "closed")
      .sort((a, b) =>
        memberChoiceLabel(a).localeCompare(memberChoiceLabel(b), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
  }

  function memberMatchesSearch(member, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const name = String(member.full_name || "").toLowerCase();
    const memberId = String(member.member_id || "").toLowerCase();
    const label = memberChoiceLabel(member).toLowerCase();
    return name.includes(q) || memberId.includes(q) || label.includes(q);
  }

  function rankMemberChoice(member, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return 3;
    const memberId = String(member.member_id || "").toLowerCase();
    const name = String(member.full_name || "").toLowerCase();
    if (memberId && memberId === q) return 0;
    if (memberId && memberId.startsWith(q)) return 1;
    if (name.startsWith(q)) return 2;
    return 3;
  }

  function matchingMemberChoices(query) {
    return memberChoices()
      .filter((member) => memberMatchesSearch(member, query))
      .sort((a, b) => {
        const rank = rankMemberChoice(a, query) - rankMemberChoice(b, query);
        if (rank) return rank;
        return memberChoiceLabel(a).localeCompare(memberChoiceLabel(b), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }

  function closeMemberList() {
    highlight = -1;
    if (list) {
      list.hidden = true;
      list.innerHTML = "";
    }
    if (search) {
      search.setAttribute("aria-expanded", "false");
      search.removeAttribute("aria-activedescendant");
    }
  }

  function paintHighlight() {
    if (!list) return;
    [...list.querySelectorAll("[data-member-id]")].forEach((button, index) => {
      const on = index === highlight;
      button.setAttribute("aria-selected", on ? "true" : "false");
      button.classList.toggle("is-active", on);
      if (on) {
        button.id = "password-member-active";
        search?.setAttribute("aria-activedescendant", button.id);
        button.scrollIntoView({ block: "nearest" });
      } else if (button.id === "password-member-active") {
        button.removeAttribute("id");
      }
    });
  }

  function showMemberList() {
    if (!search || !list) return;
    const matches = matchingMemberChoices(search.value || "");
    const shown = matches.slice(0, MEMBER_LIST_LIMIT);
    highlight = shown.length ? 0 : -1;
    const items = shown
      .map(
        (member) =>
          `<li role="presentation"><button type="button" role="option" data-member-id="${AdminCommon.escapeHtml(
            member.id
          )}">${AdminCommon.escapeHtml(memberChoiceLabel(member))}</button></li>`
      )
      .join("");
    const more =
      matches.length > shown.length
        ? `<li class="member-lookup-note" role="presentation">Showing ${shown.length} of ${matches.length}. Keep typing to narrow the list.</li>`
        : "";
    const empty = shown.length
      ? ""
      : `<li class="member-lookup-note" role="presentation">No members match.</li>`;
    list.innerHTML = items + more + empty;
    list.hidden = false;
    search.setAttribute("aria-expanded", "true");
    paintHighlight();
  }

  function applyMemberPick(id) {
    const member = memberChoices().find((item) => item.id === id);
    if (!member || !hidden) return;
    hidden.value = member.id;
    if (search) search.value = memberChoiceLabel(member);
    closeMemberList();
  }

  function clearPickIfEdited() {
    const selected = memberChoices().find((member) => member.id === hidden?.value);
    if (!selected || search.value !== memberChoiceLabel(selected)) {
      if (hidden) hidden.value = "";
    }
  }

  search?.addEventListener("focus", showMemberList);
  search?.addEventListener("input", () => {
    clearPickIfEdited();
    showMemberList();
  });
  search?.addEventListener("keydown", (event) => {
    const buttons = list && !list.hidden ? [...list.querySelectorAll("[data-member-id]")] : [];
    if (event.key === "ArrowDown" && buttons.length) {
      event.preventDefault();
      highlight = (highlight + 1) % buttons.length;
      paintHighlight();
    } else if (event.key === "ArrowUp" && buttons.length) {
      event.preventDefault();
      highlight = (highlight - 1 + buttons.length) % buttons.length;
      paintHighlight();
    } else if (event.key === "Enter") {
      if (!buttons.length) return;
      event.preventDefault();
      const index = highlight >= 0 ? highlight : 0;
      applyMemberPick(buttons[index].getAttribute("data-member-id"));
    } else if (event.key === "Escape") {
      closeMemberList();
    }
  });
  list?.addEventListener("mousedown", (event) => {
    const button = event.target.closest("[data-member-id]");
    if (!button) return;
    event.preventDefault();
    applyMemberPick(button.getAttribute("data-member-id"));
  });
  document.addEventListener("click", (event) => {
    const field = form?.querySelector(".member-lookup");
    if (field && !field.contains(event.target)) closeMemberList();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = document.getElementById("admin-reset-password-result");
    AdminCommon.showMessage(result, "", "");
    if (!hidden?.value) {
      AdminCommon.showMessage(result, "Choose a member from the list.", "error");
      search?.focus();
      showMemberList();
      return;
    }
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const created = await Auth.provisionUser({
        kind: "reset_password",
        user_id: hidden.value,
        temporary_password: document.getElementById("password-temp").value,
      });
      AdminCommon.showMessage(
        result,
        `Temporary password set for ${created.email}. Member must change it after sign-in.`,
        "success"
      );
      event.target.reset();
      if (hidden) hidden.value = "";
      closeMemberList();
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  try {
    profiles = await Auth.listAllProfiles();
  } catch (err) {
    AdminCommon.showMessage(message, err.message, "error");
  }
})();
