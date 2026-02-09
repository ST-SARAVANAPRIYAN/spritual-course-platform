/**
 * Secure File Service Routes
 * Handles authenticated access to protected content (videos, PDFs)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const authorize = require('../middleware/auth');

// Serve secure video file
// GET /api/secure-files/video/:courseId/:filename
router.get('/video/:courseId/:filename', authorize(), (req, res) => {
    const { courseId, filename } = req.params;

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).send('Invalid filename');
    }

    const filePath = path.join(__dirname, '../uploads/videos', courseId, filename);
    console.log('Serving video:', filePath); // Debug log

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return res.status(404).send('File not found');
    }

    // Stream video
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// Serve secure PDF file
// GET /api/secure-files/pdf/:courseId/:filename
router.get('/pdf/:courseId/:filename', authorize(), (req, res) => {
    const { courseId, filename } = req.params;

    // Validate filename
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).send('Invalid filename');
    }

    const filePath = path.join(__dirname, '../uploads/pdfs', courseId, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    // Serve PDF
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
