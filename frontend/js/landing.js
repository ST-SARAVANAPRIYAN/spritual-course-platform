/**
 * InnerSpark - Enhanced Landing Page 
 * Complete functionality for featured courses, blogs, events, and newsletter
 */

const API_URL = (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:5000/api');

// Utility function to show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Load Featured Courses (Real Data)
async function loadFeaturedCourses() {
    const featuredCourses = document.getElementById('featuredCourses');

    try {
        const res = await fetch(`${API_URL}/courses/marketplace`);
        const allCourses = await res.json();

        // Filter only 'Published' courses for the landing page
        const courses = allCourses.filter(c => c.status === 'Published').slice(0, 3); // Show max 3

        if (courses.length === 0) {
            featuredCourses.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">New spiritual paths are being paved. Check back soon.</p>';
            return;
        }

        featuredCourses.innerHTML = courses.map(course => `
            <div class="glass-card" style="text-align: left; transition: all 0.3s ease; cursor: pointer; overflow: hidden;" onclick="window.location.href='marketplace.html'" onmouseover="this.style.transform='translateY(-10px)'; this.style.boxShadow='0 15px 40px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 30px rgba(0,0,0,0.1)'">
                <div style="height: 200px; background: url('${course.thumbnail}'); background-size: cover; background-position: center; border-radius: 10px 10px 0 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 4rem;">
                    ${!course.thumbnail ? '<i class="fas fa-om"></i>' : ''}
                </div>
                <div style="padding: 30px;">
                    <span class="badge" style="background: var(--color-saffron); color: white; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">${course.category || 'Spiritual'}</span>
                    <h3 style="margin: 20px 0 15px; font-family: var(--font-heading); font-size: 1.5rem; color: var(--color-primary);">${course.title}</h3>
                    <p style="color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 20px;">${course.description ? course.description.substring(0, 100) + '...' : 'Embark on a transformative journey.'}</p>
                    <div style="display: flex; gap: 20px; margin-bottom: 20px; font-size: 0.9rem; color: var(--color-text-secondary);">
                        <span><i class="fas fa-video"></i> ${course.totalLessons || 0} Lessons</span>
                        <span><i class="fas fa-clock"></i> ${course.duration || 'Flexible'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-size: 1.8rem; font-weight: bold; color: var(--color-saffron);">₹${course.price || 0}</span>
                        </div>
                        <a href="login.html" class="btn-primary" style="padding: 12px 25px;">
                            <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load courses:', err);
        featuredCourses.innerHTML = '<p>Unable to load courses at this moment.</p>';
    }
}

// Hardcoded Blog Data
const blogData = [
    {
        title: 'The Power of Daily Meditation',
        date: '2026-01-28',
        content: 'In our fast-paced modern world, finding moments of stillness has become more crucial than ever. Daily meditation practice can transform your life by reducing stress, improving focus, and cultivating inner peace. Start with just 5 minutes each morning and gradually increase your practice time.',
        excerpt: 'Discover how a simple daily meditation practice can transform your life and bring lasting peace to your mind and spirit.'
    },
    {
        title: 'Understanding Karma: Action and Consequence',
        date: '2026-01-25',
        content: 'Karma is often misunderstood as a system of reward and punishment. In reality, it is the natural law of cause and effect. Every action we take creates an energy that eventually returns to us. By understanding karma, we can make conscious choices that lead to positive outcomes in our lives.',
        excerpt: 'Explore the true meaning of karma and how understanding this ancient principle can guide you toward conscious living.'
    },
    {
        title: 'Sacred Spaces: Creating Your Home Sanctuary',
        date: '2026-01-20',
        content: 'Your home should be more than just a place to sleep. By creating a dedicated sacred space for meditation and reflection, you establish a physical anchor for your spiritual practice. Learn how to design a sanctuary that nurtures your soul and supports your journey inward.',
        excerpt: 'Transform a corner of your home into a sacred sanctuary that supports your spiritual practice and inner growth.'
    }
];

// Load Blogs
function loadBlogs() {
    const blogGrid = document.getElementById('blogGrid');
    const blogs = blogData;

    blogGrid.innerHTML = blogs.map(blog => `
            <div class="glass-card" style="transition: all 0.3s ease; cursor: pointer; overflow: hidden; background: white;" onmouseover="this.style.transform='translateY(-10px)'" onmouseout="this.style.transform='translateY(0)'">
                <div style="height: 180px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px 10px 0 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">
                    <i class="fas fa-book-open"></i>
                </div>
                <div style="padding: 30px;">
                    <span class="badge" style="background: #667eea; color: white; padding: 5px 12px; border-radius: 20px; font-size: 0.75rem;">${new Date(blog.date).toLocaleDateString()}</span>
                    <h3 style="margin: 20px 0 15px; font-size: 1.3rem; color: var(--color-primary);">${blog.title}</h3>
                    <p style="color: var(--color-text-secondary); line-height: 1.6;">${blog.excerpt || blog.content.substring(0, 150) + '...'}</p>
                    <button class="btn-primary" style="margin-top: 20px; padding: 10px 20px; font-size: 0.9rem;" onclick="showNotification('Blog feature coming soon! Stay tuned.', 'success')">
                        <i class="fas fa-book-reader"></i> Read More
                    </button>
                </div>
            </div>
        `).join('');
}

// Hardcoded Events Data
const eventsData = [
    {
        title: 'Full Moon Meditation Circle',
        date: '2026-02-15',
        time: '7:00 PM - 8:30 PM IST',
        speaker: 'Swami Dayananda',
        description: 'Join us for a powerful full moon meditation session. Harness the lunar energy to deepen your practice and connect with fellow seekers in a sacred virtual gathering.',
        registrationLink: 'https://meet.jit.si/innerspark-fullmoon-feb2026'
    },
    {
        title: 'Bhagavad Gita Study Group',
        date: '2026-02-08',
        time: '6:00 PM - 7:30 PM IST',
        speaker: 'Dr. Priya Sharma',
        description: 'Weekly discussion on Chapter 2 of the Bhagavad Gita. Explore the nature of the self and the path of knowledge with our expert facilitator and community members.',
        registrationLink: 'https://meet.jit.si/innerspark-gita-study'
    },
    {
        title: 'Introduction to Pranayama Workshop',
        date: '2026-02-22',
        time: '10:00 AM - 12:00 PM IST',
        speaker: 'Yogi Ramesh Kumar',
        description: 'Learn the ancient art of breath control. This beginner-friendly workshop will teach you fundamental pranayama techniques to enhance vitality and calm the mind.',
        registrationLink: 'https://meet.jit.si/innerspark-pranayama-workshop'
    }
];

// Load Events
function loadEvents() {
    const eventsGrid = document.getElementById('eventsGrid');
    const events = eventsData;

    eventsGrid.innerHTML = events.map(event => `
            <div class="glass-card" style="transition: all 0.3s ease; border-left: 5px solid var(--color-saffron); background: white;" onmouseover="this.style.transform='translateX(5px)'" onmouseout="this.style.transform='translateX(0)'">
                <div style="padding: 35px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
                        <span class="badge" style="background: var(--color-saffron); color: white; padding: 8px 15px; border-radius: 20px; font-size: 0.85rem;">
                            <i class="fas fa-calendar-alt"></i> ${new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        ${event.registrationLink ? '<span style="background: #4caf50; color: white; padding: 5px 10px; border-radius: 15px; font-size: 0.75rem;"><i class="fas fa-check"></i> Open</span>' : ''}
                    </div>
                    <h3 style="margin-bottom: 15px; font-size: 1.4rem; color: var(--color-primary); font-family: var(--font-heading);">${event.title}</h3>
                    <div style="color: var(--color-text-secondary); margin-bottom: 10px; display: flex; gap: 20px; flex-wrap: wrap;">
                        <span><i class="fas fa-clock" style="color: var(--color-saffron);"></i> ${event.time || 'TBA'}</span>
                        ${event.speaker ? `<span><i class="fas fa-user-tie" style="color: var(--color-saffron);"></i> ${event.speaker}</span>` : ''}
                    </div>
                    <p style="color: var(--color-text-secondary); line-height: 1.6; margin: 20px 0;">${event.description}</p>
                    ${event.registrationLink ?
            `<a href="${event.registrationLink}" class="btn-primary" style="margin-top: 15px; padding: 12px 25px; display: inline-flex; align-items: center; gap: 10px;" target="_blank">
                            <i class="fas fa-user-plus"></i> Register Now
                        </a>` :
            `<button class="btn-primary" style="margin-top: 15px; padding: 12px 25px; opacity: 0.6;" disabled>
                            <i class="fas fa-lock"></i> Registration Closed
                        </button>`
        }
                </div>
            </div>
        `).join('');
}

// Newsletter subscription
function setupNewsletterForm() {
    const form = document.getElementById('newsletterForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const email = formData.get('email');

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalHTML = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_URL}/extra/newsletter`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (response.ok) {
                    showNotification('✨ Welcome to the Inner Circle! Check your inbox for confirmation.', 'success');
                    form.reset();
                } else {
                    const error = await response.json();
                    showNotification(error.message || '❌ Subscription failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Newsletter subscription error:', error);
                showNotification('❌ An error occurred. Please try again later.', 'error');
            } finally {
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedCourses();
    loadBlogs();
    loadEvents();
    setupNewsletterForm();
});
