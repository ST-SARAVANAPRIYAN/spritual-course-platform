/**
 * Interactive Course Preview Logic
 * Sidebar navigation + Admin Actions
 */

let courseId = null;
let currentModuleId = null;
let courseData = null;
let modulesData = [];
let assessmentsData = [];
let currentUser = null;
let currentExamId = null;
let currentExamData = null;

document.addEventListener('DOMContentLoaded', async () => {
    const authData = Auth.checkAuth(['Admin', 'Staff']);
    if (!authData) return;
    currentUser = authData.user;

    // Initialize user profile in header
    if (currentUser) {
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl && userAvatarEl) {
            userNameEl.textContent = currentUser.firstName || currentUser.name || currentUser.email || 'User';
            const initials = (currentUser.firstName || currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase();
            userAvatarEl.textContent = initials;
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    courseId = urlParams.get('id');
    const requestedModuleId = urlParams.get('moduleId'); // Deep link
    const requestedExamId = urlParams.get('examId'); // Exam review

    if (!courseId) {
        UI.error('No course specified');
        return;
    }

    setupNavigation();
    await loadCourseData();

    // Handle exam review if examId is provided
    if (requestedExamId) {
        currentExamId = requestedExamId;
        await loadAndDisplayExam(requestedExamId);
    }
    // Auto-select module if requested, otherwise first one
    else if (requestedModuleId) {
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
        const [courseRes, modulesRes, assessmentsRes] = await Promise.all([
            fetch(`${Auth.apiBase}/courses/${courseId}`, { headers: Auth.getHeaders() }),
            fetch(`${Auth.apiBase}/courses/${courseId}/modules?includeUnpublished=true`, { headers: Auth.getHeaders() }),
            fetch(`${Auth.apiBase}/exams/course/${courseId}`, { headers: Auth.getHeaders() })
        ]);

        if (!courseRes.ok) throw new Error('Failed to load course');

        const cData = await courseRes.json();
        const mData = await modulesRes.json();
        const aData = await assessmentsRes.json();

        courseData = cData.course;
        // Ensure modules logic works even if modules are empty or undefined
        modulesData = mData.modules || [];
        assessmentsData = aData || [];

        console.log('[ASSESSMENTS] Loaded', assessmentsData.length, 'assessments for course');

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
            // Already Published - No action button needed, status badge shows it
            btnHtml = '';
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
                    <i class="fas fa-check"></i> Approve Course
                 </button>
            `;
        }
        actionContainer.innerHTML = btnHtml;
    }
}

function renderSidebar() {
    const list = document.getElementById('moduleList');
    const totalItems = modulesData.length + assessmentsData.length;
    document.getElementById('progressText').textContent = `${modulesData.length} module${modulesData.length !== 1 ? 's' : ''} • ${assessmentsData.length} assessment${assessmentsData.length !== 1 ? 's' : ''}`;

    // Render modules
    let modulesHtml = modulesData.map((m, index) => {
        let statusColor = '#ccc';
        if (m.status === 'Pending') statusColor = '#ffc107';
        if (m.status === 'Approved') statusColor = '#17a2b8'; // Upcoming
        if (m.status === 'Published') statusColor = '#28a745'; // Live
        if (m.status === 'Rejected') statusColor = '#dc3545';

        // Use m.status properly
        const displayStatus = m.status || 'Draft';
        const role = (currentUser.role || '').toLowerCase();
        
        // Build action menu for admin
        let actionMenu = '';
        if (role === 'admin') {
            let menuItems = '';
            if (displayStatus === 'Approved') {
                // Already approved - only show delete
                menuItems = `
                    <div class="assessment-dropdown-item reject" onclick="event.stopPropagation(); deleteModuleFromMenu('${m._id}'); closeAssessmentMenu();">
                        <i class="fas fa-trash"></i> Delete Module
                    </div>
                `;
            } else {
                // Pending/Draft - show approve and delete
                menuItems = `
                    <div class="assessment-dropdown-item approve" onclick="event.stopPropagation(); approveModuleFromMenu('${m._id}'); closeAssessmentMenu();">
                        <i class="fas fa-check"></i> Approve Module
                    </div>
                    <div class="assessment-dropdown-item reject" onclick="event.stopPropagation(); deleteModuleFromMenu('${m._id}'); closeAssessmentMenu();">
                        <i class="fas fa-trash"></i> Delete Module
                    </div>
                `;
            }
            
            actionMenu = `
                <div style="position: relative;">
                    <button class="assessment-menu-btn" onclick="event.stopPropagation(); toggleAssessmentMenu(event, 'mod-${m._id}');" title="Actions">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="assessment-dropdown" id="menu-mod-${m._id}">
                        ${menuItems}
                    </div>
                </div>
            `;
        }

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
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${displayStatus === 'Approved' ? '<i class="fas fa-check" style="color:#17a2b8; font-size:0.8rem;"></i>' : '<i class="fas fa-eye-slash" style="color:#ccc; font-size:0.8rem;"></i>'}
                    ${actionMenu}
                </div>
            </li>
        `;
    }).join('');

    // Render assessments section
    let assessmentsHtml = '';
    if (assessmentsData.length > 0) {
        assessmentsHtml = `
            <li style="padding: 15px 10px 8px; border-top: 1px solid #e9ecef; margin-top: 15px; background: #f8f9fa;">
                <div style="font-weight: 600; font-size: 0.85rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fas fa-clipboard-check" style="margin-right: 8px; color: var(--color-golden);"></i>Assessments
                </div>
            </li>
        ` + assessmentsData.map((exam, index) => {
            let statusColor = '#ccc';
            if (exam.approvalStatus === 'Pending') statusColor = '#ffc107';
            if (exam.approvalStatus === 'Approved') statusColor = '#28a745';
            if (exam.approvalStatus === 'Rejected') statusColor = '#dc3545';

            const displayStatus = exam.approvalStatus || 'Draft';
            const role = (currentUser.role || '').toLowerCase();
            
            // Build action menu for admin
            let actionMenu = '';
            if (role === 'admin') {
                let menuItems = '';
                if (displayStatus === 'Pending') {
                    menuItems = `
                        <div class="assessment-dropdown-item approve" onclick="event.stopPropagation(); approveAssessment('${exam._id}'); closeAssessmentMenu();">
                            <i class="fas fa-check"></i> Approve
                        </div>
                        <div class="assessment-dropdown-item reject" onclick="event.stopPropagation(); rejectAssessment('${exam._id}'); closeAssessmentMenu();">
                            <i class="fas fa-times"></i> Reject
                        </div>
                    `;
                } else if (displayStatus === 'Approved') {
                    menuItems = `
                        <div class="assessment-dropdown-item reject" onclick="event.stopPropagation(); rejectAssessment('${exam._id}'); closeAssessmentMenu();">
                            <i class="fas fa-ban"></i> Revoke Approval
                        </div>
                    `;
                } else if (displayStatus === 'Rejected') {
                    menuItems = `
                        <div class="assessment-dropdown-item approve" onclick="event.stopPropagation(); approveAssessment('${exam._id}'); closeAssessmentMenu();">
                            <i class="fas fa-check"></i> Approve
                        </div>
                    `;
                }
                
                actionMenu = `
                    <div style="position: relative;">
                        <button class="assessment-menu-btn" onclick="event.stopPropagation(); toggleAssessmentMenu(event, '${exam._id}');" title="Actions">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="assessment-dropdown" id="menu-${exam._id}">
                            ${menuItems}
                        </div>
                    </div>
                `;
            }

            return `
                <li class="module-item assessment-item" id="nav-exam-${exam._id}" onclick="selectAssessment('${exam._id}')" style="border-left: 3px solid var(--color-golden);">
                    <div class="module-icon" style="background: linear-gradient(135deg, var(--color-saffron), var(--color-golden));">
                        <i class="fas fa-clipboard-check" style="font-size: 0.9rem;"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:500; font-size:0.95rem; color:#333;">${exam.title}</div>
                        <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:#888; margin-top:2px;">
                            <span style="width:8px; height:8px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
                            ${displayStatus} • ${exam.questions?.length || 0} Questions
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${displayStatus === 'Approved' ? '<i class="fas fa-check-circle" style="color:#28a745; font-size:0.9rem;"></i>' : displayStatus === 'Rejected' ? '<i class="fas fa-times-circle" style="color:#dc3545; font-size:0.9rem;"></i>' : '<i class="fas fa-clock" style="color:#ffc107; font-size:0.9rem;"></i>'}
                        ${actionMenu}
                    </div>
                </li>
            `;
        }).join('');
    }

    list.innerHTML = modulesHtml + assessmentsHtml;
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

    // Render content based on content type
    renderModuleContent(module);

    // Hide action panel for modules (actions are now in sidebar menu)
    const actionPanel = document.getElementById('moduleActionPanel');
    const rejectionAlert = document.getElementById('rejectionAlert');
    if (rejectionAlert) rejectionAlert.style.display = 'none';
    actionPanel.style.display = 'none';
}

/**
 * Select and display an assessment
 */
function selectAssessment(examId) {
    currentExamId = examId;
    currentModuleId = null; // Clear module selection
    const exam = assessmentsData.find(e => e._id === examId);
    if (!exam) return;

    // UI Updates
    document.querySelectorAll('.module-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(`nav-exam-${examId}`);
    if (activeEl) activeEl.classList.add('active');

    // Load and display the exam
    loadAndDisplayExam(examId);
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

/**
 * Render module content based on content type
 */
async function renderModuleContent(module) {
    const container = document.getElementById('moduleBody');
    const contentType = module.contentType || 'rich-content';

    if (contentType === 'rich-content') {
        // Display rich HTML content with fixed URLs
        const fixedContent = UI.fixContentUrls(module.content);
        container.innerHTML = fixedContent || '<p>No content.</p>';
    } else if (contentType === 'video') {
        // Display actual video player for admin/staff preview
        if (module.fileUrl && module.fileMetadata) {
            container.innerHTML = `
                <div style="background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
                    <div id="videoPlayerContainer" style="position: relative;">
                        <div style="padding: 40px; text-align: center; color: white;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
                            <p>Loading video...</p>
                        </div>
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px;">
                    <strong>File:</strong> ${module.fileMetadata.originalName} 
                    <span style="color: #6c757d; margin-left: 10px;">(${formatFileSize(module.fileMetadata.fileSize)})</span>
                </div>
            `;

            // Fetch and display video
            try {
                const response = await fetch(`${Auth.apiBase}/secure-files/${module._id}`, {
                    headers: Auth.getHeaders()
                });

                if (!response.ok) throw new Error('Failed to load video');

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                const videoContainer = document.getElementById('videoPlayerContainer');
                videoContainer.innerHTML = `
                    <video controls controlsList="nodownload" style="width: 100%; max-height: 500px; display: block;">
                        <source src="${blobUrl}" type="${module.fileMetadata.mimeType}">
                        Your browser does not support the video tag.
                    </video>
                `;
            } catch (error) {
                console.error('Error loading video:', error);
                const videoContainer = document.getElementById('videoPlayerContainer');
                videoContainer.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #dc3545;">
                        <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <p>Failed to load video: ${error.message}</p>
                    </div>
                `;
            }
        } else {
            container.innerHTML = '<p style="color: #dc3545;">Video file not found.</p>';
        }
    } else if (contentType === 'pdf') {
        // Display PDF viewer for admin/staff preview
        if (module.fileUrl && module.fileMetadata) {
            container.innerHTML = `
                <div id="pdfViewerContainer" style="background: #f0f0f0; border-radius: 8px; padding: 20px; min-height: 400px;">
                    <div style="text-align: center; padding: 40px;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #6c757d;"></i>
                        <p style="color: #6c757d;">Loading PDF...</p>
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px;">
                    <strong>File:</strong> ${module.fileMetadata.originalName} 
                    <span style="color: #6c757d; margin-left: 10px;">(${formatFileSize(module.fileMetadata.fileSize)})</span>
                </div>
            `;

            // Fetch and display PDF using iframe
            try {
                const response = await fetch(`${Auth.apiBase}/secure-files/${module._id}`, {
                    headers: Auth.getHeaders()
                });

                if (!response.ok) throw new Error('Failed to load PDF');

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);

                const pdfContainer = document.getElementById('pdfViewerContainer');
                pdfContainer.innerHTML = `
                    <iframe src="${blobUrl}" style="width: 100%; height: 600px; border: none; border-radius: 8px;"></iframe>
                `;
            } catch (error) {
                console.error('Error loading PDF:', error);
                const pdfContainer = document.getElementById('pdfViewerContainer');
                pdfContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #dc3545;">
                        <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <p>Failed to load PDF: ${error.message}</p>
                    </div>
                `;
            }
        } else {
            container.innerHTML = '<p style="color: #dc3545;">PDF file not found.</p>';
        }
    }
}

/**
 * Format file size helper
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Assessment Review Functions
 */
async function loadAndDisplayExam(examId) {
    try {
        UI.showLoader();
        
        console.log('[EXAM LOAD] Attempting to load exam:', examId);
        console.log('[EXAM LOAD] API Base:', Auth.apiBase);
        
        const res = await fetch(`${Auth.apiBase}/exams/${examId}`, {
            headers: Auth.getHeaders()
        });
        
        console.log('[EXAM LOAD] Response status:', res.status);
        
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error(`Assessment not found (ID: ${examId}). It may have been removed or doesn't exist.`);
            } else if (res.status === 403) {
                throw new Error('You do not have permission to view this assessment.');
            } else {
                throw new Error(`Failed to load assessment: ${res.statusText}`);
            }
        }
        
        const exam = await res.json();
        console.log('[EXAM LOAD] Successfully loaded exam:', exam.title);
        currentExamData = exam;
        
        // Only hide sidebar if coming from external link (no assessments loaded yet)
        if (assessmentsData.length === 0) {
            document.querySelector('.sidebar').style.display = 'none';
            document.querySelector('.content-area').style.width = '100%';
        }
        
        // Hide action panel for assessments (actions are now in sidebar menu)
        const actionPanel = document.getElementById('moduleActionPanel');
        actionPanel.style.display = 'none';
        
        // Display exam details
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('contentDisplay').style.display = 'block';
        
        document.getElementById('moduleTitle').textContent = exam.title;
        document.getElementById('moduleAuthor').textContent = exam.createdBy?.name || 'Staff Member';
        document.getElementById('moduleDate').textContent = new Date(exam.createdAt).toLocaleDateString();
        
        const statusBadge = document.getElementById('moduleStatusBadge');
        statusBadge.textContent = exam.approvalStatus;
        statusBadge.className = `status-badge status-${exam.approvalStatus}`;
        
        // Show rejection reason if rejected
        if (exam.approvalStatus === 'Rejected' && exam.rejectionReason) {
            document.getElementById('rejectionAlert').style.display = 'block';
            document.getElementById('rejectionReasonText').textContent = exam.rejectionReason;
        } else {
            document.getElementById('rejectionAlert').style.display = 'none';
        }
        
        // Render exam content
        const moduleBody = document.getElementById('moduleBody');
        moduleBody.innerHTML = `
            <div style="margin-bottom: 30px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid var(--color-saffron);">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 8px;">Total Questions</div>
                        <div style="font-size: 2.5rem; font-weight: bold; color: var(--color-saffron);">${exam.questions.length}</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid #17a2b8;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 8px;">Duration</div>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #17a2b8;">${exam.duration} <span style="font-size: 1rem;">min</span></div>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid #28a745;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 8px;">Passing Score</div>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #28a745;">${exam.passingScore}<span style="font-size: 1rem;">%</span></div>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid #6c757d;">
                        <div style="font-size: 0.85rem; color: #666; margin-bottom: 8px;">Activation Threshold</div>
                        <div style="font-size: 2.5rem; font-weight: bold; color: #6c757d;">${exam.activationThreshold}<span style="font-size: 1rem;">%</span></div>
                    </div>
                </div>
                
                <h3 style="color: var(--color-saffron); margin: 30px 0 20px 0; padding-bottom: 10px; border-bottom: 3px solid var(--color-saffron);">
                    <i class="fas fa-list-ol"></i> Assessment Questions
                </h3>
                
                ${exam.questions.map((q, index) => `
                    <div style="background: white; border: 2px solid #e0e0e0; border-radius: 12px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-weight: 600; margin-bottom: 15px; color: #333; font-size: 1.1rem; display: flex; align-items: start; gap: 12px;">
                            <span style="background: linear-gradient(135deg, var(--color-saffron) 0%, var(--color-golden) 100%); color: white; padding: 8px 14px; border-radius: 8px; font-size: 1rem; font-weight: bold; flex-shrink: 0;">
                                Q${index + 1}
                            </span>
                            <span style="flex: 1;">${q.questionText}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-left: 45px;">
                            ${q.options.map((opt, i) => {
                                const isCorrect = q.correctOptionIndices.includes(i);
                                return `
                                    <div style="display: flex; align-items: center; gap: 12px; padding: 14px; background: ${isCorrect ? 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)' : '#f8f9fa'}; border-radius: 8px; ${isCorrect ? 'border: 2px solid #28a745; box-shadow: 0 2px 6px rgba(40, 167, 69, 0.2);' : 'border: 1px solid #e0e0e0;'}">
                                        <span style="background: ${isCorrect ? '#28a745' : '#6c757d'}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 0.95rem;">
                                            ${String.fromCharCode(65 + i)}
                                        </span>
                                        <span style="flex: 1; font-size: 0.95rem;">${opt}</span>
                                        ${isCorrect ? '<i class="fas fa-check-circle" style="color: #28a745; font-size: 1.3rem;"></i>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (err) {
        console.error('Error loading assessment:', err);
        
        // Show user-friendly error message
        const errorContainer = document.getElementById('contentDisplay');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="glass-card" style="text-align: center; padding: 40px; color: var(--color-error);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px; color: #e74c3c;"></i>
                    <h3>Assessment Not Available</h3>
                    <p style="margin: 20px 0; color: var(--color-text-secondary);">
                        ${err.message || 'The requested assessment could not be loaded.'}
                    </p>
                    <p style="font-size: 0.9rem; color: #999;">
                        This may happen if the assessment was removed, rejected, or you don't have permission to view it.
                    </p>
                    <button onclick="window.history.back()" class="btn-primary" style="margin-top: 20px;">
                        <i class="fas fa-arrow-left"></i> Go Back
                    </button>
                </div>
            `;
            errorContainer.style.display = 'block';
            document.getElementById('emptyState').style.display = 'none';
        } else {
            UI.error('Failed to load assessment: ' + err.message);
        }
    } finally {
        UI.hideLoader();
    }
}

async function currentModuleAction(action) {
    // Check if we're reviewing an exam or a module
    if (currentExamId && currentExamData) {
        await handleExamAction(action);
    } else if (currentModuleId) {
        await handleModuleAction(action);
    }
}

async function handleExamAction(action, rejectionReason = null) {
    // If rejecting and no reason provided, show modal
    if (action === 'Rejected' && !rejectionReason) {
        showRejectionModal();
        return;
    }
    
    try {
        UI.showLoader();
        const endpoint = `${Auth.apiBase}/exams/${currentExamId}/approve`;
        
        console.log('[EXAM ACTION] Processing:', {
            action,
            examId: currentExamId,
            endpoint,
            rejectionReason
        });
        
        // Backend expects { action: 'approve' } or { action: 'reject', rejectionReason: '...' }
        const requestBody = {
            action: action === 'Approved' ? 'approve' : 'reject'
        };
        
        if (action === 'Rejected') {
            requestBody.rejectionReason = rejectionReason;
        }
        
        console.log('[EXAM ACTION] Request body:', requestBody);
            
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { ...Auth.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        console.log('[EXAM ACTION] Response status:', res.status);
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
            console.error('[EXAM ACTION] Full error response:', errorData);
            console.error('[EXAM ACTION] Error message:', errorData.message);
            console.error('[EXAM ACTION] Error details:', errorData.error);
            const errorMsg = errorData.error ? `${errorData.message}: ${errorData.error}` : errorData.message;
            throw new Error(errorMsg || 'Action failed');
        }
        
        const result = await res.json();
        console.log('[EXAM ACTION] Success:', result);
        
        UI.success(`Assessment ${action === 'Approved' ? 'approved' : 'rejected'} successfully`);
        
        // Reload course data and refresh sidebar
        await loadCourseData();
        
        // Refresh the assessment display if it's currently selected
        if (currentExamId) {
            await loadAndDisplayExam(currentExamId);
        }
        
    } catch (err) {
        console.error('[EXAM ACTION] Error processing assessment action:', err);
        UI.error(err.message || 'Failed to process action');
    } finally {
        UI.hideLoader();
    }
}

async function handleModuleAction(action) {
    // Original module approval logic
    let remarks = '';
    if (action === 'Rejected') {
        remarks = prompt('Enter reason for rejection:');
        if (!remarks) return;
    }

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/admin/review`, {
            method: 'POST',
            headers: { ...Auth.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contentType: 'Module',
                contentID: currentModuleId,
                status: action,
                remarks: remarks
            })
        });

        if (res.ok) {
            UI.success(`Module ${action}`);
            await loadCourseData();
            // Re-select the same module to see updated status
            selectModule(currentModuleId);
        } else {
            UI.error('Action failed');
        }
    } catch (e) {
        UI.error('Error processing request');
    } finally {
        UI.hideLoader();
    }
}

/**
 * Modal control functions for rejection reason
 */
function showRejectionModal() {
    const modal = document.getElementById('rejectionModal');
    const input = document.getElementById('rejectionReasonInput');
    if (modal && input) {
        input.value = '';
        modal.style.display = 'flex';
        input.focus();
    }
}

function closeRejectionModal() {
    const modal = document.getElementById('rejectionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function confirmRejection() {
    const input = document.getElementById('rejectionReasonInput');
    const reason = input?.value?.trim();
    
    if (!reason) {
        UI.error('Please provide a reason for rejection');
        return;
    }
    
    closeRejectionModal();
    await handleExamAction('Rejected', reason);
}

/**
 * Module action wrapper functions for sidebar menu
 */
async function approveModuleFromMenu(moduleId) {
    currentModuleId = moduleId;
    const module = modulesData.find(m => m._id === moduleId);
    if (module) {
        await toggleModuleStatus('Approved');
    }
}

async function deleteModuleFromMenu(moduleId) {
    currentModuleId = moduleId;
    const module = modulesData.find(m => m._id === moduleId);
    if (module) {
        await deleteModule();
    }
}

/**
 * Assessment menu dropdown controls
 */
function toggleAssessmentMenu(event, examId) {
    event.stopPropagation();
    
    // Close all other open menus
    document.querySelectorAll('.assessment-dropdown').forEach(menu => {
        if (menu.id !== `menu-${examId}`) {
            menu.classList.remove('show');
        }
    });
    
    // Toggle current menu
    const menu = document.getElementById(`menu-${examId}`);
    if (menu) {
        menu.classList.toggle('show');
    }
}

function closeAssessmentMenu() {
    document.querySelectorAll('.assessment-dropdown').forEach(menu => {
        menu.classList.remove('show');
    });
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.assessment-menu-btn') && !event.target.closest('.assessment-dropdown')) {
        closeAssessmentMenu();
    }
});

/**
 * Wrapper functions for assessment approval/rejection
 */
async function approveAssessment(examId) {
    if (examId) {
        currentExamId = examId;
        currentExamData = assessmentsData.find(e => e._id === examId);
    }
    await handleExamAction('Approved');
}

async function rejectAssessment(examId) {
    if (examId) {
        currentExamId = examId;
        currentExamData = assessmentsData.find(e => e._id === examId);
    }
    await handleExamAction('Rejected');
}
