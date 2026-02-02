/**
 * InnerSpark Database Seeder
 * Populates the database with sample data for testing
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
    User, Course, Schedule, Attendance, Payment, Content, FAQ,
    Exam, Certificate, Progress, Result, Enrollment, Ticket,
    Forum, Broadcast, Banner, Blog, Event, Newsletter, Coupon
} = require('../backend/models/index');

require('dotenv').config({ path: './backend/.env' });

const MONGO_URI = process.env.MONGODB_URL;

if (!MONGO_URI) {
    console.error('❌ ERROR: MONGODB_URL is missing from environment variables.');
    process.exit(1);
}

// Sample Data
const sampleUsers = [
    // Admin
    {
        name: 'Divine Administrator',
        email: 'admin@innerspark.com',
        password: 'admin123',
        role: 'Admin',
        phone: '+1234567890',
        address: 'Sanctuary HQ, Spiritual Valley',
        gender: 'Other',
        dob: '1980-01-01'
    },
    // Staff/Mentors
    {
        name: 'Swami Dayananda',
        email: 'swami@innerspark.com',
        password: 'mentor123',
        role: 'Staff',
        phone: '+1234567891',
        address: 'Himalayan Ashram, India',
        gender: 'Male',
        dob: '1970-05-15'
    },
    {
        name: 'Sister Maya',
        email: 'maya@innerspark.com',
        password: 'mentor123',
        role: 'Staff',
        phone: '+1234567892',
        address: 'Zen Center, Kyoto',
        gender: 'Female',
        dob: '1975-08-20'
    },
    {
        name: 'Guru Ananda',
        email: 'ananda@innerspark.com',
        password: 'mentor123',
        role: 'Staff',
        phone: '+1234567893',
        address: 'Yoga Retreat, Bali',
        gender: 'Male',
        dob: '1968-12-10'
    },
    // Students
    {
        name: 'Arjun Kumar',
        email: 'arjun@example.com',
        password: 'student123',
        role: 'Student',
        phone: '+1234567894',
        address: 'Mumbai, India',
        gender: 'Male',
        dob: '1995-03-22'
    },
    {
        name: 'Priya Sharma',
        email: 'priya@example.com',
        password: 'student123',
        role: 'Student',
        phone: '+1234567895',
        address: 'Delhi, India',
        gender: 'Female',
        dob: '1998-07-14'
    },
    {
        name: 'Raj Patel',
        email: 'raj@example.com',
        password: 'student123',
        role: 'Student',
        phone: '+1234567896',
        address: 'Bangalore, India',
        gender: 'Male',
        dob: '1992-11-30'
    },
    {
        name: 'Ananya Singh',
        email: 'ananya@example.com',
        password: 'student123',
        role: 'Student',
        phone: '+1234567897',
        address: 'Pune, India',
        gender: 'Female',
        dob: '2000-02-18'
    },
    {
        name: 'Vikram Rao',
        email: 'vikram@example.com',
        password: 'student123',
        role: 'Student',
        phone: '+1234567898',
        address: 'Chennai, India',
        gender: 'Male',
        dob: '1997-09-05'
    }
];

const sampleCourses = [
    {
        title: 'Meditation Fundamentals',
        description: 'Discover the ancient art of meditation and mindfulness. Learn techniques to calm your mind, reduce stress, and find inner peace. Perfect for beginners seeking spiritual growth.',
        category: 'Meditation',
        price: 49.99,
        status: 'Published',
        totalLessons: 12
    },
    {
        title: 'Yoga for Inner Balance',
        description: 'Explore the holistic practice of yoga combining physical postures, breathing techniques, and meditation. Achieve harmony between body, mind, and spirit.',
        category: 'Yoga',
        price: 79.99,
        status: 'Published',
        totalLessons: 20
    },
    {
        title: 'Philosophy of the Bhagavad Gita',
        description: 'Deep dive into the timeless wisdom of the Bhagavad Gita. Understand the concepts of dharma, karma, and moksha through guided study and reflection.',
        category: 'Philosophy',
        price: 59.99,
        status: 'Published',
        totalLessons: 15
    },
    {
        title: 'Mindfulness in Daily Life',
        description: 'Practical techniques to bring mindfulness into your everyday activities. Transform routine tasks into opportunities for presence and awareness.',
        category: 'Mindfulness',
        price: 39.99,
        status: 'Published',
        totalLessons: 10
    },
    {
        title: 'Sacred Rituals and Ceremonies',
        description: 'Learn the significance and practice of various spiritual rituals. Create meaningful ceremonies to honor life transitions and sacred moments.',
        category: 'Rituals',
        price: 69.99,
        status: 'Published',
        totalLessons: 18
    },
    {
        title: 'Advanced Pranayama Techniques',
        description: 'Master the art of breath control. Advanced breathing techniques for energy cultivation, healing, and spiritual awakening.',
        category: 'Meditation',
        price: 89.99,
        status: 'Draft',
        totalLessons: 8
    }
];

const sampleFAQs = [
    {
        question: 'How do I start meditating?',
        answer: 'Begin with just 5 minutes daily. Find a quiet space, sit comfortably, and focus on your breath. Our Meditation Fundamentals course provides step-by-step guidance.',
        category: 'Spiritual'
    },
    {
        question: 'What payment methods do you accept?',
        answer: 'We accept UPI, Credit/Debit Cards, and manual bank transfers. All transactions are secure and encrypted.',
        category: 'Payment'
    },
    {
        question: 'Can I download the course materials?',
        answer: 'Yes! Once enrolled, you can download PDF notes and supplementary materials. Videos are available for streaming only.',
        category: 'Technical'
    },
    {
        question: 'How do I get my certificate?',
        answer: 'Complete at least 80% of the course and pass the assessment with 70% or higher. Your certificate will be generated automatically.',
        category: 'Technical'
    },
    {
        question: 'What is the refund policy?',
        answer: 'We offer a 7-day money-back guarantee if you are not satisfied with the course content.',
        category: 'Payment'
    }
];

const sampleBlogs = [
    {
        title: 'The Power of Morning Meditation',
        content: 'Starting your day with meditation can transform your entire life. Research shows that morning meditation reduces stress by 40% and increases focus throughout the day. In this article, we explore the science behind morning meditation and provide a simple 10-minute routine you can start tomorrow...',
        author: 'Swami Dayananda',
        category: 'Meditation',
        thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773'
    },
    {
        title: '5 Yoga Poses for Stress Relief',
        content: 'In our fast-paced modern world, stress has become a constant companion. These five yoga poses have been practiced for centuries to release tension and restore inner calm. From Child\'s Pose to Legs-Up-the-Wall, discover how simple movements can bring profound peace...',
        author: 'Sister Maya',
        category: 'Yoga',
        thumbnail: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b'
    },
    {
        title: 'Understanding Karma: Actions and Consequences',
        content: 'Karma is often misunderstood in Western culture. It\'s not about punishment or reward, but about the natural law of cause and effect. This deep dive into the philosophy of karma explains how our intentions shape our reality...',
        author: 'Guru Ananda',
        category: 'Philosophy',
        thumbnail: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc'
    }
];

const sampleEvents = [
    {
        title: 'Full Moon Meditation Gathering',
        date: new Date('2026-02-15T19:00:00'),
        location: 'Online (Zoom)',
        description: 'Join us for a special full moon meditation circle. Experience the powerful energy of the lunar cycle with guided meditation and group intention setting.',
        registrationLink: 'https://zoom.us/innerspark-fullmoon',
        active: true
    },
    {
        title: 'Yoga & Philosophy Weekend Retreat',
        date: new Date('2026-03-20T10:00:00'),
        location: 'Spiritual Valley Ashram, Rishikesh',
        description: 'Immerse yourself in a transformative weekend of yoga practice, philosophical discussions, and silent contemplation in the foothills of the Himalayas.',
        registrationLink: 'https://innerspark.com/retreat',
        active: true
    },
    {
        title: 'Introduction to Mindfulness - Free Webinar',
        date: new Date('2026-02-10T18:00:00'),
        location: 'Online (YouTube Live)',
        description: 'Free introduction to mindfulness meditation. Perfect for beginners. Learn basic techniques and get answers to your questions.',
        registrationLink: 'https://youtube.com/innerspark',
        active: true
    }
];

const sampleCoupons = [
    {
        code: 'GRACE10',
        discountPercent: 10,
        expiryDate: new Date('2026-12-31'),
        active: true
    },
    {
        code: 'FIRSTPATH20',
        discountPercent: 20,
        expiryDate: new Date('2026-06-30'),
        active: true
    },
    {
        code: 'NEWYEAR50',
        discountPercent: 50,
        expiryDate: new Date('2026-02-28'),
        active: true
    }
];

// Seeding Function
async function seedDatabase() {
    try {
        console.log('🌟 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Course.deleteMany({});
        await Content.deleteMany({});
        await Schedule.deleteMany({});
        await Payment.deleteMany({});
        await Attendance.deleteMany({});
        await FAQ.deleteMany({});
        await Exam.deleteMany({});
        await Certificate.deleteMany({});
        await Progress.deleteMany({});
        await Result.deleteMany({});
        await Enrollment.deleteMany({});
        await Ticket.deleteMany({});
        await Forum.deleteMany({});
        await Broadcast.deleteMany({});
        await Banner.deleteMany({});
        await Blog.deleteMany({});
        await Event.deleteMany({});
        await Newsletter.deleteMany({});
        await Coupon.deleteMany({});
        console.log('✅ Database cleared');

        // Create Users
        console.log('👥 Creating users...');
        const createdUsers = [];
        let studentCount = 0, staffCount = 0, adminCount = 0;

        for (const userData of sampleUsers) {
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Generate unique ID
            let studentID;
            if (userData.role === 'Student') {
                studentCount++;
                studentID = `STU-2026-${String(studentCount).padStart(4, '0')}`;
            } else if (userData.role === 'Staff') {
                staffCount++;
                studentID = `STF-2026-${String(staffCount).padStart(4, '0')}`;
            } else {
                adminCount++;
                studentID = `ADM-2026-${String(adminCount).padStart(4, '0')}`;
            }

            const user = await User.create({
                ...userData,
                password: hashedPassword,
                studentID
            });
            createdUsers.push(user);
            console.log(`  ✓ Created ${user.role}: ${user.name} (${user.studentID})`);
        }

        const admin = createdUsers.find(u => u.role === 'Admin');
        const staff = createdUsers.filter(u => u.role === 'Staff');
        const students = createdUsers.filter(u => u.role === 'Student');

        // Create Courses
        console.log('\n📚 Creating courses...');
        const createdCourses = [];
        for (let i = 0; i < sampleCourses.length; i++) {
            const course = await Course.create({
                ...sampleCourses[i],
                mentorID: staff[i % staff.length]._id
            });
            createdCourses.push(course);
            console.log(`  ✓ Created course: ${course.title}`);
        }

        // Create Content for published courses
        console.log('\n🎥 Creating course content...');
        const publishedCourses = createdCourses.filter(c => c.status === 'Published');
        const createdContent = [];

        for (const course of publishedCourses) {
            for (let i = 1; i <= Math.min(5, course.totalLessons); i++) {
                const content = await Content.create({
                    courseID: course._id,
                    uploadedBy: course.mentorID,
                    type: i % 3 === 0 ? 'PDF' : 'Video',
                    fileUrl: i % 3 === 0
                        ? `/uploads/pdfs/lesson${i}.pdf`
                        : `/uploads/videos/lesson${i}.mp4`,
                    previewDuration: i === 1 ? 30 : (i === 2 ? 60 : 0), // First two videos have previews
                    approvalStatus: 'Approved'
                });
                createdContent.push(content);
            }
            console.log(`  ✓ Created ${Math.min(5, course.totalLessons)} materials for: ${course.title}`);
        }

        // Create Enrollments & Payments
        console.log('\n💳 Creating enrollments and payments...');
        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const coursesToEnroll = createdCourses.slice(0, Math.min(3, i + 2));

            for (const course of coursesToEnroll) {
                // Create enrollment
                await Enrollment.create({
                    studentID: student._id,
                    courseID: course._id,
                    status: 'Active'
                });

                // Add to user's enrolled courses
                await User.findByIdAndUpdate(student._id, {
                    $push: { enrolledCourses: course._id }
                });

                // Create payment
                await Payment.create({
                    transactionID: `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                    studentID: student._id,
                    courseID: course._id,
                    amount: course.price,
                    paymentMethod: ['UPI', 'Card', 'Manual'][Math.floor(Math.random() * 3)],
                    status: 'Success',
                    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
                });

                console.log(`  ✓ Enrolled ${student.name} in ${course.title}`);
            }
        }

        // Create Schedules (Live classes)
        console.log('\n📅 Creating schedules...');
        const schedules = [];
        for (let i = 0; i < publishedCourses.length; i++) {
            const course = publishedCourses[i];
            const startDate = new Date('2026-02-05');
            startDate.setDate(startDate.getDate() + (i * 3));
            startDate.setHours(18, 0, 0, 0);

            const endDate = new Date(startDate);
            endDate.setHours(19, 30, 0, 0);

            const schedule = await Schedule.create({
                courseID: course._id,
                staffID: course.mentorID,
                title: `Live Session - ${course.title}`,
                startTime: startDate,
                endTime: endDate,
                meetingLink: `https://meet.jit.si/InnerSpark-${course._id.toString().substr(-6)}`,
                type: 'Live'
            });
            schedules.push(schedule);
            console.log(`  ✓ Scheduled live class for: ${course.title}`);
        }

        // Create Exams
        console.log('\n📝 Creating exams...');
        for (const course of publishedCourses.slice(0, 3)) {
            await Exam.create({
                courseID: course._id,
                questions: [
                    {
                        questionText: 'What is the primary benefit of daily meditation?',
                        options: ['Physical strength', 'Mental clarity', 'Financial success', 'Social popularity'],
                        correctOptionIndex: 1
                    },
                    {
                        questionText: 'How long should a beginner meditate?',
                        options: ['1 hour', '30 minutes', '5-10 minutes', '3 hours'],
                        correctOptionIndex: 2
                    },
                    {
                        questionText: 'What does "mindfulness" mean?',
                        options: ['Thinking a lot', 'Being present in the moment', 'Ignoring thoughts', 'Sleeping well'],
                        correctOptionIndex: 1
                    },
                    {
                        questionText: 'Which is a common meditation posture?',
                        options: ['Standing on one leg', 'Lying down only', 'Cross-legged sitting', 'Running'],
                        correctOptionIndex: 2
                    },
                    {
                        questionText: 'What is the goal of spiritual practice?',
                        options: ['Material wealth', 'Self-realization', 'Fame', 'Power over others'],
                        correctOptionIndex: 1
                    }
                ],
                passingScore: 70,
                activationThreshold: 80,
                status: 'Published'
            });
            console.log(`  ✓ Created exam for: ${course.title}`);
        }

        // Create Progress for students
        console.log('\n📊 Creating progress records...');
        for (const student of students) {
            const enrolledCourses = await Enrollment.find({ studentID: student._id });
            for (const enrollment of enrolledCourses) {
                const courseContent = createdContent.filter(c => c.courseID.equals(enrollment.courseID));
                const completed = courseContent.slice(0, Math.floor(Math.random() * courseContent.length));

                await Progress.create({
                    studentID: student._id,
                    courseID: enrollment.courseID,
                    completedLessons: completed.map(c => c._id),
                    percentComplete: Math.floor((completed.length / courseContent.length) * 100),
                    lastAccessed: new Date()
                });
            }
        }
        console.log('  ✓ Progress records created');

        // Create Forum Posts
        console.log('\n💬 Creating forum posts...');
        for (const course of publishedCourses.slice(0, 3)) {
            for (let i = 0; i < 3; i++) {
                await Forum.create({
                    courseID: course._id,
                    studentID: students[i % students.length]._id,
                    comment: [
                        'This course is transforming my daily practice. Thank you!',
                        'The meditation techniques are so powerful. Feeling more centered.',
                        'Question: How often should we practice the breathing exercises?',
                        'Loving the deep philosophical insights in this course.',
                        'The instructor explains complex concepts beautifully.'
                    ][i]
                });
            }
            console.log(`  ✓ Created forum posts for: ${course.title}`);
        }

        // Create Support Tickets
        console.log('\n🎫 Creating support tickets...');
        await Ticket.create({
            studentID: students[0]._id,
            subject: 'Cannot access video content',
            message: 'I have enrolled in the Meditation Fundamentals course but the videos are not playing. Please help.',
            status: 'Open'
        });
        await Ticket.create({
            studentID: students[1]._id,
            subject: 'Certificate download issue',
            message: 'I completed the course and passed the exam, but I cannot download my certificate.',
            status: 'Resolved'
        });
        console.log('  ✓ Support tickets created');

        // Create FAQs
        console.log('\n❓ Creating FAQs...');
        for (const faq of sampleFAQs) {
            await FAQ.create(faq);
        }
        console.log(`  ✓ Created ${sampleFAQs.length} FAQs`);

        // Create Blogs
        console.log('\n📰 Creating blogs...');
        for (const blog of sampleBlogs) {
            await Blog.create(blog);
        }
        console.log(`  ✓ Created ${sampleBlogs.length} blog posts`);

        // Create Events
        console.log('\n🎪 Creating events...');
        for (const event of sampleEvents) {
            await Event.create(event);
        }
        console.log(`  ✓ Created ${sampleEvents.length} events`);

        // Create Coupons
        console.log('\n🎟️  Creating coupons...');
        for (const coupon of sampleCoupons) {
            await Coupon.create(coupon);
        }
        console.log(`  ✓ Created ${sampleCoupons.length} coupon codes`);

        // Create Broadcast
        console.log('\n📢 Creating broadcast messages...');
        await Broadcast.create({
            title: 'Welcome to InnerSpark!',
            message: 'Join us for a free meditation webinar this Friday at 6 PM. Register now!',
            type: 'Announcement',
            active: true
        });
        console.log('  ✓ Broadcast message created');

        // Create Banners
        console.log('\n🖼️  Creating banners...');
        await Banner.create({
            title: 'New Course: Advanced Pranayama',
            imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773',
            link: '/marketplace',
            active: true
        });
        console.log('  ✓ Banner created');

        // Create Newsletter Subscriptions
        console.log('\n📧 Creating newsletter subscriptions...');
        await Newsletter.create({ email: 'subscriber1@example.com' });
        await Newsletter.create({ email: 'subscriber2@example.com' });
        await Newsletter.create({ email: 'subscriber3@example.com' });
        console.log('  ✓ Newsletter subscriptions created');

        console.log('\n✨ ================================');
        console.log('✨  DATABASE SEEDING COMPLETED!  ✨');
        console.log('✨ ================================\n');

        console.log('📊 Summary:');
        console.log(`   • ${createdUsers.length} Users (${adminCount} Admin, ${staffCount} Staff, ${studentCount} Students)`);
        console.log(`   • ${createdCourses.length} Courses`);
        console.log(`   • ${createdContent.length} Content items`);
        console.log(`   • ${schedules.length} Scheduled classes`);
        console.log(`   • ${sampleFAQs.length} FAQs`);
        console.log(`   • ${sampleBlogs.length} Blog posts`);
        console.log(`   • ${sampleEvents.length} Events`);
        console.log(`   • ${sampleCoupons.length} Coupon codes`);

        console.log('\n🔑 Login Credentials:');
        console.log('   Admin:   admin@innerspark.com / admin123');
        console.log('   Staff:   swami@innerspark.com / mentor123');
        console.log('   Student: arjun@example.com / student123');

        console.log('\n🎁 Active Coupon Codes:');
        console.log('   • GRACE10 (10% off)');
        console.log('   • FIRSTPATH20 (20% off)');
        console.log('   • NEWYEAR50 (50% off - expires Feb 28)');

    } catch (error) {
        console.error('❌ Seeding error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB\n');
        process.exit(0);
    }
}

// Run the seeder
seedDatabase();
