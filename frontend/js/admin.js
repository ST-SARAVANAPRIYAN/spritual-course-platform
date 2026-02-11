/**
 * InnerSpark - Admin Command Center Logic
 */

let selectedContentID = null;
let currentUserRoleView = 'Student';

// Admin Status Diagnostic Functions
async function checkAdminStatusDiagnostic() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const diagnosticPanel = document.getElementById('adminStatusDiagnostic');
    const statusEl = document.getElementById('diagnosticStatus');
    const detailsEl = document.getElementById('diagnosticDetails');
    
    if (!currentUser || currentUser.role !== 'Admin') {
        if (diagnosticPanel) diagnosticPanel.style.display = 'none';
        return;
    }
    
    // Show the diagnostic panel
    if (diagnosticPanel) diagnosticPanel.style.display = 'block';
    
    // CRITICAL: Validate session against server
    try {
        const res = await fetch(`${Auth.apiBase}/auth/profile`, {
            headers: Auth.getHeaders()
        });
        
        if (res.ok) {
            const data = await res.json();
            const serverUser = data.data;
            
            // Compare localStorage with server data
            if (currentUser.isDefaultAdmin !== serverUser.isDefaultAdmin) {
                console.warn('⚠️ SESSION MISMATCH DETECTED!');
                console.warn('localStorage isDefaultAdmin:', currentUser.isDefaultAdmin);
                console.warn('Server isDefaultAdmin:', serverUser.isDefaultAdmin);
                
                // Force logout with clear message
                const shouldLogout = confirm(
                    '⚠️ SESSION DATA MISMATCH DETECTED!\n\n' +
                    'Your admin privileges have changed in the database, but your session is outdated.\n\n' +
                    'You MUST log out and log back in for changes to take effect.\n\n' +
                    'Click OK to logout now.'
                );
                
                if (shouldLogout) {
                    localStorage.clear();
                    window.location.href = 'login.html';
                    return;
                } else {
                    statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ⚠️ SESSION MISMATCH!';
                    detailsEl.textContent = 'Your privileges changed. You MUST logout and login again!';
                    diagnosticPanel.style.background = 'linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%)';
                    return;
                }
            }
            
            // Update localStorage with fresh server data
            const mergedUser = {
                ...currentUser,
                isDefaultAdmin: serverUser.isDefaultAdmin || false
            };
            localStorage.setItem('user', JSON.stringify(mergedUser));
        }
    } catch (error) {
        console.error('Failed to validate session:', error);
    }
    
    // Check if isDefaultAdmin exists
    if (!currentUser.hasOwnProperty('isDefaultAdmin')) {
        statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ⚠️ STALE SESSION DATA';
        detailsEl.innerHTML = 'Your session is missing privilege data. <strong>Please log out and log back in.</strong>';
        diagnosticPanel.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
        
        // Auto-show logout prompt after 2 seconds
        setTimeout(() => {
            const shouldLogout = confirm(
                'Your session is outdated.\n\n' +
                'Click OK to logout now and refresh your privileges.'
            );
            if (shouldLogout) {
                localStorage.clear();
                window.location.href = 'login.html';
            }
        }, 2000);
        return;
    }
    
    if (currentUser.isDefaultAdmin === true) {
        statusEl.innerHTML = '<i class="fas fa-shield-alt"></i> ⭐ DEFAULT ADMIN';
        detailsEl.textContent = 'You have full privileges to manage all admins, staff, and students.';
        diagnosticPanel.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    } else {
        statusEl.innerHTML = '<i class="fas fa-user-shield"></i> 👤 NORMAL ADMIN';
        detailsEl.textContent = 'You can manage students and staff, but not other admins (requires default admin).';
        diagnosticPanel.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    }
}

async function refreshAdminStatus() {
    const button = event.target.closest('button');
    const originalContent = button.innerHTML;
    
    try {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        button.disabled = true;
        
        // Fetch fresh user data from server
        const res = await fetch(`${Auth.apiBase}/auth/profile`, {
            headers: Auth.getHeaders()
        });
        
        if (!res.ok) {
            throw new Error('Failed to fetch profile');
        }
        
        const data = await res.json();
        const updatedUser = data.data;
        
        // Update localStorage with fresh data
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const mergedUser = {
            ...currentUser,
            isDefaultAdmin: updatedUser.isDefaultAdmin || false
        };
        
        localStorage.setItem('user', JSON.stringify(mergedUser));
        
        // Re-check diagnostic
        checkAdminStatusDiagnostic();
        
        UI.success('Admin status refreshed! Page will reload in 2 seconds...');
        
        // Reload page to update all UI elements
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Refresh failed:', error);
        UI.error('Failed to refresh status. Please log out and log back in.');
        button.innerHTML = originalContent;
        button.disabled = false;
    }
}

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
    
    // 3. Check admin status and show diagnostic panel
    checkAdminStatusDiagnostic();

    // 3. Initial Load
    loadQueue(); // For Overview

    // Admin Course Info Video Upload Logic
    const adminIntroDropzone = document.getElementById('adminIntroVideoDropzone');
    const adminIntroInput = document.getElementById('adminIntroVideoInput');
    const adminIntroHidden = document.getElementById('courseIntroVideoUrl');
    const adminUploadProgress = document.getElementById('adminUploadProgress');
    const adminProgressBar = document.getElementById('adminProgressBar');
    // Updated container ID
    const adminVideoPreview = document.getElementById('adminVideoPreviewContainer');
    const adminRemoveBtn = document.getElementById('adminRemoveVideoBtn');
    const adminDropzoneContent = document.getElementById('adminDropzoneContent');

    if (adminIntroInput) {
        adminIntroInput.addEventListener('change', handleAdminIntroUpload);

        // Drag & Drop visual feedback
        adminIntroDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            adminIntroDropzone.style.borderColor = 'var(--color-saffron)';
            adminIntroDropzone.style.background = 'rgba(0,0,0,0.02)';
        });
        adminIntroDropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            adminIntroDropzone.style.borderColor = '#ddd';
            adminIntroDropzone.style.background = 'white';
        });
        adminIntroDropzone.addEventListener('drop', (e) => {
            adminIntroDropzone.style.borderColor = '#ddd';
            adminIntroDropzone.style.background = 'white';
        });

        adminRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent re-triggering dropzone click if any
            adminIntroInput.value = '';
            adminIntroHidden.value = '';
            adminVideoPreview.style.display = 'none';
            adminDropzoneContent.style.display = 'block';
            adminUploadProgress.style.display = 'none';
        });
    }

    async function handleAdminIntroUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Reset UI
        adminUploadProgress.style.display = 'block';
        adminProgressBar.style.width = '0%';
        adminDropzoneContent.style.display = 'none';

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Fake progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                if (progress > 90) clearInterval(interval);
                adminProgressBar.style.width = `${progress}%`;
            }, 200);

            const res = await fetch(`${Auth.apiBase}/uploads/content`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });

            clearInterval(interval);
            adminProgressBar.style.width = '100%';

            if (res.ok) {
                const data = await res.json();
                adminIntroHidden.value = data.url;

                // Show Preview indicator
                adminVideoPreview.style.display = 'block';
                document.getElementById('adminVideoLink').href = data.url;
                adminUploadProgress.style.display = 'none';
            } else {
                throw new Error('Upload failed');
            }
        } catch (err) {
            console.error(err);
            UI.error('Upload failed');
            adminDropzoneContent.style.display = 'block';
        }
    }
});

