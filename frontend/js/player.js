/**
 * InnerSpark - Course Player & Tracking Logic
 */

let currentCourseID = null;
let currentContentID = null;
let previewLimit = 0;
let hasFullAccess = false;
let trackingInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    currentCourseID = params.get('course');
    currentContentID = params.get('content');

    if (!currentCourseID || !currentContentID) {
        window.location.href = 'marketplace.html';
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

        hasFullAccess = data.hasFullAccess;
        document.getElementById('courseTitle').textContent = data.course.title;
        document.getElementById('mentorName').textContent = `By ${data.course.mentorID?.name}`;

        // Render Curriculum
        renderCurriculum(data.content);

        // Load specific content
        const activeItem = data.content.find(i => i._id === currentContentID);
        if (activeItem) playContent(activeItem);

        // Mock viewer count
        document.getElementById('viewCount').textContent = Math.floor(Math.random() * 50) + 5;

    } catch (err) {
        UI.error('The stream of wisdom is interrupted.');
    } finally {
        UI.hideLoader();
    }
}

function renderCurriculum(content) {
    const list = document.getElementById('curriculumList');
    list.innerHTML = content.map(item => {
        const isLocked = !hasFullAccess && item.previewDuration <= 0;
        return `
            <div class="content-item ${item._id === currentContentID ? 'active' : ''} ${isLocked ? 'locked' : ''}" 
                 onclick="${isLocked ? `UI.info('This sacred lesson is locked. Enroll to unlock.')` : `switchContent('${item._id}')`}"
                 style="${isLocked ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                <i class="fas ${isLocked ? 'fa-lock' : (item.type === 'Video' ? 'fa-play-circle' : 'fa-file-pdf')}"></i>
                <div>
                    <p style="font-size: 0.9rem;">${item.type}: Spiritual Lesson</p>
                    <small style="color: ${isLocked ? '#666' : '#aaa'};">${isLocked ? 'Locked Pathway' : (item.previewDuration > 0 ? 'Preview Available' : 'Enrolled Access')}</small>
                </div>
            </div>
        `;
    }).join('');
}

function playContent(item) {
    const video = document.getElementById('mainVideo');
    const overlay = document.getElementById('previewOverlay');
    const title = document.getElementById('contentTitle');
    const downloadBtn = document.getElementById('downloadNotesBtn');
    const markBtn = document.getElementById('markCompleteBtn');

    title.textContent = `Lesson: Spiritual Growth`;
    overlay.style.display = 'none';
    downloadBtn.style.display = 'none';
    markBtn.style.display = 'block';
    markBtn.innerHTML = 'Mark as Complete';
    markBtn.style.background = 'var(--color-saffron)';
    markBtn.disabled = false;

    if (item.type === 'Video') {
        video.style.display = 'block';
        video.src = item.fileUrl;
        previewLimit = item.previewDuration || 0;

        if (trackingInterval) clearInterval(trackingInterval);

        trackingInterval = setInterval(() => {
            if (!video.paused && !video.ended) {
                trackImpression(video.currentTime, video.duration);

                // 90% Completion auto-mark
                if (video.currentTime / video.duration > 0.9) {
                    markAsComplete();
                }
            }
        }, 10000);

        video.onseeked = () => {
            trackMetric('VideoSkip', `Seeked to ${Math.floor(video.currentTime)}s`);
        };

        video.ontimeupdate = () => {
            if (!hasFullAccess && video.currentTime > previewLimit) {
                video.pause();
                video.currentTime = previewLimit;
                video.style.display = 'none';
                overlay.style.display = 'flex';
                clearInterval(trackingInterval);
                trackMetric('PreviewEnd', 'Reached preview boundary');
            }
        };
    } else {
        video.style.display = 'none';
        if (hasFullAccess) {
            downloadBtn.style.display = 'inline-block';
            downloadBtn.href = item.fileUrl;
            downloadBtn.textContent = `Download ${item.type} Notes`;
        } else {
            UI.info('Divine materials are locked for enrolled seekers.');
        }
    }
}

async function trackMetric(type, metadata = '') {
    try {
        await fetch(`${Auth.apiBase}/analytics/track`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({
                courseID: currentCourseID,
                type: type,
                metadata: metadata
            })
        });
    } catch (err) { }
}

async function trackImpression(watchTime, totalTime) {
    trackMetric('View', `Watching lesson: ${Math.floor(watchTime)}s`);
}

function switchContent(id) {
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
            body: JSON.stringify({ courseID: currentCourseID, lessonID: currentContentID })
        });
        const data = await res.json();
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Completed';
        btn.style.background = 'var(--color-success)';
        btn.disabled = true;
        UI.success(data.message);
    } catch (err) {
        UI.error('Could not update progress.');
    }
}
