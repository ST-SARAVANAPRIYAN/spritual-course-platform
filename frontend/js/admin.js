/**
 * InnerSpark - Admin Command Center Logic
 */

let selectedContentID = null;
let currentUserRoleView = 'Student';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verify Auth
    const authData = Auth.checkAuth(['Admin']);
    if (!authData) return;

    // 2. Load Dashboard Stats
    loadStats();

    // 3. Initial Load
    loadQueue(); // For Overview
});

/* --- NAVIGATION --- */
function switchSection(section) {
    // Hide all sections
    ['overview', 'analytics', 'users', 'courses', 'content', 'finance', 'settings'].forEach(s => {
        const el = document.getElementById(s + 'Section');
        if (el) el.style.display = 'none';

        // Remove active class from nav
        const links = document.querySelectorAll(`.nav-link[onclick="switchSection('${s}')"]`);
        links.forEach(l => l.classList.remove('active'));
    });

    // Show target section
    const target = document.getElementById(section + 'Section');
    if (target) {
        target.style.display = 'block';
        target.classList.add('fade-in');
    }

    // Activate nav link
    const activeLink = document.querySelector(`.nav-link[onclick="switchSection('${section}')"]`);
    if (activeLink) activeLink.classList.add('active');

    // Update Page Title
    const title = activeLink ? activeLink.getAttribute('title') : 'Overview';
    document.getElementById('pageTitle').innerText = title;

    // Load Data based on section
    if (section === 'analytics') loadAnalytics();
    if (section === 'finance') loadLedger();
    if (section === 'users') loadUserManagement(currentUserRoleView);
    if (section === 'courses') {
        showCourseSubSection('queue');
        loadOverrideCourses();
    }
    if (section === 'content') {
        showContentSubSection('banners');
    }
}

/* --- OVERVIEW & STATS --- */
async function loadStats() {
    try {
        const res = await fetch(`${Auth.apiBase}/admin/stats`, { headers: Auth.getHeaders() });
        const stats = await res.json();

        document.getElementById('statUsers').textContent = stats.totalUsers;
        document.getElementById('statMentors').textContent = stats.totalMentors;
        document.getElementById('statCourses').textContent = stats.totalCourses;
        document.getElementById('statRevenue').textContent = `$${stats.revenue.toLocaleString()}`;
    } catch (err) {
        console.error('Stats error:', err);
    }
}

async function loadQueue() {
    try {
        const res = await fetch(`${Auth.apiBase}/admin/pending`, { headers: Auth.getHeaders() });
        const data = await res.json();

        // Render for Overview (limited) and Course Queue (full)
        renderQueueList(data, 'pendingQueueOverview', true);
        renderQueueList(data, 'pendingQueue', false);
    } catch (err) {
        console.error('Queue error:', err);
    }
}

function renderQueueList(data, containerId, isOverview) {
    const list = document.getElementById(containerId);
    if (!list) return;

    if (data.content.length === 0 && data.exams.length === 0) {
        list.innerHTML = '<p style="color: var(--color-text-secondary); padding: 20px;">The sanctuary is clean. No pending reviews.</p>';
        return;
    }

    let html = '';
    // Limit for overview
    const contentLimit = isOverview ? data.content.slice(0, 3) : data.content;
    const examLimit = isOverview ? data.exams.slice(0, 3) : data.exams;

    contentLimit.forEach(item => {
        html += `
            <div class="review-card glass-premium" style="background: white; border-radius: 12px; margin-bottom: 10px; padding: 15px; border-left: 4px solid var(--color-saffron);">
                <div>
                    <strong>${item.courseID?.title || 'Unknown Path'}</strong>
                    <p style="font-size: 0.8rem; color: #666;">${item.type} by ${item.uploadedBy?.name || 'Mentor'}</p>
                </div>
                <button class="btn-primary" onclick="openReviewModal('${item._id}', '${item.fileUrl}', '${item.type}', 'Content')" style="padding: 5px 15px; font-size: 0.75rem;">Review</button>
            </div>
        `;
    });

    examLimit.forEach(exam => {
        html += `
            <div class="review-card glass-premium" style="background: white; border-radius: 12px; margin-bottom: 10px; padding: 15px; border-left: 4px solid var(--color-golden);">
                <div>
                    <strong>${exam.courseID?.title || 'Unknown Path'}</strong>
                    <p style="font-size: 0.8rem; color: #666;">Exam by ${exam.mentorID?.name || 'Mentor'}</p>
                </div>
                <button class="btn-primary" onclick="openReviewModal('${exam._id}', '#', 'Assessment', 'Exam')" style="padding: 5px 15px; font-size: 0.75rem;">Review</button>
            </div>
        `;
    });

    list.innerHTML = html;
}

