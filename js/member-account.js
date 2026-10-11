/**
 * Member account ledger, with a test payment on the open invoice.
 */
(async function () {
  const user = Auth.redirectForAuth({ requireMember: true, loginPage: "login.html?next=member-account.html" });
  if (!user) return;

  try {
    await Auth.ready();
  } catch {
    /* cached session */
  }

  const balance = document.getElementById("account-balance");
  const message = document.getElementById("account-message");
  const ledgerBody = document.getElementById("account-ledger-body");
  const ledgerFoot = document.getElementById("account-ledger-foot");
  const invoiceCard = document.getElementById("account-invoice");
  const invoiceTitle = document.getElementById("account-invoice-title");
  const invoiceDetails = document.getElementById("account-invoice-details");
  const invoicePay = document.getElementById("account-invoice-pay");
  const invoiceClose = document.getElementById("account-invoice-close");
  const confirmCard = document.getElementById("account-confirm");
  const confirmCopy = document.getElementById("account-confirm-copy");
  const confirmYes = document.getElementById("account-confirm-yes");
  const confirmNo = document.getElementById("account-confirm-no");
  const returning = new URLSearchParams(window.location.search).get("return") === "book";
  let invoices = [];
  let selectedId = "";
  let pendingId = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showMessage(text, type) {
    if (!message) return;
    message.textContent = text || "";
    message.className = type ? `form-message ${type}` : "form-message";
  }

  function overdueLeft() {
    const today = Auth.localToday();
    return invoices.filter((invoice) => Auth.invoiceIsOverdue(invoice, today));
  }

  function hideConfirm() {
    pendingId = "";
    if (confirmCard) confirmCard.hidden = true;
  }

  function money(value) {
    return escapeHtml(Auth.formatMoney(value));
  }

  function detailRow(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  function selectedInvoice() {
    return invoices.find((invoice) => invoice.id === selectedId) || null;
  }

  function renderInvoice() {
    const invoice = selectedInvoice();
    if (!invoiceCard || !invoiceDetails || !invoiceTitle) return;
    if (!invoice) {
      invoiceCard.hidden = true;
      invoiceDetails.innerHTML = "";
      if (invoicePay) invoicePay.hidden = true;
      return;
    }
    const today = Auth.localToday();
    const overdue = Auth.invoiceIsOverdue(invoice, today);
    const paid = invoice.status === "paid";
    const paidAmount = paid ? Number(invoice.paid_amount ?? invoice.amount ?? 0) : 0;
    const owed = Number(invoice.amount || 0) - paidAmount;
    invoiceTitle.textContent = `Invoice ${invoice.invoice_number}`;
    invoiceDetails.innerHTML = [
      detailRow("Inv number", invoice.invoice_number || "—"),
      detailRow("Date", AccountLedger.dateLabel(invoice.created_at)),
      detailRow("Added by", invoice.created_by_name || "—"),
      detailRow("Member", `${invoice.member_name || "—"}${invoice.member_id ? ` · ${invoice.member_id}` : ""}`),
      detailRow("Description", AccountLedger.description(invoice)),
      detailRow("Amount", Auth.formatMoney(invoice.amount)),
      detailRow("Due date", `${AccountLedger.dateLabel(invoice.due_date)}${overdue ? " · Overdue" : ""}`),
      detailRow("Paid", paid ? Auth.formatMoney(paidAmount) : "—"),
      detailRow("On", paid ? AccountLedger.dateLabel(invoice.paid_at) : "—"),
      detailRow("Paid with", AccountLedger.howPaid(invoice)),
      detailRow("Balance", Auth.formatMoney(owed)),
    ].join("");
    if (invoicePay) invoicePay.hidden = paid;
    invoiceCard.hidden = false;
  }

  function render() {
    const today = Auth.localToday();
    const lines = AccountLedger.lines(invoices);
    const totals = AccountLedger.totals(lines);
    const overdueTotal = overdueLeft().reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    if (balance) {
      balance.textContent = overdueTotal
        ? `Open balance ${Auth.formatMoney(totals.owed)}. Overdue ${Auth.formatMoney(overdueTotal)}.`
        : `Open balance ${Auth.formatMoney(totals.owed)}.`;
    }
    if (!lines.length) {
      ledgerBody.innerHTML = `<tr><td colspan="9">No invoices yet.</td></tr>`;
      if (ledgerFoot) ledgerFoot.innerHTML = "";
    } else {
      ledgerBody.innerHTML = lines
        .map((line) => {
          const invoice = line.invoice;
          const overdue = Auth.invoiceIsOverdue(invoice, today);
          const paid = invoice.status === "paid";
          const selected = invoice.id === selectedId ? " ledger-row-selected" : "";
          return `<tr class="${selected.trim()}" data-invoice-id="${escapeHtml(invoice.id)}">
            <td><button type="button" class="ledger-invoice" data-invoice-id="${escapeHtml(invoice.id)}">${escapeHtml(invoice.invoice_number)}</button></td>
            <td>${escapeHtml(AccountLedger.dateLabel(invoice.created_at))}</td>
            <td class="ledger-text">${escapeHtml(AccountLedger.description(invoice))}</td>
            <td class="ledger-money">${money(line.amount)}</td>
            <td class="${overdue ? "ledger-overdue" : ""}">${escapeHtml(AccountLedger.dateLabel(invoice.due_date))}${overdue ? " · Overdue" : ""}</td>
            <td class="ledger-money">${paid ? money(line.paid) : "—"}</td>
            <td>${paid ? escapeHtml(AccountLedger.dateLabel(invoice.paid_at)) : "—"}</td>
            <td>${escapeHtml(AccountLedger.howPaid(invoice))}</td>
            <td class="ledger-money">${money(line.total)}</td>
          </tr>`;
        })
        .join("");
      if (ledgerFoot) {
        ledgerFoot.innerHTML = `<tr>
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
    }
    renderInvoice();
  }

  function openInvoice(id) {
    selectedId = id || "";
    render();
    if (selectedId && invoiceCard && !invoiceCard.hidden) {
      invoiceCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  ledgerBody?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-invoice-id]");
    if (!button || !ledgerBody.contains(button)) return;
    openInvoice(button.getAttribute("data-invoice-id"));
  });

  invoiceClose?.addEventListener("click", () => {
    selectedId = "";
    render();
  });

  function askToPay(invoice) {
    if (!invoice || invoice.status === "paid" || !confirmCard || !confirmCopy) return;
    pendingId = invoice.id;
    confirmCopy.textContent = `Pay ${Auth.formatMoney(invoice.amount)} for ${invoice.invoice_number}, ${Auth.chargeTypeLabel(invoice.charge_type)}? This is a test payment.`;
    confirmCard.hidden = false;
    confirmCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    confirmYes?.focus();
  }

  invoicePay?.addEventListener("click", () => {
    askToPay(selectedInvoice());
  });

  confirmNo?.addEventListener("click", () => {
    hideConfirm();
  });

  confirmYes?.addEventListener("click", async () => {
    if (!pendingId) return;
    confirmYes.disabled = true;
    try {
      await Auth.payOwnInvoice(pendingId);
      const paidId = pendingId;
      hideConfirm();
      invoices = await Auth.listInvoices();
      selectedId = paidId;
      render();
      if (returning && !overdueLeft().length) {
        showMessage("Paid. Returning to your booking.", "success");
        window.setTimeout(() => {
          window.location.href = "reservation-book.html";
        }, 700);
      } else if (overdueLeft().length) {
        showMessage("That invoice is paid. Another charge is still overdue.", "success");
      } else {
        showMessage("Payment recorded. No card was charged.", "success");
      }
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      confirmYes.disabled = false;
    }
  });

  try {
    invoices = await Auth.listInvoices();
    render();
    if (returning && !overdueLeft().length) {
      showMessage("Your account is clear. Returning to your booking.", "success");
      window.setTimeout(() => {
        window.location.href = "reservation-book.html";
      }, 700);
    }
  } catch (err) {
    showMessage(err.message, "error");
    if (ledgerBody) {
      ledgerBody.innerHTML = `<tr><td colspan="9">${escapeHtml(err.message)}</td></tr>`;
    }
  }
})();
