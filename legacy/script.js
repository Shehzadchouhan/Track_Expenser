let currentBalance = localStorage.getItem("balance") ? parseInt(localStorage.getItem("balance")) : 0;
let expenseList = JSON.parse(localStorage.getItem("expenseList")) || [];
let hasShownRain = false;  // Removed dollar rain feature

// Function to add balance
function addBalance() {
    const input = document.getElementById("balanceInput").value;
    if (input === "" || isNaN(input) || input <= 0) {
        alert("Please enter a valid amount");
        return;
    }
    currentBalance += parseInt(input);
    updateBalance();
    document.getElementById("balanceInput").value = "";

    // Save to localStorage
    localStorage.setItem("balance", currentBalance);
}

// Function to add an expense
function addExpense() {
    const amount = document.getElementById("expenseInput").value;
    const desc = document.getElementById("descInput").value;

    if (amount === "" || isNaN(amount) || amount <= 0 || desc.trim() === "") {
        alert("Please enter a valid expense and description.");
        return;
    }

    const expenseAmount = parseInt(amount);
    if (expenseAmount > currentBalance) {
        alert("Insufficient balance!");
        return;
    }

    currentBalance -= expenseAmount;
    updateBalance();

    // Create an expense transaction
    const expense = {
        description: desc,
        amount: expenseAmount,
        type: 'expense',  // Type to differentiate income/expense
        date: new Date().toLocaleString() // Store the current date and time
    };

    // Add the expense transaction to the expenseList
    expenseList.push(expense);

    // Sort transactions by date in descending order
    expenseList.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Clear previous transaction list
    renderTransactionHistory();

    // Save updated expenseList in localStorage
    localStorage.setItem("expenseList", JSON.stringify(expenseList));

    // Save updated balance in localStorage
    localStorage.setItem("balance", currentBalance);

    // Clear inputs
    document.getElementById("expenseInput").value = "";
    document.getElementById("descInput").value = "";
}

// Function to add income
function addIncome() {
    const input = document.getElementById("incomeInput").value;
    if (input === "" || isNaN(input) || input <= 0) {
        alert("Please enter a valid income amount");
        return;
    }
    currentBalance += parseInt(input);
    updateBalance();
    document.getElementById("incomeInput").value = "";

    // Create an income transaction
    const incomeTransaction = {
        description: `Income - ₹${input}`,
        amount: parseInt(input),
        type: 'income',  // Type to differentiate income/expense
        date: new Date().toLocaleString() // Store the current date and time
    };

    // Add the income transaction to the expenseList
    expenseList.push(incomeTransaction);

    // Sort transactions by date in descending order
    expenseList.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Clear previous transaction list
    renderTransactionHistory();

    // Save updated expenseList in localStorage
    localStorage.setItem("expenseList", JSON.stringify(expenseList));

    // Save updated balance in localStorage
    localStorage.setItem("balance", currentBalance);
}

// Function to update remaining balance
function updateBalance() {
    document.getElementById("balance").textContent = currentBalance;

    const warning = document.getElementById("warning");

    if (currentBalance < 100) {
        warning.textContent = "💡 Stay strong! Spend wisely and save more!";
        warning.style.color = "red";
    } else {
        warning.textContent = "";
    }
}

// Function to render the transaction history with optional feature
function renderTransactionHistory() {
    // Clear previous transaction list
    document.getElementById("expenseList").innerHTML = "";

    // Render the sorted transactions list
    expenseList.forEach((transaction) => {
        const li = document.createElement("li");
        li.textContent = `${transaction.description} - ₹${transaction.amount} (Added on: ${transaction.date})`;

        if (transaction.type === 'income') {
            li.style.color = 'green'; // Green for income
            li.style.fontWeight = "bold"; // Make income transactions bold
        } else {
            li.style.color = 'red'; // Red for expenses
        }

        document.getElementById("expenseList").appendChild(li);
    });
}

// Function to clear all data
function clearAll() {
    currentBalance = 0;
    expenseList = [];
    document.getElementById("balance").textContent = "0";
    document.getElementById("expenseList").innerHTML = "";
    document.getElementById("warning").textContent = "";

    // Clear localStorage
    localStorage.removeItem("balance");
    localStorage.removeItem("expenseList");
}

// Filter functions to show only income, expense, or all transactions
function showIncome() {
    const filteredIncome = expenseList.filter(transaction => transaction.type === 'income');
    renderFilteredTransactions(filteredIncome);
}

function showExpense() {
    const filteredExpense = expenseList.filter(transaction => transaction.type === 'expense');
    renderFilteredTransactions(filteredExpense);
}

function showAllTransactions() {
    renderTransactionHistory();
}

// Function to render filtered transactions
function renderFilteredTransactions(filteredList) {
    document.getElementById("expenseList").innerHTML = ""; // Clear existing list
    filteredList.forEach((transaction) => {
        const li = document.createElement("li");
        li.textContent = `${transaction.description} - ₹${transaction.amount} (Added on: ${transaction.date})`;

        if (transaction.type === 'income') {
            li.style.color = 'green'; // Green for income
            li.style.fontWeight = "bold"; // Bold for income
        } else {
            li.style.color = 'red'; // Red for expenses
        }

        document.getElementById("expenseList").appendChild(li);
    });
}

// Function to render all transactions
function renderTransactionHistory() {
    document.getElementById("expenseList").innerHTML = ""; // Clear existing list
    expenseList.forEach((transaction) => {
        const li = document.createElement("li");
        li.textContent = `${transaction.description} - ₹${transaction.amount} (Added on: ${transaction.date})`;

        if (transaction.type === 'income') {
            li.style.color = 'green'; // Green for income
            li.style.fontWeight = "bold"; // Bold for income
        } else {
            li.style.color = 'red'; // Red for expenses
        }

        document.getElementById("expenseList").appendChild(li);
    });
}

// Load data from localStorage on page load
function loadData() {
    if (currentBalance > 0) {
        updateBalance();
    }

    // Render the transaction history from localStorage
    renderTransactionHistory();
}

// Call loadData on page load
window.onload = loadData;
