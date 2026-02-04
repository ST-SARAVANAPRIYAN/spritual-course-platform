/**
 * InnerSpark - Course Player & Tracking Logic (Refactored for Modules)
 */

let currentCourseID = null;
let currentModuleID = null;
let hasFullAccess = false;

document.addEventListener('DOMContentLoaded', async () => {
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
        // Simple access check: if enrolled, you have access. If not, maybe preview?
        // For now, assuming if `hasFullAccess` is false, they can't see content unless we handle preview logic again.
        // But simplified requirement: Modules are just content.
        const isLocked = !hasFullAccess;

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
                        ${isLocked ? '<i class="fas fa-lock"></i> Locked' : '<i class="fas fa-book-open"></i> Read'}
                    </small>
                </div>
            </div>
        `;
    }).join('');
}

function loadModuleContent(module) {
    // Hide Video & Overlay
    const video = document.getElementById('mainVideo');
    const overlay = document.getElementById('previewOverlay');
    const title = document.getElementById('contentTitle');
    const downloadBtn = document.getElementById('downloadNotesBtn');
    const markBtn = document.getElementById('markCompleteBtn');

    // Inject content area if not present (replacing video area)
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
        // Insert after video
        video.parentNode.insertBefore(contentDisplay, video.nextSibling);
    }

    video.style.display = 'none';
    overlay.style.display = 'none';
    downloadBtn.style.display = 'none'; // No downloads for now

    title.textContent = module.title;
    contentDisplay.innerHTML = module.content || '<p style="color:#666; font-style:italic;">No content in this module.</p>';
    contentDisplay.style.display = 'block';

    // Mark Complete Button
    markBtn.style.display = 'block';

    // Check if already completed (would need to fetch progress, but for now just reset button)
    markBtn.innerHTML = 'Mark as Complete';
    markBtn.style.background = 'var(--color-saffron)';
    markBtn.disabled = false;

    // Check existing progress (Optimistic or fetch?)
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
