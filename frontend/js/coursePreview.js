/**
 * Interactive Course Preview Logic
 * Sidebar navigation + Admin Actions
 */

let courseId = null;
let currentModuleId = null;
let courseData = null;
let modulesData = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authData = Auth.checkAuth(['Admin', 'Staff']);
    if (!authData) return;
    currentUser = authData.user;

    const urlParams = new URLSearchParams(window.location.search);
    courseId = urlParams.get('id');
    const requestedModuleId = urlParams.get('moduleId'); // Deep link

    if (!courseId) {
        UI.error('No course specified');
        return;
    }

    setupNavigation();
    await loadCourseData();

    // Auto-select module if requested, otherwise first one
    if (requestedModuleId) {
        selectModule(requestedModuleId);
    } else if (modulesData.length > 0) {
        selectModule(modulesData[0]._id);
    }
});

// Setup Navigation - Case Insensitive Role Check
function setupNavigation() {
    const backBtn = document.getElementById('backLink');
    const role = (currentUser.role || '').toLowerCase(); // Safer check

    if (role === 'admin') {
        backBtn.href = 'admin-dashboard.html';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Dashboard';
    } else {
        backBtn.href = 'staff-dashboard.html';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Dashboard';
    }
}

async function loadCourseData() {
    try {
        UI.showLoader();
        const [courseRes, modulesRes] = await Promise.all([
            fetch(`${Auth.apiBase}/courses/${courseId}`, { headers: Auth.getHeaders() }),
            fetch(`${Auth.apiBase}/courses/${courseId}/modules?includeUnpublished=true`, { headers: Auth.getHeaders() })
        ]);

        if (!courseRes.ok) throw new Error('Failed to load course');

        const cData = await courseRes.json();
        const mData = await modulesRes.json();

        courseData = cData.course;
        // Ensure modules logic works even if modules are empty or undefined
        modulesData = mData.modules || [];

        renderSidebar();
        renderHeader();

    } catch (err) {
        console.error(err);
        UI.error('Failed to load course data');
    } finally {
        UI.hideLoader();
    }
}

function renderHeader() {
    document.getElementById('courseTitleHeader').textContent = courseData.title;

    // Status Logic
    const displayStatus = courseData.status;
    // Removed legacy check for approvalStatus
    const badge = document.getElementById('courseStatusBadge');
    badge.textContent = displayStatus;
    badge.className = `status-badge status-${displayStatus.replace(/\s/g, '')} status-${displayStatus}`; // Fallback

    // Course Actions (Admin Only) - Toggle Logic
    const actionContainer = document.getElementById('courseActions');
    const role = (currentUser.role || '').toLowerCase();

    if (role === 'admin') {
        let btnHtml = '';

        if (displayStatus === 'Published') {
            // Already Published - No Unpublish button as requested
            btnHtml = `<span style="color:#28a745; font-weight:bold;"><i class="fas fa-check-double"></i> Live in Course Catalog</span>`;
        } else if (displayStatus === 'Approved') {
            // Approved -> Publish
            btnHtml = `
                 <button onclick="toggleCourseStatus('Published')" class="btn btn-approve" style="font-size:0.8rem;">
                    <i class="fas fa-rocket"></i> Publish Course
                 </button>
            `;
        } else {
            // Draft/Pending -> Approve
            btnHtml = `
                 <button onclick="toggleCourseStatus('Approved')" class="btn btn-approve" style="font-size:0.8rem;">
                    <i class="fas fa-check"></i> Approve (Set as Upcoming)
                 </button>
            `;
        }
        actionContainer.innerHTML = btnHtml;
    }
}

function renderSidebar() {
    const list = document.getElementById('moduleList');
    document.getElementById('progressText').textContent = `${modulesData.length} items`;

    list.innerHTML = modulesData.map((m, index) => {
        let statusColor = '#ccc';
        if (m.status === 'Pending') statusColor = '#ffc107';
        if (m.status === 'Approved') statusColor = '#17a2b8'; // Upcoming
        if (m.status === 'Published') statusColor = '#28a745'; // Live
        if (m.status === 'Rejected') statusColor = '#dc3545';

        // Use m.status properly
        const displayStatus = m.status || 'Draft';

        return `
            <li class="module-item" id="nav-${m._id}" onclick="selectModule('${m._id}')">
                <div class="module-icon">${index + 1}</div>
                <div style="flex:1;">
                    <div style="font-weight:500; font-size:0.95rem; color:#333;">${m.title}</div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:#888; margin-top:2px;">
                        <span style="width:8px; height:8px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
                        ${displayStatus}
                    </div>
                </div>
                 ${displayStatus === 'Approved' ? '<i class="fas fa-check" style="color:#17a2b8; font-size:0.8rem;"></i>' : '<i class="fas fa-eye-slash" style="color:#ccc; font-size:0.8rem;"></i>'}
            </li>
        `;
    }).join('');
}

