/**
 * Office invoices for the test member account.
 */
(async function () {
  const me = await AdminCommon.requireAdmin("accounts_manager");
  if (!me) return;

  const form = document.getElementById("invoice-form");
  const result = document.getElementById("invoice-result");
  const body = document.getElementById("invoice-body");
  const foot = document.getElementById("invoice-foot");
  const detailCard = document.getElementById("invoice-detail");
  const detailTitle = document.getElementById("invoice-detail-title");
  const detailList = document.getElementById("invoice-detail-list");
  const detailClose = document.getElementById("invoice-detail-close");
  const search = document.getElementById("invoice-member-search");
  const list = document.getElementById("invoice-member-list");
  const hidden = document.getElementById("invoice-member");
  const ledgerHelp = document.getElementById("invoice-ledger-help");
  const showAllButton = document.getElementById("invoice-show-all");
  const showOverdueButton = document.getElementById("invoice-show-overdue");
  let profiles = [];
  let invoices = [];
  let highlight = -1;
  let selectedId = "";
  let overdueOnly = false;

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

  function money(value) {
    return AdminCommon.escapeHtml(Auth.formatMoney(value));
  }

  function detailRow(label, value) {
    return `<div><dt>${AdminCommon.escapeHtml(label)}</dt><dd>${AdminCommon.escapeHtml(value)}</dd></div>`;
  }

  function addedByLabel(invoice) {
    const profile = profiles.find((person) => person.id === invoice?.created_by);
    if (typeof Auth.adminPersonLabel === "function") {
      const label = Auth.adminPersonLabel({
        name: profile?.full_name || invoice?.created_by_name,
        code: profile?.staff_code,
        admin_level: profile?.admin_level,
        admin_seat: profile?.admin_seat,
      });
      if (label) return label;
    }
    return invoice?.created_by_name || "—";
  }

  function selectedInvoice() {
    return invoices.find((invoice) => invoice.id === selectedId) || null;
  }

  function renderDetail() {
    const invoice = selectedInvoice();
    if (!detailCard || !detailList || !detailTitle) return;
    if (!invoice) {
      detailCard.hidden = true;
      detailList.innerHTML = "";
      return;
    }
    const today = Auth.localToday();
    const overdue = Auth.invoiceIsOverdue(invoice, today);
    const paid = invoice.status === "paid";
    const paidAmount = paid ? Number(invoice.paid_amount ?? invoice.amount ?? 0) : 0;
    const owed = Number(invoice.amount || 0) - paidAmount;
    detailTitle.textContent = `Invoice ${invoice.invoice_number}`;
    detailList.innerHTML = [
      detailRow("Inv number", invoice.invoice_number || "—"),
      detailRow("Date", AccountLedger.dateLabel(invoice.created_at)),
      detailRow("Added by", addedByLabel(invoice)),
      detailRow("Member", `${invoice.member_name || "—"}${invoice.member_id ? ` · ${invoice.member_id}` : ""}`),
      detailRow("Description", AccountLedger.description(invoice)),
      detailRow("Amount", Auth.formatMoney(invoice.amount)),
      detailRow("Due date", `${AccountLedger.dateLabel(invoice.due_date)}${overdue ? " · Overdue" : ""}`),
      detailRow("Paid", paid ? Auth.formatMoney(paidAmount) : "—"),
      detailRow("On", paid ? AccountLedger.dateLabel(invoice.paid_at) : "—"),
      detailRow("Paid with", AccountLedger.howPaid(invoice)),
      detailRow("Balance", Auth.formatMoney(owed)),
    ].join("");
    detailCard.hidden = false;
  }

  function visibleInvoices() {
    if (!overdueOnly) return invoices;
    const today = Auth.localToday();
    return invoices.filter((invoice) => Auth.invoiceIsOverdue(invoice, today));
  }

  function updateLedgerHelp(lines) {
    if (!ledgerHelp) return;
    if (!overdueOnly) {
      ledgerHelp.textContent =
        "One sheet for every invoice. Total is that member’s balance still owed after the row. Select an invoice number to open that invoice.";
      return;
    }
    const accounts = new Set(
      lines.map((line) => String(line.invoice.user_id || line.invoice.member_id || line.invoice.id))
    );
    const count = accounts.size;
    ledgerHelp.textContent = count
      ? `Showing ${count} overdue account${count === 1 ? "" : "s"}. These charges are open and past the due date.`
      : "No accounts are overdue.";
  }

  function setLedgerFilter(nextOverdueOnly) {
    overdueOnly = Boolean(nextOverdueOnly);
    showAllButton?.setAttribute("aria-pressed", overdueOnly ? "false" : "true");
    showOverdueButton?.setAttribute("aria-pressed", overdueOnly ? "true" : "false");
    const shown = visibleInvoices();
    if (selectedId && !shown.some((invoice) => invoice.id === selectedId)) {
      selectedId = "";
    }
    renderInvoices();
  }

  function renderInvoices() {
    const today = Auth.localToday();
    const lines = AccountLedger.lines(visibleInvoices(), { byMember: true });
    const totals = AccountLedger.totals(lines);
    updateLedgerHelp(lines);
    if (!lines.length) {
      body.innerHTML = `<tr><td colspan="10">${
        overdueOnly ? "No overdue accounts." : "No invoices yet."
      }</td></tr>`;
      if (foot) foot.innerHTML = "";
      renderDetail();
      return;
    }
    body.innerHTML = lines
      .map((line) => {
        const invoice = line.invoice;
        const overdue = Auth.invoiceIsOverdue(invoice, today);
        const paid = invoice.status === "paid";
        const selected = invoice.id === selectedId ? " ledger-row-selected" : "";
        const member = `${invoice.member_name || "—"}${invoice.member_id ? ` · ${invoice.member_id}` : ""}`;
        return `<tr class="${selected.trim()}" data-invoice-id="${AdminCommon.escapeHtml(invoice.id)}">
          <td><button type="button" class="ledger-invoice" data-invoice-id="${AdminCommon.escapeHtml(invoice.id)}">${AdminCommon.escapeHtml(invoice.invoice_number)}</button></td>
          <td>${AdminCommon.escapeHtml(member)}</td>
          <td>${AdminCommon.escapeHtml(AccountLedger.dateLabel(invoice.created_at))}</td>
          <td class="ledger-text">${AdminCommon.escapeHtml(AccountLedger.description(invoice))}</td>
          <td class="ledger-money">${money(line.amount)}</td>
          <td class="${overdue ? "ledger-overdue" : ""}">${AdminCommon.escapeHtml(AccountLedger.dateLabel(invoice.due_date))}${overdue ? " · Overdue" : ""}</td>
          <td class="ledger-money">${paid ? money(line.paid) : "—"}</td>
          <td>${paid ? AdminCommon.escapeHtml(AccountLedger.dateLabel(invoice.paid_at)) : "—"}</td>
          <td>${AdminCommon.escapeHtml(AccountLedger.howPaid(invoice))}</td>
          <td class="ledger-money">${money(line.total)}</td>
        </tr>`;
      })
      .join("");
    if (foot) {
      foot.innerHTML = `<tr>
        <td></td>
        <td></td>
        <td></td>
        <td>Total</td>
        <td class="ledger-money">${money(totals.amount)}</td>
        <td></td>
        <td class="ledger-money">${money(totals.paid)}</td>
        <td></td>
        <td></td>
        <td class="ledger-money">${money(totals.owed)}</td>
      </tr>`;
    }
    renderDetail();
  }

  function openInvoice(id) {
    selectedId = id || "";
    renderInvoices();
    if (selectedId && detailCard && !detailCard.hidden) {
      detailCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  body?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-invoice-id]");
    if (!button || !body.contains(button)) return;
    openInvoice(button.getAttribute("data-invoice-id"));
  });

  detailClose?.addEventListener("click", () => {
    selectedId = "";
    renderInvoices();
  });

  showAllButton?.addEventListener("click", () => setLedgerFilter(false));
  showOverdueButton?.addEventListener("click", () => setLedgerFilter(true));

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
      if (invoice?.id) selectedId = invoice.id;
      renderInvoices();
      if (invoice?.id && detailCard && !detailCard.hidden) {
        detailCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
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
    body.innerHTML = `<tr><td colspan="10">${AdminCommon.escapeHtml(err.message)}</td></tr>`;
  }
})();
