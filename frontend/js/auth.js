/**
 * InnerSpark - Common Auth Utility
 */

let isLoggingOut = false; // Flag to prevent multiple logout attempts
let statusCheckInterval = null; // Store interval ID for cleanup

const Auth = {
    // Check if user is logged in
    // passive: if true, just return auth state without redirecting (for pages that work with/without login)
    checkAuth: (allowedRoles = [], passive = false) => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));

        if (!token || !user) {
            if (passive) {
                return null; // Just return null, don't redirect
            }
            window.location.replace('login.html'); // Use replace to not create history entry
            return;
        }

        // SECURITY: Check if token is expired (JWT format validation)
        try {
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                const expiry = payload.exp * 1000; // JWT exp is in seconds

                if (expiry && Date.now() > expiry) {
                    // Token expired - clear and redirect
                    console.log('Token expired, clearing session');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');

                    if (passive) {
                        return null;
                    }
                    window.location.replace('login.html');
                    return;
                }
            }
        } catch (e) {
            // Invalid token format - clear session
            console.log('Invalid token format, clearing session');
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            if (passive) {
                return null;
            }
            window.location.replace('login.html');
            return;
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
            if (passive) {
                return null; // Return null if role doesn't match in passive mode
            }
            alert('Access Denied: You do not have permission to view this page.');
            window.location.href = 'index.html';
            return;
        }

        return { token, user };
    },

    // Logout
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('login.html'); // Use replace to prevent back button to logged-in state
    },

    // Get auth headers
    getHeaders: () => {
        const token = localStorage.getItem('token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    },

    // API Base URL
    apiBase: (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:5001/api'),

    // Force logout with message
    forceLogout: (message) => {
        // Prevent multiple logout attempts
        if (isLoggingOut) return;
        isLoggingOut = true;

        // Clear the status check interval
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
        }

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Use UI popup if available, otherwise fallback to alert
        if (typeof UI !== 'undefined' && UI.createPopup) {
            const popup = UI.createPopup({
                title: 'Account Deactivated',
                message: message,
                type: 'error',
                icon: 'exclamation-triangle',
                confirmText: 'Go to Login',
                persistent: true,
                onConfirm: () => {
                    window.location.replace('login.html');
                }
            });

            // Also auto-redirect after 3 seconds in case user doesn't click
            setTimeout(() => {
                window.location.replace('login.html');
            }, 3000);
        } else {
            alert(message);
            window.location.replace('login.html');
        }
    },

    // SECURITY: Validate session with backend
    validateSession: async () => {
        const token = localStorage.getItem('token');
        if (!token) return false;

        try {
            const res = await fetch(Auth.apiBase + '/auth/validate', {
                method: 'GET',
                headers: Auth.getHeaders()
            });

            if (!res.ok) {
                // Token is invalid, clear local storage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                return false;
            }
            return true;
        } catch (err) {
            return false;
        }
    }
};

// Global Fetch Interceptor to detect inactive accounts
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    // If already logging out, return early to prevent loops
    if (isLoggingOut) {
        return Promise.reject(new Error('Session terminated'));
    }

    const response = await originalFetch(...args);

    // Check if response is 403 (Forbidden) - likely an inactive account
    if (response.status === 403) {
        // Clone response to read it without consuming the original
        const clonedResponse = response.clone();

        // Check if response is JSON and has inactive flag
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try {
                const data = await clonedResponse.json();

                // If account is inactive, force logout immediately
                if (data.inactive === true && !isLoggingOut) {
                    Auth.forceLogout('Your account has been deactivated by the administrator.\n\nYou have been automatically logged out.\n\nPlease contact the administrator for assistance.');
                    return response;
                }

                if (data.invalidAccount === true && !isLoggingOut) {
                    Auth.forceLogout('Your account is no longer valid.\n\nYou have been automatically logged out.');
                    return response;
                }
            } catch (e) {
                // Not JSON or parsing failed, ignore
            }
        }
    }

    return response;
};

// Global Logout Handler
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
    }

    // Periodic status check (every 10 seconds) to detect account deactivation
    // Only run on dashboard pages (not login/register)
    if (localStorage.getItem('token') && !window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
        const userRole = JSON.parse(localStorage.getItem('user') || '{}').role;
        let checkEndpoint = null;

        // Use appropriate lightweight endpoint based on role
        if (userRole === 'Staff') {
            checkEndpoint = `${Auth.apiBase}/staff/profile`;
        } else if (userRole === 'Student') {
            checkEndpoint = `${Auth.apiBase}/attendance/my`;
        } else if (userRole === 'Admin') {
            checkEndpoint = `${Auth.apiBase}/admin/stats`;
        }

        if (checkEndpoint) {
            statusCheckInterval = setInterval(async () => {
                // Stop if token is gone or logging out
                if (!localStorage.getItem('token') || isLoggingOut) {
                    if (statusCheckInterval) {
                        clearInterval(statusCheckInterval);
                        statusCheckInterval = null;
                    }
                    return;
                }

                try {
                    // Lightweight endpoint check - will trigger 403 if inactive
                    await fetch(checkEndpoint, {
                        headers: Auth.getHeaders()
                    }).catch(() => null);

                    // If 403, the fetch interceptor will handle it
                    // This just ensures we check periodically even if user is idle
                } catch (e) {
                    // Ignore errors
                }
            }, 10000); // Check every 10 seconds
        }
    }
});

// SECURITY: Light validation on back/forward navigation
// Only check if we're on a page that requires auth and no token exists
window.addEventListener('pageshow', (event) => {
    // If page is loaded from cache AND on a protected page
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        const token = localStorage.getItem('token');
        const isProtectedPage = !window.location.pathname.includes('login') &&
            !window.location.pathname.includes('register') &&
            !window.location.pathname.includes('index');

        // Only redirect if on protected page with no token
        if (isProtectedPage && !token && !isLoggingOut) {
            window.location.replace('login.html');
        }
    }
});

// SECURITY: Clear sensitive data when page is unloaded (if configured for strict mode)
// Uncomment below for maximum security (user will need to re-login on every tab close)
// window.addEventListener('beforeunload', () => {
//     localStorage.removeItem('token');
//     localStorage.removeItem('user');
// });