/* --- USER MANAGEMENT --- */
function switchUserTab(role) {
    currentUserRoleView = role;
    document.querySelectorAll('#usersSection .tab-btn').forEach(b => {
        b.classList.remove('active');
        if (b.innerText.includes(role)) b.classList.add('active'); // loose check
    });
    loadUserManagement(role);
}

async function loadUserManagement(role) {
    const container = document.getElementById('userListContainer');
    const search = document.getElementById('userSearchInput')?.value || '';
    const status = document.getElementById('userStatusFilter')?.value || '';

    container.innerHTML = '<p>Loading records...</p>';

    try {
        const queryParams = new URLSearchParams({ role, search, status });
        const url = `${Auth.apiBase}/admin/users?${queryParams}`;
        console.log('Fetching users from:', url);

        const res = await fetch(url, { headers: Auth.getHeaders() });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Server Error (${res.status}): ${text}`);
        }

        const users = await res.json();

        if (users.length === 0) {
            container.innerHTML = '<p>No records found matching your criteria.</p>';
            return;
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; text-align: left; background: white; border-radius: 10px; overflow: hidden;">
                <thead style="background: #f8f8f8; border-bottom: 2px solid #eee;">
                    <tr>
                        <th style="padding: 15px;">Name</th>
                        <th style="padding: 15px;">ID</th>
                        <th style="padding: 15px;">Email</th>
                        <th style="padding: 15px;">Status</th>
                        <th style="padding: 15px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 15px;">
                                <div style="font-weight: 600;">${u.name}</div>
                                <small style="color: #999;">${u.role}</small>
                            </td>
                            <td style="padding: 15px; font-family: monospace;">${u.studentID || '-'}</td>
                            <td style="padding: 15px;">${u.email}</td>
                            <td style="padding: 15px;">
                                <span class="badge ${u.active ? 'badge-active' : 'badge-inactive'}">
                                    ${u.active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td style="padding: 15px; text-align: right; white-space: nowrap;">
                                <button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: #337ab7; margin-right: 5px;" onclick='openEditUserModal(${JSON.stringify(u).replace(/'/g, "&#39;")})'>
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: ${u.active ? '#f0ad4e' : '#5cb85c'}; margin-right: 5px;" onclick="toggleUserStatus('${u._id}')">
                                    ${u.active ? 'Disable' : 'Enable'}
                                </button>
                                <button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: #d9534f;" onclick="requestDeleteUser('${u._id}', '${u.studentID || ''}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('User load failed:', err);
        container.innerHTML = `<p style="color: red;">Failed to load users: ${err.message}</p>`;
        UI.error(`Error: ${err.message}`);
    }
}

// Debounce for Search
let debounceTimer;
function debounceLoadUsers() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        loadUserManagement(currentUserRoleView);
    }, 500);
}

function openAddUserModal() {
    document.getElementById('addUserModal').style.display = 'flex';
}

function openEditUserModal(user) {
    document.getElementById('editUserId').value = user._id;
    document.getElementById('editUserName').value = user.name;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserPhone').value = user.phone || '';
    document.getElementById('editUserModal').style.display = 'flex';
}

function toggleStudentFields(role) {
    const fields = document.getElementById('studentOnlyFields');
    fields.style.display = role === 'Student' ? 'block' : 'none';
}

async function submitAddUser() {
    const form = document.getElementById('addUserForm');
    const data = Object.fromEntries(new FormData(form).entries());

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/users`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
            UI.success('User created successfully.');
            form.reset();
            document.getElementById('addUserModal').style.display = 'none';
            loadUserManagement(currentUserRoleView);
            loadStats();
        } else {
            UI.error(result.message);
        }
    } catch (err) {
        UI.error('Creation failed.');
    } finally {
        UI.hideLoader();
    }
}

