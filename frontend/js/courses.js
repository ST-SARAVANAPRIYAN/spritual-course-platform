/**
 * InnerSpark - Marketplace Discovery Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    loadMarketplace();

    // Filter State
    window.state = {
        category: 'All Paths',
        search: '',
        sort: 'newest'
    };

    // Event Listeners
    // 1. Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            window.state.search = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    }

    // 2. Sort
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            window.state.sort = e.target.value;
            applyFilters();
        });
    }

    // 3. Category Tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            window.state.category = tab.textContent;
            applyFilters();
        });
    });
});

let allCourses = [];

async function loadMarketplace() {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/marketplace`);
        allCourses = await res.json();
        // Initial render with filters
        applyFilters();
    } catch (err) {
        console.error('Marketplace Error:', err);
        UI.error(`The course catalog is currently unavailable: ${err.message}`);
    } finally {
        UI.hideLoader();
    }
}

// Helper to sanitize thumbnail URLs
function getThumbnail(url) {
    if (!url || url.includes('via.placeholder.com')) {
        return 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
    }
    return url;
}

function renderCourses(courses) {
    const list = document.getElementById('marketplaceCourses');

    // Create sections container if not present
    if (!document.getElementById('exploreSections')) {
        // Change default grid container to a flex container for sections
        list.className = '';
        list.style.maxWidth = '1200px';
        list.style.margin = '0 auto 100px';
        list.style.padding = '0 20px';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '40px';

        list.innerHTML = `
            <div id="exploreSections" style="width: 100%; display: flex; flex-direction: column; gap: 40px;">
                <div id="upcomingSection" style="display: none;">
                    <h2 class="section-title" style="margin-bottom: 20px; border-left: 5px solid var(--color-saffron); padding-left: 15px;">Upcoming Paths</h2>
                    <div class="courses-grid" id="upcomingCoursesGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 30px;"></div>
                </div>
                <div id="currentSection">
                    <h2 class="section-title" style="margin-bottom: 20px; border-left: 5px solid var(--color-primary); padding-left: 15px;">Explore Courses</h2>
                    <div class="courses-grid" id="currentCoursesGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 30px;"></div>
                </div>
            </div>
        `;
    }

    const upcomingGrid = document.getElementById('upcomingCoursesGrid');
    const currentGrid = document.getElementById('currentCoursesGrid');
    const upcomingSection = document.getElementById('upcomingSection');

    // Filter Logic
    const upcoming = courses.filter(c => c.status === 'Approved');
    const current = courses.filter(c => c.status === 'Published');

    // Helper to generate Card HTML
    const generateCard = (c, isUpcoming) => `
        <div class="course-card glass-premium" style="background: white; border-radius: var(--border-radius-lg); overflow: hidden; cursor: default; transition: var(--transition-smooth); opacity: ${isUpcoming ? '0.9' : '1'};">
            <div class="course-thumb" style="background-image: url('${getThumbnail(c.thumbnail)}'); background-size: cover; background-position: center; height: 200px; width: 100%; position: relative;">
                ${isUpcoming ? '<div style="position: absolute; top: 10px; right: 10px; background: var(--color-saffron); color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold; font-size: 0.8rem;">Coming Soon</div>' : ''}
            </div>
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-saffron); font-weight: 700;">${c.category}</span>
                    <span style="font-weight: 700; color: var(--color-saffron); font-size: 1.1rem;">$${c.price}</span>
                </div>
                <h3 style="margin-bottom: 10px; font-family: var(--font-heading);">${c.title}</h3>
                <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 15px;">By ${c.mentors && c.mentors[0] ? c.mentors[0].name : 'Mentor'}</p>
                <div style="display: flex; align-items: center; gap: 15px; font-size: 0.8rem; color: #999;">
                    <span><i class="fas fa-layer-group"></i> ${c.totalLessons || 0} Lessons</span>
                    ${isUpcoming ? '<span><i class="fas fa-clock"></i> Releases Soon</span>' : '<span><i class="fas fa-star" style="color: var(--color-golden);"></i> 4.9</span>'}
                </div>
                ${isUpcoming ? `<button onclick="openNotifyModal('${c._id}', '${c.title.replace(/'/g, "\\'")}')" class="btn-primary" style="width: 100%; margin-top: 15px; background: linear-gradient(135deg, #D97706 0%, #F59E0B 100%); cursor: pointer;"><i class="fas fa-bell"></i> Notify Me</button>` : `<button onclick="openExploreModal('${c._id}')" class="btn-primary" style="width: 100%; margin-top: 15px; background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-golden) 100%); cursor: pointer;"><i class="fas fa-compass"></i> Explore Course</button>`}
            </div>
        </div>
    `;

    // Render Upcoming
    if (upcoming.length > 0) {
        upcomingSection.style.display = 'block';
        upcomingGrid.innerHTML = upcoming.map(c => generateCard(c, true)).join('');
    } else {
        upcomingSection.style.display = 'none';
    }

    // Render Current
    if (current.length === 0 && upcoming.length === 0) {
        currentGrid.innerHTML = '<p style="text-align:center; padding: 50px;">No paths found in this category yet.</p>';
    } else {
        currentGrid.innerHTML = current.map(c => generateCard(c, false)).join('');
        // Track Impressions for current courses
        current.forEach(c => trackMetric('View', `Course List: ${c.title}`, c._id));
    }
}

async function trackMetric(type, metadata = '', courseID = null) {
    try {
        await fetch(`${Auth.apiBase}/analytics/track`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({ courseID, type, metadata })
        });
    } catch (e) { }
}



function applyFilters() {
    let filtered = [...allCourses];
    const s = window.state;

    // 1. Filter by Category
    if (s.category !== 'All Paths') {
        filtered = filtered.filter(c => c.category && c.category.toLowerCase() === s.category.toLowerCase());
    }

    // 2. Filter by Search
    if (s.search) {
        filtered = filtered.filter(c =>
            (c.title && c.title.toLowerCase().includes(s.search)) ||
            (c.description && c.description.toLowerCase().includes(s.search)) ||
            (c.mentors && c.mentors[0] && c.mentors[0].name.toLowerCase().includes(s.search))
        );
    }

    // 3. Sort
    filtered.sort((a, b) => {
        switch (s.sort) {
            case 'price-asc':
                return (a.price || 0) - (b.price || 0);
            case 'price-desc':
                return (b.price || 0) - (a.price || 0);
            case 'title-asc':
                return a.title.localeCompare(b.title);
            case 'title-desc':
                return b.title.localeCompare(a.title);
            case 'newest':
            default:
                // Assuming newer items are at the end of the array by default or have createdAt
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
    });

    renderCourses(filtered);
}



async function openCourseModal(id) {
    trackMetric('Click', 'Course Card in Catalog', id);
    const modal = document.getElementById('coursePreviewModal');
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/${id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const { course, content, hasFullAccess, isExpired } = data;

        document.getElementById('modalTitle').textContent = course.title;
        document.getElementById('modalMentor').textContent = `By ${course.mentorID?.name}`;
        document.getElementById('modalDesc').textContent = course.description;
        document.getElementById('modalPrice').textContent = `$${course.price}`;
        document.getElementById('modalImg').src = getThumbnail(course.thumbnail);
        document.getElementById('modalImg').onerror = function () {
            this.src = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
        };

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
            const previewRes = await fetch(`${Auth.apiBase}/courses/${id}/preview`);
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

// Helper to sanitize thumbnail URLs
function getThumbnail(url) {
    if (!url || url.includes('via.placeholder.com')) {
        return 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80';
    }
    return url;
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
// --- COURSE SUBSCRIPTION / NOTIFY ME FEATURE ---

function openNotifyModal(courseId, courseTitle) {
    window.currentNotifyCourseId = courseId;
    window.currentNotifyCourseTitle = courseTitle;
    
    // Create modal if it doesn't exist
    if (!document.getElementById('notifyMeModal')) {
        const modalHTML = `
            <div id="notifyMeModal" class="modal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(5px); overflow-y: auto; padding: 20px;">
                <div class="modal-content glass-card" style="position: relative; margin: auto; padding: 0; max-width: 500px; width: 100%; max-height: calc(100vh - 40px); overflow-y: auto; border-radius: 16px; animation: slideDown 0.3s ease; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                    <div style="background: linear-gradient(135deg, #D97706 0%, #F59E0B 100%); padding: 25px; border-radius: 16px 16px 0 0; color: white;">
                        <h2 style="margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-bell"></i> Get Notified
                        </h2>
                        <p style="margin: 8px 0 0; opacity: 0.95; font-size: 0.9rem;" id="notifyCourseTitle"></p>
                    </div>
                    <div style="padding: 30px;">
                        <p style="color: #666; margin-bottom: 25px; line-height: 1.6;">
                            Subscribe to get notified when this course becomes available. We'll send you an email with all the details!
                        </p>
                        <form id="notifyMeForm">
                            <div class="form-group" style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 8px; color: #333; font-weight: 500;">Name <span style="color: red;">*</span></label>
                                <input type="text" id="notifyName" class="form-control" placeholder="Your full name" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem;">
                            </div>
                            <div class="form-group" style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 8px; color: #333; font-weight: 500;">Email <span style="color: red;">*</span></label>
                                <input type="email" id="notifyEmail" class="form-control" placeholder="your.email@example.com" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem;">
                            </div>
                            <div class="form-group" style="margin-bottom: 25px;">
                                <label style="display: block; margin-bottom: 8px; color: #333; font-weight: 500;">Phone Number <span style="color: red;">*</span></label>
                                <input type="tel" id="notifyPhone" class="form-control" placeholder="10-digit phone number" required maxlength="10" pattern="[0-9]{10}" oninput="validateNotifyPhone()" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem;">
                                <div id="phoneValidationMsg" style="margin-top: 5px; font-size: 0.85rem;"></div>
                            </div>
                            <div style="display: flex; gap: 12px;">
                                <button type="button" onclick="closeNotifyModal()" class="btn-secondary" style="flex: 1; padding: 12px; border: 1px solid #ddd; background: white; color: #666; border-radius: 8px; font-size: 1rem; cursor: pointer;">
                                    Cancel
                                </button>
                                <button type="submit" id="submitNotifyBtn" class="btn-primary" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #D97706 0%, #F59E0B 100%); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">
                                    <i class="fas fa-bell"></i> Notify Me
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add form submit handler
        document.getElementById('notifyMeForm').addEventListener('submit', handleNotifySubmit);
    }
    
    // Show modal and set course title
    document.getElementById('notifyCourseTitle').textContent = courseTitle;
    document.getElementById('notifyMeModal').style.display = 'block';
    
    // Clear form
    document.getElementById('notifyMeForm').reset();
    document.getElementById('phoneValidationMsg').textContent = '';
}

function closeNotifyModal() {
    document.getElementById('notifyMeModal').style.display = 'none';
}

function validateNotifyPhone() {
    const phoneInput = document.getElementById('notifyPhone');
    const validationMsg = document.getElementById('phoneValidationMsg');
    
    // Remove non-numeric characters
    phoneInput.value = phoneInput.value.replace(/\D/g, '');
    
    const phone = phoneInput.value;
    const remaining = 10 - phone.length;
    
    if (phone.length === 0) {
        validationMsg.textContent = '';
        validationMsg.style.color = '';
    } else if (phone.length < 10) {
        validationMsg.textContent = `${remaining} more digit${remaining > 1 ? 's' : ''} required`;
        validationMsg.style.color = '#DC2626';
    } else if (phone.length === 10) {
        validationMsg.innerHTML = '<i class="fas fa-check-circle"></i> Valid phone number';
        validationMsg.style.color = '#10B981';
    }
}

async function handleNotifySubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('notifyName').value.trim();
    const email = document.getElementById('notifyEmail').value.trim();
    const phone = document.getElementById('notifyPhone').value.trim();
    
    // Validate phone
    if (!/^[0-9]{10}$/.test(phone)) {
        UI.error('Please enter a valid 10-digit phone number');
        return;
    }
    
    const submitBtn = document.getElementById('submitNotifyBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';
    
    try {
        const res = await fetch(`${Auth.apiBase}/subscribers/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                courseID: window.currentNotifyCourseId,
                name,
                email,
                phone
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            UI.success(data.message || 'Successfully subscribed! We will notify you when the course is available.');
            closeNotifyModal();
        } else {
            UI.error(data.message || 'Subscription failed. Please try again.');
        }
    } catch (err) {
        console.error('Subscription error:', err);
        UI.error('Network error. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-bell"></i> Notify Me';
    }
}

window.openNotifyModal = openNotifyModal;
window.closeNotifyModal = closeNotifyModal;
window.validateNotifyPhone = validateNotifyPhone;

// --- COURSE EXPLORATION MODAL ---

function openExploreModal(courseId) {
    // Create modal if it doesn't exist
    if (!document.getElementById('exploreCourseModal')) {
        const modalHTML = `
            <div id="exploreCourseModal" class="modal" style="display: none; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); overflow-y: auto; padding: 20px; align-items: center; justify-content: center;">
                <div class="modal-content glass-card" style="position: relative; background: white; margin: auto; max-width: 800px; width: 100%; max-height: calc(100vh - 40px); overflow-y: auto; border-radius: 20px; animation: slideDown 0.3s ease; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <button onclick="closeExploreModal()" style="position: absolute; top: 20px; right: 20px; background: white; border: none; font-size: 2rem; cursor: pointer; color: #999; z-index: 10; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); transition: all 0.3s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">&times;</button>
                    
                    <div id="exploreModalThumb" style="width: 100%; height: 300px; background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 20px 20px 0 0; position: relative;">
                        <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 30px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);">
                            <h2 id="exploreModalTitle" style="color: white; font-size: 2rem; margin: 0; font-family: var(--font-heading); text-shadow: 0 2px 10px rgba(0,0,0,0.5);"></h2>
                        </div>
                    </div>
                    
                    <div style="padding: 40px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0;">
                            <div>
                                <p id="exploreModalMentor" style="color: var(--color-primary); font-weight: 600; font-size: 1.1rem; margin: 0 0 5px 0;">
                                    <i class="fas fa-user-circle"></i> <span></span>
                                </p>
                                <p id="exploreModalCategory" style="color: #666; font-size: 0.9rem; margin: 0;">
                                    <i class="fas fa-tag"></i> <span></span>
                                </p>
                            </div>
                            <div style="text-align: right;">
                                <p id="exploreModalPrice" style="font-size: 2.5rem; font-weight: 700; color: var(--color-saffron); margin: 0; line-height: 1;"></p>
                                <p style="font-size: 0.85rem; color: #999; margin: 5px 0 0 0;">Lifetime Access</p>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 25px;">
                            <h3 style="color: var(--color-primary); margin-bottom: 15px; font-size: 1.3rem;">
                                <i class="fas fa-info-circle"></i> Course Overview
                            </h3>
                            <p id="exploreModalDescription" style="color: #555; line-height: 1.8; font-size: 1rem;"></p>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 12px;">
                            <div style="text-align: center;">
                                <div style="font-size: 2rem; color: var(--color-primary); margin-bottom: 5px;">
                                    <i class="fas fa-layer-group"></i>
                                </div>
                                <p id="exploreModalLessons" style="font-weight: 600; color: #333; margin: 0; font-size: 1.1rem;"></p>
                                <p style="font-size: 0.85rem; color: #666; margin: 5px 0 0 0;">Lessons</p>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 2rem; color: var(--color-saffron); margin-bottom: 5px;">
                                    <i class="fas fa-star"></i>
                                </div>
                                <p style="font-weight: 600; color: #333; margin: 0; font-size: 1.1rem;">4.9</p>
                                <p style="font-size: 0.85rem; color: #666; margin: 5px 0 0 0;">Rating</p>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 2rem; color: var(--color-success); margin-bottom: 5px;">
                                    <i class="fas fa-infinity"></i>
                                </div>
                                <p style="font-weight: 600; color: #333; margin: 0; font-size: 1.1rem;">Lifetime</p>
                                <p style="font-size: 0.85rem; color: #666; margin: 5px 0 0 0;">Access</p>
                            </div>
                        </div>
                        
                        <div style="background: linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 100%); padding: 20px; border-radius: 12px; border-left: 4px solid var(--color-saffron); margin-bottom: 30px;">
                            <p style="margin: 0; color: #92400E; font-size: 0.95rem; line-height: 1.6;">
                                <i class="fas fa-lightbulb" style="color: var(--color-saffron); margin-right: 8px;"></i>
                                <strong>Ready to start your journey?</strong> Create an account to enroll in this course and unlock your path to self-discovery.
                            </p>
                        </div>
                        
                        <button onclick="redirectToRegister()" class="btn-primary" style="width: 100%; padding: 18px; font-size: 1.2rem; font-weight: 600; background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-golden) 100%); border: none; border-radius: 12px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(139, 69, 19, 0.3);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(139, 69, 19, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(139, 69, 19, 0.3)'">
                            <i class="fas fa-user-plus"></i> Register Now to Enroll
                        </button>
                        
                        <p style="text-align: center; margin-top: 15px; font-size: 0.85rem; color: #999;">
                            <i class="fas fa-shield-alt" style="color: var(--color-success);"></i> Secure registration • Money-back guarantee
                        </p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Fetch course details and populate modal
    loadCourseDetails(courseId);
    
    // Show modal
    const modal = document.getElementById('exploreCourseModal');
    modal.style.display = 'flex';
    trackMetric('Click', 'Explore Course Button', courseId);
}

async function loadCourseDetails(courseId) {
    try {
        UI.showLoader();
        const res = await fetch(`${Auth.apiBase}/courses/${courseId}`);
        
        if (!res.ok) {
            throw new Error('Failed to load course details');
        }
        
        const data = await res.json();
        const course = data.course;
        
        // Populate modal with course data
        document.getElementById('exploreModalTitle').textContent = course.title;
        document.getElementById('exploreModalMentor').querySelector('span').textContent = course.mentorID?.name || 'Mentor';
        document.getElementById('exploreModalCategory').querySelector('span').textContent = course.category || 'General';
        document.getElementById('exploreModalPrice').textContent = `$${course.price}`;
        document.getElementById('exploreModalDescription').textContent = course.description || 'Discover the transformative power of this course.';
        document.getElementById('exploreModalLessons').textContent = course.totalLessons || 0;
        
        const thumbUrl = getThumbnail(course.thumbnail);
        document.getElementById('exploreModalThumb').style.backgroundImage = `url('${thumbUrl}')`;
        
    } catch (err) {
        console.error('Error loading course details:', err);
        UI.error('Failed to load course details. Please try again.');
        closeExploreModal();
    } finally {
        UI.hideLoader();
    }
}

function closeExploreModal() {
    const modal = document.getElementById('exploreCourseModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function redirectToRegister() {
    trackMetric('Click', 'Register Now from Explore Modal');
    window.location.href = 'register.html';
}

window.openExploreModal = openExploreModal;
window.closeExploreModal = closeExploreModal;
window.redirectToRegister = redirectToRegister;