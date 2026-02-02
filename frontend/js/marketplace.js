/**
 * InnerSpark - Marketplace Discovery Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    loadMarketplace();

    // Category Filter Handlers
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const category = tab.textContent;
            filterCourses(category);
        });
    });
});

let allCourses = [];

async function loadMarketplace() {
    try {
        UI.showLoader();
        const res = await fetch(`${API_URL}/courses/marketplace`);
        allCourses = await res.json();
        renderCourses(allCourses);
    } catch (err) {
        console.error('Marketplace Error:', err);
        UI.error(`The marketplace archive is currently shielded: ${err.message}`);
    } finally {
        UI.hideLoader();
    }
}

function renderCourses(courses) {
    const list = document.getElementById('marketplaceCourses');
    if (courses.length === 0) {
        list.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 50px;">No paths found in this category yet.</p>';
        return;
    }

    list.innerHTML = courses.map(c => `
        <div class="course-card glass-premium" onclick="openCourseModal('${c._id}')" style="background: white; border-radius: var(--border-radius-lg); overflow: hidden; cursor: pointer; transition: var(--transition-smooth);">
            <div class="course-thumb" style="background: url('${c.thumbnail || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'}'); background-size: cover; background-position: center; height: 200px; width: 100%;"></div>
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-saffron); font-weight: 700;">${c.category}</span>
                    <span style="font-weight: 700; color: var(--color-saffron); font-size: 1.1rem;">$${c.price}</span>
                </div>
                <h3 style="margin-bottom: 10px; font-family: var(--font-heading);">${c.title}</h3>
                <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 15px;">By ${c.mentorID?.name || 'Mentor'}</p>
                <div style="display: flex; align-items: center; gap: 15px; font-size: 0.8rem; color: #999;">
                    <span><i class="fas fa-layer-group"></i> ${c.content?.length || 0} Lessons</span>
                    <span><i class="fas fa-star" style="color: var(--color-golden);"></i> 4.9</span>
                </div>
            </div>
        </div>
    `).join('');

    // Track Impressions
    courses.forEach(c => trackMetric('View', `Marketplace List: ${c.title}`, c._id));
}

async function trackMetric(type, metadata = '', courseID = null) {
    try {
        await fetch(`${API_URL}/analytics/track`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ courseID, type, metadata })
        });
    } catch (e) { }
}

function filterCourses(category) {
    if (category === 'All Paths') {
        renderCourses(allCourses);
    } else {
        const filtered = allCourses.filter(c => c.category.toLowerCase() === category.toLowerCase());
        renderCourses(filtered);
    }
}

async function openCourseModal(id) {
    trackMetric('Click', 'Course Card in Marketplace', id);
    const modal = document.getElementById('coursePreviewModal');
    try {
        UI.showLoader();
        const res = await fetch(`${API_URL}/courses/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const { course, content, hasFullAccess, isExpired } = data;

        document.getElementById('modalTitle').textContent = course.title;
        document.getElementById('modalMentor').textContent = `By ${course.mentorID?.name}`;
        document.getElementById('modalDesc').textContent = course.description;
        document.getElementById('modalPrice').textContent = `$${course.price}`;
        document.getElementById('modalImg').src = course.thumbnail || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';

        const enrollBtn = document.getElementById('enrollBtn');
        if (hasFullAccess) {
            enrollBtn.textContent = 'Already Enrolled';
            enrollBtn.disabled = true;
            enrollBtn.style.background = 'var(--color-success)';
        } else if (isExpired) {
            enrollBtn.textContent = 'Access Expired';
            enrollBtn.disabled = false;
            enrollBtn.style.background = 'var(--color-error)';
            enrollBtn.onclick = () => { window.location.href = `checkout.html?course=${id}`; };
            UI.info('Your previous enrollment in this path has reached its conclusion. Renew to continue.');
        } else {
            enrollBtn.textContent = `Enroll for $${course.price}`;
            enrollBtn.disabled = false;
            enrollBtn.onclick = () => { window.location.href = `checkout.html?course=${id}`; };
        }


        const materialList = document.getElementById('materialList');
        materialList.innerHTML = '<h4 style="margin-bottom: 15px;">Curriculum Preview</h4>';

        // Fetch Preview Data separately to get public preview durations if not logged in
        let previews = [];
        try {
            const previewRes = await fetch(`${API_URL}/courses/${id}/preview`);
            if (previewRes.ok) {
                const previewData = await previewRes.json();
                previews = previewData.previews || [];
            }
        } catch (e) {
            console.log('Preview fetch failed', e);
        }

        if (content.length === 0) {
            materialList.innerHTML += '<p style="font-size: 0.85rem; color: var(--color-text-secondary);">No curriculum materials uploaded yet.</p>';
        } else {
            materialList.innerHTML += content.map(m => {
                // Check if this specific content has a preview available
                const previewInfo = previews.find(p => p._id === m._id || (p.fileUrl === m.fileUrl && p.title === m.title)); // Fallback match
                const isPreviewAvailable = previewInfo && previewInfo.previewDuration > 0;
                const isLocked = !hasFullAccess && !isPreviewAvailable;

                return `
                    <div class="glass-premium" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fff; border-radius: 12px; margin-bottom: 10px; ${isLocked ? 'opacity: 0.6;' : ''}">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas ${isLocked ? 'fa-lock' : (m.type === 'Video' ? 'fa-play-circle' : 'fa-file-pdf')}" style="color: ${isLocked ? '#ccc' : 'var(--color-saffron)'};"></i>
                            <div>
                                <p style="font-size: 0.9rem; font-weight: 500;">${m.title}</p>
                                ${!hasFullAccess && isPreviewAvailable ? `<small style="color: var(--color-success);"><i class="fas fa-eye"></i> Free Preview (${previewInfo.previewDuration}s)</small>` : ''}
                                ${isLocked ? `<small style="color: #999;">Enroll to unlock</small>` : ''}
                            </div>
                        </div>
                        <button class="btn-primary" onclick="${isLocked ? `UI.info('Enroll to unlock this lesson')` : (isPreviewAvailable && !hasFullAccess ? `playPreview('${previewInfo.fileUrl}', ${previewInfo.previewDuration}, '${course._id}', '${m._id}')` : `launchContent('${m._id}', '${course._id}')`)}" 
                                style="padding: 6px 15px; font-size: 0.7rem; background: ${hasFullAccess ? 'var(--color-success)' : (isPreviewAvailable ? 'var(--color-golden)' : '#ccc')}; cursor: ${isLocked ? 'not-allowed' : 'pointer'};">
                            ${hasFullAccess ? 'Open' : (isPreviewAvailable ? 'Watch Preview' : 'Locked')}
                        </button>
                    </div>
                `;
            }).join('');
        }

        modal.style.display = 'flex';
    } catch (err) {
        UI.error('Could not illuminate course details.');
    } finally {
        UI.hideLoader();
    }
}

function closeModal() {
    document.getElementById('coursePreviewModal').style.display = 'none';
}

function launchContent(mId, cId) {
    window.location.href = `player.html?course=${cId}&content=${mId}`;
}

// Preview Player Logic
let previewTimer;
function playPreview(url, duration, courseId, contentId) {
    const playerModal = document.createElement('div');
    playerModal.id = 'previewPlayerModal';
    playerModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 2000; display: flex; justify-content: center; align-items: center; flex-direction: column;';

    playerModal.innerHTML = `
        <div style="position: relative; width: 80%; max-width: 900px; aspect-ratio: 16/9; background: #000; border-radius: 10px; overflow: hidden; box-shadow: 0 0 50px rgba(255,153,51,0.2);">
            <button onclick="closePreview()" style="position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.5); color: white; border: none; font-size: 1.5rem; cursor: pointer; z-index: 10; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="fas fa-times"></i></button>
            <video id="previewVideo" src="${url}" style="width: 100%; height: 100%; object-fit: contain;" controls autoplay></video>
            
            <div id="previewOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: none; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: white;">
                <i class="fas fa-lock" style="font-size: 4rem; color: var(--color-saffron); margin-bottom: 20px;"></i>
                <h2 style="font-family: var(--font-heading); margin-bottom: 10px;">Preview Ended</h2>
                <p style="margin-bottom: 30px; opacity: 0.8;">Unlock the full wisdom of this path by enrolling today.</p>
                <button onclick="window.location.href='checkout.html?course=${courseId}'" class="btn-primary" style="font-size: 1.2rem; padding: 15px 40px;">Enroll Now</button>
                <button onclick="closePreview()" style="margin-top: 15px; background: none; border: none; color: white; text-decoration: underline; cursor: pointer;">Maybe Later</button>
            </div>

            <div id="previewTimer" style="position: absolute; top: 15px; left: 15px; background: rgba(0,0,0,0.7); color: white; padding: 5px 12px; border-radius: 20px; font-size: 0.85rem;">
                <i class="fas fa-eye"></i> Preview Mode: <span id="timeLeft">${duration}</span>s remaining
            </div>
        </div>
    `;

    document.body.appendChild(playerModal);

    const video = document.getElementById('previewVideo');
    const overlay = document.getElementById('previewOverlay');
    const timeLeftSpan = document.getElementById('timeLeft');
    let timeLeft = duration;

    // Monitor Playback
    video.addEventListener('timeupdate', () => {
        const current = Math.floor(video.currentTime);
        if (current >= duration) {
            video.pause();
            video.currentTime = duration; // Lock at end
            overlay.style.display = 'flex'; // Show overlay

            // Track Completion
            trackMetric('PreviewCompleted', `Watched ${duration}s preview`, courseId);
        }
        timeLeftSpan.textContent = Math.max(0, duration - current);
    });

    // Initial Track
    trackMetric('View', `Generating Preview for ${contentId}`, courseId);
}

function closePreview() {
    const modal = document.getElementById('previewPlayerModal');
    if (modal) modal.remove();
}
