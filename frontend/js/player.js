/**
 * InnerSpark - Course Player & Tracking Logic (Refactored for Modules)
 */

let currentCourseID = null;
let currentModuleID = null;
let hasFullAccess = false;

document.addEventListener('DOMContentLoaded', async () => {
    // SECURITY: Prevent caching of this page
    if (window.history && window.history.replaceState) {
        window.history.replaceState(null, null, window.location.href);
    }

    // SECURITY: Strict authentication check - must be logged in with valid token
    const auth = Auth.checkAuth();
    if (!auth) {
        // checkAuth redirects to login.html if no token
        return;
    }

    // SECURITY: Validate token with backend before proceeding
    try {
        const validateRes = await fetch(`${Auth.apiBase}/auth/validate`, {
            method: 'GET',
            headers: Auth.getHeaders()
        });

        if (!validateRes.ok) {
            console.error('Token validation failed');
            Auth.logout();
            return;
        }
    } catch (err) {
        console.error('Auth validation error:', err);
        Auth.logout();
        return;
    }

    const params = new URLSearchParams(window.location.search);
    currentCourseID = params.get('course');
    currentModuleID = params.get('content'); // URL param 'content' maps to module ID

    if (!currentCourseID) {
        window.location.href = 'courses.html';
        return;
    }

    await loadPlayer();
    loadForum();

    // Forum Submission
    const forumForm = document.getElementById('forumForm');
    if (forumForm) {
        forumForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const comment = forumForm.comment.value;
            try {
                const res = await fetch(`${Auth.apiBase}/forum/add`, {
                    method: 'POST',
                    headers: Auth.getHeaders(),
                    body: JSON.stringify({ courseID: currentCourseID, comment })
                });
                await res.json();
                forumForm.reset();
                loadForum();
            } catch (err) {
                alert('Connection error.');
            }
        });
    }
});

