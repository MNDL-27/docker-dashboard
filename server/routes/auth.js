// server/routes/auth.js
const express = require('express');
const router = express.Router();
const { verifyCredentials, isAuthEnabled } = require('../middleware/auth');

// Login endpoint
router.post('/login', async (req, res) => {
    // If auth is disabled, just mark as authenticated
    if (!isAuthEnabled()) {
        req.session.authenticated = true;
        return res.json({ success: true, message: 'Authentication disabled' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    try {
        const isValid = await verifyCredentials(username, password);
        
        if (isValid) {
            req.session.authenticated = true;
            req.session.username = username;
            return res.json({ success: true, message: 'Login successful' });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Check auth status
router.get('/status', (req, res) => {
    res.json({
        authEnabled: isAuthEnabled(),
        authenticated: req.session?.authenticated || false,
        username: req.session?.username || null
    });
});

module.exports = router;