/* --- NAVIGATION --- */
function switchSection(section) {
    // Hide all sections
    ['overview', 'analytics', 'users', 'courses', 'content', 'finance', 'tickets', 'messages', 'subscribers', 'gallery', 'settings'].forEach(s => {
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
    if (section === 'subscribers') {
        loadSubscribers();
    }
    if (section === 'gallery') {
        initGallerySection();
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
        console.log('[LOAD] Loading pending queue...');
        const res = await fetch(`${Auth.apiBase}/admin/pending`, { headers: Auth.getHeaders() });
        
        console.log('[FETCH] Response status:', res.status);
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error('[ERROR] Failed to fetch:', errorText);
            throw new Error('Failed to fetch pending items');
        }
        
        const data = await res.json();
        
        console.log('[DATA] Raw pending queue data:', data);
        console.log('[DATA] Content items:', data.content?.length || 0);
        console.log('[DATA] Exam items:', data.exams?.length || 0);
        
        // Ensure data has the expected structure
        const queueData = {
            content: Array.isArray(data.content) ? data.content : [],
            exams: Array.isArray(data.exams) ? data.exams : []
        };
        
        console.log('[SUCCESS] Processed queue data:', queueData);

        // Render for Overview only (pendingQueue element doesn't exist)
        renderQueueList(queueData, 'pendingQueueOverview', true);
    } catch (err) {
        console.error('[ERROR] Queue error:', err);
        const overviewEl = document.getElementById('pendingQueueOverview');
        if (overviewEl) {
            overviewEl.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;"><i class="fas fa-exclamation-triangle"></i> Failed to load pending approvals. Check console for details.</p>';
        }
    }
}

function renderQueueList(data, containerId, isOverview) {
    const list = document.getElementById(containerId);
    if (!list) return;

    // Filter out exams without valid courseID before counting
    const validExams = (data.exams || []).filter(exam => {
        const courseId = exam.courseID?._id || exam.courseID;
        return !!courseId; // Only count exams with valid courseID
    });
    
    // Calculate total pending items with valid data only
    const totalPending = (data.content?.length || 0) + validExams.length;

    console.log('[RENDER] Rendering to ' + containerId + ', isOverview: ' + isOverview);
    console.log('[RENDER] Total valid pending items: ' + totalPending + ' (content: ' + (data.content?.length || 0) + ', exams: ' + validExams.length + ')');
    console.log('[RENDER] Filtered out ' + ((data.exams?.length || 0) - validExams.length) + ' exams without courseID');
    
    // Update badge count if in overview
    if (isOverview) {
        const badge = document.getElementById('pendingCountBadge');
        if (badge) {
            if (totalPending > 0) {
                badge.textContent = totalPending;
                badge.style.display = 'inline-block';
                console.log('[SUCCESS] Badge updated:', totalPending);
            } else {
                badge.style.display = 'none';
            }
        }
    }

    if (totalPending === 0) {
        console.log('[INFO] No pending items to display');
        list.innerHTML = `
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <i class="fas fa-check-circle" style="font-size: 3rem; color: #28a745; margin-bottom: 15px;"></i>
                <h4 style="color: #333; margin-bottom: 8px;">All Clear!</h4>
                <p style="color: #999; margin: 0;">No pending approvals at this time.</p>
            </div>
        `;
        return;
    }

    console.log('[BUILD] Building HTML for pending items...');
    let html = '';
    // Limit for overview
    const contentLimit = isOverview ? data.content.slice(0, 3) : data.content;
    const examLimit = isOverview ? validExams.slice(0, 3) : validExams;
    
    console.log(`📝 Rendering ${contentLimit.length} content items and ${examLimit.length} exam items`);

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

        // Type badge styling
        const typeBadges = {
            'Module': { color: 'var(--color-saffron)', bg: 'rgba(255, 152, 0, 0.1)', icon: 'book-open', label: 'Module' },
            'Course': { color: 'var(--color-primary)', bg: 'rgba(52, 152, 219, 0.1)', icon: 'graduation-cap', label: 'Course' }
        };
        const badge = typeBadges[itemType] || typeBadges['Module'];

        html += `
            <div class="review-card glass-premium" style="background: white; border-radius: 12px; margin-bottom: 10px; padding: 15px; border-left: 4px solid ${badge.color}; cursor:pointer; transition:transform 0.2s; position: relative;" 
                 onmouseover="this.style.transform='translateX(5px)'"
                 onmouseout="this.style.transform='translateX(0)'"
                 onclick="window.location.href='${redirectUrl}'">
                <div style="position: absolute; top: 15px; right: 15px;">
                    <span style="background: ${badge.bg}; color: ${badge.color}; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fas fa-${badge.icon}"></i> ${badge.label}
                    </span>
                </div>
                <div style="padding-right: 100px;">
                    <strong style="font-size: 1.05rem; color: #333; display: block; margin-bottom: 6px;">${courseTitle}</strong>
                    <p style="font-size: 0.85rem; color: #666; margin: 0;">
                        <i class="fas fa-user" style="color: #999;"></i> ${item.title} by ${mentorName}
                    </p>
                    <p style="font-size: 0.75rem; color: #999; margin: 5px 0 0 0;">
                        <i class="fas fa-clock"></i> Created ${new Date(item.createdAt).toLocaleDateString()}
                    </p>
                </div>
            </div>
        `;
    });

    examLimit.forEach((exam, index) => {
        console.log('[EXAM] Processing exam ' + (index + 1) + ':', { 
            id: exam._id, 
            title: exam.title, 
            courseID: exam.courseID,
            createdBy: exam.createdBy,
            approvalStatus: exam.approvalStatus,
            updatedAt: exam.updatedAt
        });
        
        // Handle missing/undefined exam title and get better creator names
        const examTitle = exam.title && exam.title !== 'undefined' ? exam.title : `Assessment #${index + 1}`;
        const creatorName = exam.createdBy?.name || 'Course Staff';
        const courseName = exam.courseID?.title || 'Course Not Specified';
        
        // Determine if this is a resubmitted assessment
        const createdDate = new Date(exam.createdAt);
        const updatedDate = new Date(exam.updatedAt || exam.createdAt);
        const isResubmitted = updatedDate.getTime() - createdDate.getTime() > 60000; // More than 1 minute apart
        const displayDate = isResubmitted ? updatedDate : createdDate;
        const statusText = isResubmitted ? 'Resubmitted' : 'Created';
        const statusIcon = isResubmitted ? 'fas fa-redo' : 'fas fa-clock';
        const statusColor = isResubmitted ? '#e67e22' : '#999';
        
        const courseId = exam.courseID?._id || exam.courseID;
        const reviewUrl = `course-preview.html?id=${courseId}&examId=${exam._id}`;
        console.log('[URL] Review URL for "' + examTitle + '":', reviewUrl);
        
        html += `
            <div class="review-card glass-premium" style="background: white; border-radius: 12px; margin-bottom: 10px; padding: 15px; border-left: 4px solid var(--color-golden); cursor:pointer; transition:transform 0.2s; position: relative;"
                 onmouseover="this.style.transform='translateX(5px)'"
                 onmouseout="this.style.transform='translateX(0)'"
                 onclick="window.location.href='${reviewUrl}'">
                <div style="position: absolute; top: 15px; right: 15px;">
                    <span style="background: rgba(255, 193, 7, 0.1); color: var(--color-golden); padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fas fa-clipboard-check"></i> ASSESSMENT${isResubmitted ? ' (REVISED)' : ''}
                    </span>
                </div>
                <div style="padding-right: 140px;">
                    <strong style="font-size: 1.05rem; color: #333; display: block; margin-bottom: 6px;">${courseName}</strong>
                    <p style="font-size: 0.85rem; color: #666; margin: 0;">
                        <i class="fas fa-user" style="color: #999;"></i> ${examTitle} by ${creatorName}
                    </p>
                    <p style="font-size: 0.75rem; color: #999; margin: 5px 0 0 0;">
                        <i class="fas fa-question-circle"></i> ${exam.questions?.length || 0} Questions • 
                        <i class="${statusIcon}" style="color: ${statusColor};"></i> ${statusText} ${displayDate.toLocaleDateString()}
                    </p>
                </div>
            </div>
        `;
    });
    
    console.log('[SUCCESS] Generated HTML for ' + examLimit.length + ' exams');

    // Add "View All" button if overview has more items
    console.log('✨ Rendered pending items successfully to', containerId);
    if (isOverview && totalPending > 6) {
        html += `
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="switchDashboardSection('coursesSection')" class="btn-primary" style="background: var(--color-saffron); padding: 10px 30px; margin-right: 10px;">
                    <i class="fas fa-list"></i> View All Pending (${totalPending})
                </button>
                <button onclick="cleanupDuplicateAssessments()" class="btn-primary" style="background: #e74c3c; padding: 10px 20px;">  
                    <i class="fas fa-broom"></i> Cleanup Duplicates
                </button>
            </div>
        `;
    }

    list.innerHTML = html;
}

// Cleanup duplicate assessments
async function cleanupDuplicateAssessments() {
    if (!confirm('This will remove duplicate assessments from the database, keeping only the most recent version of each. Continue?')) {
        return;
    }
    
    try {
        const res = await fetch(`${Auth.apiBase}/exams/cleanup-duplicates`, {
            method: 'POST',
            headers: Auth.getHeaders()
        });
        
        const result = await res.json();
        
        if (res.ok) {
            alert(`✓ Cleanup completed successfully!\n\nFound: ${result.duplicatesFound} duplicates\nRemoved: ${result.duplicatesRemoved} duplicates\n\nThe pending assessments list will now refresh.`);
            // Refresh the pending assessments
            loadPendingContent();
        } else {
            alert('❌ Cleanup failed: ' + result.message);
        }
    } catch (err) {
        console.error('Error during cleanup:', err);
        alert('❌ Cleanup failed. Please try again.');
    }
}