async function loadPlayer() {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/${currentCourseID}`, {
            headers: Auth.getHeaders()
        });
        const data = await res.json();

        hasFullAccess = data.hasFullAccess; // Access based on enrollment
        document.getElementById('courseTitle').textContent = data.course.title;
        const mentorName = data.course.mentors && data.course.mentors.length > 0 ? data.course.mentors[0].name : 'InnerSpark Guides';
        document.getElementById('mentorName').textContent = `By ${mentorName}`;

        // Render Curriculum (Modules)
        if (data.modules && data.modules.length > 0) {
            renderCurriculum(data.modules);

            // If no specific module selected, default to first
            if (!currentModuleID) {
                currentModuleID = data.modules[0]._id;
                // Update URL without reload
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('content', currentModuleID);
                window.history.pushState({}, '', newUrl);
            }

            // Load specific module
            const activeModule = data.modules.find(m => m._id === currentModuleID);
            if (activeModule) {
                loadModuleContent(activeModule);
            } else {
                // If ID invalid, load first
                currentModuleID = data.modules[0]._id;
                loadModuleContent(data.modules[0]);
            }
        } else {
            document.getElementById('curriculumList').innerHTML = '<p style="padding:20px; color:#ccc;">No modules available yet.</p>';
        }

        // Mock viewer count
        document.getElementById('viewCount').textContent = Math.floor(Math.random() * 50) + 5;

    } catch (err) {
        console.error(err);
        UI.error('The stream of wisdom is interrupted.');
    } finally {
        UI.hideLoader();
    }
}

function renderCurriculum(modules) {
    const list = document.getElementById('curriculumList');
    list.innerHTML = modules.map((item, index) => {
        const isLocked = !hasFullAccess;

        // Determine icon based on content type
        let icon = '<i class="fas fa-book-open"></i> Read';
        if (item.contentType === 'video') {
            icon = '<i class="fas fa-play-circle"></i> Video';
        } else if (item.contentType === 'pdf') {
            icon = '<i class="fas fa-file-pdf"></i> PDF';
        }

        return `
            <div class="content-item ${item._id === currentModuleID ? 'active' : ''} ${isLocked ? 'locked' : ''}" 
                 onclick="${isLocked ? `UI.info('Enroll to unlock this module.')` : `switchModule('${item._id}')`}"
                 style="${isLocked ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
                <div style="width:24px; height:24px; background:#eee; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold; color:#666;">
                    ${index + 1}
                </div>
                <div>
                    <p style="font-size: 0.95rem; font-weight:500; margin-bottom:2px;">${item.title}</p>
                    <small style="color: ${isLocked ? '#666' : '#888'};">
                        ${isLocked ? '<i class="fas fa-lock"></i> Locked' : icon}
                    </small>
                </div>
            </div>
        `;
    }).join('');
}

function loadModuleContent(module) {
    console.log('Loading module:', module); // Debug log

    const video = document.getElementById('mainVideo');
    const overlay = document.getElementById('previewOverlay');
    const title = document.getElementById('contentTitle');
    const downloadBtn = document.getElementById('downloadNotesBtn');
    const markBtn = document.getElementById('markCompleteBtn');

    // Content Display Area
    let contentDisplay = document.getElementById('htmlContentDisplay');
    if (!contentDisplay) {
        contentDisplay = document.createElement('div');
        contentDisplay.id = 'htmlContentDisplay';
        contentDisplay.className = 'content-body';
        contentDisplay.style.padding = '20px';
        contentDisplay.style.lineHeight = '1.8';
        contentDisplay.style.color = '#333';
        contentDisplay.style.background = '#fff';
        contentDisplay.style.borderRadius = '8px';
        contentDisplay.style.marginTop = '20px';
        video.parentNode.insertBefore(contentDisplay, video.nextSibling);
    }

    // Reset all displays
    video.style.display = 'none';
    video.pause();
    video.removeAttribute('src');
    overlay.style.display = 'none';
    contentDisplay.style.display = 'none';
    contentDisplay.innerHTML = '';
    downloadBtn.style.display = 'none';

    title.textContent = module.title;

    // Handle different content types
    const contentType = module.contentType || 'rich-content';
    const fileUrl = module.fileUrl;

    console.log('Content type:', contentType, 'File URL:', fileUrl); // Debug log

    if (contentType === 'video' && fileUrl) {
        // VIDEO MODULE
        video.src = fileUrl;
        video.style.display = 'block';
        video.load();

        // Show description if available
        if (module.content) {
            contentDisplay.innerHTML = module.content;
            contentDisplay.style.display = 'block';
        }
    } else if (contentType === 'pdf' && fileUrl) {
        // PDF MODULE
        contentDisplay.innerHTML = `
            <div style="width: 100%; height: 700px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <iframe src="${fileUrl}" width="100%" height="100%" style="border: none;">
                    <p>Your browser does not support PDFs. 
                       <a href="${fileUrl}" target="_blank" style="color: var(--color-saffron);">Download the PDF</a>
                    </p>
                </iframe>
            </div>
            ${module.content ? `<div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">${module.content}</div>` : ''}
        `;
        contentDisplay.style.display = 'block';

        // Show download button for PDFs
        downloadBtn.href = fileUrl;
        downloadBtn.download = module.title + '.pdf';
        downloadBtn.style.display = 'inline-block';
    } else {
        // RICH CONTENT (default)
        contentDisplay.innerHTML = module.content || '<p style="color:#666; font-style:italic;">No content available for this module.</p>';
        contentDisplay.style.display = 'block';
    }

    // Mark Complete Button
    markBtn.style.display = 'block';
    markBtn.innerHTML = 'Mark as Complete';
    markBtn.style.background = 'var(--color-saffron)';
    markBtn.disabled = false;

    // Check existing progress
    checkCompletionStatus(module._id);
}

async function checkCompletionStatus(moduleId) {
    const markBtn = document.getElementById('markCompleteBtn');
    try {
        const res = await fetch(`${Auth.apiBase}/progress/${currentCourseID}`, {
            headers: Auth.getHeaders()
        });
        const progress = await res.json();

        if (progress.completedModules && progress.completedModules.includes(moduleId)) {
            markBtn.innerHTML = '<i class="fas fa-check-circle"></i> Completed';
            markBtn.style.background = 'var(--color-success)';
            markBtn.disabled = true;
        }
    } catch (err) { }
}

function switchModule(id) {
    window.location.href = `player.html?course=${currentCourseID}&content=${id}`;
}

async function loadForum() {
    const list = document.getElementById('forumList');
    try {
        const res = await fetch(`${Auth.apiBase}/forum/course/${currentCourseID}`, { headers: Auth.getHeaders() });
        const posts = await res.json();

        if (posts.length === 0) {
            list.innerHTML = '<p style="color: #666; font-style: italic; padding: 20px;">The silence is profound. Be the first to speak.</p>';
            return;
        }

        list.innerHTML = posts.map(p => `
            <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border-left: 3px solid var(--color-saffron);">
                <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                    <div style="width: 35px; height: 35px; border-radius: 50%; background: var(--color-saffron); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; overflow: hidden;">
                        ${p.studentID?.profilePic ? `<img src="${p.studentID.profilePic}" style="width: 100%; height: 100%; object-fit: cover;">` : (p.studentID?.name?.charAt(0) || '?')}
                    </div>
                    <div>
                        <p style="font-weight: 600; font-size: 0.95rem;">${p.studentID?.name || 'Anonymous Seeker'}</p>
                        <small style="color: #666;">${new Date(p.createdAt).toLocaleDateString()}</small>
                    </div>
                </div>
                <p style="font-size: 0.95rem; color: #ddd; line-height: 1.5;">${p.comment}</p>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = '<p>The oracle is silent.</p>';
    }
}

async function markAsComplete() {
    const btn = document.getElementById('markCompleteBtn');
    try {
        const res = await fetch(`${Auth.apiBase}/progress/mark-complete`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ courseID: currentCourseID, moduleID: currentModuleID })
        });
        const data = await res.json();

        btn.innerHTML = '<i class="fas fa-check-circle"></i> Completed';
        btn.style.background = 'var(--color-success)';
        btn.disabled = true;

        UI.success('Module completed!');
    } catch (err) {
        UI.error('Could not update progress.');
    }
}
