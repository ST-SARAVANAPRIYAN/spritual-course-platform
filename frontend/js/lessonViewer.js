/**
 * Lesson Viewer for Students
 * Displays lesson content with module navigation
 */

let currentCourse = null;
let currentLesson = null;
let allModules = [];
let allLessons = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('courseId');
    const lessonId = params.get('lessonId');

    if (!courseId) {
        UI.error('No course selected');
        window.location.href = 'index.html';
        return;
    }

    currentCourse = courseId;

    // Load course data and modules
    await loadCourseData(courseId);
    await loadModules(courseId);

    // Load specific lesson or first lesson
    if (lessonId) {
        await loadLesson(lessonId);
    } else if (allLessons.length > 0) {
        await loadLesson(allLessons[0]._id);
    } else {
        showEmptyState();
    }

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');

    if (window.innerWidth <= 768) {
        mobileBtn.style.display = 'block';
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
});

/**
 * Load course data
 */
async function loadCourseData(courseId) {
    try {
        const res = await fetch(`${Auth.apiBase}/courses/${courseId}`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load course');

        const data = await res.json();
        const course = data.course;

        // Update UI
        document.getElementById('courseTitle').textContent = course.title;
        document.getElementById('breadcrumbCourse').textContent = course.title;

    } catch (err) {
        console.error('Failed to load course:', err);
        UI.error('Failed to load course');
    }
}

/**
 * Load modules and lessons
 */
async function loadModules(courseId) {
    try {
        const res = await fetch(`${Auth.apiBase}/courses/${courseId}/modules`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load modules');

        const data = await res.json();
        allModules = data.modules || [];

        // Flatten all lessons
        allLessons = [];
        allModules.forEach(module => {
            if (module.lessons && module.lessons.length > 0) {
                module.lessons.forEach(lesson => {
                    allLessons.push({
                        ...lesson,
                        moduleName: module.title,
                        moduleId: module._id
                    });
                });
            }
        });

        renderModulesList();
        updateProgress();

    } catch (err) {
        console.error('Failed to load modules:', err);
        UI.error('Failed to load modules');
    }
}

/**
 * Render modules and lessons sidebar
 */
function renderModulesList() {
    const container = document.getElementById('modulesList');

    if (allModules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book"></i>
                <p>No modules available yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = allModules.map((module, index) => {
        const lessons = module.lessons || [];

        return `
            <div class="module-item ${index === 0 ? 'expanded' : ''}" data-module-id="${module._id}">
                <div class="module-header" onclick="toggleModule('${module._id}')">
                    <div class="module-title">
                        <i class="fas fa-book"></i> ${module.order + 1}. ${module.title}
                    </div>
                    <i class="fas fa-chevron-right module-icon"></i>
                </div>
                <div class="lessons-list">
                    ${lessons.length === 0 ? '<p style="padding: 15px 40px; color: #6c757d; font-size: 0.85rem;">No lessons yet</p>' :
                lessons.map((lesson, idx) => `
                        <a href="?courseId=${currentCourse}&lessonId=${lesson._id}" 
                           class="lesson-link ${currentLesson && currentLesson._id === lesson._id ? 'active' : ''}"
                           data-lesson-id="${lesson._id}">
                            <i class="fas fa-play-circle lesson-icon"></i>
                            <span class="lesson-name">${idx + 1}. ${lesson.title}</span>
                            ${lesson.duration ? `<span class="lesson-duration">${lesson.duration}m</span>` : ''}
                        </a>
                      `).join('')
            }
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Toggle module expansion
 */
window.toggleModule = function (moduleId) {
    const moduleItem = document.querySelector(`[data-module-id="${moduleId}"]`);
    if (moduleItem) {
        moduleItem.classList.toggle('expanded');
    }
};

/**
 * Load and display lesson
 */
async function loadLesson(lessonId) {
    try {
        UI.showLoader();

        const res = await fetch(`${Auth.apiBase}/lessons/${lessonId}?includeContent=true`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) {
            throw new Error('Failed to load lesson');
        }

        const data = await res.json();
        currentLesson = data.lesson;

        // Update URL without reload
        const newUrl = `${window.location.pathname}?courseId=${currentCourse}&lessonId=${lessonId}`;
        window.history.pushState({}, '', newUrl);

        // Update UI
        document.getElementById('lessonTitle').textContent = currentLesson.title;
        document.getElementById('lessonDuration').textContent = currentLesson.duration || '--';
        document.getElementById('breadcrumbLesson').textContent = currentLesson.title;

        // Find and display module name
        const lessonData = allLessons.find(l => l._id === lessonId);
        if (lessonData) {
            document.getElementById('moduleTitle').textContent = lessonData.moduleName;
        }

        // Show description if exists
        const descElement = document.getElementById('lessonDescription');
        if (currentLesson.description) {
            descElement.style.display = 'block';
            descElement.innerHTML = `<p>${currentLesson.description}</p>`;
        } else {
            descElement.style.display = 'none';
        }

        // Render content using ContentRenderer
        const renderer = new ContentRenderer('contentContainer');
        renderer.render(currentLesson.content);

        // Update active lesson in sidebar
        document.querySelectorAll('.lesson-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-lesson-id="${lessonId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');

            // Expand parent module
            const moduleItem = activeLink.closest('.module-item');
            if (moduleItem) {
                moduleItem.classList.add('expanded');
            }
        }

        // Update navigation buttons
        updateNavigationButtons();

        // Mark as completed (if progress tracking exists)
        markLessonComplete(lessonId);

        // Scroll to top
        document.querySelector('.main-content').scrollTo(0, 0);

    } catch (err) {
        console.error('Failed to load lesson:', err);
        UI.error('Failed to load lesson: ' + err.message);
        showErrorState();
    } finally {
        UI.hideLoader();
    }
}

/**
 * Update navigation buttons
 */
function updateNavigationButtons() {
    const currentIndex = allLessons.findIndex(l => l._id === currentLesson._id);

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Previous button
    if (currentIndex > 0) {
        prevBtn.classList.remove('disabled');
        prevBtn.href = `?courseId=${currentCourse}&lessonId=${allLessons[currentIndex - 1]._id}`;
        prevBtn.onclick = (e) => {
            e.preventDefault();
            loadLesson(allLessons[currentIndex - 1]._id);
        };
    } else {
        prevBtn.classList.add('disabled');
    }

    // Next button
    if (currentIndex < allLessons.length - 1) {
        nextBtn.classList.remove('disabled');
        nextBtn.href = `?courseId=${currentCourse}&lessonId=${allLessons[currentIndex + 1]._id}`;
        nextBtn.onclick = (e) => {
            e.preventDefault();
            loadLesson(allLessons[currentIndex + 1]._id);
        };
    } else {
        nextBtn.classList.add('disabled');
    }
}

/**
 * Update progress bar
 */
function updateProgress() {
    // This is a placeholder - integrate with actual progress tracking
    const completedLessons = 0; // Get from progress API
    const totalLessons = allLessons.length;

    if (totalLessons === 0) return;

    const percentage = Math.round((completedLessons / totalLessons) * 100);

    document.getElementById('progressText').textContent = `${percentage}% Complete`;
    document.getElementById('progressFill').style.width = `${percentage}%`;
}

/**
 * Mark lesson as complete
 */
async function markLessonComplete(lessonId) {
    // Placeholder for progress tracking
    // This would typically call a progress API endpoint
    try {
        // await fetch(`${Auth.apiBase}/progress/mark-complete`, {
        //     method: 'POST',
        //     headers: {
        //         ...Auth.getHeaders(),
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({
        //         courseId: currentCourse,
        //         lessonId: lessonId
        //     })
        // });

        console.log('Lesson viewed:', lessonId);
    } catch (err) {
        console.error('Failed to mark complete:', err);
    }
}

/**
 * Show empty state
 */
function showEmptyState() {
    document.getElementById('contentContainer').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-book-open"></i>
            <h3>No lessons available</h3>
            <p>This course doesn't have any published lessons yet.</p>
        </div>
    `;
}

/**
 * Show error state
 */
function showErrorState() {
    document.getElementById('contentContainer').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Failed to load lesson</h3>
            <p>Please try refreshing the page.</p>
        </div>
    `;
}
