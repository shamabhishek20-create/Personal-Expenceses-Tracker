(() => {
  "use strict";

  const STORAGE_KEY = "spendwise.expenses.v1";
  const CATEGORIES = {
    Food: { color: "#4e9b74", icon: "🍽️" },
    Transport: { color: "#77b6a0", icon: "🚌" },
    Shopping: { color: "#e4b86a", icon: "🛍️" },
    Bills: { color: "#7c8bd1", icon: "🧾" },
    Health: { color: "#d98787", icon: "✚" },
    Education: { color: "#a28ad4", icon: "📚" },
    Entertainment: { color: "#e19c6e", icon: "🎬" },
    Other: { color: "#9aa7a0", icon: "✦" }
  };

  const $ = (selector) => document.querySelector(selector);
  const today = getLocalDateString(new Date());
  let expenses = loadExpenses();
  let chart = null;
  let toastTimer = null;

  const elements = {
    monthFilter: $("#monthFilter"),
    totalSpent: $("#totalSpent"),
    transactionCount: $("#transactionCount"),
    largestExpense: $("#largestExpense"),
    largestExpenseCaption: $("#largestExpenseCaption"),
    totalSpentCaption: $("#totalSpentCaption"),
    categoryChart: $("#categoryChart"),
    chartEmpty: $("#chartEmpty"),
    categoryLegend: $("#categoryLegend"),
    quickForm: $("#quickExpenseForm"),
    quickTitle: $("#quickTitle"),
    quickAmount: $("#quickAmount"),
    quickCategory: $("#quickCategory"),
    quickDate: $("#quickDate"),
    tableBody: $("#transactionTableBody"),
    emptyState: $("#emptyState"),
    tableCount: $("#tableCount"),
    searchInput: $("#searchInput"),
    categoryFilter: $("#categoryFilter"),
    modal: $("#expenseModal"),
    expenseForm: $("#expenseForm"),
    modalTitle: $("#modalTitle"),
    expenseId: $("#expenseId"),
    expenseTitle: $("#expenseTitle"),
    expenseAmount: $("#expenseAmount"),
    expenseCategory: $("#expenseCategory"),
    expenseDate: $("#expenseDate"),
    expenseNote: $("#expenseNote"),
    saveExpenseButton: $("#saveExpenseButton"),
    toast: $("#toast")
  };

  initialize();

  function initialize() {
    elements.monthFilter.value = today.slice(0, 7);
    elements.quickDate.value = today;
    elements.expenseDate.value = today;

    elements.quickForm.addEventListener("submit", handleQuickAdd);
    elements.expenseForm.addEventListener("submit", handleModalSubmit);
    $("#openExpenseModal").addEventListener("click", () => openModal());
    $("#emptyAddButton").addEventListener("click", () => openModal());
    $("#closeExpenseModal").addEventListener("click", closeModal);
    $("#cancelExpense").addEventListener("click", closeModal);
    elements.modal.addEventListener("click", (event) => {
      if (event.target === elements.modal) closeModal();
    });
    elements.monthFilter.addEventListener("change", render);
    elements.searchInput.addEventListener("input", renderTransactions);
    elements.categoryFilter.addEventListener("change", renderTransactions);
    $("#clearFilters").addEventListener("click", clearFilters);
    $("#exportCsv").addEventListener("click", exportCsv);
    elements.tableBody.addEventListener("click", handleTableAction);

    render();
  }

  function loadExpenses() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidExpense);
    } catch (error) {
      console.error("Could not load saved expenses:", error);
      return [];
    }
  }

  function isValidExpense(item) {
    return item &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      Number.isFinite(Number(item.amount)) &&
      Number(item.amount) > 0 &&
      typeof item.date === "string" &&
      typeof item.category === "string";
  }

  function saveExpenses() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
      return true;
    } catch (error) {
      console.error("Could not save expenses:", error);
      showToast("Unable to save. Check browser storage settings.");
      return false;
    }
  }

  function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function getSelectedMonthExpenses() {
    const month = elements.monthFilter.value;
    return expenses.filter((expense) => expense.date.startsWith(month));
  }

  function render() {
    renderSummary();
    renderChart();
    renderTransactions();
  }

  function renderSummary() {
    const monthExpenses = getSelectedMonthExpenses();
    const total = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const largest = monthExpenses.reduce((best, expense) =>
      !best || Number(expense.amount) > Number(best.amount) ? expense : best, null);

    elements.totalSpent.textContent = formatCurrency(total);
    elements.transactionCount.textContent = String(monthExpenses.length);
    elements.largestExpense.textContent = formatCurrency(largest ? largest.amount : 0);
    elements.largestExpenseCaption.textContent = largest ? largest.title : "No expenses yet";
    elements.totalSpentCaption.textContent = elements.monthFilter.value
      ? `For ${formatMonth(elements.monthFilter.value)}`
      : "Across all recorded expenses";
  }

  function formatMonth(monthString) {
    const [year, month] = monthString.split("-").map(Number);
    return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" })
      .format(new Date(year, month - 1, 1));
  }

  function renderChart() {
    const monthExpenses = getSelectedMonthExpenses();
    const totals = {};
    monthExpenses.forEach((expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + Number(expense.amount);
    });
    const labels = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    const values = labels.map((label) => totals[label]);
    const colors = labels.map((label) => (CATEGORIES[label] || CATEGORIES.Other).color);

    elements.chartEmpty.style.display = labels.length ? "none" : "flex";
    elements.categoryLegend.innerHTML = labels.map((label, index) => `
      <span class="legend-item">
        <span class="legend-dot" style="background:${colors[index]}"></span>
        ${escapeHtml(label)} · ${formatCurrency(values[index])}
      </span>
    `).join("");

    if (typeof Chart === "undefined") {
      elements.categoryLegend.insertAdjacentHTML("beforeend",
        '<span class="legend-item">Chart library unavailable; category totals are still shown.</span>');
      return;
    }

    if (chart) chart.destroy();
    chart = new Chart(elements.categoryChart, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: "#ffffff",
          borderWidth: 4,
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${formatCurrency(context.raw)}`
            }
          }
        }
      }
    });
  }

  function getFilteredExpenses() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const category = elements.categoryFilter.value;
    const month = elements.monthFilter.value;

    return expenses
      .filter((expense) => !month || expense.date.startsWith(month))
      .filter((expense) => category === "All" || expense.category === category)
      .filter((expense) =>
        !query ||
        expense.title.toLowerCase().includes(query) ||
        (expense.note || "").toLowerCase().includes(query) ||
        expense.category.toLowerCase().includes(query)
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  function renderTransactions() {
    const filtered = getFilteredExpenses();
    elements.tableBody.innerHTML = filtered.map((expense) => {
      const categoryInfo = CATEGORIES[expense.category] || CATEGORIES.Other;
      const note = expense.note ? `<div class="expense-note">${escapeHtml(expense.note)}</div>` : "";
      return `
        <tr>
          <td>
            <div class="expense-cell">
              <span class="expense-avatar" aria-hidden="true">${categoryInfo.icon}</span>
              <div>
                <div class="expense-name">${escapeHtml(expense.title)}</div>
                ${note}
              </div>
            </div>
          </td>
          <td><span class="category-pill">${escapeHtml(expense.category)}</span></td>
          <td>${formatDate(expense.date)}</td>
          <td class="align-right amount-cell">${formatCurrency(expense.amount)}</td>
          <td class="align-right">
            <span class="row-actions">
              <button class="small-action" type="button" data-action="edit" data-id="${escapeHtml(expense.id)}" aria-label="Edit ${escapeHtml(expense.title)}">Edit</button>
              <button class="small-action delete" type="button" data-action="delete" data-id="${escapeHtml(expense.id)}" aria-label="Delete ${escapeHtml(expense.title)}">Delete</button>
            </span>
          </td>
        </tr>
      `;
    }).join("");

    const hasRows = filtered.length > 0;
    elements.emptyState.classList.toggle("visible", !hasRows);
    elements.tableBody.closest("table").style.display = hasRows ? "table" : "none";
    elements.tableCount.textContent = `Showing ${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`;
  }

  function handleQuickAdd(event) {
    event.preventDefault();
    const formData = {
      title: elements.quickTitle.value.trim(),
      amount: elements.quickAmount.value,
      category: elements.quickCategory.value,
      date: elements.quickDate.value,
      note: ""
    };

    if (!validateExpense(formData)) return;
    expenses.push(createExpense(formData));
    if (!saveExpenses()) {
      expenses.pop();
      return;
    }

    elements.quickForm.reset();
    elements.quickDate.value = today;
    render();
    showToast("Expense added successfully.");
  }

  function handleModalSubmit(event) {
    event.preventDefault();
    const formData = {
      title: elements.expenseTitle.value.trim(),
      amount: elements.expenseAmount.value,
      category: elements.expenseCategory.value,
      date: elements.expenseDate.value,
      note: elements.expenseNote.value.trim()
    };

    if (!validateExpense(formData)) return;
    const existingId = elements.expenseId.value;

    if (existingId) {
      const index = expenses.findIndex((expense) => expense.id === existingId);
      if (index === -1) {
        showToast("That expense could not be found.");
        closeModal();
        return;
      }
      const previous = expenses[index];
      expenses[index] = { ...previous, ...formData, amount: Number(formData.amount) };
      if (!saveExpenses()) expenses[index] = previous;
      else showToast("Expense updated successfully.");
    } else {
      const newExpense = createExpense(formData);
      expenses.push(newExpense);
      if (!saveExpenses()) expenses.pop();
      else showToast("Expense added successfully.");
    }

    closeModal();
    render();
  }

  function validateExpense(formData) {
    const amount = Number(formData.amount);
    if (!formData.title) {
      showToast("Please enter an expense name.");
      return false;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      showToast("Enter a valid amount greater than ₹0.");
      return false;
    }
    if (!formData.date || !/^\d{4}-\d{2}-\d{2}$/.test(formData.date)) {
      showToast("Please choose a valid date.");
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(CATEGORIES, formData.category)) {
      showToast("Please choose a valid category.");
      return false;
    }
    return true;
  }

  function createExpense(formData) {
    return {
      id: createId(),
      title: formData.title,
      amount: Number(formData.amount),
      category: formData.category,
      date: formData.date,
      note: formData.note || "",
      createdAt: Date.now()
    };
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function openModal(expense = null) {
    elements.expenseForm.reset();
    elements.expenseId.value = expense ? expense.id : "";
    elements.modalTitle.textContent = expense ? "Edit expense" : "Add an expense";
    elements.saveExpenseButton.textContent = expense ? "Update expense" : "Save expense";
    elements.expenseTitle.value = expense ? expense.title : "";
    elements.expenseAmount.value = expense ? expense.amount : "";
    elements.expenseCategory.value = expense ? expense.category : "Food";
    elements.expenseDate.value = expense ? expense.date : today;
    elements.expenseNote.value = expense ? (expense.note || "") : "";
    elements.modal.showModal();
    window.setTimeout(() => elements.expenseTitle.focus(), 0);
  }

  function closeModal() {
    if (elements.modal.open) elements.modal.close();
  }

  function handleTableAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const expense = expenses.find((item) => item.id === button.dataset.id);
    if (!expense) return;

    if (button.dataset.action === "edit") {
      openModal(expense);
    } else if (button.dataset.action === "delete") {
      const confirmed = window.confirm(`Delete "${expense.title}"? This cannot be undone.`);
      if (!confirmed) return;
      const previous = expenses;
      expenses = expenses.filter((item) => item.id !== expense.id);
      if (!saveExpenses()) expenses = previous;
      else {
        render();
        showToast("Expense deleted.");
      }
    }
  }

  function clearFilters() {
    elements.searchInput.value = "";
    elements.categoryFilter.value = "All";
    renderTransactions();
  }

  function exportCsv() {
    const rows = getFilteredExpenses();
    if (!rows.length) {
      showToast("There are no transactions to export.");
      return;
    }

    const headers = ["Title", "Amount (INR)", "Category", "Date", "Note"];
    const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      headers.map(csvCell).join(","),
      ...rows.map((expense) => [
        expense.title, Number(expense.amount).toFixed(2), expense.category, expense.date, expense.note || ""
      ].map(csvCell).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `spendwise-expenses-${elements.monthFilter.value || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("CSV export downloaded.");
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2800);
  }
})();
