/**
 * InnerSpark - Exam & Assessment Logic
 */

let examData = null;
let currentExamID = null;
let timerInterval = null;
let timeRemaining = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const authData = Auth.checkAuth(['Student', 'Admin']);
    if (!authData) return;

    const params = new URLSearchParams(window.location.search);
    currentExamID = params.get('id');

    if (!currentExamID) {
        window.location.href = 'student-dashboard.html';
        return;
    }

    await loadExam();
});

async function loadExam() {
    try {
        const res = await fetch(`${Auth.apiBase}/exams/${currentExamID}`, {
            headers: Auth.getHeaders()
        });
        examData = await res.json();

        if (!examData) {
            alert('Assessment not found or unavailable.');
            window.location.href = 'student-dashboard.html';
            return;
        }

        document.getElementById('examTitle').textContent = examData.title;
        renderQuestions(examData.questions);
        startTimer(examData.duration);

    } catch (err) {
        console.error(err);
    }
}

function renderQuestions(questions) {
    const qList = document.getElementById('questions');
    qList.innerHTML = questions.map((q, qImg) => `
        <div class="question-block">
            <h3 style="margin-bottom: 20px;">${qImg + 1}. ${q.question}</h3>
            <div class="options">
                ${q.options.map((opt, oIdx) => `
                    <label class="option-label" onclick="selectOption(this, ${qImg})">
                        <input type="radio" name="q${qImg}" value="${oIdx}" style="display: none;">
                        <span style="font-size: 1.1rem;">${opt}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function selectOption(el, qIdx) {
    const parent = el.parentElement;
    parent.querySelectorAll('.option-label').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input').checked = true;
}

function startTimer(mins) {
    timeRemaining = mins * 60;
    const timerEl = document.getElementById('timer');

    timerInterval = setInterval(() => {
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;
        timerEl.textContent = `Time Remaining: ${m}:${s < 10 ? '0' : ''}${s}`;

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            submitExam(true);
        }
        timeRemaining--;
    }, 1000);
}

async function submitExam(auto = false) {
    if (!auto && !confirm('Are you ready to submit your spiritual assessment?')) return;

    clearInterval(timerInterval);
    const answers = [];
    const qBlocks = document.querySelectorAll('.question-block');

    qBlocks.forEach((block, idx) => {
        const selected = block.querySelector('input[type="radio"]:checked');
        answers.push(selected ? selected.value : -1);
    });

    try {
        const res = await fetch(`${Auth.apiBase}/exams/submit`, {
            method: 'POST',
            headers: Auth.getHeaders(),
            body: JSON.stringify({
                examID: examData._id,
                answers: answers
            })
        });

        const result = await res.json();
        showResult(result);
    } catch (err) {
        alert('Submission error. Please contact sanctuary support.');
    }
}

function showResult(result) {
    const overlay = document.getElementById('resultOverlay');
    const heading = document.getElementById('resultHeading');
    const text = document.getElementById('resultText');
    const icon = document.getElementById('resultIcon');
    const certBtn = document.getElementById('viewCertBtn');

    overlay.style.display = 'flex';

    if (result.status === 'Pass') {
        icon.innerHTML = '<i class="fas fa-certificate" style="font-size: 5rem; color: var(--color-saffron);"></i>';
        heading.textContent = 'Enlightened!';
        heading.style.color = 'var(--color-saffron)';
        text.textContent = `Congratulations! You scored ${result.score}%. Your certificate has been issued and added to your profile.`;
        certBtn.style.display = 'block';
    } else {
        icon.innerHTML = '<i class="fas fa-redo" style="font-size: 5rem; color: var(--color-error);"></i>';
        heading.textContent = 'Keep Seeking';
        heading.style.color = 'var(--color-error)';
        text.textContent = `You scored ${result.score}%. A score of ${examData.passingScore}% is required for certification. Review the curriculum and try again.`;
    }
}
