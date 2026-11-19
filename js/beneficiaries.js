/**
 * BankEase - Beneficiary Management Logic
 */

document.addEventListener("DOMContentLoaded", async () => {
    if (!api.isAuthenticated()) return;
    await loadBeneficiaries();

    const form = document.getElementById("add-beneficiary-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const beneficiary_name = document.getElementById("ben-name").value.trim();
            const beneficiary_account_number = document.getElementById("ben-acc").value.trim();
            const bank_name = document.getElementById("ben-bank").value.trim();

            try {
                const res = await api.post("/beneficiaries/", {
                    beneficiary_name,
                    beneficiary_account_number,
                    bank_name,
                });
                if (res.status === "success") {
                    showToast("Beneficiary registered successfully!", "success");
                    closeAddModal();
                    form.reset();
                    await loadBeneficiaries();
                }
            } catch (err) {
                showToast(err.message, "error");
            }
        });
    }
});

function openAddModal() {
    document.getElementById("add-beneficiary-modal").classList.remove("hidden");
}

function closeAddModal() {
    document.getElementById("add-beneficiary-modal").classList.add("hidden");
}

async function loadBeneficiaries() {
    const tbody = document.getElementById("beneficiaries-body");
    if (!tbody) return;

    try {
        const res = await api.get("/beneficiaries/");
        if (res.status === "success") {
            const list = res.data;
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No beneficiaries registered. Click '+ Add New Payee' to add one.</td></tr>`;
                return;
            }

            tbody.innerHTML = list.map(b => `
                <tr>
                    <td><strong>${b.beneficiary_name}</strong></td>
                    <td><code>${b.beneficiary_account_number}</code></td>
                    <td>${b.bank_name}</td>
                    <td><span class="badge badge-success">${b.status}</span></td>
                    <td>
                        <a href="transfer.html?source=&dest_type=beneficiary" class="btn btn-primary btn-sm">Pay</a>
                        <button class="btn btn-danger btn-sm" onclick="deleteBeneficiary(${b.id})">Remove</button>
                    </td>
                </tr>
            `).join("");
        }
    } catch (err) {
        showToast("Error loading beneficiaries: " + err.message, "error");
    }
}

async function deleteBeneficiary(id) {
    if (!confirm("Are you sure you want to remove this beneficiary?")) return;
    try {
        const res = await api.delete(`/beneficiaries/${id}/`);
        if (res.status === "success") {
            showToast("Beneficiary removed.", "info");
            await loadBeneficiaries();
        }
    } catch (err) {
        showToast(err.message, "error");
    }
}
