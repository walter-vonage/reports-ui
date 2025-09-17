// index.js
const express = require('express');
const axios = require('axios');
const app = express();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const utils = require('./utils')
const userStore = require('./common/user_store')
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const multer = require('multer');
const flash = require('connect-flash');
const Config = require('./config');

// Enable CORS for all origins and methods
app.use(cors({
    origin: '*',            // allow any domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const port = process.env.VCR_PORT || 3000;

// 5MB = 5 * 1024 * 1024
// 1 GB = 1024 * 1024 * 1024 = 1073741824 bytes
const upload = multer({
    dest: path.join(__dirname, 'uploads'),
    limits: {
        fileSize: 1024 * 1024 * 1024 // 1 GB
    }
});

//  VCR
const { neru, Assets, Scheduler, State, Messages } = require('neru-alpha');
const passport = require('passport');
const cookieSession = require('cookie-session');
const initializePassport = require('./initializePassport');
const sessionStore = neru.getGlobalSession();
const globalState = new State(sessionStore);  // In debug this loses the data. Deploy is fine. Make sure your vcr.yml file contains "preserve-data: true" for debug

//  MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use('/files', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: false }));
app.use(
    cookieSession({
        name: 'session',
        keys: ['secretcat'],
        secure: false,
        resave: false,
        maxAge: 24 * 60 * 60 * 1000,
    })
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).send('File too large. Max allowed is 5MB.');
    }
    next(err);
});

/**
 * Using Passport to get session information
 * when users are logged in.
 */
initializePassport(
    passport,
    async (email) => {
        const customer = await globalState.hget('users', email);
        return JSON.parse(customer);
    },
    async (email) => {
        const customer = await globalState.hget('users', email);
        return customer;
    }
);

//
//  GET
//

//  Access the UI
//  To see the Dashboard, user must be authenticated
app.get('/', utils.checkAuthenticated, async (req, res) => {
    const credentials = await globalState.hgetall('credentials');
    console.log('Credentials', credentials)
    const user = await req.user; // resolve the promise
    const adminEmail = Config.data.ADMIN;
    res.render('dashboard', {
        showUploadFile: false,
        credentials,
        user: user ? JSON.parse(user) : null,
        adminEmail
    });
})

// Create account
app.get('/new-user', async (req, res) => {
    res.render('users-new', {});
})

// Login
app.get('/login', async (req, res) => {
    const allUsers = await userStore.getAllUsers(globalState);
    if (!allUsers || allUsers.length == 0) {
        //  Create first user
        res.render('users-new', {});
    } else {
        res.render('login', { messages: { error: null } });
    }
})

// Optional: Read a specific file and send it back programmatically
app.get('/read-file/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', fileName);
    if (fileName.includes('..')) {
        return res.status(400).send('Invalid file path');
    }
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) return res.status(404).send('File not found');
        res.sendFile(filePath);
    });
});

/**
 * Delete credentials
 */
app.get('/delete-credentials', async (req, res) => {
    const deleteCredentials = require('./actions/delete_credentials');
    await deleteCredentials.action(req, res, globalState);
});


//
//  POST
//

/**
 * Create a user
 * It will create a user ONLY if the Users 
 * table does not exist.
 */
app.post('/admin/users/create', async (req, res) => {
    const fn = require('./actions/admin_create_user');
    fn.action(req, res, globalState);
})

/**
 * Login
 */
app.post('/login', utils.checkNotAuthenticated,
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: false,
    })
);

/**
 * Store credentials 
 */
app.post('/credentials', async (req, res) => {
    const postCredentials = require('./actions/store_credentials');
    await postCredentials.action(req, res, globalState);
});

/**
 * Submit for a report
 */
app.post('/submit-json-report', upload.single('file'), async (req, res) => {
    const sendReportRequest = require('./actions/send_report_request');
    await sendReportRequest.action(req, res, globalState)
});


//  ENTRYPOINTS FOR THE FRONTEND

// GET /crons/list - proxy to credentials.reportsUrl
app.get('/crons/list', async (req, res) => {
    try {
        const credentials = await globalState.hgetall('credentials');
        if (!credentials?.reportsUrl) {
            return res.status(400).json({ message: 'Reports URL not configured' });
        }

        const { data } = await axios.get(`${credentials.reportsUrl}/crons/list`, {
            headers: { 'Accept': 'application/json' }
        });

        res.json(data);
    } catch (err) {
        console.error('Error fetching crons list:', err.message);
        res.status(500).json({ message: 'Error fetching crons list', error: err.message });
    }
});

// POST /crons/cancel - proxy to credentials.reportsUrl
app.post('/crons/cancel', async (req, res) => {
    try {
        const { cronId } = req.body;
        if (!cronId) {
            return res.status(400).json({ message: 'Missing cronId' });
        }

        const credentials = await globalState.hgetall('credentials');
        if (!credentials?.reportsUrl) {
            return res.status(400).json({ message: 'Reports URL not configured' });
        }

        const { data } = await axios.post(
            `${credentials.reportsUrl}/crons/cancel`,
            { cronId },
            { headers: { 'Content-Type': 'application/json' } }
        );

        res.json(data);
    } catch (err) {
        console.error('Error cancelling cron:', err.message);
        res.status(500).json({ message: 'Error cancelling cron', error: err.message });
    }
});


/**
 * Check system health 
 */
app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
})

/**
 * VCR calls this to show metrics related stuff
 */
app.get('/_/metrics', async (req, res) => {
    res.sendStatus(200);
})


// Start the server
app.listen(port, () => {
    console.log(`Reports API UI is running at http://localhost:${port}`);
})