// Make cleanup function globally available
window.cleanupDuplicateAssessments = cleanupDuplicateAssessments;

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

    // Get current user to check if they're default admin
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const isCurrentUserDefaultAdmin = currentUser && currentUser.isDefaultAdmin === true;
    
    console.log('🔍 DEBUG - Current User Object:', currentUser);
    console.log('🔍 DEBUG - isDefaultAdmin value:', currentUser?.isDefaultAdmin);
    console.log('🔍 DEBUG - Type of isDefaultAdmin:', typeof currentUser?.isDefaultAdmin);
    console.log('🔍 DEBUG - isCurrentUserDefaultAdmin result:', isCurrentUserDefaultAdmin);
    
    // Alert user if localStorage might be stale
    if (currentUser && currentUser.role === 'Admin' && !currentUser.hasOwnProperty('isDefaultAdmin')) {
        console.warn('⚠️  WARNING: User object missing isDefaultAdmin field! You may need to log out and back in.');
    }

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
                    ${users.map((u, index) => {
                        // Debug logging for each user
                        if (u.role === 'Admin') {
                            console.log(`👤 Admin User: ${u.name}`, {
                                isDefaultAdmin: u.isDefaultAdmin,
                                isCurrentUserDefaultAdmin: isCurrentUserDefaultAdmin,
                                shouldShowActiveButtons: !(u.isDefaultAdmin || !isCurrentUserDefaultAdmin)
                            });
                        }
                        return `
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
                                ${u.role === 'Admin' && u.isDefaultAdmin ? '<div style="margin-top: 5px;"><span style="background: linear-gradient(135deg, #FF6B6B, #FF8E53); color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.65rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-shield-alt"></i> DEFAULT ADMIN</span></div>' : ''}
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
                                ${u.role === 'Admin' && u.isDefaultAdmin ?
                                    `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: #ccc; cursor: not-allowed; margin-right: 5px;" disabled title="Default admin cannot be disabled">
                                        <i class="fas fa-lock"></i>
                                    </button>` :
                                    u.role === 'Admin' && !isCurrentUserDefaultAdmin ?
                                    `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: #ccc; cursor: not-allowed; margin-right: 5px;" disabled title="Only default admin can disable other admins">
                                        <i class="fas fa-lock"></i>
                                    </button>` :
                                    `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: ${u.active ? '#f0ad4e' : '#5cb85c'}; margin-right: 5px;" onclick="requestToggleStatus('${u._id}', '${u.studentID || ''}', '${u.role}', ${u.active}, '${u.name}', ${u.isDefaultAdmin || false})">
                                        ${u.active ? 'Disable' : 'Enable'}
                                    </button>`}
                                ${u.role === 'Admin' && !u.isDefaultAdmin && isCurrentUserDefaultAdmin ? 
                                    `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: #FF6B6B; margin-right: 5px;" onclick="setDefaultAdmin('${u._id}', '${u.name}')" title="Set as Default Admin">
                                        <i class="fas fa-shield-alt"></i>
                                    </button>` : 
                                    u.role === 'Admin' && !u.isDefaultAdmin && !isCurrentUserDefaultAdmin ?
                                    `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: #ccc; cursor: not-allowed; margin-right: 5px;" disabled title="Only default admin can change default admin">
                                        <i class="fas fa-shield-alt" style="opacity: 0.5;"></i>
                                    </button>` : ''}
                                ${u.role === 'Admin' && u.isDefaultAdmin ? 
                                    `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: #ccc; cursor: not-allowed;" disabled title="Default admin cannot be deleted">
                                        <i class="fas fa-lock"></i>
                                    </button>` :
                                    u.role === 'Admin' && !isCurrentUserDefaultAdmin ?
                                    `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: #ccc; cursor: not-allowed;" disabled title="Only default admin can delete other admins">
                                        <i class="fas fa-lock"></i>
                                    </button>` :
                                    `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.7rem; background: #d9534f;" onclick="requestDeleteUser('${u._id}', '${u.studentID || ''}', '${u.role}')">
                                        <i class="fas fa-trash"></i>
                                    </button>`}
                            </td>
                        </tr>
                    `;}).join('')}
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
// Multi-Stage User Form Variables
let currentUserStage = 1;
const totalUserStages = 4;

function nextStep(step) {
    const stepElements = document.querySelectorAll('.form-step');
    if (stepElements && stepElements.length > 0) {
        stepElements.forEach(el => el.style.display = 'none');
        const targetStep = document.getElementById(`step${step}`);
        if (targetStep) {
            targetStep.style.display = 'block';
        }
    }
}

function openAddUserModal() {
    currentUserStage = 1;
    document.getElementById('addUserForm').reset();
    updateUserStageDisplay();
    document.getElementById('addUserModal').style.display = 'flex';
}

function closeAddUserModal() {
    document.getElementById('addUserModal').style.display = 'none';
    currentUserStage = 1;
    document.getElementById('addUserForm').reset();
    // Hide success stage and show stage 1
    document.getElementById('userStageSuccess').style.display = 'none';
    updateUserStageDisplay();
    // Reload users to show the newly created user
    loadUserManagement(currentUserRoleView);
}

function updateUserStageDisplay() {
    // Hide all stages
    document.querySelectorAll('.user-form-stage').forEach(stage => {
        stage.style.display = 'none';
    });

    // Show current stage
    const currentStageElement = document.getElementById(`userStage${currentUserStage}`);
    if (currentStageElement) {
        currentStageElement.style.display = 'block';
    }

    // Update progress dots
    document.querySelectorAll('.progress-dot').forEach((dot, index) => {
        if (index < currentUserStage) {
            dot.style.background = '#4a90e2';
        } else {
            dot.style.background = '#e0e0e0';
        }
    });

    // Update buttons
    const btnPrev = document.getElementById('btnPrevStage');
    const btnNext = document.getElementById('btnNextStage');
    const btnCreate = document.getElementById('btnCreateUser');

    btnPrev.style.display = currentUserStage > 1 ? 'block' : 'none';
    btnNext.style.display = currentUserStage < totalUserStages ? 'block' : 'none';
    btnCreate.style.display = currentUserStage === totalUserStages ? 'block' : 'none';
}

function validateCurrentUserStage() {
    const form = document.getElementById('addUserForm');
    
    if (currentUserStage === 1) {
        const role = document.getElementById('userRole').value;
        if (!role) {
            UI.error('Please select a user role');
            return false;
        }
    } else if (currentUserStage === 2) {
        const name = document.getElementById('userName').value.trim();
        if (!name) {
            UI.error('Please enter the full name');
            return false;
        }
        if (name.length < 3) {
            UI.error('Name must be at least 3 characters long');
            return false;
        }
    } else if (currentUserStage === 3) {
        const email = document.getElementById('userEmail').value.trim();
        const password = document.getElementById('userPassword').value;
        
        if (!email) {
            UI.error('Please enter an email address');
            return false;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            UI.error('Please enter a valid email address');
            return false;
        }
        
        if (!password) {
            UI.error('Please enter a password');
            return false;
        }
        
        if (password.length < 6) {
            UI.error('Password must be at least 6 characters long');
            return false;
        }
    }
    
    return true;
}

function nextUserStage() {
    if (!validateCurrentUserStage()) {
        return;
    }

    // Special handling for stage transitions
    if (currentUserStage === 1) {
        // Update gender field visibility based on role
        const role = document.getElementById('userRole').value;
        const genderContainer = document.getElementById('genderFieldContainer');
        genderContainer.style.display = role === 'Student' ? 'block' : 'none';
    }

    if (currentUserStage === 3) {
        // Moving to confirmation stage - populate the confirmation details
        populateConfirmationDetails();
    }

    currentUserStage++;
    updateUserStageDisplay();
}

function previousUserStage() {
    if (currentUserStage > 1) {
        currentUserStage--;
        updateUserStageDisplay();
    }
}

function populateConfirmationDetails() {
    const role = document.getElementById('userRole').value;
    const name = document.getElementById('userName').value;
    const initial = document.getElementById('userInitial').value;
    const email = document.getElementById('userEmail').value;
    const phone = document.getElementById('userPhone').value;
    const gender = document.getElementById('userGender').value;

    const roleLabels = {
        'Student': '<span style="background: #3498db; color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.85rem;"><i class="fas fa-graduation-cap"></i> Student</span>',
        'Staff': '<span style="background: #9b59b6; color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.85rem;"><i class="fas fa-chalkboard-teacher"></i> Staff</span>',
        'Admin': '<span style="background: #e74c3c; color: white; padding: 4px 12px; border-radius: 15px; font-size: 0.85rem;"><i class="fas fa-user-shield"></i> Admin</span>'
    };

    let html = `
        <div style="margin-bottom: 15px;">
            <label style="font-size: 0.8rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Role</label>
            <div>${roleLabels[role] || role}</div>
        </div>
        <div style="margin-bottom: 15px;">
            <label style="font-size: 0.8rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Full Name</label>
            <div style="font-weight: 600; color: #333; font-size: 1.1rem;">${name}</div>
        </div>
    `;

    if (initial) {
        html += `
            <div style="margin-bottom: 15px;">
                <label style="font-size: 0.8rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Initial</label>
                <div style="color: #555;">${initial}</div>
            </div>
        `;
    }

    if (gender && role === 'Student') {
        html += `
            <div style="margin-bottom: 15px;">
                <label style="font-size: 0.8rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Gender</label>
                <div style="color: #555;">${gender}</div>
            </div>
        `;
    }

    html += `
        <div style="margin-bottom: 15px;">
            <label style="font-size: 0.8rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Email</label>
            <div style="color: #555;"><i class="fas fa-envelope" style="color: #4a90e2; margin-right: 8px;"></i>${email}</div>
        </div>
    `;

    if (phone) {
        html += `
            <div style="margin-bottom: 15px;">
                <label style="font-size: 0.8rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Phone</label>
                <div style="color: #555;"><i class="fas fa-phone" style="color: #4a90e2; margin-right: 8px;"></i>${phone}</div>
            </div>
        `;
    }

    html += `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #e0e0e0;">
            <p style="margin: 0; font-size: 0.85rem; color: #666;">
                <i class="fas fa-shield-alt" style="color: #27ae60; margin-right: 8px;"></i>
                Password is encrypted and secure
            </p>
        </div>
    `;

    document.getElementById('confirmationDetails').innerHTML = html;
}

