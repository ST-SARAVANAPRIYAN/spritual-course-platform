/**
 * InnerSpark - Admin Command Center Logic
 */

let selectedContentID = null;
let currentUserRoleView = 'Student';

// Toast notification function
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
    `;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" style="margin-right: 10px;"></i>
        ${message}
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verify Auth
    const authData = Auth.checkAuth(['Admin']);
    if (!authData) return;

    // Set admin name and avatar in top header
    const { user } = authData;
    if (user) {
        document.getElementById('adminName').textContent = user.name || 'Admin';
        const avatar = document.getElementById('adminAvatar');
        avatar.textContent = (user.name || 'A').charAt(0).toUpperCase();
    }

    // 2. Load Dashboard Stats
    loadStats();

    // 3. Initial Load
    loadQueue(); // For Overview
});

/* --- NAVIGATION --- */
function switchSection(section) {
    // Hide all sections
    ['overview', 'analytics', 'users', 'courses', 'content', 'finance', 'tickets', 'messages', 'settings'].forEach(s => {
        const el = document.getElementById(s + 'Section');
        if (el) el.style.display = 'none';

        // Remove active class from nav
        const links = document.querySelectorAll(`.nav-link[onclick="switchSection('${s}')"]`);
        links.forEach(l => l.classList.remove('active'));
    });

    // Show target section
    const target = document.getElementById(section + 'Section');
    if (target) {
        // First, remove active-flex from all sections
        ['usersSection', 'coursesSection'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('active-flex');
                if (id !== section + 'Section') {
                    el.style.display = 'none';
                }
            }
        });

        // Reset specific class for users/courses section if leaving it, 
        // OR add it if entering it.
        if (section === 'users' || section === 'courses') {
            target.classList.add('active-flex');
            target.style.display = 'flex';
        } else {
            target.style.display = 'block';
            target.classList.remove('active-flex');
        }
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
        // Changed from 'queue' to 'manage' since tabs are removed
        loadCourses();
        // Logic for sub-section toggling is no longer needed as there's only one view
        const manageSub = document.getElementById('courseManageSub');
        if (manageSub) manageSub.style.display = 'flex';
    }
    if (section === 'content') {
        showContentSubSection('banners');
    }
    if (section === 'tickets') {
        loadTickets();
        loadUnreadTicketCount();
    }
    if (section === 'messages') {
        loadMessages();
    }
    if (section === 'settings') {
        loadSettings();
    }
}

function loadSettings() {
    // Determine user role and load appropriate settings
    const auth = Auth.checkAuth(['Admin']);
    if (auth && auth.user) {
        // Populate profile form (Mock or from User object)
        const nameInput = document.querySelector('#adminProfileForm input[value="Admin User"]');
        if (nameInput) nameInput.value = auth.user.name || 'Admin User';

        const emailInput = document.querySelector('#adminProfileForm input[type="email"]');
        if (emailInput) emailInput.value = auth.user.email || 'admin@innerspark.com';
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
        // Handle both legacy Content, Modules, and Courses
        const itemType = item.type || 'Module';

        let courseTitle, mentorName;
        let redirectUrl = '#';

        if (itemType === 'Course') {
            courseTitle = 'New Course Proposal';
            mentorName = item.createdBy?.name || 'Mentor';
            redirectUrl = `course-preview.html?id=${item._id}`;
        } else {
            // Module
            const cId = item.courseId?._id || item.courseId; // Populate might return object or ID
            const cTitle = item.courseId?.title || 'Unknown Course';
            courseTitle = cTitle;
            mentorName = item.createdBy?.name || 'Mentor';

            // Ensure we have a course ID to link to
            if (cId) {
                const courseIdStr = (typeof cId === 'object') ? cId._id : cId;
                redirectUrl = `course-preview.html?id=${courseIdStr}&moduleId=${item._id}`;
            }
        }

        // Visual distinction
        const borderColors = {
            'Module': 'var(--color-saffron)',
            'Course': 'var(--color-primary)'
        };
        const borderColor = borderColors[itemType] || borderColors['Module'];

        html += `
            <div class="review-card glass-premium" style="background: white; border-radius: 12px; margin-bottom: 10px; padding: 15px; border-left: 4px solid ${borderColor}; cursor:pointer; transition:transform 0.2s;" 
                 onmouseover="this.style.transform='translateX(5px)'"
                 onmouseout="this.style.transform='translateX(0)'"
                 onclick="window.location.href='${redirectUrl}'">
                 <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${courseTitle}</strong>
                        <p style="font-size: 0.8rem; color: #666;">${item.title} (${itemType}) by ${mentorName}</p>
                    </div>
                    <i class="fas fa-chevron-right" style="color:#ccc;"></i>
                </div>
            </div>
        `;
    });

    examLimit.forEach(exam => {
        // Exams might still use the modal for now, or we can redirect to an exam previewer if it exists.
        // Keeping modal for exams to avoid breaking that flow unless asked.
        html += `
            <div class="review-card glass-premium" style="background: white; border-radius: 12px; margin-bottom: 10px; padding: 15px; border-left: 4px solid var(--color-golden);">
                <div>
                    <strong>${exam.courseID?.title || 'Unknown Path'}</strong>
                    <p style="font-size: 0.8rem; color: #666;">Exam by ${exam.mentorID?.name || 'Mentor'}</p>
                </div>
                <button class="btn-primary" onclick="event.stopPropagation(); openReviewModal('${exam._id}', '#', 'Assessment', 'Exam')" style="padding: 5px 15px; font-size: 0.75rem;">Review</button>
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
            <table class="data-table" style="width: 100%; border-collapse: separate; border-spacing: 0;">
                <thead>
                    <tr>
                        <th style="padding: 15px; width: 50px;">S.No</th>
                        <th style="padding: 15px; width: 60px;">Profile</th>
                        <th style="padding: 15px;">Name</th>
                        <th style="padding: 15px;">ID</th>
                        <th style="padding: 15px;">Email</th>
                        <th style="padding: 15px;">Status</th>
                        <th style="padding: 15px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map((u, index) => `
                        <tr>
                            <td style="padding: 15px; color: #666;">${index + 1}</td>
                            <td style="padding: 15px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: #eee; display: flex; align-items: center; justify-content: center;">
                                    ${u.profilePic ?
                `<img src="${u.profilePic}" style="width: 100%; height: 100%; object-fit: cover;">` :
                `<i class="fas fa-user" style="color: #ccc;"></i>`
            }
                                </div>
                            </td>
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
                                <button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: ${u.active ? '#f0ad4e' : '#5cb85c'}; margin-right: 5px;" onclick="requestToggleStatus('${u._id}', '${u.studentID || ''}', '${u.role}', ${u.active}, '${u.name}')">
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

// Step Control for Add User
function nextStep(step) {
    document.querySelectorAll('.form-step').forEach(el => el.style.display = 'none');
    document.getElementById(`step${step}`).style.display = 'block';
}

function openAddUserModal() {
    document.getElementById('addUserForm').reset();
    nextStep(1); // Reset to step 1
    document.getElementById('addUserModal').style.display = 'flex';
}

function openEditUserModal(user) {
    document.getElementById('editUserId').value = user._id;
    document.getElementById('editUserName').value = user.name;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserPhone').value = user.phone || '';
    document.getElementById('editUserRole').value = user.role;

    // Extended Details (Safe access)
    if (user.fatherName) document.getElementById('editFatherName').value = user.fatherName;
    if (user.motherName) document.getElementById('editMotherName').value = user.motherName;
    if (user.address) {
        document.getElementById('editTown').value = user.address.town || '';
        document.getElementById('editState').value = user.address.state || '';
    }

    // Audit Info
    const auditText = user.lastEditedBy
        ? `Last Edited By: ${user.lastEditedBy} on ${new Date(user.lastEditedAt).toLocaleString()}`
        : 'No edit history available';
    document.getElementById('auditInfo').textContent = auditText;

    document.getElementById('editUserModal').style.display = 'flex';
}

// Global variables for delete logic
let targetDeleteID = null;

function requestDeleteUser(id, studentID) {
    targetDeleteID = id;
    const displayID = studentID || 'NO-ID-ASSIGNED';
    document.getElementById('deleteTargetID').textContent = displayID;
    document.getElementById('deleteIDInput').value = '';
    document.getElementById('deleteReason').value = '';
    document.getElementById('deleteConfirmModal').style.display = 'flex';

    // Store expected value for validation
    document.getElementById('deleteConfirmModal').dataset.expectedId = displayID;
}

