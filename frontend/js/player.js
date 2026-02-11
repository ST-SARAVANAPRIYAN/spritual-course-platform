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

        // Define progress scope
        let completedModuleIds = [];

        // Fetch Assessment
        let courseAssessment = null;
        try {
            const assessRes = await fetch(`${Auth.apiBase}/exams/course/${currentCourseID}`, { headers: Auth.getHeaders() });
            const assessments = await assessRes.json();
            if (assessments && assessments.length > 0) courseAssessment = assessments[0];
        } catch (e) { console.error('Error fetching assessment', e); }

        // Render Curriculum (Modules)
        if (data.modules && data.modules.length > 0) {

            // If no specific module selected, default to first module
            if (!currentModuleID) {
                currentModuleID = data.modules[0]._id;
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('content', currentModuleID);
                window.history.pushState({}, '', newUrl);
            }

            // Get user progress to determine locks
            try {
                const progRes = await fetch(`${Auth.apiBase}/progress/${currentCourseID}`, { headers: Auth.getHeaders() });
                const progData = await progRes.json();
                completedModuleIds = progData.completedModules || [];
            } catch (e) { console.error('Error fetching progress for locks', e); }

            renderCurriculum(data.modules, completedModuleIds, courseAssessment);

            if (currentModuleID === 'intro') {
                loadIntroIframe(data.course);
            } else if (currentModuleID === 'assessment' && courseAssessment) {
                // Check if locked
                const canTakeAssessment = checkAssessmentUnlock(courseAssessment, completedModuleIds, data.modules);
                if (canTakeAssessment) {
                    loadAssessmentContent(courseAssessment);
                } else {
                    UI.info('Assessment is locked. Complete all modules first.');
                    // Redirect to first unlocked/incomplete module or just the first one
                    currentModuleID = data.modules[0]._id;
                    loadModuleContent(data.modules[0]);
                }
            } else {
                // Check if requested module is locked
                // It's locked if it's NOT the first module AND the previous module is NOT completed
                const modIndex = data.modules.findIndex(m => m._id === currentModuleID);
                const prevModule = modIndex > 0 ? data.modules[modIndex - 1] : null;
                const isLocked = !hasFullAccess || (prevModule && !completedModuleIds.includes(prevModule._id));

                if (isLocked && modIndex > 0) {
                    UI.info('This module is locked. Complete previous modules first.');
                    // Redirect to first unlocked/incomplete module or just the first one
                    currentModuleID = data.modules[0]._id;
                    loadModuleContent(data.modules[0]);
                } else {
                    const activeModule = data.modules.find(m => m._id === currentModuleID);
                    if (activeModule) {
                        loadModuleContent(activeModule);
                    } else {
                        currentModuleID = data.modules[0]._id;
                        loadModuleContent(data.modules[0]);
                    }
                }
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

function checkAssessmentUnlock(assessment, completedModuleIds, allModules) {
    if (!assessment) return false;

    // Logic: Unlocked if progress % >= approvalThreshold
    // OR simper logic: All modules completed? 
    // The requirement says "threshold progress".
    // We need to calculate progress %.

    // Total modules
    const total = allModules.length;
    if (total === 0) return true;

    const completed = completedModuleIds.length;
    const progressPercent = (completed / total) * 100;

    return progressPercent >= (assessment.activationThreshold || 100);
}

function renderCurriculum(modules, completedModuleIds = [], assessment = null) {
    const list = document.getElementById('curriculumList');

    // Calculate Progress
    const totalModules = modules.length;
    const completedCount = completedModuleIds.length;
    const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

    // Progress Section HTML
    const progressHtml = `
        <li style="padding: 15px; border-bottom: 1px solid #eee; background: #fffcf5;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.85rem; color: #666; font-weight: 600;">
                <span>Course Progress</span>
                <span style="color: var(--color-saffron);">${progressPercent}%</span>
            </div>
            <div style="height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, var(--color-golden), var(--color-saffron)); border-radius: 3px; transition: width 0.5s ease;"></div>
            </div>
            <div style="text-align: right; font-size: 0.75rem; color: #999; margin-top: 4px;">
                ${completedCount}/${totalModules} Modules Completed
            </div>
        </li>
    `;

    // Create Course Intro Item
    const introItem = `
        <li class="content-item ${currentModuleID === 'intro' ? 'active' : ''}" 
             onclick="switchModule('intro')">
            <div class="module-number" style="background: var(--color-golden); color: white;">
                <i class="fas fa-info"></i>
            </div>
            <div class="module-info">
                <p style="font-size: 0.95rem; font-weight:500; margin-bottom:2px;">Course Intro</p>
                <small style="color: #888;">Overview & Details</small>
            </div>
        </li>
    `;

    const modulesHtml = modules.map((item, index) => {
        // Locking Logic:
        // 1. If no full access (not enrolled), everything locked (except potentially preview, but we handle that with hasFullAccess)
        // 2. If enrolled:
        //    - First module (index 0) is ALWAYS unlocked.
        //    - Subsequent modules are unlocked ONLY IF the previous module is in completedModuleIds.

        let isLocked = !hasFullAccess;
        if (hasFullAccess) {
            if (index === 0) {
                isLocked = false;
            } else {
                const prevModuleId = modules[index - 1]._id;
                const isPrevCompleted = completedModuleIds.includes(prevModuleId);
                isLocked = !isPrevCompleted;
            }
        }

        const isCompleted = completedModuleIds.includes(item._id);

        // Determine icon based on content type
        let icon = '<i class="fas fa-book-open"></i> Read';
        if (item.contentType === 'video') {
            icon = '<i class="fas fa-play-circle"></i> Video';
        } else if (item.contentType === 'pdf') {
            icon = '<i class="fas fa-file-pdf"></i> PDF';
        }

        // Status Text
        let statusHtml = '';
        if (isLocked) {
            statusHtml = '<i class="fas fa-lock"></i> Locked';
        } else if (isCompleted) {
            statusHtml = '<i class="fas fa-check-circle" style="color:var(--color-success)"></i> Completed';
        } else {
            statusHtml = icon;
        }

        return `
            <li class="content-item ${item._id === currentModuleID ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}" 
                 onclick="${isLocked ? `UI.info('Complete previous module to unlock.')` : `switchModule('${item._id}')`}"
                 style="${isLocked ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
                <div class="module-number" style="${isCompleted ? 'background:var(--color-success); border-color:var(--color-success); color:white;' : ''}">
                    ${isCompleted ? '<i class="fas fa-check"></i>' : index + 1}
                </div>
                <div class="module-info">
                    <p style="font-size: 0.95rem; font-weight:500; margin-bottom:2px;">${item.title}</p>
                    <small style="color: ${isLocked ? '#666' : '#888'};">
                        ${statusHtml}
                    </small>
                </div>
            </li>
        `;
    }).join('');

    let assessmentHtml = '';
    if (assessment) {
        const isUnlocked = checkAssessmentUnlock(assessment, completedModuleIds, modules);

        // TODO: Check if already passed/taken?
        // We might need to fetch assessment result separately.

        assessmentHtml = `
            <li class="content-item ${currentModuleID === 'assessment' ? 'active' : ''}" 
                 onclick="${isUnlocked ? `switchAssessment('${assessment._id}')` : `UI.info('Complete ${assessment.activationThreshold}% of modules to unlock.')`}"
                 style="${!isUnlocked ? 'opacity: 0.6; cursor: not-allowed;' : 'border-color: var(--color-saffron);'}">
                <div class="module-number" style="background: ${isUnlocked ? 'var(--color-saffron)' : '#ccc'}; color: white;">
                    <i class="fas fa-clipboard-check"></i>
                </div>
                <div class="module-info">
                    <p style="font-size: 0.95rem; font-weight:500; margin-bottom:2px; color: var(--color-saffron);">Final Assessment</p>
                    <small style="color: #888;">
                        ${isUnlocked ? 'Ready to Start' : `Unlock at ${assessment.activationThreshold}%`}
                    </small>
                </div>
            </li>
        `;
    }

    list.innerHTML = progressHtml + introItem + modulesHtml + assessmentHtml;
}

// Global state for progress
let progressInterval = null;
let timeSpentInModule = 0; // Total time spent (loaded + current session)
let unsavedTime = 0; // Time spent since last sync
let moduleTotalDuration = 600;
let userHasControl = true;
let heartbeatInterval = null;

// ... existing loadPlayer function ...

async function loadModuleContent(module) {
    console.log('Loading module:', module);

    // Clear previous intervals
    if (progressInterval) clearInterval(progressInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    // Remove old listeners to prevent duplicates (though loadModuleContent usually runs on fresh page load or swap)
    window.removeEventListener('beforeunload', handleUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    // Initialize timer state
    timeSpentInModule = 0;
    unsavedTime = 0;
    moduleTotalDuration = (module.duration || 10) * 60; // Duration in seconds

    // Fetch existing progress for this module to resume timer
    try {
        const progRes = await fetch(`${Auth.apiBase}/progress/${currentCourseID}`, { headers: Auth.getHeaders() });
        const progData = await progRes.json();
        // Ensure accurate comparison of IDs
        const modProgress = progData.moduleProgress?.find(m => m.moduleID.toString() === module._id.toString());
        if (modProgress) {
            timeSpentInModule = modProgress.timeSpent || 0;
            console.log('Resuming progress from:', timeSpentInModule);
        }
    } catch (e) { console.error('Error fetching module progress', e); }

    const video = document.getElementById('mainVideo');
    const overlay = document.getElementById('previewOverlay');
    const title = document.getElementById('contentTitle');
    const downloadBtn = document.getElementById('downloadNotesBtn');
    const markBtn = document.getElementById('markCompleteBtn');

    // Timer Display
    let timerDisplay = document.getElementById('moduleTimer');
    if (!timerDisplay) {
        timerDisplay = document.createElement('div');
        timerDisplay.id = 'moduleTimer';
        timerDisplay.style.cssText = 'position:fixed; bottom:20px; right:20px; background:rgba(0,0,0,0.8); color:white; padding:10px 15px; border-radius:30px; font-weight:bold; font-size:14px; z-index:1000; box-shadow:0 4px 15px rgba(0,0,0,0.2); backdrop-filter:blur(5px); display:flex; align-items:center; gap:10px; border:1px solid var(--color-saffron);';
        document.body.appendChild(timerDisplay);
    }
    timerDisplay.style.display = 'flex';
    updateTimerDisplay();

    // Start Timer
    progressInterval = setInterval(() => {
        if (document.visibilityState === 'visible') { // Only count when tab is active
            timeSpentInModule++;
            unsavedTime++;
            updateTimerDisplay();
        }
    }, 1000);

    // Start Heartbeat (Sync every 5s for better granularity)
    heartbeatInterval = setInterval(() => syncProgress(false), 5000);

    // Add listeners for robust saving
    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

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
    let fileUrl = module.fileUrl;

    console.log('Content type:', contentType, 'File URL:', fileUrl);

    if (contentType === 'video' && fileUrl) {
        // VIDEO MODULE - Direct Static URL
        video.src = fileUrl;
        video.style.display = 'block';
        video.load();

        // Disable right-click on video to prevent easy download
        video.addEventListener('contextmenu', e => e.preventDefault());

        // Show description if available
        if (module.content) {
            contentDisplay.innerHTML = UI.fixContentUrls(module.content);
            contentDisplay.style.display = 'block';
        }
    } else if (contentType === 'pdf' && fileUrl) {
        // PDF MODULE - Direct Static URL
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
        contentDisplay.innerHTML = UI.fixContentUrls(module.content) || '<p style="color:#666; font-style:italic;">No content available for this module.</p>';
        contentDisplay.style.display = 'block';
    }

    // Mark Complete Button
    markBtn.style.display = 'block';
    markBtn.innerHTML = 'Mark as Complete';
    markBtn.style.background = '#ccc'; // initially disabled
    markBtn.disabled = true;

    // Check existing progress
    checkCompletionStatus(module._id);
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('moduleTimer');
    if (!timerDisplay) return;

    const percent = Math.min((timeSpentInModule / moduleTotalDuration) * 100, 100);
    const mins = Math.floor(timeSpentInModule / 60);
    const secs = timeSpentInModule % 60;

    // Check if 50% threshold reached for unlocking button
    const requiredSeconds = moduleTotalDuration * 0.5;
    const isReady = timeSpentInModule >= requiredSeconds;

    let icon = '<i class="fas fa-hourglass-half fa-spin"></i>';
    if (isReady) icon = '<i class="fas fa-check-circle" style="color: var(--color-golden);"></i>';

    timerDisplay.innerHTML = `${icon} <span>${mins}:${secs.toString().padStart(2, '0')}</span> <small style="opacity:0.7">/ ${(moduleTotalDuration / 60).toFixed(0)}m</small>`;

    // Enable button if threshold reached and not already completed
    const markBtn = document.getElementById('markCompleteBtn');
    if (markBtn && isReady && !markBtn.innerHTML.includes('Completed')) {
        markBtn.disabled = false;
        markBtn.style.background = 'var(--color-saffron)';
    }
}

const handleUnload = () => syncProgress(true);
const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
        syncProgress(false);
    }
};

async function syncProgress(isUnload = false) {
    if (unsavedTime > 0) {
        const timeToSend = unsavedTime;
        // Reset immediately to prevent double sending if multiple events trigger rapidly
        unsavedTime = 0;

        try {
            const payload = JSON.stringify({
                courseID: currentCourseID,
                moduleID: currentModuleID,
                timeSpent: timeToSend
            });

            if (isUnload) {
                // Use fetch with keepalive for unload events
                // Note: Auth headers might be tricky with keepalive if they depend on localStorage, 
                // but usually fine as long as token is in header.
                // However, fetch keepalive has size limits.
                fetch(`${Auth.apiBase}/progress/update-progress`, {
                    method: 'POST',
                    headers: Auth.getHeaders(),
                    body: payload,
                    keepalive: true
                });
            } else {
                const res = await fetch(`${Auth.apiBase}/progress/update-progress`, {
                    method: 'POST',
                    headers: Auth.getHeaders(),
                    body: payload
                });
                const data = await res.json();

                if (data.moduleCompleted) {
                    const markBtn = document.getElementById('markCompleteBtn');
                    if (markBtn) {
                        markBtn.innerHTML = '<i class="fas fa-check-circle"></i> Completed';
                        markBtn.style.background = 'var(--color-success)';
                        markBtn.disabled = true;
                    }

                    // Unlock next module in UI without full reload if possible
                    updateCurriculumWithCompletion(data.nextModuleID);
                    UI.success('Module successfully completed!');
                }
            }
            console.log(`Synced ${timeToSend}s`);
        } catch (err) {
            console.error('Sync failed', err);
            // Put time back if failed? Tricky because of async. 
            // For now, assume best effort.
        }
    }
}

function updateCurriculumWithCompletion(nextModuleId) {
    // Helper to refresh locks without full reload
    // For now, easiest to just re-fetch progress or reload player data
    loadPlayer();
}

async function checkCompletionStatus(moduleId) {
    const markBtn = document.getElementById('markCompleteBtn');
    try {
        const res = await fetch(`${Auth.apiBase}/progress/${currentCourseID}`, {
            headers: Auth.getHeaders()
        });
        const progress = await res.json();

        // Check if completed in backend
        const isCompleted = progress.completedModules && progress.completedModules.includes(moduleId);

        if (isCompleted) {
            markBtn.innerHTML = '<i class="fas fa-check-circle"></i> Completed';
            markBtn.style.background = 'var(--color-success)';
            markBtn.disabled = true;

            // If already completed, user can move freely
            userHasControl = true;
        } else {
            // Not completed
            userHasControl = false;
        }

        // Render locking state in list
        updateCurriculumWithLocks(progress.completedModules || []);

    } catch (err) { }
}

function updateCurriculumWithLocks(completedModules) {
    const items = document.querySelectorAll('.content-item');
    let locked = false; // Start unlocked (first item always unlocked)

    // Logic: Item is locked if previous item is NOT in completedModules
    // Exception: First item is always unlocked
    // Exception: hasFullAccess=false (handled in renderCurriculum)

    // We need to re-render to apply locks properly based on data
    // Or we can iterate DOM (easier if we have IDs)

    // ... Actually, easier to let renderCurriculum handle it by passing progress
    // But renderCurriculum is called once. We should reload it.
}

// ... existing switchModule ...
async function switchModule(moduleId) {
    console.log('Switching to module:', moduleId);

    // 1. Sync current progress before switching
    await syncProgress();

    // 2. Update current ID
    currentModuleID = moduleId;

    // 3. Update URL without reloading
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('content', currentModuleID);
    window.history.pushState({}, '', newUrl);

    // 4. Reload Player to render correct content
    // We call loadPlayer which will re-fetch course data and render the correct module
    loadPlayer();
}

async function loadForum() {
    const list = document.getElementById('forumComments');
    if (!list) return;

    list.innerHTML = '<p class="text-center" style="color:#888;">Loading discussion...</p>';

    try {
        const res = await fetch(`${Auth.apiBase}/forum/${currentCourseID}`, { headers: Auth.getHeaders() });
        const comments = await res.json();

        if (comments.length === 0) {
            list.innerHTML = '<p class="text-center" style="color:#888; padding: 20px;">No thoughts shared yet. Be the first to reflect.</p>';
            return;
        }

        list.innerHTML = comments.map(c => `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong style="color: var(--color-primary);">${c.userID ? c.userID.name : 'Seeker'}</strong>
                    <small style="color: #999;">${new Date(c.createdAt).toLocaleDateString()}</small>
                </div>
                <p style="margin: 0; color: #555;">${c.comment}</p>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p style="color: var(--color-error); text-align: center;">Unable to load the circle of wisdom.</p>';
    }
}

async function markAsComplete() {
    // Legacy function, kept for compatibility but main logic moved to syncProgress
    // We can use this for manual trigger if time threshold met
    const btn = document.getElementById('markCompleteBtn');
    if (btn.disabled) return UI.info('You must spend more time on this module.');

    try {
        await syncProgress(); // Force sync
        // Logic handled in syncProgress response
    } catch (err) {
        UI.error('Could not update progress.');
    }
}

function loadIntroIframe(course) {
    console.log('Loading Course Intro Iframe');
    if (progressInterval) clearInterval(progressInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    const timer = document.getElementById('moduleTimer');
    if (timer) timer.style.display = 'none';

    const video = document.getElementById('mainVideo');
    const overlay = document.getElementById('previewOverlay');
    const title = document.getElementById('contentTitle');
    const markBtn = document.getElementById('markCompleteBtn');
    const contentDisplay = document.getElementById('htmlContentDisplay');

    // Reset Display
    video.style.display = 'none';
    overlay.style.display = 'none';
    markBtn.style.display = 'none';
    if (contentDisplay) contentDisplay.style.display = 'none';

    title.textContent = "Course Introduction - " + (course?.title || 'Overview');
    document.getElementById('contentDescription').innerHTML = '<p>Welcome to the course. Watch the introduction to get started.</p>';

    if (course?.introVideo) {
        video.src = course.introVideo;
        video.style.display = 'block';
        video.load();
    } else {
        UI.info('No introduction video available.');
    }
}

// Ensure functions are global
window.switchModule = switchModule;
window.loadIntroIframe = loadIntroIframe;
window.markAsComplete = markAsComplete;
window.switchAssessment = switchAssessment;

async function switchAssessment(examId) {
    console.log('Switching to assessment:', examId);

    // 1. Sync current progress before switching
    await syncProgress();

    // 2. Update current ID
    currentModuleID = 'assessment';

    // 3. Update URL without reloading
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('content', 'assessment');
    window.history.pushState({}, '', newUrl);

    // 4. Reload Player to render correct content
    loadPlayer();
}

async function loadAssessmentContent(assessment) {
    console.log('Loading Assessment:', assessment);

    // Clear previous intervals
    if (progressInterval) clearInterval(progressInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    // HIDE Video & show content
    const video = document.getElementById('mainVideo');
    const overlay = document.getElementById('previewOverlay');
    const title = document.getElementById('contentTitle');
    const downloadBtn = document.getElementById('downloadNotesBtn');
    const markBtn = document.getElementById('markCompleteBtn');
    const contentDisplay = document.getElementById('htmlContentDisplay');
    const timerDisplay = document.getElementById('moduleTimer');

    video.style.display = 'none';
    video.pause();
    overlay.style.display = 'none';
    downloadBtn.style.display = 'none';
    if (markBtn) markBtn.style.display = 'none';
    if (timerDisplay) timerDisplay.style.display = 'block';

    title.textContent = assessment.title;
    document.getElementById('contentDescription').innerHTML = `<p>Duration: ${assessment.duration} mins | Passing Score: ${assessment.passingScore}%</p>`;

    // Fetch full exam details (questions)
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/exams/${assessment._id}`, { headers: Auth.getHeaders() });
        const fullExam = await res.json();

        // Render Quiz UI
        contentDisplay.style.display = 'block';
        contentDisplay.innerHTML = renderQuizUI(fullExam);

        // Initialize Timer
        startAssessmentTimer(fullExam.duration);

        // Attach Submit Handler
        document.getElementById('quizForm').onsubmit = (e) => submitAssessment(e, fullExam._id);

    } catch (err) {
        console.error('Error loading exam details', err);
        UI.error('Failed to load assessment.');
    } finally {
        UI.hideLoader();
    }
}

let assessmentTimerInterval = null;
function startAssessmentTimer(durationMinutes) {
    let timeLeft = durationMinutes * 60;
    const timerDisplay = document.getElementById('moduleTimer');

    if (assessmentTimerInterval) clearInterval(assessmentTimerInterval);

    assessmentTimerInterval = setInterval(() => {
        timeLeft--;
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;

        if (timerDisplay) {
            timerDisplay.innerHTML = `<i class="fas fa-clock"></i> <span>${mins}:${secs.toString().padStart(2, '0')}</span>`;
            if (timeLeft < 60) timerDisplay.style.color = 'var(--color-error)';
        }

        if (timeLeft <= 0) {
            clearInterval(assessmentTimerInterval);
            UI.info('Time is up! Submitting assessment...');
            document.getElementById('quizForm').dispatchEvent(new Event('submit'));
        }
    }, 1000);
}

function renderQuizUI(exam) {
    return `
        <div class="assessment-container" style="max-width: 800px; margin: 0 auto;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 5px solid var(--color-saffron);">
                <h4 style="margin-top:0;">Instructions</h4>
                <ul style="padding-left: 20px; color: #666;">
                    <li>Answer all questions.</li>
                    <li>You need ${exam.passingScore}% to pass.</li>
                    <li>Do not refresh the page.</li>
                </ul>
            </div>
            
            <form id="quizForm">
                ${exam.questions.map((q, index) => `
                    <div class="question-block" style="margin-bottom: 30px; background: white; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <p style="font-weight: 600; font-size: 1.1rem; margin-bottom: 15px;">
                            <span style="background: var(--color-saffron); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.9rem; margin-right: 10px;">Q${index + 1}</span>
                            ${q.questionText}
                        </p>
                        <div class="options-list" style="display: flex; flex-direction: column; gap: 10px;">
                            ${q.options.map((opt, i) => `
                                <label style="display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid #eee; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                                    <input type="${q.correctOptionIndices.length > 1 ? 'checkbox' : 'radio'}" 
                                           name="q${index}" 
                                           value="${i}" 
                                           style="transform: scale(1.2);">
                                    <span>${opt}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                
                <button type="submit" class="btn-primary" style="width: 100%; padding: 15px; font-size: 1.1rem; font-weight: bold; margin-top: 20px;">
                    Submit Assessment
                </button>
            </form>
        </div>
    `;
}

async function submitAssessment(e, examId) {
    e.preventDefault();
    if (assessmentTimerInterval) clearInterval(assessmentTimerInterval);

    const formData = new FormData(e.target);
    const answers = {};

    // Collect answers
    // We need to iterate over questions to handle multi-select properly if needed
    // Simplified: iterate form data
    for (let [key, value] of formData.entries()) {
        const qIndex = parseInt(key.replace('q', ''));
        if (!answers[qIndex]) {
            answers[qIndex] = value;
        } else {
            // If multiple values (checkbox), make it an array
            if (!Array.isArray(answers[qIndex])) {
                answers[qIndex] = [answers[qIndex]];
            }
            answers[qIndex].push(value);
        }
    }

    // Convert to array of answers matching question index
    // Note: The backend expects an array where index matches question index
    const questions = document.querySelectorAll('.question-block');
    const answersArray = [];
    for (let i = 0; i < questions.length; i++) {
        answersArray.push(answers[i] || []); // Push array or single value
    }

    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/exams/submit`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ examID: examId, answers: answersArray })
        });

        const result = await res.json();

        const contentDisplay = document.getElementById('htmlContentDisplay');
        const timerDisplay = document.getElementById('moduleTimer');
        if (timerDisplay) timerDisplay.style.display = 'none'; // Hide timer

        if (res.ok) {
            let resultIcon = result.status === 'Pass' ? 'trophy' : 'times-circle';
            let resultColor = result.status === 'Pass' ? 'var(--color-success)' : 'var(--color-error)';

            contentDisplay.innerHTML = `
                <div style="text-align: center; padding: 50px 20px;">
                    <i class="fas fa-${resultIcon}" style="font-size: 5rem; color: ${resultColor}; margin-bottom: 20px;"></i>
                    <h2 style="color: ${resultColor}; margin-bottom: 10px;">You ${result.status}!</h2>
                    <p style="font-size: 1.5rem; color: #333;">Score: <strong>${result.score.toFixed(1)}%</strong></p>
                    <p style="color: #666; margin-bottom: 30px;">${result.message}</p>
                    
                    ${result.status === 'Pass' ? `
                        <button onclick="UI.success('Certificate Generated!');" class="btn-primary" style="background: var(--color-golden);">
                            <i class="fas fa-certificate"></i> View Certificate
                        </button>
                    ` : `
                        <button onclick="loadAssessmentContent({_id: '${examId}', title: 'Retake Assessment', duration: 30, passingScore: 70})" class="btn-primary" style="background: #666;">
                            <i class="fas fa-redo"></i> Retake Assessment
                        </button>
                    `}
                </div>
            `;
            UI.success(`Assessment Submitted: ${result.status}`);
        } else {
            UI.error(result.message || 'Submission failed');
        }
    } catch (err) {
        console.error(err);
        UI.error('Error submitting assessment');
    } finally {
        UI.hideLoader();
    }
}

