/**
 * BankEase - Fund Transfer Logic
 */

document.addEventListener("DOMContentLoaded", async () => {
    if (!api.isAuthenticated()) return;
    await populateAccounts();
    await populateBeneficiaries();

    const form = document.getElementById("transfer-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = document.getElementById("transfer-submit-btn");

            const source_account_id = document.getElementById("source-account-select").value;
            const amount = document.getElementById("transfer-amount").value;
            const remarks = document.getElementById("transfer-remarks").value.trim();

            const destType = document.querySelector("input[name='dest-type']:checked").value;
            let beneficiary_id = null;
            let destination_account_number = null;

            if (destType === "beneficiary") {
                beneficiary_id = document.getElementById("beneficiary-select").value;
                if (!beneficiary_id) {
                    showToast("Please select a beneficiary or choose direct account transfer.", "error");
                    return;
                }
            } else {
                destination_account_number = document.getElementById("destination-account-number").value.trim();
                if (!destination_account_number) {
                    showToast("Please enter the destination account number.", "error");
                    return;
                }
            }

            try {
                btn.disabled = true;
                btn.textContent = "Processing Transfer...";

                const payload = {
                    source_account_id: parseInt(source_account_id),
                    amount: amount,
                    remarks: remarks,
                };
                if (beneficiary_id) payload.beneficiary_id = parseInt(beneficiary_id);
                if (destination_account_number) payload.destination_account_number = destination_account_number;

                const res = await api.post("/transfers/", payload);
                if (res.status === "success") {
                    showReceipt(res.data);
                    form.reset();
                    await populateAccounts(); // refresh balance
                }
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Confirm & Transfer Funds";
            }
        });
    }
});

function toggleDestType() {
    const destType = document.querySelector("input[name='dest-type']:checked").value;
    const benContainer = document.getElementById("beneficiary-select-container");
    const dirContainer = document.getElementById("direct-acc-container");

    if (destType === "beneficiary") {
        benContainer.classList.remove("hidden");
        dirContainer.classList.add("hidden");
    } else {
        benContainer.classList.add("hidden");
        dirContainer.classList.remove("hidden");
    }
}

async function populateAccounts() {
    const select = document.getElementById("source-account-select");
    if (!select) return;

    try {
        const res = await api.get("/accounts/");
        if (res.status === "success") {
            const accounts = res.data;
            if (accounts.length === 0) {
                select.innerHTML = `<option value="">No active accounts available</option>`;
                return;
            }
            // Check query param for preselected source
            const params = new URLSearchParams(window.location.search);
            const preselectId = params.get("source");

            select.innerHTML = accounts.map(acc => `
                <option value="${acc.id}" ${preselectId == acc.id ? 'selected' : ''}>
                    ${acc.account_type_display} - ${acc.account_number} (Bal: ₹${parseFloat(acc.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})})
                </option>
            `).join("");
        }
    } catch (err) {
        showToast("Error loading source accounts: " + err.message, "error");
    }
}

async function populateBeneficiaries() {
    const select = document.getElementById("beneficiary-select");
    if (!select) return;

    try {
        const res = await api.get("/beneficiaries/");
        if (res.status === "success") {
            const list = res.data;
            if (list.length === 0) {
                select.innerHTML = `<option value="">No registered beneficiaries (switch to Direct A/C)</option>`;
                return;
            }
            select.innerHTML = `<option value="">Select registered payee</option>` + list.map(b => `
                <option value="${b.id}">
                    ${b.beneficiary_name} (${b.bank_name} - ${b.beneficiary_account_number})
                </option>
            `).join("");
        }
    } catch (err) {
        showToast("Error loading beneficiaries: " + err.message, "error");
    }
}

function showReceipt(txn) {
    document.getElementById("receipt-ref").textContent = txn.reference_number;
    document.getElementById("receipt-amount").textContent = `₹${parseFloat(txn.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    document.getElementById("receipt-date").textContent = new Date(txn.created_at).toLocaleString("en-IN");
    document.getElementById("receipt-modal").classList.remove("hidden");
}

function closeReceiptModal() {
    document.getElementById("receipt-modal").classList.add("hidden");
}
