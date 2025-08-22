// Firebase configuration
const firebaseConfig = {
    // Add your Firebase config here
    // You'll need to create a Firebase project and get these values
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

class ExpenseTracker {
    constructor() {
        this.expenses = [];
        this.selectedPerson = null;
        this.db = null;
        this.initializeFirebase();
        this.initializeEventListeners();
    }

    async initializeFirebase() {
        try {
            // For demo purposes, we'll use localStorage
            // In production, uncomment the Firebase code below
            /*
            const app = window.firebase.initializeApp(firebaseConfig);
            this.db = window.firebase.getFirestore(app);
            await this.loadExpensesFromFirebase();
            */
            
            // Load from localStorage for now
            this.expenses = this.loadExpenses();
            this.updateDisplay();
        } catch (error) {
            console.error('Firebase initialization error:', error);
            // Fallback to localStorage
            this.expenses = this.loadExpenses();
            this.updateDisplay();
        }
    }

    initializeEventListeners() {
        const form = document.getElementById('expenseForm');
        form.addEventListener('submit', (e) => this.handleFormSubmit(e));

        // Person selector buttons
        document.querySelectorAll('.person-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectPerson(btn.dataset.person);
            });
        });

        // Modal close on background click
        document.getElementById('addExpenseModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    selectPerson(person) {
        this.selectedPerson = person;
        document.querySelectorAll('.person-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.person === person);
        });
    }

    showAddExpense() {
        document.getElementById('addExpenseModal').classList.add('active');
        document.getElementById('description').focus();
    }

    showSettleUp() {
        const totals = this.calculateTotals();
        if (totals.youOwe > 0) {
            alert(`You owe your housemate $${totals.youOwe.toFixed(2)}`);
        } else if (totals.housemateOwes > 0) {
            alert(`Your housemate owes you $${totals.housemateOwes.toFixed(2)}`);
        } else {
            alert('You are all settled up!');
        }
    }

    closeModal() {
        document.getElementById('addExpenseModal').classList.remove('active');
        this.clearForm();
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const description = document.getElementById('description').value.trim();
        const amount = parseFloat(document.getElementById('amount').value);

        if (!description || !amount || !this.selectedPerson) {
            alert('Please fill in all fields and select who paid');
            return;
        }

        const expense = {
            id: Date.now(),
            description,
            amount,
            paidBy: this.selectedPerson,
            date: new Date().toISOString()
        };

        this.addExpense(expense);
        this.closeModal();
    }

    async addExpense(expense) {
        try {
            // For demo purposes, we'll use localStorage
            // In production, uncomment the Firebase code below
            /*
            await this.db.collection('expenses').add(expense);
            */
            
            this.expenses.unshift(expense);
            this.saveExpenses();
            this.updateDisplay();
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('Failed to add expense. Please try again.');
        }
    }

    async deleteExpense(id) {
        try {
            // For demo purposes, we'll use localStorage
            // In production, uncomment the Firebase code below
            /*
            await this.db.collection('expenses').doc(id).delete();
            */
            
            this.expenses = this.expenses.filter(expense => expense.id !== id);
            this.saveExpenses();
            this.updateDisplay();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Failed to delete expense. Please try again.');
        }
    }

    clearForm() {
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        this.selectedPerson = null;
        document.querySelectorAll('.person-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
    }

    calculateTotals() {
        let youTotal = 0;
        let housemateTotal = 0;
        let grandTotal = 0;

        this.expenses.forEach(expense => {
            grandTotal += expense.amount;
            if (expense.paidBy === 'you') {
                youTotal += expense.amount;
            } else {
                housemateTotal += expense.amount;
            }
        });

        const halfTotal = grandTotal / 2;
        const youOwe = Math.max(0, halfTotal - youTotal);
        const housemateOwes = Math.max(0, halfTotal - housemateTotal);

        return {
            grandTotal,
            youOwe,
            housemateOwes,
            youTotal,
            housemateTotal
        };
    }

    updateDisplay() {
        this.updateBalanceSummary();
        this.renderExpenses();
    }

    updateBalanceSummary() {
        const totals = this.calculateTotals();
        const balanceSummary = document.getElementById('balanceSummary');
        const balanceText = balanceSummary.querySelector('.balance-text');
        
        if (totals.grandTotal === 0) {
            balanceText.textContent = 'You are all settled up!';
            balanceSummary.style.background = 'rgba(255, 255, 255, 0.15)';
        } else if (totals.youOwe > 0) {
            balanceText.textContent = `You owe your housemate $${totals.youOwe.toFixed(2)}`;
            balanceSummary.style.background = 'rgba(220, 53, 69, 0.2)';
        } else if (totals.housemateOwes > 0) {
            balanceText.textContent = `Your housemate owes you $${totals.housemateOwes.toFixed(2)}`;
            balanceSummary.style.background = 'rgba(40, 199, 111, 0.2)';
        } else {
            balanceText.textContent = 'You are all settled up!';
            balanceSummary.style.background = 'rgba(255, 255, 255, 0.15)';
        }
    }

    renderExpenses() {
        const container = document.getElementById('expensesList');
        
        if (this.expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💸</div>
                    <h3>No expenses yet</h3>
                    <p>Track shared expenses between you and your housemate. Split costs easily and see who owes what.</p>
                </div>
            `;
            return;
        }

        const totals = this.calculateTotals();
        
        container.innerHTML = this.expenses.map(expense => {
            const halfAmount = expense.amount / 2;
            const isYourExpense = expense.paidBy === 'you';
            
            return `
                <div class="expense-item">
                    <div class="expense-icon">${this.getExpenseIcon(expense.description)}</div>
                    <div class="expense-details">
                        <div class="expense-description">${this.escapeHtml(expense.description)}</div>
                        <div class="expense-meta">
                            Paid by ${isYourExpense ? 'you' : 'your housemate'} • 
                            ${this.formatDate(expense.date)}
                        </div>
                    </div>
                    <div class="expense-amount">
                        <div class="expense-total">$${expense.amount.toFixed(2)}</div>
                        <div class="expense-split ${isYourExpense ? 'you-get' : 'you-owe'}">
                            ${isYourExpense ? 'you get' : 'you owe'} $${halfAmount.toFixed(2)}
                        </div>
                    </div>
                    <button class="delete-btn" onclick="tracker.deleteExpense(${expense.id})">
                        Delete
                    </button>
                </div>
            `;
        }).join('');
    }

    getExpenseIcon(description) {
        const desc = description.toLowerCase();
        if (desc.includes('food') || desc.includes('restaurant') || desc.includes('dinner') || desc.includes('lunch')) return '🍽️';
        if (desc.includes('grocery') || desc.includes('market')) return '🛒';
        if (desc.includes('gas') || desc.includes('fuel')) return '⛽';
        if (desc.includes('rent') || desc.includes('apartment')) return '🏠';
        if (desc.includes('utility') || desc.includes('electric') || desc.includes('water')) return '💡';
        if (desc.includes('internet') || desc.includes('wifi')) return '📶';
        if (desc.includes('movie') || desc.includes('entertainment')) return '🎬';
        if (desc.includes('uber') || desc.includes('taxi') || desc.includes('transport')) return '🚗';
        return '💳';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Firebase methods (commented out for demo)
    /*
    async loadExpensesFromFirebase() {
        try {
            const snapshot = await this.db.collection('expenses')
                .orderBy('date', 'desc')
                .get();
            
            this.expenses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error loading expenses from Firebase:', error);
        }
    }

    async syncToFirebase() {
        // Real-time sync implementation
        this.db.collection('expenses')
            .orderBy('date', 'desc')
            .onSnapshot((snapshot) => {
                this.expenses = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.updateDisplay();
            });
    }
    */

    // Local storage methods (for demo)
    saveExpenses() {
        localStorage.setItem('expenseTracker', JSON.stringify(this.expenses));
    }

    loadExpenses() {
        const saved = localStorage.getItem('expenseTracker');
        return saved ? JSON.parse(saved) : [];
    }
}

// Global functions for HTML onclick handlers
function showAddExpense() {
    window.tracker.showAddExpense();
}

function showSettleUp() {
    window.tracker.showSettleUp();
}

function closeModal() {
    window.tracker.closeModal();
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.tracker = new ExpenseTracker();
});