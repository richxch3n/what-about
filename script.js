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
        this.suggestions = [];
        this.toBuyItems = [];
        this.settlements = [];
        this.selectedPerson = null;
        this.selectedSplit = 'all'; // Default to split with everyone
        this.currentTab = 'expenses';
        this.assigningItem = null;
        this.uploadedScreenshot = null;
        this.currentAccount = 'richard'; // Default account
        this.db = null;
        this.initializeAccount();
        this.initializeFirebase();
        this.initializeEventListeners();
        // Update person selector buttons after DOM is ready
        setTimeout(() => this.updatePersonSelectorButtons(), 100);
    }

    initializeAccount() {
        // Load saved account or default to richard
        const savedAccount = localStorage.getItem('currentAccount');
        if (savedAccount && ['richard', 'tim', 'fijar'].includes(savedAccount)) {
            this.currentAccount = savedAccount;
        }
        
        // Set the select value
        const accountSelect = document.getElementById('accountSelect');
        if (accountSelect) {
            accountSelect.value = this.currentAccount;
        }
    }

    switchAccount(accountName) {
        // Save current account data before switching
        this.saveAllData();
        
        // Switch to new account
        this.currentAccount = accountName;
        localStorage.setItem('currentAccount', accountName);
        
        // Load new account data
        this.loadAllData();
        
        // Update display
        this.updateDisplay();
        this.updatePersonSelectorButtons();
        
        // Reset current state
        this.currentTab = 'expenses';
        this.selectedPerson = null;
        this.selectedSplit = 'all';
        this.assigningItem = null;
        this.uploadedScreenshot = null;
        
        // Update UI
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === 'expenses');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('hidden', !content.id.includes('expenses'));
        });
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.toggle('hidden', !section.id.includes('expenses'));
        });
    }

    getStorageKey(dataType) {
        // Expenses are shared across all accounts, others are account-specific
        if (dataType === 'expenseTracker') {
            return 'expenseTracker_shared';
        }
        return `${dataType}_${this.currentAccount}`;
    }

    getOtherAccounts() {
        const allAccounts = ['richard', 'tim', 'fijar'];
        return allAccounts.filter(account => account !== this.currentAccount);
    }

    getCurrentAccountDisplayName() {
        return this.currentAccount.charAt(0).toUpperCase() + this.currentAccount.slice(1);
    }

    getOtherAccountsDisplayName() {
        const others = this.getOtherAccounts();
        if (others.length === 1) {
            return others[0].charAt(0).toUpperCase() + others[0].slice(1);
        } else {
            return others.map(name => name.charAt(0).toUpperCase() + name.slice(1)).join(' & ');
        }
    }

    updatePersonSelectorButtons() {
        const currentAccountName = this.getCurrentAccountDisplayName();
        const otherAccountsName = this.getOtherAccountsDisplayName();
        
        // Update expense form buttons
        const youBtn = document.querySelector('#addExpenseModal .person-btn[data-person="you"] span');
        const housemateBtn = document.querySelector('#addExpenseModal .person-btn[data-person="housemate"] span');
        if (youBtn) youBtn.textContent = currentAccountName;
        if (housemateBtn) housemateBtn.textContent = otherAccountsName;
        
        // Update assignment modal buttons
        const assignYouBtn = document.querySelector('#assignModal .person-btn[data-person="you"] span');
        const assignHousemateBtn = document.querySelector('#assignModal .person-btn[data-person="housemate"] span');
        if (assignYouBtn) assignYouBtn.textContent = currentAccountName;
        if (assignHousemateBtn) assignHousemateBtn.textContent = otherAccountsName;
    }

    // Helper functions to interpret expense perspectives
    isExpensePaidByCurrentAccount(expense) {
        // If paidBy is 'you', check if it was originally from current account
        // If paidBy is 'housemate', it wasn't from current account
        // If paidBy is an actual account name, compare with current account
        if (expense.paidBy === 'you') {
            // For legacy expenses, we need to determine context
            // For new expenses, we'll store the actual account name
            return true;
        } else if (expense.paidBy === 'housemate') {
            return false;
        } else {
            // New format with actual account names
            return expense.paidBy === this.currentAccount;
        }
    }

    getExpensePaidByDisplayName(expense) {
        if (expense.paidBy === 'you') {
            // Legacy format - assume it was paid by someone, show current perspective
            return this.getCurrentAccountDisplayName();
        } else if (expense.paidBy === 'housemate') {
            // Legacy format - show other accounts
            return this.getOtherAccountsDisplayName().toLowerCase();
        } else if (['richard', 'tim', 'fijar'].includes(expense.paidBy)) {
            // New format with actual account names
            return expense.paidBy.charAt(0).toUpperCase() + expense.paidBy.slice(1);
        } else {
            // Fallback
            return expense.paidBy;
        }
    }

    getSplitWithText(expense) {
        const splitWith = expense.splitWith || 'all';
        if (splitWith === 'all') {
            return ' • Split with everyone';
        } else if (['richard', 'tim', 'fijar'].includes(splitWith)) {
            const displayName = splitWith.charAt(0).toUpperCase() + splitWith.slice(1);
            return ` • Split with ${displayName}`;
        } else {
            return ' • Split with everyone'; // fallback
        }
    }

    saveAllData() {
        this.saveExpenses();
        this.saveSuggestions();
        this.saveToBuyItems();
        this.saveSettlements();
    }

    loadAllData() {
        this.expenses = this.loadExpenses();
        this.suggestions = this.loadSuggestions();
        this.toBuyItems = this.loadToBuyItems();
        this.settlements = this.loadSettlements();
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
            this.loadAllData();
            this.updateDisplay();
        } catch (error) {
            console.error('Firebase initialization error:', error);
            // Fallback to localStorage
            this.loadAllData();
            this.updateDisplay();
        }
    }

    initializeEventListeners() {
        const expenseForm = document.getElementById('expenseForm');
        expenseForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

        const suggestionForm = document.getElementById('suggestionForm');
        suggestionForm.addEventListener('submit', (e) => this.handleSuggestionSubmit(e));

        // File upload handling
        const fileInput = document.getElementById('paymentScreenshot');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Person selector buttons
        document.querySelectorAll('.person-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectPerson(btn.dataset.person);
            });
        });

        // Assignment buttons
        document.querySelectorAll('.assign-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectAssignee(btn.dataset.person);
            });
        });

        // Split selector buttons
        document.querySelectorAll('.split-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectSplit(btn.dataset.split);
            });
        });

        // Modal close on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal')) {
                    this.closeModal();
                }
            });
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('hidden', !content.id.includes(tab));
        });

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.toggle('hidden', !section.id.includes(tab));
        });

        this.updateDisplay();
    }

    selectPerson(person) {
        this.selectedPerson = person;
        document.querySelectorAll('.person-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.person === person);
        });
    }

    selectAssignee(person) {
        document.querySelectorAll('.assign-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.person === person);
        });
        
        const saveBtn = document.querySelector('#assignModal .save-btn');
        saveBtn.disabled = false;
        saveBtn.dataset.assignee = person;
    }

    selectSplit(splitType) {
        this.selectedSplit = splitType;
        document.querySelectorAll('.split-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.split === splitType);
        });
    }

    showAddExpense() {
        document.getElementById('addExpenseModal').classList.add('active');
        document.getElementById('description').focus();
    }

    showSuggestItem() {
        document.getElementById('suggestItemModal').classList.add('active');
        document.getElementById('suggestionDescription').focus();
    }

    showAssignItems() {
        if (this.toBuyItems.filter(item => !item.assignedTo).length === 0) {
            alert('All items are already assigned!');
            return;
        }
        
        const unassigned = this.toBuyItems.filter(item => !item.assignedTo);
        const message = `Assign all ${unassigned.length} unassigned items to:`;
        const person = confirm(`${message}\n\nOK = You\nCancel = Housemate`);
        
        unassigned.forEach(item => {
            item.assignedTo = person ? 'you' : 'housemate';
        });
        
        this.saveToBuyItems();
        this.updateDisplay();
    }

    showAssignModal(itemId) {
        const item = this.toBuyItems.find(i => i.id === itemId);
        if (!item) return;

        this.assigningItem = item;
        
        const modal = document.getElementById('assignModal');
        const itemInfo = document.getElementById('assignItemInfo');
        
        itemInfo.innerHTML = `
            <h4>${this.escapeHtml(item.description)}</h4>
            <p>Estimated cost: $${item.amount ? item.amount.toFixed(2) : 'Unknown'}</p>
        `;
        
        // Reset assignment selection
        document.querySelectorAll('.assign-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        const saveBtn = modal.querySelector('.save-btn');
        saveBtn.disabled = true;
        saveBtn.dataset.assignee = '';
        
        modal.classList.add('active');
    }

    confirmAssignment() {
        const saveBtn = document.querySelector('#assignModal .save-btn');
        const assignee = saveBtn.dataset.assignee;
        
        if (!this.assigningItem || !assignee) return;
        
        this.assigningItem.assignedTo = assignee;
        this.saveToBuyItems();
        this.updateDisplay();
        this.closeModal();
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

    showSettleUpModal() {
        const totals = this.calculateTotals();
        const currentAccount = this.getCurrentAccountDisplayName();
        
        // Find the most significant debt
        let maxBalance = 0;
        let maxAccount = '';
        let isOwed = false;

        Object.entries(totals.accountBalances).forEach(([account, balance]) => {
            if (Math.abs(balance) > Math.abs(maxBalance)) {
                maxBalance = balance;
                maxAccount = account;
                isOwed = balance > 0;
            }
        });

        if (Math.abs(maxBalance) < 0.01) {
            alert('All settled up! No payment needed.');
            return;
        }
        
        const modal = document.getElementById('settleUpModal');
        const paymentInfo = document.getElementById('paymentInfo');
        const amountInput = document.getElementById('settlementAmount');
        const otherAccountName = maxAccount.charAt(0).toUpperCase() + maxAccount.slice(1);
        
        if (isOwed) {
            paymentInfo.innerHTML = `
                <h4>Request payment from ${otherAccountName.toLowerCase()}</h4>
                <p>${otherAccountName} owes ${currentAccount}</p>
                <div class="payment-amount">$${Math.abs(maxBalance).toFixed(2)}</div>
            `;
            amountInput.value = Math.abs(maxBalance).toFixed(2);
        } else {
            paymentInfo.innerHTML = `
                <h4>Send payment to ${otherAccountName.toLowerCase()}</h4>
                <p>${currentAccount} owes ${otherAccountName}</p>
                <div class="payment-amount">$${Math.abs(maxBalance).toFixed(2)}</div>
            `;
            amountInput.value = Math.abs(maxBalance).toFixed(2);
        }
        
        modal.classList.add('active');
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedScreenshot = {
                data: e.target.result,
                name: file.name,
                size: file.size,
                type: file.type
            };
            
            this.showImagePreview(e.target.result);
            this.processOCR(e.target.result);
            this.updateSubmitButton();
        };
        
        reader.readAsDataURL(file);
    }

    showImagePreview(imageSrc) {
        const uploadArea = document.getElementById('fileUploadArea');
        const placeholder = uploadArea.querySelector('.upload-placeholder');
        const preview = document.getElementById('uploadPreview');
        const previewImage = document.getElementById('previewImage');
        
        placeholder.classList.add('hidden');
        preview.classList.remove('hidden');
        previewImage.src = imageSrc;
        uploadArea.classList.add('has-file');
    }

    removeScreenshot() {
        this.uploadedScreenshot = null;
        
        const uploadArea = document.getElementById('fileUploadArea');
        const placeholder = uploadArea.querySelector('.upload-placeholder');
        const preview = document.getElementById('uploadPreview');
        const fileInput = document.getElementById('paymentScreenshot');
        
        placeholder.classList.remove('hidden');
        preview.classList.add('hidden');
        uploadArea.classList.remove('has-file');
        fileInput.value = '';
        
        this.updateSubmitButton();
        this.resetOCRState();
    }

    async processOCR(imageSrc) {
        const expectedAmount = parseFloat(document.getElementById('settlementAmount').value);
        if (!expectedAmount) return;

        // Show processing UI
        const processing = document.getElementById('ocrProcessing');
        const result = document.getElementById('ocrResult');
        
        processing.classList.remove('hidden');
        result.classList.add('hidden');

        try {
            // Initialize Tesseract worker
            const worker = await Tesseract.createWorker('eng');
            
            // Process the image
            const { data: { text } } = await worker.recognize(imageSrc);
            
            // Clean up worker
            await worker.terminate();
            
            // Extract amounts from text
            const detectedAmounts = this.extractAmountsFromText(text);
            
            // Verify against expected amount
            this.verifyAmount(expectedAmount, detectedAmounts, text);
            
        } catch (error) {
            console.error('OCR processing failed:', error);
            this.showOCRError('Failed to scan screenshot. Please ensure the image is clear and try again.');
        } finally {
            processing.classList.add('hidden');
        }
    }

    extractAmountsFromText(text) {
        // Multiple regex patterns to catch various amount formats
        const patterns = [
            // $123.45, $123, $1,234.56
            /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
            // 123.45, 123, 1,234.56 (standalone numbers)
            /(?:^|\s)(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s|$)/g,
            // Amount: 123.45, Total: 123.45
            /(?:amount|total|paid|sent)[\s:]*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi
        ];
        
        const amounts = new Set();
        
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const amount = parseFloat(match[1].replace(/,/g, ''));
                if (amount > 0 && amount < 100000) { // Reasonable range
                    amounts.add(amount);
                }
            }
        });
        
        return Array.from(amounts);
    }

    verifyAmount(expectedAmount, detectedAmounts, fullText) {
        const result = document.getElementById('ocrResult');
        const status = document.getElementById('verificationStatus');
        
        result.classList.remove('hidden');
        
        // Check for exact match
        const exactMatch = detectedAmounts.find(amount => 
            Math.abs(amount - expectedAmount) < 0.01
        );
        
        // Check for close match (within $1)
        const closeMatch = detectedAmounts.find(amount => 
            Math.abs(amount - expectedAmount) <= 1.00 && Math.abs(amount - expectedAmount) > 0.01
        );
        
        if (exactMatch) {
            status.className = 'verification-status verified';
            status.innerHTML = `
                Amount verified: $${expectedAmount.toFixed(2)} found in screenshot
                <div class="detected-amounts">Detected amounts: ${detectedAmounts.map(a => `$${a.toFixed(2)}`).join(', ')}</div>
            `;
        } else if (closeMatch) {
            status.className = 'verification-status warning';
            status.innerHTML = `
                Close match found: $${closeMatch.toFixed(2)} (expected $${expectedAmount.toFixed(2)})
                <div class="detected-amounts">Please verify this is correct. Detected: ${detectedAmounts.map(a => `$${a.toFixed(2)}`).join(', ')}</div>
            `;
        } else if (detectedAmounts.length > 0) {
            status.className = 'verification-status error';
            status.innerHTML = `
                Amount mismatch: Expected $${expectedAmount.toFixed(2)}
                <div class="detected-amounts">Found in screenshot: ${detectedAmounts.map(a => `$${a.toFixed(2)}`).join(', ')}</div>
            `;
        } else {
            status.className = 'verification-status warning';
            status.innerHTML = `
                No amounts detected in screenshot. Please ensure the image is clear and contains the payment amount.
                <div class="detected-amounts">Tip: Make sure the amount is clearly visible and not cut off</div>
            `;
        }
    }

    showOCRError(message) {
        const result = document.getElementById('ocrResult');
        const status = document.getElementById('verificationStatus');
        
        result.classList.remove('hidden');
        status.className = 'verification-status error';
        status.textContent = message;
    }

    resetOCRState() {
        const processing = document.getElementById('ocrProcessing');
        const result = document.getElementById('ocrResult');
        
        processing.classList.add('hidden');
        result.classList.add('hidden');
    }

    updateSubmitButton() {
        const submitBtn = document.querySelector('#settleUpModal .save-btn');
        const amount = document.getElementById('settlementAmount').value;
        const method = document.getElementById('paymentMethod').value;
        
        const isValid = amount && method && this.uploadedScreenshot;
        submitBtn.disabled = !isValid;
    }

    submitSettlement() {
        const amount = parseFloat(document.getElementById('settlementAmount').value);
        const method = document.getElementById('paymentMethod').value;
        const notes = document.getElementById('settlementNotes').value.trim();
        
        if (!amount || !method || !this.uploadedScreenshot) {
            alert('Please fill in all required fields and upload a screenshot');
            return;
        }
        
        const totals = this.calculateTotals();
        const settlement = {
            id: Date.now(),
            amount: amount,
            paymentMethod: method,
            notes: notes,
            screenshot: this.uploadedScreenshot,
            date: new Date().toISOString(),
            paidBy: totals.youOwe > 0 ? 'you' : 'housemate',
            status: 'completed',
            type: totals.youOwe > 0 ? 'payment_sent' : 'payment_received'
        };
        
        this.addSettlement(settlement);
        this.closeModal();
        
        // Switch to settlements tab to show the new payment
        this.switchTab('settlements');
    }

    addSettlement(settlement) {
        this.settlements.unshift(settlement);
        this.saveSettlements();
        
        // Reset balances by creating offsetting "settlement" expenses
        const settlementPaidBy = settlement.paidBy === 'you' ? 'housemate' : this.currentAccount;
        const settlementExpense = {
            id: Date.now() + 1,
            description: `Settlement payment - ${settlement.paymentMethod}`,
            amount: settlement.amount,
            paidBy: settlementPaidBy,
            date: settlement.date,
            isSettlement: true,
            settlementId: settlement.id
        };
        
        this.expenses.unshift(settlementExpense);
        this.saveExpenses();
        this.updateDisplay();
    }

    viewScreenshot(settlementId) {
        const settlement = this.settlements.find(s => s.id === settlementId);
        if (!settlement || !settlement.screenshot) return;
        
        // Create a modal to view the screenshot
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90%; max-height: 90%;">
                <div class="modal-header">
                    <h3>Payment Screenshot</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div style="padding: 20px; text-align: center;">
                    <img src="${settlement.screenshot.data}" style="max-width: 100%; max-height: 70vh; border-radius: 8px;" alt="Payment screenshot">
                    <p style="margin-top: 15px; color: #6c757d; font-size: 0.9rem;">
                        ${settlement.paymentMethod} • ${this.formatDate(settlement.date)} • $${settlement.amount.toFixed(2)}
                    </p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    markAllBought() {
        const assignedItems = this.toBuyItems.filter(item => item.assignedTo && !item.bought);
        if (assignedItems.length === 0) {
            alert('No assigned items to mark as bought!');
            return;
        }
        
        if (confirm(`Mark all ${assignedItems.length} assigned items as bought and convert to expenses?`)) {
            assignedItems.forEach(item => {
                // Create expense with actual account name
                const paidBy = item.assignedTo === 'you' ? this.currentAccount : 'housemate';
                const expense = {
                    id: Date.now() + Math.random(), // Ensure unique ID
                    description: item.description,
                    amount: item.amount || 0,
                    paidBy: paidBy,
                    date: new Date().toISOString(),
                    fromToBuy: true
                };
                
                this.expenses.unshift(expense);
                item.bought = true;
            });
            
            // Remove bought items from to-buy list
            this.toBuyItems = this.toBuyItems.filter(item => !item.bought);
            
            this.saveExpenses();
            this.saveToBuyItems();
            this.updateDisplay();
            
            // Switch to expenses tab to show new items
            this.switchTab('expenses');
        }
    }

    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        this.clearForm();
        this.assigningItem = null;
        this.uploadedScreenshot = null;
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
            paidBy: this.selectedPerson === 'you' ? this.currentAccount : 'housemate',
            splitWith: this.selectedSplit, // Store who this expense should be split with
            date: new Date().toISOString()
        };

        this.addExpense(expense);
        this.closeModal();
    }

    handleSuggestionSubmit(e) {
        e.preventDefault();
        
        const description = document.getElementById('suggestionDescription').value.trim();
        const amount = parseFloat(document.getElementById('suggestionAmount').value) || null;
        const reason = document.getElementById('suggestionReason').value.trim();

        if (!description) {
            alert('Please enter what you want to suggest');
            return;
        }

        const suggestion = {
            id: Date.now(),
            description,
            amount,
            reason,
            date: new Date().toISOString(),
            status: 'pending'
        };

        this.addSuggestion(suggestion);
        this.closeModal();
    }

    async addExpense(expense) {
        try {
            this.expenses.unshift(expense);
            this.saveExpenses();
            this.updateDisplay();
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('Failed to add expense. Please try again.');
        }
    }

    async addSuggestion(suggestion) {
        try {
            this.suggestions.unshift(suggestion);
            this.saveSuggestions();
            this.updateDisplay();
        } catch (error) {
            console.error('Error adding suggestion:', error);
            alert('Failed to add suggestion. Please try again.');
        }
    }

    acceptSuggestion(id) {
        const suggestion = this.suggestions.find(s => s.id === id);
        if (!suggestion) return;

        // Move to to-buy list
        const toBuyItem = {
            id: Date.now(),
            description: suggestion.description,
            amount: suggestion.amount,
            reason: suggestion.reason,
            date: new Date().toISOString(),
            assignedTo: null,
            bought: false,
            fromSuggestion: true
        };

        this.toBuyItems.unshift(toBuyItem);
        this.suggestions = this.suggestions.filter(s => s.id !== id);
        
        this.saveSuggestions();
        this.saveToBuyItems();
        this.updateDisplay();
    }

    rejectSuggestion(id) {
        if (confirm('Are you sure you want to reject this suggestion?')) {
            this.suggestions = this.suggestions.filter(s => s.id !== id);
            this.saveSuggestions();
            this.updateDisplay();
        }
    }

    markItemBought(id) {
        const item = this.toBuyItems.find(i => i.id === id);
        if (!item || !item.assignedTo) return;

        if (confirm('Mark this item as bought and convert to expense?')) {
            // Create expense with actual account name
            const paidBy = item.assignedTo === 'you' ? this.currentAccount : 'housemate';
            const expense = {
                id: Date.now(),
                description: item.description,
                amount: item.amount || 0,
                paidBy: paidBy,
                date: new Date().toISOString(),
                fromToBuy: true
            };

            this.expenses.unshift(expense);
            this.toBuyItems = this.toBuyItems.filter(i => i.id !== id);
            
            this.saveExpenses();
            this.saveToBuyItems();
            this.updateDisplay();
        }
    }

    async deleteExpense(id) {
        try {
            this.expenses = this.expenses.filter(expense => expense.id !== id);
            this.saveExpenses();
            this.updateDisplay();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Failed to delete expense. Please try again.');
        }
    }

    clearForm() {
        // Clear expense form
        const descInput = document.getElementById('description');
        const amountInput = document.getElementById('amount');
        if (descInput) descInput.value = '';
        if (amountInput) amountInput.value = '';

        // Clear suggestion form
        const suggDescInput = document.getElementById('suggestionDescription');
        const suggAmountInput = document.getElementById('suggestionAmount');
        const suggReasonInput = document.getElementById('suggestionReason');
        if (suggDescInput) suggDescInput.value = '';
        if (suggAmountInput) suggAmountInput.value = '';
        if (suggReasonInput) suggReasonInput.value = '';
        
        // Clear settlement form
        const settlementAmountInput = document.getElementById('settlementAmount');
        const paymentMethodSelect = document.getElementById('paymentMethod');
        const settlementNotesInput = document.getElementById('settlementNotes');
        if (settlementAmountInput) settlementAmountInput.value = '';
        if (paymentMethodSelect) paymentMethodSelect.value = '';
        if (settlementNotesInput) settlementNotesInput.value = '';
        
        // Clear file upload and OCR state
        if (this.removeScreenshot) this.removeScreenshot();
        if (this.resetOCRState) this.resetOCRState();

        this.selectedPerson = null;
        this.selectedSplit = 'all';
        document.querySelectorAll('.person-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelectorAll('.assign-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelectorAll('.split-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.split === 'all');
        });
    }

    calculateTotals() {
        const allAccounts = ['richard', 'tim', 'fijar'];
        const accountBalances = {};
        const otherAccounts = this.getOtherAccounts();
        
        // Initialize balances
        otherAccounts.forEach(account => {
            accountBalances[account] = 0;
        });

        // Process each expense based on who it's split with
        this.expenses.forEach(expense => {
            const paidBy = this.getActualPaidByAccount(expense);
            const splitWith = expense.splitWith || 'all'; // Default to 'all' for legacy expenses
            
            let participantAccounts = [];
            
            if (splitWith === 'all') {
                // Split with everyone
                participantAccounts = allAccounts;
            } else if (allAccounts.includes(splitWith)) {
                // Split with specific person - involves payer and that person
                participantAccounts = [paidBy, splitWith];
            } else {
                // Legacy format or unknown - default to all
                participantAccounts = allAccounts;
            }
            
            // Calculate share per participant
            const sharePerParticipant = expense.amount / participantAccounts.length;
            
            // Update balances between current account and each participant
            participantAccounts.forEach(participant => {
                if (participant !== this.currentAccount && otherAccounts.includes(participant)) {
                    if (paidBy === this.currentAccount) {
                        // Current account paid, they should get back from this participant
                        accountBalances[participant] += sharePerParticipant;
                    } else if (paidBy === participant) {
                        // This participant paid, current account owes them
                        accountBalances[participant] -= sharePerParticipant;
                    }
                    // If neither current account nor this participant paid, no change to their balance
                }
            });
        });

        // Calculate totals for compatibility
        let totalOwedToYou = 0;
        let totalYouOwe = 0;

        Object.values(accountBalances).forEach(balance => {
            if (balance > 0) {
                totalOwedToYou += balance;
            } else {
                totalYouOwe += Math.abs(balance);
            }
        });

        return {
            accountBalances,
            totalOwedToYou,
            totalYouOwe,
            youOwe: totalYouOwe,
            housemateOwes: totalOwedToYou
        };
    }

    getActualPaidByAccount(expense) {
        if (expense.paidBy === 'you') {
            return this.currentAccount;
        } else if (expense.paidBy === 'housemate') {
            // Legacy - we can't know which specific account, return first other
            return this.getOtherAccounts()[0];
        } else if (['richard', 'tim', 'fijar'].includes(expense.paidBy)) {
            return expense.paidBy;
        } else {
            return expense.paidBy;
        }
    }

    updateDisplay() {
        this.updateBalanceSummary();
        
        if (this.currentTab === 'expenses') {
            this.renderExpenses();
        } else if (this.currentTab === 'suggestions') {
            this.renderSuggestions();
        } else if (this.currentTab === 'tobuy') {
            this.renderToBuyList();
        } else if (this.currentTab === 'settlements') {
            this.renderSettlements();
        }
    }

    updateBalanceSummary() {
        const totals = this.calculateTotals();
        const balanceSummary = document.getElementById('balanceSummary');
        const balanceText = balanceSummary.querySelector('.balance-text');
        const currentAccount = this.getCurrentAccountDisplayName();
        
        // Check if all settled up
        const hasAnyBalance = Object.values(totals.accountBalances).some(balance => Math.abs(balance) > 0.01);
        
        if (!hasAnyBalance) {
            balanceText.textContent = 'All settled up!';
            balanceSummary.style.background = 'rgba(255, 255, 255, 0.15)';
            return;
        }

        // Find the most significant balance to display
        let maxBalance = 0;
        let maxAccount = '';
        let isOwed = false;

        Object.entries(totals.accountBalances).forEach(([account, balance]) => {
            if (Math.abs(balance) > Math.abs(maxBalance)) {
                maxBalance = balance;
                maxAccount = account;
                isOwed = balance > 0;
            }
        });

        if (maxBalance !== 0) {
            const accountDisplayName = maxAccount.charAt(0).toUpperCase() + maxAccount.slice(1);
            if (isOwed) {
                balanceText.textContent = `${accountDisplayName} owes ${currentAccount} $${Math.abs(maxBalance).toFixed(2)}`;
                balanceSummary.style.background = 'rgba(40, 199, 111, 0.2)';
            } else {
                balanceText.textContent = `${currentAccount} owes ${accountDisplayName} $${Math.abs(maxBalance).toFixed(2)}`;
                balanceSummary.style.background = 'rgba(220, 53, 69, 0.2)';
            }
        } else {
            balanceText.textContent = 'All settled up!';
            balanceSummary.style.background = 'rgba(255, 255, 255, 0.15)';
        }
    }

    renderExpenses() {
        const container = document.getElementById('expensesList');
        const currentAccount = this.getCurrentAccountDisplayName();
        const otherAccounts = this.getOtherAccountsDisplayName();
        
        if (this.expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💸</div>
                    <h3>No expenses yet</h3>
                    <p>Track shared expenses between ${currentAccount} and ${otherAccounts.toLowerCase()}. Split costs easily and see who owes what.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.expenses.map(expense => {
            // Calculate split amount based on who participated
            const splitWith = expense.splitWith || 'all';
            let participantCount = 3; // default for 'all'
            if (splitWith !== 'all' && ['richard', 'tim', 'fijar'].includes(splitWith)) {
                participantCount = 2; // split between payer and specific person
            }
            const splitAmount = expense.amount / participantCount;
            
            // Determine if current account paid for this expense
            const isYourExpense = this.isExpensePaidByCurrentAccount(expense);
            const paidByName = this.getExpensePaidByDisplayName(expense);
            
            return `
                <div class="expense-item">
                    <div class="expense-icon">${this.getExpenseIcon(expense.description)}</div>
                    <div class="expense-details">
                        <div class="expense-description">${this.escapeHtml(expense.description)}</div>
                        <div class="expense-meta">
                            Paid by ${paidByName} • 
                            ${this.formatDate(expense.date)}
                            ${this.getSplitWithText(expense)}
                            ${expense.fromToBuy ? ' • From shopping list' : ''}
                        </div>
                    </div>
                    <div class="expense-amount">
                        <div class="expense-total">$${expense.amount.toFixed(2)}</div>
                        <div class="expense-split ${isYourExpense ? 'you-get' : 'you-owe'}">
                            ${isYourExpense ? `${currentAccount} gets` : `${currentAccount} owes`} $${splitAmount.toFixed(2)}
                        </div>
                    </div>
                    <button class="delete-btn" onclick="tracker.deleteExpense(${expense.id})">
                        Delete
                    </button>
                </div>
            `;
        }).join('');
    }

    renderSuggestions() {
        const container = document.getElementById('suggestionsList');
        const otherAccounts = this.getOtherAccountsDisplayName();
        
        if (this.suggestions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💡</div>
                    <h3>No suggestions yet</h3>
                    <p>Suggest items you think you need. ${otherAccounts} can accept or reject suggestions.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.suggestions.map(suggestion => `
            <div class="suggestion-item">
                <div class="suggestion-icon">💡</div>
                <div class="suggestion-details">
                    <div class="suggestion-description">${this.escapeHtml(suggestion.description)}</div>
                    <div class="suggestion-meta">
                        Suggested ${this.formatDate(suggestion.date)}
                        ${suggestion.reason ? ` • ${this.escapeHtml(suggestion.reason)}` : ''}
                    </div>
                </div>
                ${suggestion.amount ? `<div class="suggestion-amount">$${suggestion.amount.toFixed(2)}</div>` : ''}
                <div class="suggestion-actions">
                    <button class="accept-btn" onclick="tracker.acceptSuggestion(${suggestion.id})">
                        Accept
                    </button>
                    <button class="reject-btn" onclick="tracker.rejectSuggestion(${suggestion.id})">
                        Reject
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderToBuyList() {
        const container = document.getElementById('tobuyList');
        
        if (this.toBuyItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🛒</div>
                    <h3>Shopping list is empty</h3>
                    <p>Accept suggestions to add them to your shopping list, then assign who should buy what.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.toBuyItems.map(item => `
            <div class="tobuy-item">
                <div class="tobuy-icon">🛒</div>
                <div class="tobuy-details">
                    <div class="tobuy-description">${this.escapeHtml(item.description)}</div>
                    <div class="tobuy-meta">
                        Added ${this.formatDate(item.date)}
                        ${item.reason ? ` • ${this.escapeHtml(item.reason)}` : ''}
                    </div>
                </div>
                <div class="tobuy-amount">
                    ${item.amount ? `<div class="tobuy-price">$${item.amount.toFixed(2)}</div>` : ''}
                    <div class="tobuy-assigned ${item.assignedTo ? 'assigned' : ''}">
                        ${item.assignedTo ? `Assigned to ${item.assignedTo === 'you' ? this.getCurrentAccountDisplayName() : this.getOtherAccountsDisplayName().toLowerCase()}` : 'Unassigned'}
                    </div>
                </div>
                ${!item.assignedTo ? 
                    `<button class="assign-btn-item" onclick="tracker.showAssignModal(${item.id})">Assign</button>` :
                    `<button class="bought-btn" onclick="tracker.markItemBought(${item.id})">Bought</button>`
                }
            </div>
        `).join('');
    }

    renderSettlements() {
        const container = document.getElementById('settlementsList');
        
        if (this.settlements.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💸</div>
                    <h3>No payments yet</h3>
                    <p>When you settle up expenses, payment records will appear here with screenshot verification.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.settlements.map(settlement => {
            const isPaid = settlement.paidBy === 'you';
            
            return `
                <div class="settlement-item">
                    <div class="settlement-icon ${settlement.status}">
                        ${isPaid ? '💸' : '💰'}
                    </div>
                    <div class="settlement-details">
                        <div class="settlement-description">
                            ${isPaid ? 'Payment sent' : 'Payment received'} via ${settlement.paymentMethod}
                        </div>
                        <div class="settlement-meta">
                            ${this.formatDate(settlement.date)}
                            ${settlement.notes ? ` • ${this.escapeHtml(settlement.notes)}` : ''}
                        </div>
                    </div>
                    <div class="settlement-amount">
                        <div class="settlement-total">$${settlement.amount.toFixed(2)}</div>
                        <div class="settlement-status ${settlement.status}">
                            ${settlement.status === 'completed' ? 'Verified' : 'Pending'}
                        </div>
                    </div>
                    <button class="view-screenshot" onclick="tracker.viewScreenshot(${settlement.id})">
                        View
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

    // Local storage methods (account-specific)
    saveExpenses() {
        localStorage.setItem(this.getStorageKey('expenseTracker'), JSON.stringify(this.expenses));
    }

    loadExpenses() {
        const saved = localStorage.getItem(this.getStorageKey('expenseTracker'));
        return saved ? JSON.parse(saved) : [];
    }

    saveSuggestions() {
        localStorage.setItem(this.getStorageKey('suggestions'), JSON.stringify(this.suggestions));
    }

    loadSuggestions() {
        const saved = localStorage.getItem(this.getStorageKey('suggestions'));
        return saved ? JSON.parse(saved) : [];
    }

    saveToBuyItems() {
        localStorage.setItem(this.getStorageKey('toBuyItems'), JSON.stringify(this.toBuyItems));
    }

    loadToBuyItems() {
        const saved = localStorage.getItem(this.getStorageKey('toBuyItems'));
        return saved ? JSON.parse(saved) : [];
    }

    saveSettlements() {
        localStorage.setItem(this.getStorageKey('settlements'), JSON.stringify(this.settlements));
    }

    loadSettlements() {
        const saved = localStorage.getItem(this.getStorageKey('settlements'));
        return saved ? JSON.parse(saved) : [];
    }
}

// Global functions for HTML onclick handlers
function switchTab(tab) {
    window.tracker.switchTab(tab);
}

function showAddExpense() {
    window.tracker.showAddExpense();
}

function showSuggestItem() {
    window.tracker.showSuggestItem();
}

function showSettleUp() {
    window.tracker.showSettleUp();
}

function markAllBought() {
    window.tracker.markAllBought();
}

function showAssignItems() {
    window.tracker.showAssignItems();
}

function closeModal() {
    window.tracker.closeModal();
}

function confirmAssignment() {
    window.tracker.confirmAssignment();
}

function switchAccount() {
    const accountSelect = document.getElementById('accountSelect');
    if (window.tracker && accountSelect) {
        window.tracker.switchAccount(accountSelect.value);
    }
}

function showSettleUpModal() {
    window.tracker.showSettleUpModal();
}

function submitSettlement() {
    window.tracker.submitSettlement();
}

function removeScreenshot() {
    window.tracker.removeScreenshot();
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.tracker = new ExpenseTracker();
    
    // Add validation listeners after tracker is initialized
    setTimeout(() => {
        const amountInput = document.getElementById('settlementAmount');
        const methodSelect = document.getElementById('paymentMethod');
        
        if (amountInput && methodSelect) {
            amountInput.addEventListener('input', () => {
                if (window.tracker) {
                    window.tracker.updateSubmitButton();
                    // Re-run OCR if screenshot exists and amount changed
                    if (window.tracker.uploadedScreenshot) {
                        window.tracker.processOCR(window.tracker.uploadedScreenshot.data);
                    }
                }
            });
            
            methodSelect.addEventListener('input', () => {
                if (window.tracker) {
                    window.tracker.updateSubmitButton();
                }
            });
        }
    }, 100);
});