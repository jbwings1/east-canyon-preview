/**
 * Office invoices for the test member account.
 */
(async function () {
  const me = await AdminCommon.requireAdmin("reservations_manage");
  if (!me) return;

  const form = document.getElementById("invoice-form");
  const result = document.getElementById("invoice-result");
  const body = document.getElementById("invoice-body");
  const search = document.getElementById("invoice-member-search");
  const list = document.getElementById("invoice-member-list");
  const hidden = document.getElementById("invoice-member");
  let profiles = [];
  let invoices = [];
  let highlight = -1;

  function choices() {
    return profiles
      .filter((member) => AdminCommon.profileHasMembership(member) && member.account_status !== "closed")
      .map((member) => {
        const name = member.full_name || member.email || "Member";
        const label = member.member_id ? `${name} · ${member.member_id}` : name;
        return { id: member.id, label, name, memberId: String(member.member_id || "") };
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));
  }

  function matches(query) {
    const q = String(query || "").trim().toLowerCase();
    return choices()
      .filter((choice) => {
        if (!q) return true;
        return (
          choice.label.toLowerCase().includes(q) ||
          choice.name.toLowerCase().includes(q) ||
          choice.memberId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (!q) return 0;
        const aExact = a.memberId.toLowerCase() === q ? 0 : 1;
        const bExact = b.memberId.toLowerCase() === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
      });
  }

  function closeList() {
    highlight = -1;
    if (list) {
      list.hidden = true;
      list.innerHTML = "";
    }
    search?.setAttribute("aria-expanded", "false");
  }

  function showList() {
    if (!list || !search) return;
    const shown = matches(search.value).slice(0, 20);
    const all = matches(search.value);
    highlight = shown.length ? 0 : -1;
    const items = shown
      .map(
        (choice, index) =>
          `<li role="presentation"><button type="button" role="option" data-member-id="${AdminCommon.escapeHtml(
            choice.id
          )}" aria-selected="${index === 0 ? "true" : "false"}">${AdminCommon.escapeHtml(
            choice.label
          )}</button></li>`
      )
      .join("");
    const note =
      all.length > shown.length
        ? `<li class="member-lookup-note" role="presentation">Showing ${shown.length} of ${all.length}. Keep typing to narrow the list.</li>`
        : "";
    list.innerHTML =
      items + note || `<li class="member-lookup-note" role="presentation">No members match.</li>`;
    list.hidden = false;
    search.setAttribute("aria-expanded", "true");
  }

  function applyChoice(id) {
    const choice = choices().find((item) => item.id === id);
    if (hidden) hidden.value = choice ? choice.id : "";
    if (search && choice) search.value = choice.label;
    closeList();
  }

  function renderInvoices() {
    if (!invoices.length) {
      body.innerHTML = `<tr><td colspan="6">No invoices yet.</td></tr>`;
      return;
    }
    const today = Auth.localToday();
    body.innerHTML = invoices
      .map((invoice) => {
        const overdue = Auth.invoiceIsOverdue(invoice, today);
        const status = overdue ? "Overdue" : invoice.status === "paid" ? "Paid" : "Open";
        const paidNote =
          invoice.status === "paid" && invoice.payment_kind === "test" ? " · test" : "";
        return `<tr>
          <td><code>${AdminCommon.escapeHtml(invoice.invoice_number)}</code></td>
          <td>${AdminCommon.escapeHtml(invoice.member_name)} · ${AdminCommon.escapeHtml(invoice.member_id)}</td>
          <td>${AdminCommon.escapeHtml(Auth.chargeTypeLabel(invoice.charge_type))}<br>${AdminCommon.escapeHtml(invoice.description)}</td>
          <td>${AdminCommon.escapeHtml(Auth.formatMoney(invoice.amount))}</td>
          <td>${AdminCommon.escapeHtml(invoice.due_date || "—")}</td>
          <td>${AdminCommon.escapeHtml(status + paidNote)}</td>
        </tr>`;
      })
      .join("");
  }

  search?.addEventListener("focus", showList);
  search?.addEventListener("input", () => {
    const selected = choices().find((choice) => choice.id === hidden?.value);
    if (!selected || search.value !== selected.label) {
      if (hidden) hidden.value = "";
    }
    showList();
  });
  search?.addEventListener("keydown", (event) => {
    const buttons = list && !list.hidden ? [...list.querySelectorAll("[data-member-id]")] : [];
    if (event.key === "ArrowDown" && buttons.length) {
      event.preventDefault();
      highlight = (highlight + 1) % buttons.length;
    } else if (event.key === "ArrowUp" && buttons.length) {
      event.preventDefault();
      highlight = (highlight - 1 + buttons.length) % buttons.length;
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (buttons.length) {
        const index = highlight >= 0 ? highlight : 0;
        applyChoice(buttons[index].getAttribute("data-member-id"));
      }
      return;
    } else if (event.key === "Escape") {
      closeList();
      return;
    } else {
      return;
    }
    buttons.forEach((button, index) => button.classList.toggle("is-active", index === highlight));
  });
  list?.addEventListener("mousedown", (event) => {
    const button = event.target.closest("[data-member-id]");
    if (!button) return;
    event.preventDefault();
    applyChoice(button.getAttribute("data-member-id"));
  });
  document.addEventListener("click", (event) => {
    const field = document.querySelector("#invoice-form .member-lookup");
    if (field && !field.contains(event.target)) closeList();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    AdminCommon.showMessage(result, "", "");
    if (!hidden?.value) {
      AdminCommon.showMessage(result, "Choose a member from the list.", "error");
      search?.focus();
      showList();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const invoice = await Auth.createMemberInvoice({
        userId: hidden.value,
        chargeType: document.getElementById("invoice-type").value,
        description: document.getElementById("invoice-description").value.trim(),
        amount: Number(document.getElementById("invoice-amount").value),
        dueDate: document.getElementById("invoice-due").value,
      });
      AdminCommon.showMessage(
        result,
        `Invoice ${invoice.invoice_number} created for ${invoice.member_name}.`,
        "success"
      );
      form.reset();
      if (hidden) hidden.value = "";
      closeList();
      invoices = await Auth.listInvoices();
      renderInvoices();
    } catch (err) {
      AdminCommon.showMessage(result, err.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  });

  try {
    [profiles, invoices] = await Promise.all([Auth.listAllProfiles(), Auth.listInvoices()]);
    renderInvoices();
  } catch (err) {
    AdminCommon.showMessage(result, err.message, "error");
    body.innerHTML = `<tr><td colspan="6">${AdminCommon.escapeHtml(err.message)}</td></tr>`;
  }
})();
