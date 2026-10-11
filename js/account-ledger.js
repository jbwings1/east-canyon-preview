/**
 * Shared member-account ledger rows for the member page and the office page.
 * Total is the balance still owed for that account after the row.
 */
window.AccountLedger = {
  dateLabel(value) {
    const text = String(value || "").slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return "—";
    const month = Number(match[2]);
    const day = Number(match[3]);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    if (month < 1 || month > 12 || day < 1 || day > 31) return "—";
    return `${months[month - 1]} ${day}, ${match[1]}`;
  },

  howPaid(invoice) {
    if (!invoice || invoice.status !== "paid") return "—";
    if (invoice.payment_kind === "test") return "Test";
    const kind = String(invoice.payment_kind || "").trim();
    if (!kind) return "Paid";
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  },

  description(invoice) {
    const type =
      typeof Auth !== "undefined" && Auth.chargeTypeLabel
        ? Auth.chargeTypeLabel(invoice?.charge_type)
        : invoice?.charge_type || "Charge";
    const text = String(invoice?.description || "").trim();
    if (!text) return type;
    if (text.toLowerCase() === String(type).toLowerCase()) return type;
    return `${type} — ${text}`;
  },

  /**
   * Oldest first. Office sheets restart the running total for each member.
   */
  lines(invoices, { byMember = false } = {}) {
    const rows = [...(invoices || [])].sort((a, b) => {
      if (byMember) {
        const name = String(a.member_name || "").localeCompare(String(b.member_name || ""), undefined, {
          sensitivity: "base",
        });
        if (name) return name;
        const memberId = String(a.member_id || "").localeCompare(String(b.member_id || ""), undefined, {
          numeric: true,
        });
        if (memberId) return memberId;
      }
      const aDate = String(a.created_at || "");
      const bDate = String(b.created_at || "");
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;
      return String(a.invoice_number || "").localeCompare(String(b.invoice_number || ""), undefined, {
        numeric: true,
      });
    });

    let running = 0;
    let memberKey = "";
    return rows.map((invoice) => {
      const key = String(invoice.user_id || invoice.member_id || "");
      if (byMember && key !== memberKey) {
        running = 0;
        memberKey = key;
      }
      const amount = Number(invoice.amount || 0);
      const paid = invoice.status === "paid" ? Number(invoice.paid_amount ?? invoice.amount ?? 0) : 0;
      const owed = amount - paid;
      running += owed;
      return { invoice, amount, paid, owed, total: running };
    });
  },

  totals(lines) {
    return (lines || []).reduce(
      (sum, line) => {
        sum.amount += line.amount;
        sum.paid += line.paid;
        sum.owed += line.owed;
        return sum;
      },
      { amount: 0, paid: 0, owed: 0 }
    );
  },
};