async function submitMultiStageUser() {
    const form = document.getElementById('addUserForm');
    const data = Object.fromEntries(new FormData(form).entries());

    // Remove empty fields
    Object.keys(data).forEach(key => {
        if (!data[key]) delete data[key];
    });

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/users`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify(data)
        });
        const result = await res.json();
        
        if (res.ok) {
            // Show success stage
            document.getElementById('userStageSuccess').style.display = 'block';
            document.getElementById('userStage4').style.display = 'none';
            
            // Display the generated ID
            document.getElementById('generatedUserId').textContent = result.studentID || 'ID-GENERATED';
            
            // Update buttons for success stage
            document.getElementById('stageActions').style.display = 'flex';
            document.getElementById('btnPrevStage').style.display = 'none';
            document.getElementById('btnNextStage').style.display = 'none';
            document.getElementById('btnCreateUser').style.display = 'none';
            document.getElementById('btnCloseSuccess').style.display = 'block';
            
            // Update progress to complete
            document.querySelectorAll('.progress-dot').forEach(dot => {
                dot.style.background = '#27ae60';
            });
            
            loadStats(); // Refresh dashboard stats
        } else {
            UI.error(result.message || 'Failed to create user');
        }
    } catch (err) {
        console.error('Create user error:', err);
        UI.error('Creation failed. Please try again.');
    } finally {
        UI.hideLoader();
    }
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

function requestDeleteUser(id, studentID, userRole) {
    // Check if trying to delete an admin and current user is not default admin
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (userRole === 'Admin' && !currentUser.isDefaultAdmin) {
        UI.error('Only the default admin can delete other admins.');
        return;
    }

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

        const result = await res.json();

        if (res.ok) {
            UI.success('User permanently deleted.');
            closeDeleteModal();
            loadUserManagement(currentUserRoleView);
        } else {
            if (result.isDefaultAdmin) {
                UI.error('Cannot delete default admin. Please set another admin as default first.');
            } else {
                UI.error(result.message || 'Deletion failed.');
            }
        }
    } catch (err) { 
        console.error('Delete error:', err);
        UI.error('Network error.'); 
    }
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
    // Legacy function - kept for compatibility if needed elsewhere
    const fields = document.getElementById('studentOnlyFields');
    if (fields) {
        fields.style.display = role === 'Student' ? 'block' : 'none';
    }
}

// Legacy function - now replaced by submitMultiStageUser
async function submitAddUser() {
    console.warn('submitAddUser() is deprecated. Use submitMultiStageUser() instead.');
    // Fallback to new function
    return submitMultiStageUser();
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

function requestToggleStatus(id, studentID, role, isActive, userName, isDefaultAdmin = false) {
    // Get current logged-in user
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    // If active, we are DISABLING -> Show Prompt
    if (isActive) {
        // Check if trying to disable default admin
        if (isDefaultAdmin) {
            UI.error('Cannot disable the default admin. Please set another admin as default first.');
            return;
        }
        
        // Check if admin is trying to disable themselves
        if (currentUser && currentUser.id === id) {
            UI.error('You cannot disable your own account.');
            return;
        }
        
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

async function setDefaultAdmin(adminId, adminName) {
    // Check if current user is default admin
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser.isDefaultAdmin) {
        UI.error('Only the current default admin can transfer default admin privileges.');
        return;
    }

    const confirmed = confirm(`Set "${adminName}" as the default admin?\n\nYou will lose your default admin status, and "${adminName}" will become the new default admin with full privileges.`);
    if (!confirmed) return;

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/set-default-admin/${adminId}`, {
            method: 'PATCH',
            headers: Auth.getHeaders()
        });

        const result = await res.json();

        if (res.ok) {
            UI.success(`${adminName} is now the default admin`);
            // Update current user in localStorage
            currentUser.isDefaultAdmin = false;
            localStorage.setItem('user', JSON.stringify(currentUser));
            loadUserManagement(currentUserRoleView);
            
            // Show info popup about privilege transfer
            setTimeout(() => {
                UI.createPopup({
                    title: 'Default Admin Changed',
                    message: `${adminName} is now the default admin with full privileges.\n\nYou are now a regular admin with limited admin management capabilities.`,
                    type: 'info',
                    icon: 'info-circle',
                    confirmText: 'Understood'
                });
            }, 500);
        } else {
            UI.error(result.message || 'Failed to set default admin');
        }
    } catch (err) {
        console.error('Set default admin error:', err);
        UI.error('Failed to set default admin');
    } finally {
        UI.hideLoader();
    }
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
// Switch between analytics categories
function switchAnalyticsCategory(category) {
    // Hide all categories
    document.querySelectorAll('.analytics-category').forEach(cat => {
        cat.classList.remove('active');
    });
    
    // Remove active from all tabs
    document.querySelectorAll('.analytics-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected category
    const selectedCategory = document.querySelector(`[data-category="${category}"]`);
    if (selectedCategory) {
        selectedCategory.classList.add('active');
    }
    
    // Activate corresponding tab
    const tabs = document.querySelectorAll('.analytics-tab');
    const categoryOrder = ['users', 'courses', 'revenue', 'content', 'attendance', 'engagement', 'support', 'system'];
    const index = categoryOrder.indexOf(category);
    if (index !== -1 && tabs[index]) {
        tabs[index].classList.add('active');
    }
}

async function loadAnalytics() {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/analytics`, { headers: Auth.getHeaders() });
        const data = await res.json();

        // Destroy existing charts
        if (window.analyticsCharts) {
            Object.values(window.analyticsCharts).forEach(chart => {
                if (chart && typeof chart.destroy === 'function') chart.destroy();
            });
        }
        window.analyticsCharts = {};

        // Common chart options for interactivity
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    cornerRadius: 8
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        };

        // === 1. USER & GROWTH ANALYTICS ===
        
        // KPI Cards
        document.getElementById('kpiStudents').textContent = data.userOverview.totalStudents;
        document.getElementById('kpiStaff').textContent = data.userOverview.totalStaff;
        document.getElementById('kpiAdmins').textContent = data.userOverview.totalAdmins;
        document.getElementById('kpiActive').textContent = data.userOverview.activeUsers;
        document.getElementById('kpiInactive').textContent = data.userOverview.inactiveUsers;

        // Student Growth Chart
        const growthLabels = data.studentGrowth.map(d => new Date(d._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const growthData = data.studentGrowth.map(d => d.count);
        window.analyticsCharts.studentGrowth = new Chart(document.getElementById('studentGrowthChart'), {
            type: 'line',
            data: {
                labels: growthLabels,
                datasets: [{
                    label: 'New Students',
                    data: growthData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { stepSize: 1 },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // Active vs Inactive Chart (Account Status)
        window.analyticsCharts.activeInactive = new Chart(document.getElementById('activeInactiveChart'), {
            type: 'doughnut',
            data: {
                labels: ['Active Accounts', 'Inactive Accounts'],
                datasets: [{
                    data: [data.activeVsInactive.active, data.activeVsInactive.inactive],
                    backgroundColor: ['#2ecc71', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 10
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { position: 'bottom' }
                }
            }
        });

        // Recently Active vs Dormant Chart (Login Activity)
        if (data.recentlyActiveVsDormant) {
            window.analyticsCharts.recentlyActive = new Chart(document.getElementById('recentlyActiveChart'), {
                type: 'doughnut',
                data: {
                    labels: ['Recently Active', 'Dormant'],
                    datasets: [{
                        data: [data.recentlyActiveVsDormant.recentlyActive || 0, data.recentlyActiveVsDormant.dormant || 0],
                        backgroundColor: ['#3498db', '#95a5a6'],
                        borderWidth: 2,
                        borderColor: '#fff',
                        hoverOffset: 10
                    }]
                },
                options: {
                    ...commonOptions,
                    plugins: {
                        ...commonOptions.plugins,
                        legend: { position: 'bottom' },
                        tooltip: {
                            ...commonOptions.plugins.tooltip,
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // === 2. COURSE PERFORMANCE ANALYTICS ===
        
        // Course Enrollment Chart
        const enrollmentLabels = data.courseEnrollments.map(c => c.courseTitle?.substring(0, 25) || 'Unknown');
        const enrollmentData = data.courseEnrollments.map(c => c.enrollmentCount);
        window.analyticsCharts.courseEnrollment = new Chart(document.getElementById('courseEnrollmentChart'), {
            type: 'bar',
            data: {
                labels: enrollmentLabels,
                datasets: [{
                    label: 'Enrollments',
                    data: enrollmentData,
                    backgroundColor: 'rgba(255, 153, 51, 0.8)',
                    borderColor: '#FF9933',
                    borderWidth: 1,
                    borderRadius: 6,
                    hoverBackgroundColor: '#FF9933'
                }]
            },
            options: {
                ...commonOptions,
                indexAxis: 'y',
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    x: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    y: { grid: { display: false } }
                }
            }
        });

        // Course Completion Chart
        const completionLabels = data.courseCompletion.map(c => c.courseTitle?.substring(0, 25) || 'Unknown');
        const completionData = data.courseCompletion.map(c => c.completionRate || 0);
        window.analyticsCharts.courseCompletion = new Chart(document.getElementById('courseCompletionChart'), {
            type: 'bar',
            data: {
                labels: completionLabels,
                datasets: [{
                    label: 'Completion %',
                    data: completionData,
                    backgroundColor: 'rgba(46, 204, 113, 0.8)',
                    borderColor: '#2ecc71',
                    borderWidth: 1,
                    borderRadius: 6,
                    hoverBackgroundColor: '#2ecc71'
                }]
            },
            options: {
                ...commonOptions,
                indexAxis: 'y',
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    x: { 
                        beginAtZero: true, 
                        max: 100,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    y: { grid: { display: false } }
                }
            }
        });

        // Paid vs Free Chart
        window.analyticsCharts.paidFree = new Chart(document.getElementById('paidFreeChart'), {
            type: 'pie',
            data: {
                labels: ['Paid Courses', 'Free Courses'],
                datasets: [{
                    data: [data.paidVsFree.paid, data.paidVsFree.free],
                    backgroundColor: ['#FF9933', '#138808'],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 10
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { position: 'bottom' }
                }
            }
        });

        // === 3. REVENUE & PAYMENT ANALYTICS ===
        
        // Total Revenue KPI
        document.getElementById('totalRevenueKPI').textContent = `₹${data.totalRevenue.toLocaleString()}`;

        // Revenue Growth Chart
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const revenueLabels = data.revenueGrowth.map(r => `${monthNames[r._id.month - 1]} ${r._id.year}`);
        const revenueData = data.revenueGrowth.map(r => r.revenue);
        window.analyticsCharts.revenueGrowth = new Chart(document.getElementById('revenueGrowthChart'), {
            type: 'line',
            data: {
                labels: revenueLabels,
                datasets: [{
                    label: 'Revenue (₹)',
                    data: revenueData,
                    borderColor: '#FF9933',
                    backgroundColor: 'rgba(255, 153, 51, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#FF9933',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        ...commonOptions.plugins.tooltip,
                        callbacks: {
                            label: context => 'Revenue: ₹' + context.parsed.y.toLocaleString()
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                            callback: value => '₹' + value.toLocaleString()
                        }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // Payment Status Chart
        window.analyticsCharts.paymentStatus = new Chart(document.getElementById('paymentStatusChart'), {
            type: 'doughnut',
            data: {
                labels: ['Success', 'Failed'],
                datasets: [{
                    data: [data.paymentStatus.success, data.paymentStatus.failed],
                    backgroundColor: ['#2ecc71', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 10
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { position: 'bottom' }
                }
            }
        });

        // Revenue by Course Chart
        const revenueCourseLabels = data.revenueByCourse.map(c => c.courseTitle?.substring(0, 30) || 'Unknown');
        const revenueCourseData = data.revenueByCourse.map(c => c.revenue);
        window.analyticsCharts.revenueByCourse = new Chart(document.getElementById('revenueByCourseChart'), {
            type: 'bar',
            data: {
                labels: revenueCourseLabels,
                datasets: [{
                    label: 'Revenue (₹)',
                    data: revenueCourseData,
                    backgroundColor: 'rgba(255, 153, 51, 0.8)',
                    borderColor: '#FF9933',
                    borderWidth: 1,
                    borderRadius: 6,
                    hoverBackgroundColor: '#FF9933'
                }]
            },
            options: {
                ...commonOptions,
                indexAxis: 'y',
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...commonOptions.plugins.tooltip,
                        callbacks: {
                            label: context => 'Revenue: ₹' + context.parsed.x.toLocaleString()
                        }
                    }
                },
                scales: {
                    x: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                            callback: value => '₹' + value.toLocaleString()
                        }
                    },
                    y: { grid: { display: false } }
                }
            }
        });

        // === 4. CONTENT & STAFF ANALYTICS ===
        
        // Content Status Chart
        window.analyticsCharts.contentStatus = new Chart(document.getElementById('contentStatusChart'), {
            type: 'doughnut',
            data: {
                labels: ['Pending', 'Approved', 'Rejected'],
                datasets: [{
                    data: [data.contentStatus.pending, data.contentStatus.approved, data.contentStatus.rejected],
                    backgroundColor: ['#f39c12', '#2ecc71', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 10
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { position: 'bottom' }
                }
            }
        });

        // Staff Contribution Chart
        const staffLabels = data.staffContributions.map(s => s.staffName || 'Unknown');
        const staffData = data.staffContributions.map(s => s.contentCount);
        window.analyticsCharts.staffContribution = new Chart(document.getElementById('staffContributionChart'), {
            type: 'bar',
            data: {
                labels: staffLabels,
                datasets: [{
                    label: 'Content Created',
                    data: staffData,
                    backgroundColor: 'rgba(155, 89, 182, 0.8)',
                    borderColor: '#9b59b6',
                    borderWidth: 1,
                    borderRadius: 6,
                    hoverBackgroundColor: '#9b59b6'
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // Live Classes by Staff Chart
        const liveStaffLabels = data.liveClassesByStaff.map(s => s.staffName || 'Unknown');
        const liveStaffData = data.liveClassesByStaff.map(s => s.classCount);
        window.analyticsCharts.liveClassStaff = new Chart(document.getElementById('liveClassStaffChart'), {
            type: 'bar',
            data: {
                labels: liveStaffLabels,
                datasets: [{
                    label: 'Live Classes',
                    data: liveStaffData,
                    backgroundColor: 'rgba(52, 152, 219, 0.8)',
                    borderColor: '#3498db',
                    borderWidth: 1,
                    borderRadius: 6,
                    hoverBackgroundColor: '#3498db'
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // === 5. LIVE CLASS & ATTENDANCE ANALYTICS ===
        
        // Attendance Rate Chart
        const attendanceLabels = data.attendanceRate.map(a => new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const attendanceData = data.attendanceRate.map(a => a.attendanceRate);
        window.analyticsCharts.attendanceRate = new Chart(document.getElementById('attendanceRateChart'), {
            type: 'line',
            data: {
                labels: attendanceLabels,
                datasets: [{
                    label: 'Attendance %',
                    data: attendanceData,
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#2ecc71',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        max: 100,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                            callback: value => value + '%'
                        }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // === 6. STUDENT ENGAGEMENT ANALYTICS ===
        
        // Video Completion Chart
        const completionRanges = ['0-25%', '25-50%', '50-75%', '75-100%'];
        const completionCounts = data.videoCompletion.map(v => v.count || 0);
        window.analyticsCharts.videoCompletion = new Chart(document.getElementById('videoCompletionChart'), {
            type: 'bar',
            data: {
                labels: completionRanges,
                datasets: [{
                    label: 'Students',
                    data: completionCounts,
                    backgroundColor: [
                        'rgba(231, 76, 60, 0.8)',
                        'rgba(243, 156, 18, 0.8)',
                        'rgba(52, 152, 219, 0.8)',
                        'rgba(46, 204, 113, 0.8)'
                    ],
                    borderColor: ['#e74c3c', '#f39c12', '#3498db', '#2ecc71'],
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // Average Engagement KPI
        document.getElementById('avgEngagementKPI').textContent = `${data.avgEngagement.toFixed(1)}%`;

        // === 7. SUPPORT & FEEDBACK ANALYTICS ===
        
        // Support Requests Chart
        const supportLabels = data.supportRequests.map(s => new Date(s._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const supportData = data.supportRequests.map(s => s.count);
        window.analyticsCharts.supportRequests = new Chart(document.getElementById('supportRequestsChart'), {
            type: 'line',
            data: {
                labels: supportLabels,
                datasets: [{
                    label: 'Tickets',
                    data: supportData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#e74c3c',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // Ticket Status Chart
        window.analyticsCharts.ticketStatus = new Chart(document.getElementById('ticketStatusChart'), {
            type: 'doughnut',
            data: {
                labels: ['Open', 'Resolved', 'Closed'],
                datasets: [{
                    data: [data.ticketStatus.open, data.ticketStatus.resolved, data.ticketStatus.closed],
                    backgroundColor: ['#f39c12', '#2ecc71', '#95a5a6'],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 10
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { position: 'bottom' }
                }
            }
        });

        // === 8. SYSTEM HEALTH & SECURITY ===
        
        // Login Activity Chart
        const loginLabels = data.loginActivity.map(l => new Date(l._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const loginData = data.loginActivity.map(l => l.logins);
        window.analyticsCharts.loginActivity = new Chart(document.getElementById('loginActivityChart'), {
            type: 'line',
            data: {
                labels: loginLabels,
                datasets: [{
                    label: 'Logins',
                    data: loginData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });

        // Role Distribution Chart
        window.analyticsCharts.roleDistribution = new Chart(document.getElementById('roleDistributionChart'), {
            type: 'pie',
            data: {
                labels: ['Students', 'Staff', 'Admins'],
                datasets: [{
                    data: [data.roleDistribution.students, data.roleDistribution.staff, data.roleDistribution.admins],
                    backgroundColor: ['#3498db', '#9b59b6', '#e67e22'],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 10
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { position: 'bottom' }
                }
            }
        });

        UI.hideLoader();
        UI.success('Analytics loaded successfully');
    } catch (e) { 
        console.error('Analytics loading error:', e);
        UI.hideLoader();
        UI.error('Failed to load analytics data');
    }
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
                            <td style="padding:15px; text-align: center;">
                                <span style="background-color: ${statusColor.bg}; color: ${statusColor.text}; padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: inline-block; min-width: 80px;">
                                    ${displayStatus}
                                </span>
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

/* --- STEPPER WIZARD LOGIC --- */
let currentAdminStep = 1;

function changeAdminStep(n) {
    // Validation only when moving forward
    if (n === 1 && !validateAdminStep(currentAdminStep)) return;

    jumpAdminStep(currentAdminStep + n);
}

// Hybrid Navigation: Click on steps
function jumpAdminStep(n) {
    if (n < 1 || n > 5) return;

    // Free navigation as requested. 
    // Jumping between sections is allowed without immediate validation blocking.
    // Final validation happens at 'Save/Publish' time.

    currentAdminStep = n;
    updateAdminStepUI();
}

function updateAdminStepUI() {
    // 1. Show/Hide Steps
    for (let i = 1; i <= 5; i++) {
        const stepEl = document.getElementById(`adminCourseStep${i}`);
        if (stepEl) stepEl.style.display = (i === currentAdminStep) ? 'block' : 'none';
    }

    // 2. Update Header Indicators
    const stepLabels = ['Basic Info', 'Key Details', 'Media', 'Faculty', 'Finalize'];

    document.querySelectorAll('.step-indicator').forEach(el => {
        const step = parseInt(el.dataset.step);
        const labelText = stepLabels[step - 1] || step;

        if (step < currentAdminStep) {
            el.className = 'step-indicator completed';
            el.style.background = 'var(--color-success)';
            el.style.color = 'white';
            el.innerHTML = `<i class="fas fa-check"></i> ${labelText}`;
        } else if (step === currentAdminStep) {
            el.className = 'step-indicator active';
            el.style.background = 'var(--color-saffron)';
            el.style.color = 'white';
            el.innerHTML = labelText;
        } else {
            el.className = 'step-indicator';
            el.style.background = '#eee';
            el.style.color = '#999';
            el.innerHTML = labelText;
        }
    });

    // 3. Update Progress Bar
    const progress = ((currentAdminStep - 1) / 4) * 100; // 0%, 25%, 50%, 75%, 100%
    const bar = document.getElementById('adminStepProgress');
    if (bar) bar.style.width = `${progress}%`;

    // 4. Update Header Label
    const labels = ['Essential Details', 'Key Information', 'Media & Preview', 'Faculty Allocation', 'Finalize & Launch'];
    const labelEl = document.getElementById('stepLabel');
    if (labelEl) labelEl.innerText = labels[currentAdminStep - 1];

    // 5. Update Footer Buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const draftBtn = document.getElementById('draftBtn');
    const publishBtn = document.getElementById('publishBtn');

    if (prevBtn) prevBtn.style.visibility = (currentAdminStep === 1) ? 'hidden' : 'visible';

    if (currentAdminStep === 5) {
        if (nextBtn) nextBtn.style.display = 'none';
        if (draftBtn) draftBtn.style.display = 'none';
        if (publishBtn) publishBtn.style.display = 'none'; // Custom buttons in Step 5 body
    } else {
        if (nextBtn) {
            nextBtn.style.display = 'block';
            nextBtn.innerText = 'Next';
        }
        if (draftBtn) draftBtn.style.display = 'none';
        if (publishBtn) publishBtn.style.display = 'none';
    }
}

function validateAdminStep(step) {
    let isValid = true;
    let errorMsg = '';

    if (step === 1) {
        const title = document.getElementById('courseTitle').value;
        const category = document.getElementById('courseCategory').value;
        if (!title || !title.trim()) {
            isValid = false; errorMsg = 'Course Title is required.';
        } else if (!category || !category.trim()) {
            isValid = false; errorMsg = 'Category is required.';
        }
    }

    if (step === 2) {
        const desc = document.getElementById('courseDesc').value;
        const price = document.getElementById('coursePrice').value;
        const dur = document.getElementById('courseDuration').value;
        if (!desc || !desc.trim()) {
            isValid = false; errorMsg = 'Description is required.';
        } else if (!price) {
            isValid = false; errorMsg = 'Price is required.';
        } else if (!dur || !dur.trim()) {
            isValid = false; errorMsg = 'Duration is required.';
        }
    }

    if (!isValid) {
        UI.error(errorMsg);
    }
    return isValid;
}

async function openCourseModal(course = null) {
    const modal = document.getElementById('courseModal');
    const title = document.getElementById('courseModalTitle');

    // switchCourseTab('details', null, 0); // Reset to first tab
    currentAdminStep = 1;
    updateAdminStepUI();

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
        document.getElementById('courseIntroText').value = course.introText || '';
        document.getElementById('courseIntroVideoUrl').value = course.introVideoUrl || '';
        document.getElementById('courseIntroVideoUrl').value = course.introVideoUrl || '';
        document.getElementById('coursePreviewDuration').value = course.previewDuration || 60;

        // Populate Status
        if (document.getElementById('courseStatusInput')) {
            document.getElementById('courseStatusInput').value = course.approvalStatus || 'Draft';
        }

        // Populate Status
        if (document.getElementById('courseStatusInput')) {
            document.getElementById('courseStatusInput').value = course.approvalStatus || 'Draft';
        }

        // Show uploaded state if video exists
        if (course.introVideoUrl) {
            const previewCont = document.getElementById('adminVideoPreviewContainer');
            if (previewCont) previewCont.style.display = 'block';
            document.getElementById('adminDropzoneContent').style.display = 'none';
            document.getElementById('adminVideoLink').href = course.introVideoUrl;
        } else {
            const previewCont = document.getElementById('adminVideoPreviewContainer');
            if (previewCont) previewCont.style.display = 'none';
            document.getElementById('adminDropzoneContent').style.display = 'block';
        }
    } else {
        title.innerText = 'Add New Course';
        document.getElementById('courseForm').reset();
        document.getElementById('courseId').value = '';
        // Uncheck all
        document.querySelectorAll('input[name="mentorId"]').forEach(cb => cb.checked = false);
        document.getElementById('courseIntroText').value = '';
        document.getElementById('courseIntroVideoUrl').value = '';
        document.getElementById('courseIntroVideoUrl').value = '';
        document.getElementById('coursePreviewDuration').value = 60;

        if (document.getElementById('courseStatusInput')) {
            document.getElementById('courseStatusInput').value = 'Draft';
        }
        document.getElementById('adminVideoPreview').style.display = 'none';
        document.getElementById('adminDropzoneContent').style.display = 'block';
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

async function saveCourse(e, statusArg) {
    if (e) e.preventDefault();
    const id = document.getElementById('courseId').value;

    // Status preference: Argument (Button) > Dropdown > Default
    const statusInput = document.getElementById('courseStatusInput');
    const status = statusArg || (statusInput ? statusInput.value : 'Draft');

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
        currentAdminStep = 4;
        updateAdminStepUI();
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
        introText: document.getElementById('courseIntroText').value,
        introVideoUrl: document.getElementById('courseIntroVideoUrl').value,
        previewDuration: document.getElementById('coursePreviewDuration').value,
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

// --- SUBSCRIBERS MANAGEMENT ---

async function loadSubscribers() {
    try {
        UI.showLoader();
        const filterStatus = document.getElementById('subscriberFilterStatus')?.value || '';

        const res = await fetch(`${Auth.apiBase}/subscribers/all`, {
            headers: Auth.getHeaders()
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Failed to load subscribers');
        }

        let subscribers = data.data.subscribers;

        // Filter by status
        if (filterStatus === 'pending') {
            subscribers = subscribers.filter(s => !s.notified);
        } else if (filterStatus === 'notified') {
            subscribers = subscribers.filter(s => s.notified);
        }

        // Load stats
        loadSubscriberStats();

        const tbody = document.getElementById('subscribersTableBody');

        if (subscribers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #999;">
                        <i class="fas fa-bell-slash" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                        No subscribers found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = subscribers.map(sub => {
            const subscribedDate = new Date(sub.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });

            const notifiedDate = sub.notifiedAt
                ? new Date(sub.notifiedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                })
                : '-';

            const statusBadge = sub.notified
                ? '<span style="background: var(--color-success); color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem;"><i class="fas fa-check"></i> Notified</span>'
                : '<span style="background: #F59E0B; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem;"><i class="fas fa-clock"></i> Pending</span>';

            const courseTitle = sub.courseID?.title || 'Unknown Course';
            const courseStatus = sub.courseID?.status || '-';

            return `
                <tr>
                    <td>${sub.name}</td>
                    <td><a href="mailto:${sub.email}" style="color: var(--color-primary); text-decoration: none;">${sub.email}</a></td>
                    <td><a href="tel:${sub.phone}" style="color: #666; text-decoration: none;">${sub.phone}</a></td>
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <strong>${courseTitle}</strong>
                            <span style="font-size: 0.8rem; color: #999;">${courseStatus}</span>
                        </div>
                    </td>
                    <td>${statusBadge}</td>
                    <td>${subscribedDate}</td>
                    <td>${notifiedDate}</td>
                    <td>
                        <button onclick="deleteSubscriber('${sub._id}')" class="btn-icon-danger" title="Delete" style="background: none; border: none; color: var(--color-error); cursor: pointer; padding: 5px 10px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading subscribers:', err);
        UI.error('Failed to load subscribers');
        document.getElementById('subscribersTableBody').innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: var(--color-error);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                    Failed to load subscribers. Please try again.
                </td>
            </tr>
        `;
    } finally {
        UI.hideLoader();
    }
}

async function loadSubscriberStats() {
    try {
        const res = await fetch(`${Auth.apiBase}/subscribers/stats`, {
            headers: Auth.getHeaders()
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('totalSubscribersCount').textContent = data.data.totalSubscribers || 0;
            document.getElementById('pendingSubscribersCount').textContent = data.data.pendingCount || 0;
            document.getElementById('notifiedSubscribersCount').textContent = data.data.notifiedCount || 0;
        }
    } catch (err) {
        console.error('Error loading subscriber stats:', err);
    }
}

async function deleteSubscriber(subscriberId) {
    if (!confirm('Are you sure you want to delete this subscriber? This action cannot be undone.')) {
        return;
    }

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/subscribers/${subscriberId}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });

        const data = await res.json();

        if (res.ok) {
            UI.success('Subscriber deleted successfully');
            loadSubscribers(); // Reload the list
        } else {
            UI.error(data.message || 'Failed to delete subscriber');
        }
    } catch (err) {
        console.error('Error deleting subscriber:', err);
        UI.error('Failed to delete subscriber');
    } finally {
        UI.hideLoader();
    }
}

window.loadSubscribers = loadSubscribers;
window.deleteSubscriber = deleteSubscriber;

/* ========================================
   GALLERY MANAGEMENT
======================================== */

let selectedGalleryFile = null;
let allGalleryImages = [];

function initGallerySection() {
    loadGalleryImages();
    setupGalleryUploadHandlers();
}

// Open upload modal
function openGalleryUploadModal() {
    document.getElementById('galleryUploadModal').style.display = 'flex';
    resetGalleryForm();
}

// Close upload modal
function closeGalleryUploadModal() {
    document.getElementById('galleryUploadModal').style.display = 'none';
    resetGalleryForm();
}

// Reset form
function resetGalleryForm() {
    selectedGalleryFile = null;
    document.getElementById('galleryUploadForm').reset();
    document.getElementById('galleryDescription').value = '';
    document.getElementById('galleryCharCount').textContent = '0 / 100 characters';
    document.getElementById('galleryImagePreview').style.display = 'none';
    document.getElementById('galleryDropZone').style.display = 'block';
    document.getElementById('galleryImageInput').value = '';
    updateGalleryUploadButton();
}

// Remove preview
function removeGalleryPreview() {
    selectedGalleryFile = null;
    document.getElementById('galleryImageInput').value = '';
    document.getElementById('galleryImagePreview').style.display = 'none';
    document.getElementById('galleryDropZone').style.display = 'block';
    updateGalleryUploadButton();
}

// Setup upload handlers
function setupGalleryUploadHandlers() {
    const dropZone = document.getElementById('galleryDropZone');
    const fileInput = document.getElementById('galleryImageInput');
    const form = document.getElementById('galleryUploadForm');
    const descriptionInput = document.getElementById('galleryDescription');
    const charCount = document.getElementById('galleryCharCount');

    if (!dropZone || !fileInput || !form || !descriptionInput || !charCount) {
        console.warn('Gallery upload elements not found');
        return;
    }

    // Drag and drop handlers
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--color-golden)';
        dropZone.style.background = 'rgba(199, 151, 47, 0.15)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(199, 151, 47, 0.3)';
        dropZone.style.background = 'rgba(199, 151, 47, 0.05)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(199, 151, 47, 0.3)';
        dropZone.style.background = 'rgba(199, 151, 47, 0.05)';
        
        if (e.dataTransfer.files.length > 0) {
            handleGalleryFileSelect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleGalleryFileSelect(e.target.files[0]);
        }
    });

    // Description character count
    descriptionInput.addEventListener('input', () => {
        const length = descriptionInput.value.length;
        charCount.textContent = `${length} / 100 characters`;
        charCount.style.color = length >= 10 && length <= 100 ? '#10b981' : length > 100 ? '#e74c3c' : '#666';
        updateGalleryUploadButton();
    });

    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        uploadGalleryImage();
    });
}

function handleGalleryFileSelect(file) {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        UI.error('Only JPEG, JPG, and PNG images are allowed');
        return;
    }

    // Validate file size (10KB - 500KB)
    const minSize = 10 * 1024; // 10KB
    const maxSize = 500 * 1024; // 500KB

    if (file.size < minSize) {
        UI.error(`Image too small. Minimum size is 10KB. Your image is ${(file.size / 1024).toFixed(2)}KB`);
        return;
    }

    if (file.size > maxSize) {
        UI.error(`Image too large. Maximum size is 500KB. Your image is ${(file.size / 1024).toFixed(2)}KB`);
        return;
    }

    selectedGalleryFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('galleryPreviewImg').src = e.target.result;
        document.getElementById('galleryFileSizeInfo').textContent = `File size: ${(file.size / 1024).toFixed(2)}KB`;
        document.getElementById('galleryImagePreview').style.display = 'block';
        document.getElementById('galleryDropZone').style.display = 'none';
        updateGalleryUploadButton();
    };
    reader.readAsDataURL(file);
}

function updateGalleryUploadButton() {
    const btn = document.getElementById('galleryUploadBtn');
    const description = document.getElementById('galleryDescription').value;
    const isValid = selectedGalleryFile && description.length >= 10 && description.length <= 100;
    btn.disabled = !isValid;
    btn.style.opacity = isValid ? '1' : '0.5';
    btn.style.cursor = isValid ? 'pointer' : 'not-allowed';
}

// Search gallery images
function searchGalleryImages() {
    const searchTerm = document.getElementById('gallerySearchInput').value.toLowerCase();
    const filteredImages = allGalleryImages.filter(img => 
        img.description.toLowerCase().includes(searchTerm)
    );
    displayGalleryImages(filteredImages);
}

// Filter gallery images
function filterGalleryImages() {
    const filter = document.getElementById('galleryFilterSelect').value;
    let filteredImages = [...allGalleryImages];
    
    if (filter === 'recent') {
        filteredImages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (filter === 'popular') {
        filteredImages.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    
    displayGalleryImages(filteredImages);
}

async function uploadGalleryImage() {
    if (!selectedGalleryFile) {
        UI.error('Please select an image');
        return;
    }

    const description = document.getElementById('galleryDescription').value.trim();
    if (description.length < 10 || description.length > 100) {
        UI.error('Description must be between 10 and 100 characters');
        return;
    }

    const formData = new FormData();
    formData.append('image', selectedGalleryFile);
    formData.append('description', description);

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/gallery/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            UI.success('✓ Image uploaded successfully!');
            closeGalleryUploadModal();
            loadGalleryImages();
            
            // Show success confirmation
            setTimeout(() => {
                UI.success('Your image is now live in the gallery!');
            }, 500);
        } else {
            UI.error(data.message || 'Failed to upload image');
        }
    } catch (err) {
        console.error('Error uploading image:', err);
        UI.error('Failed to upload image');
    } finally {
        UI.hideLoader();
    }
}

async function loadGalleryImages() {
    const loadingState = document.getElementById('galleryLoadingState');
    const emptyState = document.getElementById('galleryEmptyState');

    try {
        loadingState.style.display = 'block';
        emptyState.style.display = 'none';

        const res = await fetch(`${Auth.apiBase}/gallery/images?active=true&limit=100`, {
            headers: Auth.getHeaders()
        });

        const data = await res.json();

        loadingState.style.display = 'none';

        if (res.ok && data.images && data.images.length > 0) {
            allGalleryImages = data.images;
            displayGalleryImages(allGalleryImages);
        } else {
            allGalleryImages = [];
            emptyState.style.display = 'block';
        }
    } catch (err) {
        console.error('Error loading gallery images:', err);
        loadingState.style.display = 'none';
        UI.error('Failed to load gallery images');
    }
}

function displayGalleryImages(images) {
    const grid = document.getElementById('galleryImagesGrid');
    const emptyState = document.getElementById('galleryEmptyState');

    if (images.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    
    grid.innerHTML = images.map(img => `
        <div class="gallery-card" draggable="true" data-id="${img._id}" style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.08); transition: all 0.3s; position: relative; cursor: move;">
            <!-- Drag Handle -->
            <div class="drag-handle" style="position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.6); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 50; cursor: grab;">
                <i class="fas fa-grip-vertical"></i>
            </div>
            
            <!-- Image Container -->
            <div style="position: relative; height: 220px; overflow: hidden; background: #f8f8f8;">
                <img src="/${img.imageUrl}" alt="${img.description}" 
                     style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;" 
                     onerror="this.src='https://via.placeholder.com/400x220?text=Image+Error'" />
                
                <!-- 3-Dot Menu -->
                <div class="gallery-menu" style="position: absolute; top: 12px; right: 12px;">
                    <button onclick="toggleGalleryMenu(event, '${img._id}')" 
                            style="background: rgba(255,255,255,0.95); border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                            onmouseover="this.style.background='white'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)'"
                            onmouseout="this.style.background='rgba(255,255,255,0.95)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'">
                        <i class="fas fa-ellipsis-v" style="color: #555;"></i>
                    </button>
                    <div id="menu-${img._id}" class="gallery-dropdown" 
                         style="display: none; position: absolute; top: 42px; right: 0; background: white; border-radius: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.15); overflow: hidden; min-width: 140px; z-index: 100;">
                        <button onclick="editGalleryImage('${img._id}', '${img.description.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" 
                                style="width: 100%; padding: 12px 18px; border: none; background: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: #333; font-size: 0.9rem; transition: background 0.2s;"
                                onmouseover="this.style.background='#f5f5f5'"
                                onmouseout="this.style.background='none'">
                            <i class="fas fa-edit" style="color: #4a90e2; width: 16px;"></i>
                            Edit
                        </button>
                        <button onclick="deleteGalleryImage('${img._id}')" 
                                style="width: 100%; padding: 12px 18px; border: none; background: none; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px; color: #e74c3c; font-size: 0.9rem; transition: background 0.2s;"
                                onmouseover="this.style.background='#fff5f5'"
                                onmouseout="this.style.background='none'">
                            <i class="fas fa-trash" style="width: 16px;"></i>
                            Delete
                        </button>
                    </div>
                </div>
                
                <!-- Heart Icon with Like Count -->
                <div style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.75); color: white; padding: 8px 14px; border-radius: 20px; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-heart" style="color: #ff6b6b;"></i>
                    <span>${img.likes || 0}</span>
                </div>
            </div>
            
            <!-- Card Content -->
            <div style="padding: 18px 20px;">
                <p style="margin: 0; color: #333; font-size: 0.95rem; line-height: 1.6; min-height: 48px; overflow: hidden; text-overflow: ellipsis;">${img.description}</p>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                    <small style="color: #999; font-size: 0.85rem;">
                        <i class="fas fa-clock"></i> ${new Date(img.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </small>
                    <small style="color: #666; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-user" style="color: var(--color-golden);"></i> ${img.uploadedBy?.name || 'Unknown'}
                    </small>
                </div>
            </div>
        </div>
    `).join('');

    // Add hover effect and drag & drop handlers
    const cards = document.querySelectorAll('.gallery-card');
    let draggedElement = null;
    
    cards.forEach(card => {
        // Hover effects
        card.addEventListener('mouseenter', function() {
            if (!this.classList.contains('dragging')) {
                this.style.transform = 'translateY(-8px)';
                this.style.boxShadow = '0 12px 35px rgba(0,0,0,0.15)';
            }
        });
        card.addEventListener('mouseleave', function() {
            if (!this.classList.contains('dragging')) {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 5px 20px rgba(0,0,0,0.08)';
            }
        });

        // Drag & Drop events
        card.addEventListener('dragstart', function(e) {
            draggedElement = this;
            this.classList.add('dragging');
            this.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        });

        card.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            this.style.opacity = '1';
            this.style.transform = 'translateY(0)';
            draggedElement = null;
            
            // Show save button
            document.getElementById('galleryDragInfo').style.display = 'flex';
        });

        card.addEventListener('dragover', function(e) {
            e.preventDefault();
            if (draggedElement && draggedElement !== this) {
                const rect = this.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                
                if (e.clientX < midpoint) {
                    this.parentNode.insertBefore(draggedElement, this);
                } else {
                    this.parentNode.insertBefore(draggedElement, this.nextSibling);
                }
            }
        });

        card.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
    });
}

// Toggle 3-dot menu
function toggleGalleryMenu(event, imageId) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${imageId}`);
    const isVisible = menu.style.display === 'block';
    
    // Close all menus
    document.querySelectorAll('.gallery-dropdown').forEach(m => m.style.display = 'none');
    
    // Toggle current menu
    menu.style.display = isVisible ? 'none' : 'block';
}

