// Register GSAP Plugins
if (typeof ScrollTrigger !== 'undefined' && typeof ScrollToPlugin !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- LENIS SMOOTH SCROLL INIT ---
    let lenis;
    if (typeof Lenis !== 'undefined') {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: true,
            mouseMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
        });

        lenis.on('scroll', ScrollTrigger.update);

        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        gsap.ticker.lagSmoothing(0);
    }

    const canvas = document.getElementById('hero-lightpass');
    const context = canvas.getContext('2d');
    const videoContainer = document.querySelector('.hero-video-container');
    const heroOverlay = document.querySelector('.hero-overlay-content');

    // Configuration
    const frameCount = 192;

    // Function to get the correct frame path based on device width
    const currentFrame = index => {
        const isMobile = window.innerWidth < 768; // Mobile breakpoint
        const folder = isMobile ? 'frames-mobile' : 'frames';
        return `../assets/videos/${folder}/frame_${index.toString().padStart(4, '0')}.webp`;
    };

    let images = [];

    // REVERSED: Start from the last frame
    const airpods = {
        frame: frameCount - 1
    };

    // Track last rendered frame
    let lastRenderedFrame = -1;

    // --- 1. BLACK SCREEN FIX ---
    const startImg = new Image();
    startImg.src = currentFrame(frameCount);
    startImg.onload = () => {
        updateCanvasDimensions();
        const hRatio = canvas.width / startImg.width;
        const vRatio = canvas.height / startImg.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = Math.floor((canvas.width - startImg.width * ratio) / 2);
        const centerShift_y = Math.floor((canvas.height - startImg.height * ratio) / 2);

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(startImg, 0, 0, startImg.width, startImg.height,
            centerShift_x, centerShift_y, Math.ceil(startImg.width * ratio), Math.ceil(startImg.height * ratio));
        lastRenderedFrame = frameCount - 1;
    };

    for (let i = 1; i <= frameCount; i++) {
        const img = new Image();
        img.src = currentFrame(i);
        images.push(img);
    }

    const updateCanvasDimensions = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    updateCanvasDimensions();
    canvas.style.willChange = 'transform';

    const render = () => {
        const frameIndex = Math.round(airpods.frame);
        if (frameIndex === lastRenderedFrame) return;

        const img = images[frameIndex];
        if (!img || !img.complete) return;

        lastRenderedFrame = frameIndex;

        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = Math.floor((canvas.width - img.width * ratio) / 2);
        const centerShift_y = Math.floor((canvas.height - img.height * ratio) / 2);

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, img.width, img.height,
            centerShift_x, centerShift_y, Math.ceil(img.width * ratio), Math.ceil(img.height * ratio));
    };

    // --- 2. CONSTANT SPEED SCROLL (BI-DIRECTIONAL) ---

    let isAnimating = false;
    let animationState = 'idle'; // 'idle', 'playing', 'done'

    const trigger = ScrollTrigger.create({
        trigger: videoContainer,
        start: "top top",
        end: "+=2500", // 2500px pin duration
        pin: true,
        scrub: false,
        onEnter: () => {
            animationState = 'idle';
            bindScrollListeners();
        },
        onEnterBack: () => {
            animationState = 'done';
            bindScrollListeners();
        },
        onLeave: () => {
            animationState = 'done';
            unbindScrollListeners();
            // Ensure buttons show if we leave forward
            if (heroOverlay) {
                gsap.to(heroOverlay, { opacity: 1, pointerEvents: 'all', duration: 0.5 });
            }
        },
        onLeaveBack: () => {
            animationState = 'idle';
            unbindScrollListeners();
            // Ensure buttons hide if we leave backward
            if (heroOverlay) {
                gsap.to(heroOverlay, { opacity: 0, pointerEvents: 'none', duration: 0.5 });
            }
        }
    });

    function bindScrollListeners() {
        window.addEventListener('wheel', handleScrollIntent, { passive: false });
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    function unbindScrollListeners() {
        window.removeEventListener('wheel', handleScrollIntent);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
    }

    let touchStartY = 0;
    function handleTouchStart(e) {
        touchStartY = e.touches[0].clientY;
    }

    function handleTouchMove(e) {
        if (isAnimating) {
            e.preventDefault();
            return;
        }
        const touchEndY = e.touches[0].clientY;
        const deltaY = touchStartY - touchEndY;
        handleIntent(deltaY, e);
    }

    function handleScrollIntent(e) {
        if (isAnimating) {
            e.preventDefault();
            return;
        }
        handleIntent(e.deltaY, e);
    }

    function handleIntent(deltaY, e) {
        if (Math.abs(deltaY) < 5) return;

        if (deltaY > 0 && animationState === 'idle') {
            e.preventDefault();
            playAnimation(true);
        }
        else if (deltaY < 0 && animationState === 'done') {
            e.preventDefault();
            playAnimation(false);
        }
    }

    function playAnimation(forward) {
        isAnimating = true;
        animationState = 'playing';

        const targetFrame = forward ? 0 : frameCount - 1;
        const targetScroll = forward ? trigger.end : trigger.start;
        const ease = "power1.inOut";
        const duration = 5; // Slow, smooth duration

        // Frame Animation
        gsap.to(airpods, {
            frame: targetFrame,
            duration: duration,
            ease: ease,
            onUpdate: render
        });

        // Button Animation
        if (heroOverlay) {
            gsap.killTweensOf(heroOverlay);
            if (forward) {
                // Show buttons and text faster at the end
                gsap.to(heroOverlay, {
                    opacity: 1,
                    pointerEvents: 'all',
                    duration: 0.8,
                    delay: 4 // Start appearing at 4s mark
                });
            } else {
                // Hide buttons immediately
                gsap.to(heroOverlay, {
                    opacity: 0,
                    pointerEvents: 'none',
                    duration: 0.5
                });
            }
        }

        // Scroll Animation
        if (lenis) {
            // Let GSAP drive window scroll, Lenis will follow since it watches scroll events
            // OR specifically disable lenis for this tween? No, too complex.
        }

        gsap.to(window, {
            scrollTo: { y: targetScroll, autoKill: false },
            duration: duration,
            ease: ease,
            onComplete: () => {
                isAnimating = false;
                animationState = forward ? 'done' : 'idle';
            }
        });
    }

    let resizeRaf = null;
    let wasMobile = window.innerWidth < 768;
    window.addEventListener('resize', () => {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
            updateCanvasDimensions();
            const isMobile = window.innerWidth < 768;
            if (isMobile !== wasMobile) {
                location.reload();
            }
            lastRenderedFrame = -1;
            render();
            ScrollTrigger.refresh();
        });
    });
});