async function confirmDeleteAction() {
    const inputID = document.getElementById('deleteIDInput').value.trim();
    const expectedID = document.getElementById('deleteConfirmModal').dataset.expectedId;
    const reason = document.getElementById('deleteReason').value;

    if (inputID !== expectedID) {
        UI.error('ID does not match! Deletion aborted.');
        return;
    }

    if (reason.length < 10) {
        UI.error('Please provide a valid reason (min 10 chars).');
        return;
    }

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/users/${targetDeleteID}`, {
            method: 'DELETE',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ reason, confirmID: inputID })
        });

        if (res.ok) {
            UI.success('User permanently deleted.');
            closeDeleteModal();
            loadUserManagement(currentUserRoleView);
        } else {
            UI.error('Deletion failed.');
        }
    } catch (err) { UI.error('Network error.'); }
    finally { UI.hideLoader(); }
}

function closeDeleteModal() {
    document.getElementById('deleteConfirmModal').style.display = 'none';
    targetDeleteID = null;
}

function suggestionDeactivate() {
    if (targetDeleteID) {
        toggleUserStatus(targetDeleteID);
        closeDeleteModal();
    }
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

async function toggleUserStatus(id, reason = '', userName = 'User', userRole = 'User', wasActiveStatus = false) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/users/${id}/status`, {
            method: 'PATCH',
            headers: {
                ...Auth.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        if (res.ok) {
            const result = await res.json();
            UI.success(result.message || 'Status updated');

            // Show different popups for deactivation vs activation
            if (result.wasActive === true && result.newActive === false) {
                // User was just DEACTIVATED
                setTimeout(() => {
                    UI.createPopup({
                        title: 'User Deactivated Successfully',
                        message: `${userName} (${userRole}) has been deactivated.\n\nIf this user is currently logged in, they will be forced to logout within 10 seconds and will not be able to login until you re-activate their account.\n\nTheir session will be terminated immediately.`,
                        type: 'warning',
                        icon: 'exclamation-triangle',
                        confirmText: 'Understood'
                    });
                }, 500);
            } else if (result.wasActive === false && result.newActive === true) {
                // User was just ACTIVATED
                setTimeout(() => {
                    UI.createPopup({
                        title: 'User Activated Successfully',
                        message: `${userName} (${userRole}) has been activated.\n\nThe user can now log in and access the system.`,
                        type: 'success',
                        icon: 'check-circle',
                        confirmText: 'Great!'
                    });
                }, 500);
            }

            loadUserManagement(currentUserRoleView);
            // Hide modal if it's open
            document.getElementById('disableConfirmModal').style.display = 'none';
        } else {
            const result = await res.json();
            UI.error(result.message || 'Action failed');
        }
    } catch (err) {
        console.error('Toggle status error:', err);
        UI.error('Action failed.');
    }
    finally { UI.hideLoader(); }
}

let targetDisableID = null;

function requestToggleStatus(id, studentID, role, isActive, userName) {
    // If active, we are DISABLING -> Show Prompt
    if (isActive) {
        targetDisableID = id;
        document.getElementById('disableTargetID').textContent = studentID || 'NO-ID';

        // Setup the confirm button for this specific action
        const confirmBtn = document.getElementById('confirmDisableBtn');
        confirmBtn.onclick = () => {
            // Hardcoded confirmation reason as requested ("simple confirmation")
            toggleUserStatus(targetDisableID, 'Manual deactivation by Admin (Confirmed via Popup)', userName, role, isActive);
        };

        document.getElementById('disableConfirmModal').style.display = 'flex';
    } else {
        // If inactive, we are ENABLING -> Direct Action (or prompt if desired, but user asked for Disable prompt)
        toggleUserStatus(id, 'Re-activation by Admin', userName, role, isActive);
    }
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


/* --- SUB SECTIONS --- */
function showCourseSubSection(sub) {
    const subs = ['manage', 'queue', 'certificates', 'override'];
    subs.forEach(s => {
        const el = document.getElementById(`course${s.charAt(0).toUpperCase() + s.slice(1)}Sub`);
        if (el) el.style.display = 'none';
    });

    const target = document.getElementById(`course${sub.charAt(0).toUpperCase() + sub.slice(1)}Sub`);
    if (target) {
        // Manage section needs flex for the internal scrolling layout
        target.style.display = (sub === 'manage') ? 'flex' : 'block';
        if (sub === 'manage') target.style.flexDirection = 'column';
    }

    // Toggle active tabs
    const container = document.getElementById('coursesSection');
    container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // Highlight clicked button (approximate match via text or onclick attribute)
    // Ideally user clicking sets active, but we can search by onclick
    const clickedBtn = Array.from(container.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(sub));
    if (clickedBtn) clickedBtn.classList.add('active');

    if (sub === 'manage') loadCourses();
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

function getThumbnail(url) {
    if (!url || url.includes('via.placeholder.com')) {
        return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
    }
    return url;
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
function openReviewModal(id, contentKeyOrUrl, label, type) {
    selectedContentID = id;
    selectedItemType = type;
    const modal = document.getElementById('reviewModal');
    const preview = document.getElementById('filePreview');
    document.getElementById('reviewTitle').innerText = `Review: ${label}`;

    if (type === 'Module') {
        const content = window[contentKeyOrUrl] || '<p>No content available.</p>';
        preview.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: left; max-height: 400px; overflow-y: auto; border: 1px solid #eee;">
                ${content}
            </div>
            <div style="margin-top:10px; color:#666; font-size:0.8rem;"><i class="fas fa-info-circle"></i> Approving this module will automatically publish it to the course.</div>
        `;
    } else if (type === 'Course') {
        const desc = window[contentKeyOrUrl] || 'No description available.';
        preview.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: left; border: 1px solid #eee;">
                <h4>Description</h4>
                <p>${desc}</p>
            </div>
             <div style="margin-top:10px; color:#666; font-size:0.8rem;"><i class="fas fa-info-circle"></i> Approving this course will set its status to <strong>Published</strong>.</div>
        `;
    }

    document.getElementById('adminRemarks').value = ''; // Reset remarks
    modal.style.display = 'flex';
}

async function submitReview(status) {
    const remarks = document.getElementById('adminRemarks').value;
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/review`, {
            method: 'POST',
            headers: { ...Auth.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contentType: selectedItemType, // 'course' or 'exam' or 'content'?
                contentID: selectedContentID,
                status: status,
                remarks: remarks
            })
        });
        if (res.ok) {
            UI.success(`Content ${status}`);
            document.getElementById('reviewModal').style.display = 'none';
            // Reload queue
            loadQueue();
        } else {
            UI.error('Action failed');
        }
    } catch (e) { UI.error('Error'); }
    finally { UI.hideLoader(); }
}

/* --- COURSE MANAGEMENT LOGIC --- */
function switchCourseTab(tabName, btn, index) {
    document.querySelectorAll('.course-section').forEach(el => el.style.display = 'none');
    document.getElementById(`courseTab_${tabName}`).style.display = 'block';

    const buttons = document.querySelectorAll('.course-tab-btn');
    buttons.forEach(b => {
        b.style.borderBottom = '2px solid transparent';
        b.style.color = '#666';
        b.classList.remove('active');
    });

    if (!btn && index !== undefined) btn = buttons[index];
    if (btn) {
        btn.style.borderBottom = '2px solid var(--color-primary)';
        btn.style.color = 'var(--color-primary)';
        btn.classList.add('active');
    }
}


let courseSearchTimeout;
function debounceLoadCourses() {
    clearTimeout(courseSearchTimeout);
    courseSearchTimeout = setTimeout(loadCourses, 300);
}

async function loadCourses() {
    const container = document.getElementById('courseListContainer');
    const search = document.getElementById('courseSearchInput') ? document.getElementById('courseSearchInput').value.toLowerCase() : '';
    const statusFilter = document.getElementById('courseStatusFilter') ? document.getElementById('courseStatusFilter').value : '';

    container.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Loading courses...</div>';
    try {
        const res = await fetch(`${Auth.apiBase}/courses/admin/all`, { headers: Auth.getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch');
        let courses = await res.json();

        // Filter
        if (search) {
            courses = courses.filter(c => c.title.toLowerCase().includes(search) || c.category.toLowerCase().includes(search));
        }
        if (statusFilter) {
            courses = courses.filter(c => c.approvalStatus === statusFilter);
        }

        renderCourses(courses);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red; text-align:center;">Failed to load courses. Ensure Backend is running.</p>';
    }
}

function renderCourses(courses) {
    const container = document.getElementById('courseListContainer');
    if (!courses || courses.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">No courses found. Click "+" to create one.</div>';
        return;
    }

    // Helper function to get status badge color
    const getStatusColor = (status) => {
        const colors = {
            'Published': { bg: '#e6f4ea', text: '#1e7e34' },
            'Draft': { bg: '#fff3cd', text: '#856404' },
            'Pending': { bg: '#fff3cd', text: '#856404' },
            'Approved': { bg: '#e6f4ea', text: '#1e7e34' },
            'Rejected': { bg: '#f8d7da', text: '#721c24' },
            'Deleted': { bg: '#f8d7da', text: '#721c24' },
            'Inactive': { bg: '#d6d8db', text: '#383d41' } // New Inactive style
        };
        return colors[status] || colors['Draft'];
    };

    container.innerHTML = `
        <div class="glass-card" style="overflow:hidden; padding:0;">
            <table class="data-table" style="width:100%; border-collapse:collapse;">
                <thead style="position: sticky; top: 0; background:#fafafa; border-bottom:1px solid #eee; z-index: 5;">
                    <tr>
                        <th style="padding:15px;">Title & Category</th>
                        <th style="padding:15px;">Mentors</th>
                        <th style="padding:15px;">Price</th>
                        <th style="padding:15px; text-align: center;">Content</th>
                        <th style="padding:15px;">Status</th>
                        <th style="padding:15px; text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${courses.map(c => {
        // Display only status (Fixed field name)
        const displayStatus = c.status || 'Draft';
        const statusColor = getStatusColor(displayStatus);

        // Status Options for Dropdown
        const options = ['Draft', 'Pending', 'Approved', 'Published', 'Inactive'];

        return `
                        <tr style="border-bottom:1px solid #f9f9f9; transition:background 0.2s;">
                            <td style="padding:15px;">
                                <div style="font-weight: 600; color:var(--color-text-primary);">${c.title}</div>
                                <small style="color:#888;">${c.category || 'General'} • ${c.duration || 'N/A'}</small>
                            </td>
                            <td style="padding:15px;">
                                ${(c.mentors && c.mentors.length > 0)
                ? c.mentors.map(m => m.name).join(', ')
                : '<span style="color:#999;">None</span>'}
                            </td>
                            <td style="padding:15px; font-weight:500;">₹${c.price}</td>
                            <td style="padding:15px; text-align: center;">
                                <a href="course-preview.html?id=${c._id}" class="btn-primary" 
                                    title="Preview Course Content" 
                                    style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center; padding:8px 16px; font-size:1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; transition: all 0.3s;" 
                                    onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.4)'"
                                    onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
                                    <i class="fas fa-eye" style="margin-right:5px;"></i> Preview
                                </a>
                            </td>
                            <td style="padding:15px;">
                                <select onchange="changeCourseStatus('${c._id}', this.value)" 
                                    style="padding: 6px 10px; border-radius: 20px; border: 1px solid rgba(0,0,0,0.1); font-size: 0.75rem; font-weight: 600; cursor: pointer; outline: none; appearance: none; -webkit-appearance: none; text-align: center;
                                    background-color: ${statusColor.bg}; color: ${statusColor.text}; width: 100px;">
                                    ${options.map(opt => `<option value="${opt}" ${opt === displayStatus ? 'selected' : ''}>${opt}</option>`).join('')}
                                </select>
                            </td>
                            <td style="padding:15px; text-align:right;">
                                <button class="btn-primary" title="View Details" style="padding:6px 10px; font-size:0.8rem; margin-right:5px; background: #17a2b8;" 
                                    onclick="viewCourseDetails('${c._id}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn-primary" title="Edit" style="padding:6px 10px; font-size:0.8rem; margin-right:5px;" 
                                    onclick='openCourseModal(${JSON.stringify(c).replace(/'/g, "&#39;")})'>
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-primary" title="Delete" style="background: #fff; border:1px solid #d9534f; color:#d9534f; padding:6px 10px; font-size:0.8rem;" 
                                    onclick="deleteCourse('${c._id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Helper for changing status via dropdown
async function changeCourseStatus(id, newStatus) {
    if (!confirm(`Are you sure you want to change status to "${newStatus}"?`)) {
        loadCourses(); // Revert UI
        return;
    }

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/review`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({
                itemType: 'Course',
                itemID: id,
                status: newStatus,
                adminRemarks: `Status updated to ${newStatus} from Dashboard`
            })
        });

        if (res.ok) {
            UI.success(`Status updated to ${newStatus}`);
            loadCourses();
        } else {
            const data = await res.json();
            UI.error(data.message || 'Update failed');
            loadCourses(); // Revert
        }
    } catch (err) {
        console.error(err);
        UI.error('Update failed');
    } finally {
        UI.hideLoader();
    }


}

async function openCourseModal(course = null) {
    const modal = document.getElementById('courseModal');
    const title = document.getElementById('courseModalTitle');

    switchCourseTab('details', null, 0); // Reset to first tab

    // Load Mentors and render Checkboxes
    await loadMentorsForDropdown(course ? (course.mentors || []) : []);

    if (course) {
        title.innerText = 'Edit Course';
        document.getElementById('courseId').value = course._id;
        document.getElementById('courseTitle').value = course.title || '';
        document.getElementById('courseDesc').value = course.description || '';
        document.getElementById('coursePrice').value = course.price || 0;
        document.getElementById('courseDifficulty').value = course.difficulty || 'Beginner';
        document.getElementById('courseCategory').value = course.category || '';
        document.getElementById('courseDuration').value = course.duration || '';
        document.getElementById('courseThumb').value = course.thumbnail || '';
    } else {
        title.innerText = 'Add New Course';
        document.getElementById('courseForm').reset();
        document.getElementById('courseId').value = '';
        // Uncheck all
        document.querySelectorAll('input[name="mentorId"]').forEach(cb => cb.checked = false);
    }
    modal.style.display = 'flex';
}

async function loadMentorsForDropdown(selectedMentors = []) {
    try {
        const res = await fetch(`${Auth.apiBase}/admin/users`, { headers: Auth.getHeaders() });
        const users = await res.json();
        const mentors = users.filter(u => u.role === 'Staff' || u.role === 'Admin');

        const container = document.getElementById('mentorListContainer');
        const selectedIds = selectedMentors.map(m => (m._id || m).toString());

        container.innerHTML = mentors.map(m => `
            <label style="display:flex; align-items:center; gap:10px; padding:5px; border-bottom:1px solid #eee; cursor:pointer;">
                <input type="checkbox" name="mentorId" value="${m._id}" 
                    ${selectedIds.includes(m._id.toString()) ? 'checked' : ''}>
                <span style="font-size:0.9rem;">${m.name} <span style="color:#999;">(${m.role})</span></span>
            </label>
        `).join('');
    } catch (e) { console.error('Mentor load failed', e); }
}

async function saveCourse(e, status) {
    if (e) e.preventDefault();
    const id = document.getElementById('courseId').value;

    // Gather Checkboxes
    const mentorCheckboxes = document.querySelectorAll('input[name="mentorId"]:checked');
    const selectedMentors = Array.from(mentorCheckboxes).map(cb => cb.value);

    // Validation
    if (!document.getElementById('courseTitle').value || !document.getElementById('coursePrice').value) {
        UI.error('Please fill all mandatory (*) fields in Details tab.');
        return;
    }

    if (status === 'Published' && selectedMentors.length === 0) {
        UI.error('Disclaimer: You must assign at least one mentor to Publish.');
        switchCourseTab('logistics', null, 1); // Switch to tab to show error context
        return;
    }

    const data = {
        title: document.getElementById('courseTitle').value,
        description: document.getElementById('courseDesc').value,
        price: document.getElementById('coursePrice').value,
        difficulty: document.getElementById('courseDifficulty').value,
        category: document.getElementById('courseCategory').value,
        duration: document.getElementById('courseDuration').value,
        thumbUrl: document.getElementById('courseThumb').value,
        mentors: selectedMentors,
        status: status
    };

    try {
        UI.showLoader();
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${Auth.apiBase}/courses/${id}` : `${Auth.apiBase}/courses`;

        const res = await fetch(url, {
            method: method,
            headers: { ...Auth.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            UI.success(`Course ${status === 'Published' ? 'Published' : 'Saved'}!`);
            document.getElementById('courseModal').style.display = 'none';
            loadCourses();
        } else {
            const err = await res.json();
            UI.error(err.message || 'Save failed');
        }
    } catch (error) {
        UI.error('Error saving course');
    } finally {
        UI.hideLoader();
    }
}

let courseToDelete = null;
let deleteCourseData = null;
let currentDeleteStage = 1;

async function deleteCourse(id) {
    courseToDelete = id;
    currentDeleteStage = 1;

    try {
        UI.showLoader();
        // First, get course details with enrollments
        const res = await fetch(`${Auth.apiBase}/courses/admin/view/${id}`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to fetch course details');

        deleteCourseData = await res.json();

        // Set course ID for confirmation
        document.getElementById('deleteCourseIdDisplay').textContent = deleteCourseData.course._id;

        // Load Stage 1 content
        loadDeleteStage1();

        // Show modal
        document.getElementById('deleteCourseModal').style.display = 'flex';
        updateDeleteStageUI(1);

    } catch (error) {
        console.error(error);
        UI.error('Failed to load course details');
    } finally {
        UI.hideLoader();
    }
}

function loadDeleteStage1() {
    const course = deleteCourseData.course;
    document.getElementById('deleteCourseDetailsContent').innerHTML = `
        <div style="text-align: center; margin-bottom: 15px;">
            <h3 style="margin: 0 0 5px 0; color: #333;">${course.title}</h3>
            <p style="margin: 0; color: #666; font-size: 0.9rem;">${course.category}</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; text-align: left;">
            <div style="padding: 12px; background: white; border-radius: 6px;">
                <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Course ID</div>
                <div style="font-weight: 600; font-family: monospace; font-size: 0.9rem;">${course._id}</div>
            </div>
            <div style="padding: 12px; background: white; border-radius: 6px;">
                <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Status</div>
                <div style="font-weight: 600;">${course.approvalStatus || 'Draft'}</div>
            </div>
            <div style="padding: 12px; background: white; border-radius: 6px;">
                <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Thumbnail</div>
                <div style="width: 80px; height: 60px; background: url('${getThumbnail(course.thumbnail)}') center/cover; border-radius: 8px;"></div>
            </div>
            <div style="padding: 12px; background: white; border-radius: 6px;">
                <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Price</div>
                <div style="font-weight: 600;">₹${course.price}</div>
            </div>
            <div style="padding: 12px; background: white; border-radius: 6px;">
                <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Difficulty</div>
                <div style="font-weight: 600;">${course.difficulty || 'N/A'}</div>
            </div>
            <div style="padding: 12px; background: white; border-radius: 6px; grid-column: 1 / -1;">
                <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Mentors</div>
                <div style="font-weight: 600;">${course.mentors && course.mentors.length > 0 ? course.mentors.map(m => m.name).join(', ') : 'None'}</div>
            </div>
            <div style="padding: 12px; background: white; border-radius: 6px; grid-column: 1 / -1;">
                <div style="font-size: 0.8rem; color: #999; margin-bottom: 5px;">Description</div>
                <div style="font-size: 0.9rem; line-height: 1.5;">${course.description || 'No description'}</div>
            </div>
        </div>
    `;
}

function loadDeleteStage2() {
    const currentEnrollments = deleteCourseData.students.filter(s => !s.completed);
    const completedEnrollments = deleteCourseData.students.filter(s => s.completed);

    let html = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 20px; background: #f8f8f8; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: 600; color: var(--color-saffron);">${deleteCourseData.stats.totalEnrolled}</div>
                <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">Total Enrolled</div>
            </div>
            <div style="text-align: center; padding: 20px; background: #f8f8f8; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: 600; color: ${currentEnrollments.length > 0 ? 'var(--color-error)' : 'var(--color-success)'};">${currentEnrollments.length}</div>
                <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">Currently Enrolled</div>
            </div>
            <div style="text-align: center; padding: 20px; background: #f8f8f8; border-radius: 8px;">
                <div style="font-size: 2rem; font-weight: 600; color: var(--color-success);">${completedEnrollments.length}</div>
                <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">Completed</div>
            </div>
        </div>
    `;

    if (currentEnrollments.length > 0) {
        html += `
            <div style="padding: 15px; background: #f8d7da; border-left: 4px solid #dc3545; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #721c24;">
                    <i class="fas fa-exclamation-circle"></i> Active Students (${currentEnrollments.length})
                </h4>
                <div style="max-height: 150px; overflow-y: auto;">
                    <table style="width: 100%; font-size: 0.85rem;">
                        <thead style="position: sticky; top: 0; background: #f8d7da;">
                            <tr style="text-align: left;">
                                <th style="padding: 5px;">Name</th>
                                <th style="padding: 5px;">Email</th>
                                <th style="padding: 5px; text-align: center;">Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentEnrollments.map(s => `
                                <tr>
                                    <td style="padding: 5px;">${s.name}</td>
                                    <td style="padding: 5px;">${s.email}</td>
                                    <td style="padding: 5px; text-align: center;">${s.progress}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    if (completedEnrollments.length > 0) {
        html += `
            <div style="padding: 15px; background: #d1ecf1; border-left: 4px solid #0c5460; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #0c5460;">
                    <i class="fas fa-check-circle"></i> Completed Students (${completedEnrollments.length})
                </h4>
                <div style="max-height: 100px; overflow-y: auto;">
                    <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem;">
                        ${completedEnrollments.map(s => `
                            <li style="margin: 5px 0;">${s.name} (${s.email})</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    if (currentEnrollments.length === 0 && completedEnrollments.length === 0) {
        html += `
            <div style="padding: 30px; text-align: center; background: #d1ecf1; border-radius: 8px;">
                <i class="fas fa-info-circle" style="font-size: 2rem; color: #0c5460; margin-bottom: 10px;"></i>
                <p style="margin: 0; color: #0c5460; font-weight: 600;">No students have enrolled in this course yet.</p>
            </div>
        `;
    }

    document.getElementById('deleteCourseEnrollmentsContent').innerHTML = html;
}

function updateDeleteStageUI(stage) {
    currentDeleteStage = stage;

    // Update progress indicators
    document.querySelectorAll('.delete-step-indicator').forEach((indicator, index) => {
        const stepNum = index + 1;
        const circle = indicator.querySelector('.step-circle');
        const label = indicator.querySelector('span');

        if (stepNum < stage) {
            // Completed step
            circle.style.background = 'var(--color-success)';
            circle.style.color = 'white';
            label.style.color = 'var(--color-success)';
        } else if (stepNum === stage) {
            // Current step
            circle.style.background = 'var(--color-saffron)';
            circle.style.color = 'white';
            label.style.color = '#333';
        } else {
            // Future step
            circle.style.background = '#ddd';
            circle.style.color = '#999';
            label.style.color = '#999';
        }
    });

    // Show/hide stages
    document.querySelectorAll('.delete-stage').forEach((stageEl, index) => {
        stageEl.style.display = (index + 1 === stage) ? 'block' : 'none';
    });

    // Update buttons
    const buttonsContainer = document.getElementById('deleteStageButtons');
    const currentEnrollments = deleteCourseData ? deleteCourseData.students.filter(s => !s.completed) : [];

    if (stage === 1) {
        buttonsContainer.innerHTML = `
            <button onclick="closeCourseDeleteModal()" class="btn-primary" style="background: #999; flex: 1;">
                Cancel
            </button>
            <button onclick="nextDeleteStage()" class="btn-primary" style="flex: 1;">
                Next <i class="fas fa-arrow-right"></i>
            </button>
        `;
    } else if (stage === 2) {
        if (currentEnrollments.length > 0) {
            buttonsContainer.innerHTML = `
                <button onclick="previousDeleteStage()" class="btn-primary" style="background: #999; flex: 1;">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <button onclick="viewCourseFromDelete()" class="btn-primary" style="background: var(--color-primary); flex: 1;">
                    <i class="fas fa-eye"></i> View & Manage Students
                </button>
            `;
        } else {
            buttonsContainer.innerHTML = `
                <button onclick="previousDeleteStage()" class="btn-primary" style="background: #999; flex: 1;">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <button onclick="nextDeleteStage()" class="btn-primary" style="flex: 1;">
                    Proceed to Delete <i class="fas fa-arrow-right"></i>
                </button>
            `;
        }
    } else if (stage === 3) {
        buttonsContainer.innerHTML = `
            <button onclick="previousDeleteStage()" class="btn-primary" style="background: #999; flex: 1;">
                <i class="fas fa-arrow-left"></i> Back
            </button>
            <button onclick="confirmCourseDeletion()" class="btn-primary" style="background: var(--color-error); flex: 1;">
                <i class="fas fa-trash"></i> Confirm Delete
            </button>
        `;
    }
}

function nextDeleteStage() {
    if (currentDeleteStage === 1) {
        loadDeleteStage2();
        updateDeleteStageUI(2);
    } else if (currentDeleteStage === 2) {
        // Clear input field
        document.getElementById('deleteCourseIdInput').value = '';
        updateDeleteStageUI(3);
    }
}

function previousDeleteStage() {
    if (currentDeleteStage > 1) {
        updateDeleteStageUI(currentDeleteStage - 1);
    }
}

function closeCourseDeleteModal() {
    document.getElementById('deleteCourseModal').style.display = 'none';
    courseToDelete = null;
    deleteCourseData = null;
    currentDeleteStage = 1;
}

function viewCourseFromDelete() {
    closeCourseDeleteModal();
    viewCourseDetails(courseToDelete);
}

async function confirmCourseDeletion() {
    const inputId = document.getElementById('deleteCourseIdInput').value.trim();
    const actualId = document.getElementById('deleteCourseIdDisplay').textContent.trim();

    if (inputId !== actualId) {
        UI.error('Course ID does not match! Please enter the exact Course ID shown above.');
        document.getElementById('deleteCourseIdInput').focus();
        return;
    }

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/${courseToDelete}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Failed to delete course');
        }

        UI.success('Course has been marked as deleted successfully');
        closeCourseDeleteModal();
        loadCourses();

    } catch (error) {
        console.error(error);
        UI.error(error.message || 'Failed to delete course');
    } finally {
        UI.hideLoader();
    }
}

// View course details with enrolled students
let currentCourseId = null;
let currentCourseStudents = [];

async function viewCourseDetails(courseId) {
    currentCourseId = courseId;
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/admin/view/${courseId}`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to fetch course details');

        const data = await res.json();
        currentCourseStudents = data.students;

        // Update modal title
        document.getElementById('viewCourseTitle').textContent = data.course.title;

        // Update course info
        const infoHtml = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div><strong>Category:</strong> ${data.course.category || 'N/A'}</div>
                <div><strong>Price:</strong> ₹${data.course.price}</div>
                <div><strong>Status:</strong> <span style="padding: 2px 8px; border-radius: 8px; background: #e6f4ea; color: #1e7e34; font-size: 0.85rem;">${data.course.approvalStatus || 'Draft'}</span></div>
                <div><strong>Duration:</strong> ${data.course.duration || 'N/A'}</div>
                <div><strong>Mentors:</strong> ${data.course.mentors.map(m => m.name).join(', ') || 'None'}</div>
                <div><strong>Difficulty:</strong> ${data.course.difficulty || 'N/A'}</div>
            </div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center;">
                    <div>
                        <div style="font-size: 2rem; color: var(--color-saffron); font-weight: 600;">${data.stats.totalEnrolled}</div>
                        <div style="color: #666; font-size: 0.85rem;">Total Enrolled</div>
                    </div>
                    <div>
                        <div style="font-size: 2rem; color: var(--color-success); font-weight: 600;">${data.stats.completed}</div>
                        <div style="color: #666; font-size: 0.85rem;">Completed</div>
                    </div>
                    <div>
                        <div style="font-size: 2rem; color: var(--color-primary); font-weight: 600;">${data.stats.inProgress}</div>
                        <div style="color: #666; font-size: 0.85rem;">In Progress</div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('viewCourseInfo').innerHTML = infoHtml;

        // Render students table
        renderCourseStudents(data.students);

        // Show modal
        document.getElementById('viewCourseModal').style.display = 'flex';

    } catch (error) {
        console.error(error);
        UI.error('Failed to load course details');
    } finally {
        UI.hideLoader();
    }
}

function renderCourseStudents(students) {
    const tbody = document.getElementById('viewCourseStudents');

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;">No students enrolled yet</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(s => `
        <tr>
            <td style="padding: 12px;">
                <input type="checkbox" class="student-checkbox" value="${s.studentId}" data-enrollment-id="${s.enrollmentId}">
            </td>
            <td style="padding: 12px;">${s.studentID || 'N/A'}</td>
            <td style="padding: 12px;">${s.name}</td>
            <td style="padding: 12px;">${s.email}</td>
            <td style="padding: 12px;">${new Date(s.enrolledAt).toLocaleDateString()}</td>
            <td style="padding: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="flex: 1; background: #eee; border-radius: 10px; height: 8px; overflow: hidden;">
                        <div style="width: ${s.progress}%; background: var(--color-success); height: 100%;"></div>
                    </div>
                    <span style="font-size: 0.85rem; color: #666;">${s.progress}%</span>
                    ${s.completed ? '<i class="fas fa-check-circle" style="color: var(--color-success);"></i>' : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function toggleAllStudents(checkbox) {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

function selectAllStudents() {
    const checkboxes = document.querySelectorAll('.student-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    document.getElementById('selectAllCheckbox').checked = true;
}

async function removeSelectedStudents() {
    const checkboxes = document.querySelectorAll('.student-checkbox:checked');

    if (checkboxes.length === 0) {
        UI.error('Please select at least one student to remove');
        return;
    }

    const studentIds = Array.from(checkboxes).map(cb => cb.value);
    const confirmMsg = `Are you sure you want to remove ${studentIds.length} student(s) from this course?\n\nThis action cannot be undone.`;

    if (!confirm(confirmMsg)) return;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/${currentCourseId}/remove-students`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ studentIds })
        });

        if (!res.ok) throw new Error('Failed to remove students');

        const data = await res.json();
        UI.success(`${data.count} student(s) removed successfully`);

        // Reload course details
        viewCourseDetails(currentCourseId);

    } catch (error) {
        console.error(error);
        UI.error('Failed to remove students');
    } finally {
        UI.hideLoader();
    }
}

/* --- SETTINGS --- */
let currentSettings = {};

async function loadSettings() {
    try {
        const res = await fetch(`${Auth.apiBase}/settings`, { headers: Auth.getHeaders() });
        currentSettings = await res.json();

        // Populate UI
        document.getElementById('maintenanceToggle').checked = currentSettings.isMaintenanceMode;
        document.getElementById('rightClickToggle').checked = currentSettings.disableRightClick;
        document.getElementById('maintenanceMessageInput').value = currentSettings.maintenanceMessage || '';
        document.getElementById('siteTitleInput').value = currentSettings.siteTitle || '';
        document.getElementById('supportEmailInput').value = currentSettings.supportEmail || '';

    } catch (err) {
        console.error(err);
        UI.error('Failed to load settings');
    }
}

async function toggleSetting(key, value) {
    try {
        const update = {};
        update[key] = value;

        const res = await fetch(`${Auth.apiBase}/settings`, {
            method: 'PUT',
            headers: Auth.getHeaders(),
            body: JSON.stringify(update)
        });

        if (res.ok) {
            UI.success('Setting updated');
            currentSettings[key] = value;
        } else {
            UI.error('Failed to update setting');
            // Revert Toggle
            document.getElementById(key === 'isMaintenanceMode' ? 'maintenanceToggle' : 'rightClickToggle').checked = !value;
        }
    } catch (err) {
        UI.error('Error updating setting');
    }
}

async function updateMaintenanceMessage() {
    const msg = document.getElementById('maintenanceMessageInput').value;
    if (!msg) return UI.error('Message cannot be empty');

    toggleSetting('maintenanceMessage', msg);
}

async function updatePlatformInfo() {
    const siteTitle = document.getElementById('siteTitleInput').value;
    const supportEmail = document.getElementById('supportEmailInput').value;

    try {
        const res = await fetch(`${Auth.apiBase}/settings`, {
            method: 'PUT',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ siteTitle, supportEmail })
        });

        if (res.ok) {
            UI.success('Platform info updated');
        } else {
            UI.error('Failed to update info');
        }
    } catch (err) {
        UI.error('Error updating info');
    }
}

// Switch Edit User Modal Tabs
function switchEditTab(tabName, buttonElement, tabIndex) {
    // Hide all tab contents
    const tabs = ['identityTab', 'profileTab', 'securityTab'];
    tabs.forEach(tab => {
        const el = document.getElementById(tab);
        if (el) el.style.display = 'none';
    });

    // Show selected tab
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) targetTab.style.display = 'block';

    // Update active button state
    const buttons = document.querySelectorAll('.edit-tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    if (buttonElement) {
        buttonElement.classList.add('active');
    } else if (typeof tabIndex === 'number') {
        // If called programmatically with index
        if (buttons[tabIndex]) {
            buttons[tabIndex].classList.add('active');
        }
    }
}

// Make switchEditTab globally available
window.switchEditTab = switchEditTab;

/* --- TICKETS MANAGEMENT --- */
let ticketSearchTimeout;
let currentTicketId = null;

function debounceLoadTickets() {
    clearTimeout(ticketSearchTimeout);
    ticketSearchTimeout = setTimeout(loadTickets, 500);
}

async function loadTickets() {
    const container = document.getElementById('ticketsListContainer');
    const search = document.getElementById('ticketSearchInput')?.value || '';
    const status = document.getElementById('ticketStatusFilter')?.value || '';
    const priority = document.getElementById('ticketPriorityFilter')?.value || '';

    container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">Loading tickets...</p>';

    try {
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('search', search);
        if (status) queryParams.append('status', status);
        if (priority) queryParams.append('priority', priority);

        const url = `${Auth.apiBase}/tickets/admin/all?${queryParams}`;
        const res = await fetch(url, { headers: Auth.getHeaders() });

        if (!res.ok) {
            throw new Error('Failed to fetch tickets');
        }

        const tickets = await res.json();

        if (tickets.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No tickets found.</p>';
            return;
        }

        const statusColors = {
            'Open': { bg: '#fff3cd', text: '#856404', icon: 'circle-notch' },
            'In Progress': { bg: '#d1ecf1', text: '#0c5460', icon: 'spinner' },
            'Resolved': { bg: '#d4edda', text: '#155724', icon: 'check-circle' },
            'Closed': { bg: '#e2e3e5', text: '#383d41', icon: 'times-circle' }
        };

        const priorityColors = {
            'Low': '#28a745',
            'Medium': '#ffc107',
            'High': '#fd7e14',
            'Urgent': '#dc3545'
        };

        container.innerHTML = `
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead style="background: #fafafa; position: sticky; top: 0; z-index: 10;">
                    <tr>
                        <th style="padding: 15px; text-align: left;">Ticket ID</th>
                        <th style="padding: 15px; text-align: left;">User</th>
                        <th style="padding: 15px; text-align: left;">Subject</th>
                        <th style="padding: 15px; text-align: center;">Priority</th>
                        <th style="padding: 15px; text-align: center;">Status</th>
                        <th style="padding: 15px; text-align: center;">Last Updated</th>
                        <th style="padding: 15px; text-align: center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tickets.map(ticket => {
            const statusColor = statusColors[ticket.status] || statusColors['Open'];
            const priorityColor = priorityColors[ticket.priority] || priorityColors['Medium'];
            const isUnread = !ticket.isReadByAdmin;
            const creator = ticket.createdBy || { name: 'Unknown', role: 'N/A', studentID: null };

            return `
                            <tr style="border-bottom: 1px solid #f0f0f0; ${isUnread ? 'background: #f8f9ff;' : ''}">
                                <td style="padding: 15px;">
                                    <div style="font-weight: 600; color: var(--color-primary); font-family: monospace;">
                                        ${ticket.ticketID}
                                        ${isUnread ? '<span style="color: var(--color-error); margin-left: 5px;">●</span>' : ''}
                                    </div>
                                </td>
                                <td style="padding: 15px;">
                                    <div style="font-weight: 600;">${creator.name}</div>
                                    <small style="color: #666;">${creator.role} • ${creator.studentID || 'N/A'}</small>
                                </td>
                                <td style="padding: 15px;">
                                    <div style="font-weight: 500;">${ticket.subject || 'No Subject'}</div>
                                    <small style="color: #666;">${ticket.description ? (ticket.description.substring(0, 60) + (ticket.description.length > 60 ? '...' : '')) : 'No description'}</small>
                                </td>
                                <td style="padding: 15px; text-align: center;">
                                    <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; background: ${priorityColor}15; color: ${priorityColor}; border: 1px solid ${priorityColor};">
                                        ${ticket.priority}
                                    </span>
                                </td>
                                <td style="padding: 15px; text-align: center;">
                                    <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; background: ${statusColor.bg}; color: ${statusColor.text};">
                                        <i class="fas fa-${statusColor.icon}"></i>
                                        ${ticket.status}
                                    </span>
                                </td>
                                <td style="padding: 15px; text-align: center;">
                                    <small style="color: #666;">${new Date(ticket.lastUpdated).toLocaleDateString()}</small>
                                    <br>
                                    <small style="color: #999;">${new Date(ticket.lastUpdated).toLocaleTimeString()}</small>
                                </td>
                                <td style="padding: 15px; text-align: center;">
                                    <button class="btn-primary" onclick="viewTicketDetail('${ticket._id}')" style="padding: 6px 12px; font-size: 0.8rem;">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                </td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Load tickets error:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--color-error); padding: 40px;">Failed to load tickets. Please try again.</p>';
    }
}

async function viewTicketDetail(ticketId) {
    currentTicketId = ticketId;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/tickets/${ticketId}`, { headers: Auth.getHeaders() });

        if (!res.ok) {
            throw new Error('Failed to fetch ticket details');
        }

        const ticket = await res.json();

        // Mark as read
        await fetch(`${Auth.apiBase}/tickets/${ticketId}/mark-read`, {
            method: 'PATCH',
            headers: Auth.getHeaders()
        });

        const statusColors = {
            'Open': { bg: '#fff3cd', text: '#856404' },
            'In Progress': { bg: '#d1ecf1', text: '#0c5460' },
            'Resolved': { bg: '#d4edda', text: '#155724' },
            'Closed': { bg: '#e2e3e5', text: '#383d41' }
        };

        const priorityColors = {
            'Low': '#28a745',
            'Medium': '#ffc107',
            'High': '#fd7e14',
            'Urgent': '#dc3545'
        };

        const statusColor = statusColors[ticket.status] || statusColors['Open'];
        const priorityColor = priorityColors[ticket.priority] || priorityColors['Medium'];
        const creator = ticket.createdBy || { name: 'Unknown', role: 'N/A', email: 'N/A' };

        document.getElementById('ticketDetailContent').innerHTML = `
            <!-- Header Info Card -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; margin-bottom: 20px; color: white; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div>
                        <label style="font-size: 0.8rem; opacity: 0.9; display: block; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">Ticket ID</label>
                        <div style="font-weight: 700; font-family: monospace; font-size: 1.1rem;">${ticket.ticketID}</div>
                    </div>
                    <div>
                        <label style="font-size: 0.8rem; opacity: 0.9; display: block; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">Created By</label>
                        <div style="font-weight: 600;">${creator.name}</div>
                        <small style="opacity: 0.9;">${creator.role} • ${creator.email}</small>
                    </div>
                    <div>
                        <label style="font-size: 0.8rem; opacity: 0.9; display: block; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">Created On</label>
                        <div style="font-weight: 600;">${new Date(ticket.createdAt).toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <!-- Subject and Status Controls -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #e9ecef;">
                <div style="margin-bottom: 20px;">
                    <label style="font-size: 0.85rem; color: #666; display: block; margin-bottom: 8px; font-weight: 600;">Subject</label>
                    <div style="font-weight: 600; font-size: 1.1rem; color: #333;">${ticket.subject}</div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <label style="font-size: 0.85rem; color: #666; display: block; margin-bottom: 8px; font-weight: 600;">
                            <i class="fas fa-flag"></i> Status
                        </label>
                        <select id="ticketStatusSelect" class="form-control" onchange="updateTicketStatus('${ticket._id}')" style="padding: 10px 12px; border-radius: 8px; border: 2px solid #e0e0e0; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                            <option value="Open" ${ticket.status === 'Open' ? 'selected' : ''}>🔵 Open</option>
                            <option value="In Progress" ${ticket.status === 'In Progress' ? 'selected' : ''}>🟡 In Progress</option>
                            <option value="Resolved" ${ticket.status === 'Resolved' ? 'selected' : ''}>🟢 Resolved</option>
                            <option value="Closed" ${ticket.status === 'Closed' ? 'selected' : ''}>⚫ Closed</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: #666; display: block; margin-bottom: 8px; font-weight: 600;">
                            <i class="fas fa-exclamation-triangle"></i> Priority
                        </label>
                        <select id="ticketPrioritySelect" class="form-control" onchange="updateTicketPriority('${ticket._id}')" style="padding: 10px 12px; border-radius: 8px; border: 2px solid #e0e0e0; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                            <option value="Low" ${ticket.priority === 'Low' ? 'selected' : ''}>🟢 Low</option>
                            <option value="Medium" ${ticket.priority === 'Medium' ? 'selected' : ''}>🟡 Medium</option>
                            <option value="High" ${ticket.priority === 'High' ? 'selected' : ''}>🟠 High</option>
                            <option value="Urgent" ${ticket.priority === 'Urgent' ? 'selected' : ''}>🔴 Urgent</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Description Card -->
            <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #667eea; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <h4 style="margin: 0 0 12px 0; color: #333; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-align-left" style="color: #667eea;"></i>
                    Description
                </h4>
                <p style="margin: 0; line-height: 1.7; color: #555; white-space: pre-wrap;">${ticket.description}</p>
            </div>

            <!-- Conversation Section -->
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #333; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-comments" style="color: #667eea;"></i>
                    Conversation History (${ticket.replies.length})
                </h4>
                <div style="max-height: 400px; overflow-y: auto; background: #f8f9fa; padding: 15px; border-radius: 12px; border: 1px solid #e9ecef;">
                    ${ticket.replies.length === 0 ? '<div style="text-align: center; color: #999; padding: 40px;"><i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 10px; display: block;"></i><p style="margin: 0;">No replies yet. Be the first to respond!</p></div>' : ''}
                    ${ticket.replies.map(reply => {
            const replier = reply.repliedBy || { name: 'Unknown', role: 'N/A' };
            return `
                        <div style="background: ${reply.isAdminReply ? 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)' : 'white'}; padding: 18px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid ${reply.isAdminReply ? '#667eea' : '#cbd5e0'}; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-weight: 600; color: ${reply.isAdminReply ? '#667eea' : '#333'}; display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${reply.isAdminReply ? '#667eea' : '#cbd5e0'}; display: flex; align-items: center; justify-content: center; color: white;">
                                        <i class="fas fa-${reply.isAdminReply ? 'user-shield' : 'user'}" style="font-size: 0.9rem;"></i>
                                    </div>
                                    <div>
                                        <div>${replier.name}</div>
                                        <small style="opacity: 0.7; font-weight: 400;">${reply.isAdminReply ? 'Administrator' : replier.role}</small>
                                    </div>
                                </div>
                                <small style="color: #666; font-size: 0.85rem;">
                                    <i class="fas fa-clock"></i> ${new Date(reply.repliedAt).toLocaleString()}
                                </small>
                            </div>
                            <p style="margin: 0; line-height: 1.6; white-space: pre-wrap; color: #444;">${reply.message}</p>
                        </div>
                    `}).join('')}
                </div>
            </div>

            <!-- Reply Form -->
            <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 12px; border: 2px dashed #cbd5e0;">
                <h4 style="margin: 0 0 15px 0; color: #333; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-reply" style="color: #667eea;"></i>
                    Add Your Reply
                </h4>
                <textarea id="adminReplyMessage" class="form-control" rows="4" placeholder="Type your reply here... (Shift+Enter for new line)" style="margin-bottom: 15px; border-radius: 8px; border: 2px solid #cbd5e0; padding: 12px; font-size: 0.95rem; resize: vertical;"></textarea>
                <button onclick="sendAdminReply('${ticket._id}')" class="btn-primary" style="width: 100%; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                    <i class="fas fa-paper-plane"></i> Send Reply
                </button>
            </div>
        `;

        document.getElementById('ticketDetailModal').style.display = 'flex';
        loadUnreadTicketCount(); // Refresh unread count
    } catch (error) {
        console.error('View ticket error:', error);
        UI.error('Failed to load ticket details');
    } finally {
        UI.hideLoader();
    }
}

async function sendAdminReply(ticketId) {
    const message = document.getElementById('adminReplyMessage').value.trim();

    if (!message) {
        UI.error('Please enter a reply message');
        return;
    }

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/tickets/${ticketId}/reply`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ message })
        });

        if (!res.ok) {
            throw new Error('Failed to send reply');
        }

        UI.success('Reply sent successfully');
        viewTicketDetail(ticketId); // Refresh ticket details
    } catch (error) {
        console.error('Send reply error:', error);
        UI.error('Failed to send reply');
    } finally {
        UI.hideLoader();
    }
}

async function updateTicketStatus(ticketId) {
    const status = document.getElementById('ticketStatusSelect').value;

    try {
        const res = await fetch(`${Auth.apiBase}/tickets/${ticketId}/status`, {
            method: 'PATCH',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ status })
        });

        if (!res.ok) {
            throw new Error('Failed to update status');
        }

        UI.success('Status updated successfully');
        loadTickets(); // Refresh ticket list
    } catch (error) {
        console.error('Update status error:', error);
        UI.error('Failed to update status');
    }
}

async function updateTicketPriority(ticketId) {
    const priority = document.getElementById('ticketPrioritySelect').value;

    try {
        const res = await fetch(`${Auth.apiBase}/tickets/${ticketId}/priority`, {
            method: 'PATCH',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ priority })
        });

        if (!res.ok) {
            throw new Error('Failed to update priority');
        }

        UI.success('Priority updated successfully');
        loadTickets(); // Refresh ticket list
    } catch (error) {
        console.error('Update priority error:', error);
        UI.error('Failed to update priority');
    }
}

function closeTicketDetailModal() {
    document.getElementById('ticketDetailModal').style.display = 'none';
    currentTicketId = null;
}

async function loadUnreadTicketCount() {
    try {
        const res = await fetch(`${Auth.apiBase}/tickets/admin/unread-count`, { headers: Auth.getHeaders() });

        if (res.ok) {
            const data = await res.json();
            const badge = document.getElementById('ticketBadge');

            if (data.count > 0) {
                badge.textContent = data.count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Load unread count error:', error);
    }
}

// Load unread count on page load
document.addEventListener('DOMContentLoaded', () => {
    if (Auth.checkAuth(['Admin'])) {
        loadUnreadTicketCount();
        loadNewMessagesCount();
        // Refresh counts every 30 seconds
        setInterval(loadUnreadTicketCount, 30000);
        setInterval(loadNewMessagesCount, 30000);
    }
});

/* =========================================
   CONTACT MESSAGES MANAGEMENT
   ========================================= */

let currentMessageId = null;
let currentPage = 1;
let messagesPerPage = 20;

async function loadMessages(page = 1) {
    try {
        currentPage = page;

        // Get filter values
        const search = document.getElementById('messageSearch').value.trim();
        const status = document.getElementById('messageStatusFilter').value;
        const priority = document.getElementById('messagePriorityFilter').value;
        const sortBy = document.getElementById('messageSortFilter').value;

        // Build query string
        const params = new URLSearchParams({
            page,
            limit: messagesPerPage,
            sortBy
        });

        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (priority) params.append('priority', priority);

        const res = await fetch(`${Auth.apiBase}/contact/admin?${params}`, { headers: Auth.getHeaders() });

        if (!res.ok) {
            throw new Error('Failed to load messages');
        }

        const data = await res.json();

        // Update stats
        document.getElementById('newMessagesCount').textContent = data.stats.New || 0;
        document.getElementById('readMessagesCount').textContent = data.stats.Read || 0;
        document.getElementById('repliedMessagesCount').textContent = data.stats.Replied || 0;
        document.getElementById('totalMessagesCount').textContent = data.total || 0;

        // Update messages badge
        updateMessagesBadge(data.stats.New || 0);

        // Render table
        renderMessagesTable(data.data);

        // Update pagination
        renderMessagesPagination(data.page, data.pages, data.total);

    } catch (error) {
        console.error('Load messages error:', error);
        const tbody = document.getElementById('messagesTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="padding: 40px; text-align: center; color: #ef4444;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <p style="margin: 0; font-size: 1.1rem;">Failed to load messages</p>
                        <p style="margin: 5px 0 0 0; font-size: 0.9rem;">${error.message}</p>
                        <button onclick="loadMessages()" class="btn-primary" style="margin-top: 15px; padding: 10px 20px;">
                            <i class="fas fa-sync-alt"></i> Retry
                        </button>
                    </td>
                </tr>
            `;
        }
        showToast('Failed to load messages', 'error');
    }
}

function renderMessagesTable(messages) {
    const tbody = document.getElementById('messagesTableBody');

    if (messages.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="padding: 40px; text-align: center; color: #9ca3af;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.3;"></i>
                    <p style="margin: 0; font-size: 1.1rem;">No messages found</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem;">Try adjusting your filters</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = messages.map(msg => {
        const date = new Date(msg.createdAt);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Determine pill class based on status
        let statusClass = 'status-read'; // default
        if (msg.status === 'New') statusClass = 'status-new';
        else if (msg.status === 'Replied') statusClass = 'status-replied';
        else if (msg.status === 'Archived') statusClass = 'status-archived';

        return `
            <tr onclick="viewMessage('${msg._id}')">
                <td>
                    <span class="status-pill ${statusClass}">
                        ${msg.status === 'New' ? '<i class="fas fa-circle" style="font-size: 0.5rem;"></i>' : ''} 
                        ${msg.status}
                    </span>
                </td>
                <td>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 600; color: #1f2937;">${msg.name}</span>
                        <span style="font-size: 0.8rem; color: #9ca3af;">${msg.email}</span>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${msg.priority === 'Urgent' ? '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>' : ''}
                        <span style="color: #4b5563; font-weight: 500;">${msg.subject}</span>
                    </div>
                </td>
                <td style="color: #6b7280; font-size: 0.85rem;">${formattedDate}</td>
                <td style="text-align: right;">
                    <i class="fas fa-chevron-right" style="color: #d1d5db;"></i>
                </td>
        `;
    }).join('');
}

// Global function for Settings Tab Switching
window.switchSettingsTab = function (element, tabId) {
    // 1. Update Sidebar Active State
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');

    // 2. Update Content Panel
    document.querySelectorAll('.settings-content-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
};

function renderMessagesPagination(currentPage, totalPages, total) {
    const info = document.getElementById('messagesInfo');
    const buttonsContainer = document.getElementById('messagesPaginationButtons');

    const start = (currentPage - 1) * messagesPerPage + 1;
    const end = Math.min(currentPage * messagesPerPage, total);

    info.textContent = `Showing ${start}-${end} of ${total} messages`;

    if (totalPages <= 1) {
        buttonsContainer.innerHTML = '';
        return;
    }

    let buttons = '';

    // Previous button
    if (currentPage > 1) {
        buttons += `<button class="btn-secondary" onclick="loadMessages(${currentPage - 1})" style="padding: 8px 12px; background: #e5e7eb; color: #374151; border: none; border-radius: 6px; cursor: pointer;">
    <i class="fas fa-chevron-left"></i> Previous
        </button>`;
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            const active = i === currentPage ? 'background: var(--color-saffron); color: white;' : 'background: #e5e7eb; color: #374151;';
            buttons += `<button onclick="loadMessages(${i})" style="padding: 8px 14px; ${active} border: none; border-radius: 6px; cursor: pointer; font-weight: ${i === currentPage ? '600' : '400'};">
    ${i}
            </button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            buttons += `<span style="padding: 8px;">...</span>`;
        }
    }

    // Next button
    if (currentPage < totalPages) {
        buttons += `<button class="btn-secondary" onclick="loadMessages(${currentPage + 1})" style="padding: 8px 12px; background: #e5e7eb; color: #374151; border: none; border-radius: 6px; cursor: pointer;">
    Next <i class="fas fa-chevron-right"></i>
        </button>`;
    }

    buttonsContainer.innerHTML = buttons;
}

async function viewMessage(messageId) {
    try {
        currentMessageId = messageId;

        const res = await fetch(`${Auth.apiBase}/contact/admin/${messageId}`, { headers: Auth.getHeaders() });

        if (!res.ok) {
            throw new Error('Failed to load message');
        }

        const data = await res.json();
        const msg = data.data;

        // Populate modal
        document.getElementById('modalMessageName').textContent = msg.name;
        document.getElementById('modalMessageEmail').textContent = msg.email;
        document.getElementById('modalMessageSubject').textContent = msg.subject;
        document.getElementById('modalMessageContent').textContent = msg.message;
        document.getElementById('modalMessageStatus').value = msg.status;
        document.getElementById('modalMessagePriority').value = msg.priority;
        document.getElementById('modalAdminNotes').value = msg.adminNotes || '';
        document.getElementById('modalMessageIP').textContent = msg.ipAddress || 'N/A';
        document.getElementById('modalMessageUA').textContent = msg.userAgent || 'N/A';
        document.getElementById('modalMessageSource').textContent = msg.source || 'Website';

        const date = new Date(msg.createdAt);
        document.getElementById('modalMessageDate').textContent = date.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Set reply email link
        const subject = encodeURIComponent(`Re: ${msg.subject} `);
        const replyLink = document.getElementById('replyEmailLink');
        replyLink.href = `mailto:${msg.email}?subject = ${subject} `;

        // Show modal
        document.getElementById('messageDetailsModal').style.display = 'flex';

        // Reload messages to update status
        setTimeout(() => loadMessages(currentPage), 500);

    } catch (error) {
        console.error('View message error:', error);
        showToast('Failed to load message details', 'error');
    }
}

function closeMessageModal() {
    document.getElementById('messageDetailsModal').style.display = 'none';
    currentMessageId = null;
}

async function updateMessageStatus() {
    const status = document.getElementById('modalMessageStatus').value;
    await updateMessage({ status });
}

async function updateMessagePriority() {
    const priority = document.getElementById('modalMessagePriority').value;
    await updateMessage({ priority });
}

async function saveMessageNotes() {
    const adminNotes = document.getElementById('modalAdminNotes').value;
    await updateMessage({ adminNotes });
}

async function updateMessage(updates) {
    if (!currentMessageId) return;

    try {
        const res = await fetch(`${Auth.apiBase} /contact/admin / ${currentMessageId} `, {
            method: 'PATCH',
            headers: Auth.getHeaders(),
            body: JSON.stringify(updates)
        });

        if (!res.ok) {
            throw new Error('Failed to update message');
        }

        showToast('Message updated successfully', 'success');
        loadMessages(currentPage);

    } catch (error) {
        console.error('Update message error:', error);
        showToast('Failed to update message', 'error');
    }
}

async function deleteMessage() {
    if (!currentMessageId) return;

    if (!confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
        return;
    }

    try {
        const res = await fetch(`${Auth.apiBase}/contact/admin/${currentMessageId}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });

        if (!res.ok) {
            throw new Error('Failed to delete message');
        }

        showToast('Message deleted successfully', 'success');
        closeMessageModal();
        loadMessages(currentPage);

    } catch (error) {
        console.error('Delete message error:', error);
        showToast('Failed to delete message', 'error');
    }
}

async function loadNewMessagesCount() {
    try {
        const res = await fetch(`${Auth.apiBase}/contact/admin?status=New&limit=1`, { headers: Auth.getHeaders() });

        if (res.ok) {
            const data = await res.json();
            updateMessagesBadge(data.total || 0);
        }
    } catch (error) {
        console.error('Load new messages count error:', error);
    }
}

function updateMessagesBadge(count) {
    const badge = document.getElementById('messagesBadge');

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// Add event listeners for filters
document.addEventListener('DOMContentLoaded', () => {
    const messageSearch = document.getElementById('messageSearch');
    const messageStatusFilter = document.getElementById('messageStatusFilter');
    const messagePriorityFilter = document.getElementById('messagePriorityFilter');
    const messageSortFilter = document.getElementById('messageSortFilter');

    if (messageSearch) {
        let searchTimeout;
        messageSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadMessages(1), 500);
        });
    }

    if (messageStatusFilter) {
        messageStatusFilter.addEventListener('change', () => loadMessages(1));
    }

    if (messagePriorityFilter) {
        messagePriorityFilter.addEventListener('change', () => loadMessages(1));
    }

    if (messageSortFilter) {
        messageSortFilter.addEventListener('change', () => loadMessages(1));
    }
});