// Close menus when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.gallery-dropdown').forEach(m => m.style.display = 'none');
});

async function editGalleryImage(imageId, currentDescription) {
    const newDescription = prompt('Enter new description (10-100 characters):', currentDescription);
    
    if (newDescription === null) return; // Cancelled
    
    if (newDescription.trim().length < 10 || newDescription.trim().length > 100) {
        UI.error('Description must be between 10 and 100 characters');
        return;
    }

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/gallery/image/${imageId}/description`, {
            method: 'PUT',
            headers: {
                ...Auth.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ description: newDescription.trim() })
        });

        const data = await res.json();

        if (res.ok) {
            UI.success('Description updated successfully');
            loadGalleryImages();
        } else {
            UI.error(data.message || 'Failed to update description');
        }
    } catch (err) {
        console.error('Error updating description:', err);
        UI.error('Failed to update description');
    } finally {
        UI.hideLoader();
    }
}

async function deleteGalleryImage(imageId) {
    if (!confirm('Are you sure you want to permanently delete this image? This action cannot be undone.')) {
        return;
    }

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/gallery/image/${imageId}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });

        const data = await res.json();

        if (res.ok) {
            UI.success('Image deleted successfully');
            loadGalleryImages();
        } else {
            UI.error(data.message || 'Failed to delete image');
        }
    } catch (err) {
        console.error('Error deleting image:', err);
        UI.error('Failed to delete image');
    } finally {
        UI.hideLoader();
    }
}

// Save Gallery Order
async function saveGalleryOrder() {
    const cards = document.querySelectorAll('.gallery-card');
    const orderedIds = Array.from(cards).map(card => card.getAttribute('data-id'));

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/gallery/update-order`, {
            method: 'PUT',
            headers: {
                ...Auth.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orderedIds })
        });

        const data = await res.json();

        if (res.ok) {
            UI.success('Gallery order saved successfully!');
            document.getElementById('galleryDragInfo').style.display = 'none';
            loadGalleryImages();
        } else {
            UI.error(data.message || 'Failed to save order');
        }
    } catch (err) {
        console.error('Error saving gallery order:', err);
        UI.error('Failed to save gallery order');
    } finally {
        UI.hideLoader();
    }
}

// Expose functions globally
window.initGallerySection = initGallerySection;
window.loadGalleryImages = loadGalleryImages;
window.editGalleryImage = editGalleryImage;
window.deleteGalleryImage = deleteGalleryImage;
window.openGalleryUploadModal = openGalleryUploadModal;
window.closeGalleryUploadModal = closeGalleryUploadModal;
window.removeGalleryPreview = removeGalleryPreview;
window.searchGalleryImages = searchGalleryImages;
window.filterGalleryImages = filterGalleryImages;
window.toggleGalleryMenu = toggleGalleryMenu;
window.saveGalleryOrder = saveGalleryOrder;

// End of admin.js - All functions properly defined