function selectModule(id) {
    currentModuleId = id;
    const module = modulesData.find(m => m._id === id);
    if (!module) return;

    // UI Updates
    document.querySelectorAll('.module-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(`nav-${id}`);
    if (activeEl) activeEl.classList.add('active');

    // Show Content
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('contentDisplay').style.display = 'block';

    // Populate Data
    document.getElementById('moduleTitle').textContent = module.title;
    document.getElementById('moduleAuthor').textContent = module.createdBy?.name || 'Instructor';
    document.getElementById('moduleDate').textContent = new Date(module.updatedAt || module.createdAt).toLocaleDateString();

    const statusBadge = document.getElementById('moduleStatusBadge');
    statusBadge.textContent = module.status || 'Draft';
    statusBadge.className = `status-badge status-${module.status || 'Draft'}`;

    document.getElementById('moduleBody').innerHTML = module.content || '<p>No content.</p>';

    // Admin Action Panel
    const actionPanel = document.getElementById('moduleActionPanel');
    const rejectionAlert = document.getElementById('rejectionAlert');
    if (rejectionAlert) rejectionAlert.style.display = 'none';
    actionPanel.style.display = 'none';

    // ALWAYS SHOW Action Panel for Admins (Toggle Style)
    const role = (currentUser.role || '').toLowerCase();

    if (role === 'admin') {
        actionPanel.style.display = 'flex'; // Force Flex
        actionPanel.innerHTML = ''; // Clear previous

        let mainAction = '';
        let panelStyle = '';
        let infoHtml = '';

        if (module.status === 'Approved') {
            // Context: Approved (Final State for Modules)
            panelStyle = 'background:#e6f4ea; border-bottom:1px solid #c3e6cb;';
            infoHtml = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-check-circle" style="color:#155724; font-size:1.2rem;"></i>
                    <div>
                        <strong style="color:#155724;">Approved</strong>
                        <div style="font-size:0.8rem; color:#155724;">Module is ready. Visibility depends on Course status.</div>
                    </div>
                </div>`;
            // No Publish button for modules
            mainAction = '';
        } else {
            // Context: Not Live (Draft/Pending)
            panelStyle = 'background:#fff3cd; border-bottom:1px solid #ffeeba;';
            infoHtml = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-eye-slash" style="color:#856404; font-size:1.2rem;"></i>
                    <div>
                        <strong style="color:#856404;">Pending Review</strong>
                        <div style="font-size:0.8rem; color:#856404;">Hidden from students.</div>
                    </div>
                </div>`;
            mainAction = `
                <button onclick="toggleModuleStatus('Approved')" class="btn btn-approve">
                    <i class="fas fa-check"></i> Approve
                </button>`;
        }

        actionPanel.style.cssText = `display:flex; align-items:center; justify-content:space-between; padding:15px; ${panelStyle}`;
        actionPanel.innerHTML = `
            ${infoHtml}
            <div style="display:flex; gap:10px;">
                ${mainAction}
                <button onclick="deleteModule()" class="btn btn-reject" style="background:white; color:#dc3545; border:1px solid #dc3545;" title="Delete Module">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }
}

// Toggle Module Status (Replaces old currentModuleAction)
async function toggleModuleStatus(status) {
    if (!currentModuleId) return;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/review`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({
                itemType: 'Module',
                itemID: currentModuleId,
                status: status,
                adminRemarks: status === 'Rejected' ? 'Unpublished by Admin' : ''
            })
        });

        if (!res.ok) throw new Error('Action failed');
        UI.success(`Module ${status}`);
        await loadCourseData();
        selectModule(currentModuleId);

    } catch (err) {
        console.error(err);
        UI.error('Action failed');
    } finally {
        UI.hideLoader();
    }
}

// Toggle Course Status
async function toggleCourseStatus(status) {
    if (status === 'Pending' && !confirm('Hide this course from students?')) return;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/review`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({
                itemType: 'Course',
                itemID: courseId,
                status: status
            })
        });
        if (res.ok) {
            UI.success(`Course ${status === 'Approved' ? 'Published' : 'Unpublished'}`);
            location.reload();
        }
    } catch (err) { UI.error('Failed'); }
    finally { UI.hideLoader(); }
}

// Delete Module Logic
async function deleteModule() {
    if (!currentModuleId || !confirm('Are you sure you want to DELETE this module?\nThis action cannot be undone.')) return;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/modules/${currentModuleId}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Delete failed');
        UI.success('Module deleted');

        // Remove from list
        modulesData = modulesData.filter(m => m._id !== currentModuleId);

        // Refresh Sidebar
        renderSidebar();

        // Select next or empty state
        if (modulesData.length > 0) {
            selectModule(modulesData[0]._id);
        } else {
            document.getElementById('contentDisplay').style.display = 'none';
            document.getElementById('emptyState').style.display = 'block';
        }

    } catch (err) {
        console.error(err);
        UI.error('Delete failed');
    } finally {
        UI.hideLoader();
    }
}