async function submitEditUser() {
    const form = document.getElementById('editUserForm');
    const data = Object.fromEntries(new FormData(form).entries());
    const userId = data.userId;

    // Remove empty password if not changing
    if (!data.password) delete data.password;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/users/${userId}`, {
            method: 'PUT',
            headers: Auth.getHeaders(),
            body: JSON.stringify(data)
        });

        if (res.ok) {
            UI.success('User updated successfully.');
            document.getElementById('editUserModal').style.display = 'none';
            loadUserManagement(currentUserRoleView);
        } else {
            const result = await res.json();
            UI.error(result.message || 'Update failed.');
        }
    } catch (err) {
        UI.error('Update failed.');
    } finally {
        UI.hideLoader();
    }
}

async function toggleUserStatus(id) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/users/${id}/status`, {
            method: 'PATCH',
            headers: Auth.getHeaders()
        });
        if (res.ok) {
            UI.success('Status updated.');
            loadUserManagement(currentUserRoleView);
        }
    } catch (err) { UI.error('Action failed.'); }
    finally { UI.hideLoader(); }
}

async function deleteUser(id) {
    if (!confirm('Are you sure? This action is irreversible.')) return;
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/users/${id}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });
        if (res.ok) {
            UI.success('User deleted.');
            loadUserManagement(currentUserRoleView);
            loadStats();
        }
    } catch (err) { UI.error('Deletion failed.'); }
    finally { UI.hideLoader(); }
}


/* --- COURSES --- */
function showCourseSubSection(sub) {
    ['queue', 'certificates', 'override'].forEach(s => {
        document.getElementById(`course${s.charAt(0).toUpperCase() + s.slice(1)}Sub`).style.display = 'none';
    });
    document.getElementById(`course${sub.charAt(0).toUpperCase() + sub.slice(1)}Sub`).style.display = 'block';

    // Toggle active tabs
    const container = document.getElementById('coursesSection');
    container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // (Simple logic, can be improved with IDs on buttons)

    if (sub === 'queue') loadQueue();
    if (sub === 'certificates') loadCertificates();
    if (sub === 'override') loadOverrideCourses();
}

