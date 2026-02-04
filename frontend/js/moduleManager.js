/**
 * Module Manager
 * Manage course modules with drag-drop reordering and rich content editing
 */

let currentCourse = null;
let modules = [];
let editingModule = null;
let sortable = null;
let quillEditor = null;

// Local upload helpers and modal logic removed - now handled in moduleEditor.js

document.addEventListener('DOMContentLoaded', async () => {
    // Verify auth
    const authData = Auth.checkAuth(['Staff', 'Admin']);
    if (!authData) return;

    // Load courses
    await loadCourses();

    // Event listeners
    document.getElementById('courseSelect').addEventListener('change', handleCourseChange);
    document.getElementById('addModuleBtn').addEventListener('click', () => {
        if (!currentCourse) {
            UI.error('Please select a course first');
            return;
        }
        window.location.href = `module-editor.html?courseId=${currentCourse}`;
    });

    // Immediate check to hide dropdown if courseId is present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('courseId')) {
        const courseSelectContainer = document.querySelector('.course-select');
        if (courseSelectContainer) {
            courseSelectContainer.style.display = 'none';
        }
    }
});



/**
 * Load courses for selection
 */
async function loadCourses() {
    try {
        const res = await fetch(`${Auth.apiBase}/staff/courses`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) {
            throw new Error('Failed to load courses');
        }

        // The response is an array directly, not { courses: [...] }
        const courses = await res.json();

        const select = document.getElementById('courseSelect');
        select.innerHTML = '<option value="">-- Select a course --</option>';

        if (!courses || courses.length === 0) {
            select.innerHTML += '<option value="" disabled>No courses available</option>';
            return;
        }

        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course._id;
            option.textContent = course.title;
            select.appendChild(option);
        });

        // Check URL parameters for courseId
        const urlParams = new URLSearchParams(window.location.search);
        const courseIdParam = urlParams.get('courseId');

        if (courseIdParam) {
            select.value = courseIdParam;
            // Only load if selection was successful (course exists in list)
            if (select.value === courseIdParam) {
                // Ensure it remains hidden
                const courseSelectContainer = document.querySelector('.course-select');
                if (courseSelectContainer) {
                    courseSelectContainer.style.display = 'none';
                }
                await handleCourseChange();
                return;
            } else {
                // Invalid course ID or not in list, show dropdown so user can pick
                const courseSelectContainer = document.querySelector('.course-select');
                if (courseSelectContainer) {
                    courseSelectContainer.style.display = 'block';
                }
                UI.error('Prescribed course not found. Please select from the list.');
            }
        } else {
            // No param, make sure it is visible
            const courseSelectContainer = document.querySelector('.course-select');
            if (courseSelectContainer) {
                courseSelectContainer.style.display = 'block';
            }
        }

        // Auto-select if only one course
        if (courses.length === 1) {
            select.value = courses[0]._id;
            await handleCourseChange();
        }

    } catch (err) {
        console.error('Failed to load courses:', err);
        const select = document.getElementById('courseSelect');
        select.innerHTML = '<option value="">Error loading courses - Check MongoDB connection</option>';
        UI.error('Failed to load courses. Please check if MongoDB is connected.');
    }
}

/**
 * Handle course selection change
 */
async function handleCourseChange() {
    const courseId = document.getElementById('courseSelect').value;

    if (!courseId) {
        currentCourse = null;
        modules = [];
        renderModules();
        return;
    }

    currentCourse = courseId;
    await loadModules(courseId);
}

/**
 * Load modules for selected course
 */
async function loadModules(courseId) {
    try {
        UI.showLoader();

        const res = await fetch(`${Auth.apiBase}/courses/${courseId}/modules?includeUnpublished=true`, {
            headers: Auth.getHeaders()
        });

        if (!res.ok) throw new Error('Failed to load modules');

        const data = await res.json();
        modules = data.modules || [];

        renderModules();

    } catch (err) {
        console.error('Failed to load modules:', err);
        UI.error('Failed to load modules');
    } finally {
        UI.hideLoader();
    }
}

/**
 * Render modules list
 */
function renderModules() {
    const container = document.getElementById('moduleList');

    if (modules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book"></i>
                <p>No modules yet. Create your first module!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = modules.map(module => `
        <div class="module-item" data-module-id="${module._id}">
            <div class="module-header">
                <i class="fas fa-grip-vertical drag-handle"></i>
                <div class="module-info">
                    <div class="module-title">${module.order + 1}. ${module.title}</div>
                    <div class="module-meta">
                        ${module.isPublished ? '<span style="color: #28a745;">• Published</span>' : '<span style="color: #ffc107;">• Draft</span>'}
                    </div>
                </div>
                <div class="module-actions">
                    <button class="icon-btn" onclick="editModule('${module._id}')" title="Edit Content">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn delete" onclick="deleteModule('${module._id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${module.description ? `<p style="margin: 10px 0 0 30px; color: #6c757d; font-size: 0.9rem;">${module.description}</p>` : ''}
        </div>
    `).join('');

    // Initialize drag-drop
    initializeSortable();
}

/**
 * Initialize Sortable.js for drag-drop
 */
function initializeSortable() {
    const container = document.getElementById('moduleList');

    if (sortable) {
        sortable.destroy();
    }

    sortable = new Sortable(container, {
        animation: 200,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: handleReorder
    });
}

/**
 * Handle module reorder
 */
async function handleReorder(evt) {
    const newOrder = Array.from(document.querySelectorAll('.module-item')).map((item, index) => {
        return {
            id: item.dataset.moduleId,
            order: index
        };
    });

    try {
        const res = await fetch(`${Auth.apiBase}/courses/${currentCourse}/modules/reorder`, {
            method: 'PUT',
            headers: {
                ...Auth.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ moduleOrders: newOrder })
        });

        if (!res.ok) throw new Error('Failed to reorder');

        // Update local order
        modules.forEach(module => {
            const found = newOrder.find(o => o.id === module._id);
            if (found) module.order = found.order;
        });

        UI.success('Modules reordered successfully');

    } catch (err) {
        console.error('Reorder failed:', err);
        UI.error('Failed to reorder modules');
        // Reload to restore original order
        await loadModules(currentCourse);
    }
}

/**
 * Edit module
 */
window.editModule = function (moduleId) {
    if (!currentCourse) return;
    window.location.href = `module-editor.html?courseId=${currentCourse}&moduleId=${moduleId}`;
};

/**
 * Delete module
 */
window.deleteModule = async function (moduleId) {
    const module = modules.find(m => m._id === moduleId);
    if (!module) return;

    if (!confirm(`Are you sure you want to delete "${module.title}"?\n\nThis cannot be undone.`)) {
        return;
    }

    try {
        UI.showLoader();

        const res = await fetch(`${Auth.apiBase}/modules/${moduleId}`, {
            method: 'DELETE',
            headers: Auth.getHeaders()
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to delete');
        }

        UI.success('Module deleted successfully');
        await loadModules(currentCourse);

    } catch (err) {
        console.error('Delete failed:', err);
        UI.error('Failed to delete module: ' + err.message);
    } finally {
        UI.hideLoader();
    }
};
