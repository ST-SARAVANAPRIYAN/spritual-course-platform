// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('hero-lightpass');
    const context = canvas.getContext('2d');
    const videoContainer = document.querySelector('.hero-video-container');
    const heroContent = document.querySelector('.hero-overlay-content');

    // Configuration
    const frameCount = 192; // Adjust based on actual frames extracted
    const currentFrame = index => (
        `../assets/videos/frames/frame_${index.toString().padStart(4, '0')}.webp`
    );

    const images = [];
    const airpods = {
        frame: 0
    };

    // Preload images
    for (let i = 1; i <= frameCount; i++) {
        const img = new Image();
        img.src = currentFrame(i);
        images.push(img);
    }

    // Set canvas dimensions
    canvas.width = 1920;
    canvas.height = 1080;

    // Render function
    const render = () => {
        // Scale and center image (Object-fit: cover equivalent)
        const img = images[airpods.frame];
        if (img) {
            const hRatio = canvas.width / img.width;
            const vRatio = canvas.height / img.height;
            const ratio = Math.max(hRatio, vRatio);
            const centerShift_x = (canvas.width - img.width * ratio) / 2;
            const centerShift_y = (canvas.height - img.height * ratio) / 2;

            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0, img.width, img.height,
                centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
        }
    };

    // Initial render
    images[0].onload = render;

    // Scroll Animation
    gsap.to(airpods, {
        frame: frameCount - 1,
        snap: "frame",
        ease: "none",
        scrollTrigger: {
            trigger: videoContainer,
            start: "top top",
            end: "+=400%", // Scroll length
            pin: true,
            scrub: 0.5, // Smooth scrubbing
            // markers: true
        },
        onUpdate: render // Render on every update
    });

    // Content Fade Out animation removed (content relocated)

    // Handle resizing
    window.addEventListener('resize', () => {
        // Optional: Dynamic resizing logic if needed beyond CSS object-fit simulation in render()
        render();
        ScrollTrigger.refresh();
    });
});