async function loadCertificates() {
    const list = document.getElementById('certificatesList');
    try {
        const res = await fetch(`${Auth.apiBase}/admin/certificates`, { headers: Auth.getHeaders() });
        const certs = await res.json();

        if (certs.length === 0) {
            list.innerHTML = '<p>No certificates issued.</p>';
            return;
        }

        // Re-using the table structure for consistency
        list.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead style="background: rgba(0,0,0,0.02);">
                    <tr><th>Seeker</th><th>Path</th><th>Date</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${certs.map(c => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px;">${c.studentID?.name}</td>
                            <td style="padding: 10px;">${c.courseID?.title}</td>
                            <td style="padding: 10px;">${new Date(c.issueDate).toLocaleDateString()}</td>
                            <td style="padding: 10px;"><button onclick="revokeCert('${c._id}')" class="btn-primary" style="background:#d9534f; padding:4px 8px; font-size:0.7rem;">Revoke</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
         `;
    } catch (err) { UI.error('Certificates load failed.'); }
}

async function revokeCert(id) {
    if (!confirm("Withdrawing certificate?")) return;
    try {
        await fetch(`${Auth.apiBase}/admin/certificates/${id}`, { method: 'DELETE', headers: Auth.getHeaders() });
        loadCertificates();
    } catch (err) { UI.error('Revocation failed.'); }
}

async function loadOverrideCourses() {
    const select = document.getElementById('overrideCourseSelect');
    if (!select) return;
    try {
        const res = await fetch(`${Auth.apiBase}/courses/marketplace`);
        const courses = await res.json();
        select.innerHTML = courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('');
    } catch (err) { console.error(err); }
}

// Override Form Handler
const overrideForm = document.getElementById('overrideForm');
if (overrideForm) {
    overrideForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        try {
            UI.showLoader();
            const res = await fetch(`${Auth.apiBase}/admin/override`, {
                method: 'POST',
                headers: Auth.getHeaders(),
                body: JSON.stringify(data)
            });
            if (res.ok) {
                UI.success('Access granted.');
                e.target.reset();
            } else {
                const d = await res.json();
                UI.error(d.message);
            }
        } catch (err) { UI.error('Failed.'); }
        finally { UI.hideLoader(); }
    });
}

/* --- CONTENT --- */
function showContentSubSection(sub) {
    ['banners', 'blogs', 'events'].forEach(s => {
        document.getElementById(`content${s.charAt(0).toUpperCase() + s.slice(1)}Sub`).style.display = 'none';
    });
    document.getElementById(`content${sub.charAt(0).toUpperCase() + sub.slice(1)}Sub`).style.display = 'block';

    if (sub === 'banners') loadBanners();
}

async function loadBanners() {
    const list = document.getElementById('bannerList');
    try {
        const res = await fetch(`${Auth.apiBase}/admin/banners`, { headers: Auth.getHeaders() });
        const banners = await res.json();

        list.innerHTML = banners.map(b => `
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:10px; padding:10px; background:white; border-radius:8px;">
                <img src="${b.imageUrl}" style="width:60px; height:40px; object-fit:cover; border-radius:4px;">
                <div style="flex:1;"><strong>${b.title}</strong><br><small>${b.link || '-'}</small></div>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

// Form Listeners for Content (Banners, Blogs, Events)
// ... (Can reuse existing listeners if IDs match, verifying below)
document.getElementById('bannerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
        UI.showLoader();
        await fetch(`${Auth.apiBase}/admin/banners`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, method: 'POST', body: formData });
        UI.success('Banner added');
        e.target.reset();
        loadBanners();
    } catch (e) { UI.error('Failed'); }
    finally { UI.hideLoader(); }
});

/* --- FINANCE --- */
async function loadLedger() {
    const list = document.getElementById('ledgerList');
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/ledger`, { headers: Auth.getHeaders() });
        const ledger = await res.json();
        list.innerHTML = ledger.map(p => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 15px;">${p.transactionID}</td>
                <td style="padding: 15px;">${p.studentID?.name}</td>
                <td style="padding: 15px;">${p.courseID?.title}</td>
                <td style="padding: 15px; color: var(--color-saffron);">$${p.amount}</td>
                <td style="padding: 15px;">${p.status}</td>
            </tr>
        `).join('');
    } catch (err) { list.innerHTML = '<tr><td colspan="5">Ledger empty.</td></tr>'; }
    finally { UI.hideLoader(); }
}

/* --- ANALYTICS --- */
async function loadAnalytics() {
    // Re-use logic from previous version, just ensure IDs match HTML
    try {
        const res = await fetch(`${Auth.apiBase}/admin/analytics`, { headers: Auth.getHeaders() });
        const data = await res.json();
        // ... (Chart updating logic) ...
        // Simplification for brevity in this update, assuming Chart.js is handled
        const ctx = document.getElementById('growthChart').getContext('2d');
        if (window.myChart) window.myChart.destroy();
        // ... Chart init code ...
        const labels = data.growth.map(g => g._id); // Simplified
        const values = data.growth.map(g => g.revenue);
        window.myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: values,
                    borderColor: '#FF9933',
                    fill: true
                }]
            }
        });
    } catch (e) { console.error(e); }
}

/* --- SHARED --- */
// Review Modal Logic
function openReviewModal(id, url, label, type) {
    selectedContentID = id;
    selectedItemType = type;
    const modal = document.getElementById('reviewModal');
    const preview = document.getElementById('filePreview');
    // ... same as before
    modal.style.display = 'flex';
}

async function submitReview(status) {
    // ... same logic
    const remarks = document.getElementById('adminRemarks').value;
    try {
        await fetch(`${Auth.apiBase}/admin/review`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ itemID: selectedContentID, itemType: selectedItemType, status, adminRemarks: remarks })
        });
        document.getElementById('reviewModal').style.display = 'none';
        loadQueue();
    } catch (e) { UI.error('Failed'); }
}

