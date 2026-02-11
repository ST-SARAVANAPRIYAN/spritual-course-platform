/**
 * InnerSpark - Global UI Utilities
 */

const UI = {
    loader: null,
    toastContainer: null,

    init() {
        // Create Loader
        if (!document.getElementById('global-loader')) {
            const loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.innerHTML = '<span class="sparkle-loader"></span>';
            document.body.appendChild(loader);
            this.loader = loader;
        }

        // Create Toast Container
        if (!document.querySelector('.toast-container')) {
            const container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
            this.toastContainer = container;
        }
    },

    showLoader() {
        if (!this.loader) this.init();
        this.loader.style.display = 'flex';
    },

    hideLoader() {
        if (this.loader) this.loader.style.display = 'none';
    },

    showToast(message, type = 'info', duration = 4000) {
        if (!this.toastContainer) this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';

        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;

        this.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 400);
        }, duration);
    },

    success(msg) { this.showToast(msg, 'success'); },
    error(msg) { this.showToast(msg, 'error'); },
    info(msg) { this.showToast(msg, 'info'); },

    // Create styled popup modal
    createPopup(config) {
        const { title, message, type = 'info', icon = 'info-circle', confirmText = 'OK', onConfirm, cancelText, onCancel, persistent = false } = config;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        // Icon colors
        const iconColors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };

        // Create popup
        const popup = document.createElement('div');
        popup.style.cssText = `
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
            overflow: hidden;
            animation: slideIn 0.3s ease;
        `;

        popup.innerHTML = `
            <div style="padding: 30px; text-align: center;">
                <div style="margin-bottom: 20px;">
                    <i class="fas fa-${icon}" style="font-size: 4rem; color: ${iconColors[type] || iconColors.info};"></i>
                </div>
                <h2 style="margin: 0 0 15px 0; color: #333; font-size: 1.5rem;">${title}</h2>
                <p style="margin: 0; color: #666; line-height: 1.6; white-space: pre-line;">${message}</p>
            </div>
            <div style="padding: 20px 30px; background: #f8f9fa; display: flex; gap: 10px; justify-content: ${cancelText ? 'space-between' : 'center'};">
                ${cancelText ? `<button id="popup-cancel" style="flex: 1; padding: 12px 24px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 500; transition: all 0.3s;">${cancelText}</button>` : ''}
                <button id="popup-confirm" style="flex: 1; padding: 12px 24px; border: none; background: linear-gradient(135deg, var(--color-saffron), var(--color-golden)); color: white; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.3s;">${confirmText}</button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Add animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Close function
        const closePopup = () => {
            overlay.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => overlay.remove(), 300);
        };

        // Event listeners
        const confirmBtn = popup.querySelector('#popup-confirm');
        confirmBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            closePopup();
        });

        if (cancelText) {
            const cancelBtn = popup.querySelector('#popup-cancel');
            cancelBtn.addEventListener('click', () => {
                if (onCancel) onCancel();
                closePopup();
            });
        }

        // Close on overlay click if not persistent
        if (!persistent) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closePopup();
            });
        }

        return { close: closePopup };
    },

    /**
     * Fix relative upload URLs in rich content to point to backend server
     * This prevents 404 errors when frontend is served from a different port (e.g., Live Server)
     */
    fixContentUrls(htmlContent) {
        if (!htmlContent) return htmlContent;
        
        // Get the backend base URL (without /api)
        // Handle case when CONFIG might not be loaded
        const backendUrl = (typeof CONFIG !== 'undefined' && CONFIG.CLIENT_URL) ? CONFIG.CLIENT_URL : 'http://localhost:5001';
        
        // Replace relative /uploads/ paths with absolute backend URLs
        // This handles: <img src="/uploads/..."> and <video src="/uploads/...">
        const fixedContent = htmlContent
            .replace(/src=["']\/uploads\//g, `src="${backendUrl}/uploads/`)
            .replace(/href=["']\/uploads\//g, `href="${backendUrl}/uploads/`);
        
        return fixedContent;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    applyGlobalSettings();
});

async function applyGlobalSettings() {
    try {
        // Check if Auth exists, otherwise use default API base
        const apiBase = (typeof Auth !== 'undefined' && Auth.apiBase) ? Auth.apiBase : 'http://localhost:5001/api';
        
        const res = await fetch(`${apiBase}/settings/public`);

        if (!res.ok) {
            console.warn('Failed to load public settings');
            return;
        }

        const settings = await res.json();
        processSettings(settings);
    } catch (err) {
        console.error('Settings load error:', err);
    }
}

function processSettings(settings) {
    // 1. Disable Right Click
    if (settings.disableRightClick) {
        // Allow on Admin Dashboard
        if (!window.location.pathname.includes('admin-dashboard')) {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                // Optional: Show toast? No, just disable silently or consistent with user request "disable right click"
            });
        }
    }

    // 2. Maintenance Check (Optional redirect logic here if needed, but Middleware does heavy lifting)
    if (settings.isMaintenanceMode && !window.location.pathname.includes('admin') && !window.location.pathname.includes('login')) {
        // Maybe show a banner?
        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed; top:0; left:0; width:100%; background:var(--color-error, red); color:white; text-align:center; padding:10px; z-index:9999; font-weight:bold;';
        banner.textContent = settings.maintenanceMessage || 'Maintenance Mode Active';
        document.body.prepend(banner);
    }
    // 3. Scroll Animations
    initScrollAnimations();
}

/**
 * Global Scroll Animation Observer
 * Triggers animations when elements enter the viewport
 */
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    // Target elements with .scroll-reveal class
    const elements = document.querySelectorAll('.scroll-reveal, .fade-in-up, .slide-in-left, .slide-in-right, .scale-up');
    elements.forEach(el => observer.observe(el));
}
