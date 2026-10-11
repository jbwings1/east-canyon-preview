/**
 * Member account: open and paid charges, with a test payment.
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
  const openBody = document.getElementById("account-open-body");
  const paidBody = document.getElementById("account-paid-body");
  const confirmCard = document.getElementById("account-confirm");
  const confirmCopy = document.getElementById("account-confirm-copy");
  const confirmYes = document.getElementById("account-confirm-yes");
  const confirmNo = document.getElementById("account-confirm-no");
  const returning = new URLSearchParams(window.location.search).get("return") === "book";
  let invoices = [];
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

  function dateLabel(value) {
    const text = String(value || "").slice(0, 10);
    return text || "—";
  }

  function overdueLeft() {
    const today = Auth.localToday();
    return invoices.filter((invoice) => Auth.invoiceIsOverdue(invoice, today));
  }

  function hideConfirm() {
    pendingId = "";
    if (confirmCard) confirmCard.hidden = true;
  }

  async function finishReturnIfClear() {
    if (!returning || overdueLeft().length) return;
    showMessage("Paid. Returning to your booking.", "success");
    window.setTimeout(() => {
      window.location.href = "reservation-book.html";
    }, 700);
  }

  function render() {
    const today = Auth.localToday();
    const open = invoices.filter((invoice) => invoice.status !== "paid");
    const paid = invoices.filter((invoice) => invoice.status === "paid");
    const openTotal = open.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const overdueTotal = overdueLeft().reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    if (balance) {
      balance.textContent = overdueTotal
        ? `Open balance ${Auth.formatMoney(openTotal)}. Overdue ${Auth.formatMoney(overdueTotal)}.`
        : `Open balance ${Auth.formatMoney(openTotal)}.`;
    }
    if (!open.length) {
      openBody.innerHTML = `<tr><td colspan="6">Nothing is owed right now.</td></tr>`;
    } else {
      openBody.innerHTML = open
        .map((invoice) => {
          const overdue = Auth.invoiceIsOverdue(invoice, today);
          return `<tr>
            <td><code>${escapeHtml(invoice.invoice_number)}</code></td>
            <td>${escapeHtml(dateLabel(invoice.created_at))}</td>
            <td>${escapeHtml(Auth.chargeTypeLabel(invoice.charge_type))}<br>${escapeHtml(invoice.description)}</td>
            <td>${escapeHtml(Auth.formatMoney(invoice.amount))}</td>
            <td>${escapeHtml(dateLabel(invoice.due_date))}${overdue ? " · Overdue" : ""}</td>
            <td><button type="button" class="btn btn-primary btn-small" data-pay="${escapeHtml(invoice.id)}">Pay</button></td>
          </tr>`;
        })
        .join("");
    }
    if (!paid.length) {
      paidBody.innerHTML = `<tr><td colspan="5">No payments yet.</td></tr>`;
    } else {
      paidBody.innerHTML = paid
        .map((invoice) => {
          const test = invoice.payment_kind === "test" ? " · test" : "";
          return `<tr>
            <td><code>${escapeHtml(invoice.invoice_number)}</code></td>
            <td>${escapeHtml(dateLabel(invoice.created_at))}</td>
            <td>${escapeHtml(Auth.chargeTypeLabel(invoice.charge_type))}<br>${escapeHtml(invoice.description)}</td>
            <td>${escapeHtml(Auth.formatMoney(invoice.paid_amount || invoice.amount))}</td>
            <td>${escapeHtml(dateLabel(invoice.paid_at))}${escapeHtml(test)}</td>
          </tr>`;
        })
        .join("");
    }
  }

  openBody?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pay]");
    if (!button) return;
    const invoice = invoices.find((item) => item.id === button.getAttribute("data-pay"));
    if (!invoice || !confirmCard || !confirmCopy) return;
    pendingId = invoice.id;
    confirmCopy.textContent = `Pay ${Auth.formatMoney(invoice.amount)} for ${invoice.invoice_number}, ${Auth.chargeTypeLabel(invoice.charge_type)}? This is a test payment.`;
    confirmCard.hidden = false;
    confirmCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    confirmYes?.focus();
  });

  confirmNo?.addEventListener("click", () => {
    hideConfirm();
  });

  confirmYes?.addEventListener("click", async () => {
    if (!pendingId) return;
    confirmYes.disabled = true;
    try {
      await Auth.payOwnInvoice(pendingId);
      hideConfirm();
      invoices = await Auth.listInvoices();
      render();
      if (returning && !overdueLeft().length) {
        await finishReturnIfClear();
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
    openBody.innerHTML = `<tr><td colspan="6">${escapeHtml(err.message)}</td></tr>`;
    paidBody.innerHTML = `<tr><td colspan="5">${escapeHtml(err.message)}</td></tr>`;
  }
})();
