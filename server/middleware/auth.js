// server/middleware/auth.js
const bcrypt = require('bcrypt');

// Check if authentication is enabled
function isAuthEnabled() {
    return process.env.AUTH_ENABLED === 'true';
}

// Get credentials from environment
function getAuthCredentials() {
    const username = process.env.AUTH_USERNAME || 'admin';
    const password = process.env.AUTH_PASSWORD || 'admin';
    return { username, password };
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    // Skip auth if disabled
    if (!isAuthEnabled()) {
        return next();
    }

    // Check if user is authenticated
    if (req.session && req.session.authenticated) {
        return next();
    }

    // For API requests, return 401
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // For page requests, redirect to login
    return res.redirect('/login.html');
}

// Verify credentials
async function verifyCredentials(username, password) {
    const credentials = getAuthCredentials();
    
    // Check username
    if (username !== credentials.username) {
        return false;
    }

    // Check password (support both plain and bcrypt hashed)
    if (credentials.password.startsWith('$2b$') || credentials.password.startsWith('$2a$')) {
        // Bcrypt hashed password
        return await bcrypt.compare(password, credentials.password);
    } else {
        // Plain text password (for development)
        return password === credentials.password;
    }
}

// Hash password helper (for generating bcrypt hashes)
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

module.exports = {
    isAuthEnabled,
    requireAuth,
    verifyCredentials,
    hashPassword
};
