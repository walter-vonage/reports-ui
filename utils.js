const { DateTime } = require('luxon');
const checkSenderIdValid = (senderId) => /^[a-zA-Z0-9]*$/gm.test(senderId);
const { tokenGenerate } = require('@vonage/jwt');
const { v4: uuidv4 } = require('uuid');
/**
 * You can use predefined VCR variables. 
 * See more: https://developer.vonage.com/en/vonage-cloud-runtime/getting-started/deploying#injected-environment-variables
 */
const privateKey = process.env.VCR_PRIVATE_KEY;
const applicationId = process.env.VCR_API_APPLICATION_ID;

const getUsers = async (globalState) => {
    try {
        const users = await globalState.hvals('users');
        return users;
    } catch (ex) {
        console.log('validateTokenBasedOnPassword', ex)
        return [];
    }
}

/**
 * For Postman requests you need to send an Authorisation Token.
 * This function will validate if the token exists or not.
 */
const validateAuthTokenFromRequest = async (globalState, req) => {
    try {
        const authHeader = req.headers['authorization'];
        let token;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1]; // Extract the token after 'Bearer '
        } else {
            token = null;
        }
        const value = await validateAuthToken(globalState, token)
        return value;
    } catch (ex) {
        console.log('validateAuthToken', ex)
        return false;
    }
}
const validateAuthToken = async (globalState, token) => {
    try {
        const storedToken = await await globalState.hvals('authTokens');
        console.log(storedToken)
        for (let item of storedToken) {
            const value = JSON.parse(item)
            if (value.token == token) {
                return true;
            }
        }
        return false;
    } catch (ex) {
        console.log('validateAuthToken', ex)
        return false;
    }
}


const createAuthorisationToken = async (globalState, password) => {
    try {
        if (!password) {
            console.log('createAuthorisationToken - no passowrd sent');
            return null;
        }

        const users = await getUsers(globalState)
        console.log(users)
        if (!users) {
            console.log('createAuthorisationToken - no users found');
            return null;
        }

        let passwordFound = false;
        for (let item of users) {
            const u = JSON.parse(item)
            if (u.password == password) {
                passwordFound = true;
                break;
            }
        }

        if (!passwordFound) {
            console.log('createAuthorisationToken - Invalid passowrd sent');
            return null;
        }

        const token = uuidv4();

        await globalState.hset('authTokens', {
            [password]: JSON.stringify({
                token,
            }),
        })

        return token;

    } catch (ex) {
        console.log('createAuthorisationToken', ex)
        return null;
    }
}



const getTemplateById = async (templateId, globalState) => {
    try {
        const TEMPLATES_TABLENAME = 'TEMPLATES';
        const templates = await globalState.hgetall(TEMPLATES_TABLENAME);
        const parsedTemplates = Object.keys(templates).map((key) => {
            const data = JSON.parse(templates[key]);
            return { ...data };
        })
        console.log('parsedTemplates', parsedTemplates)
        const template = parsedTemplates.find((template) => template.id == templateId);
        console.log('Template found', template)
        return template;
    } catch (ex) {
        console.log('getTemplateById', ex)
        return null;
    }
}

const secondsTillEndOfDay = () => {
    const now = DateTime.now().setZone('Europe/Berlin');
    const germanTime = DateTime.fromObject({ day: now.c.day, hour: 20, minute: 0, second: 0 }, { zone: 'Europe/Berlin' });
    const diffSeconds = parseInt((germanTime - now) / 1000);
    return diffSeconds;
};
const timeNow = () => {
    const now = DateTime.now().setZone('Europe/Berlin');
    return now.c.hour;
};

const generateToken = () => {
    console.log('Generating token with App Id: ' + applicationId)
    return tokenGenerate(applicationId, privateKey, {
        exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60, // 8 hours
    });
};

const checkAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

const checkNotAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.redirect('/templates/new');
    }
    next();
};

module.exports = {
    checkSenderIdValid,
    secondsTillEndOfDay,
    checkAuthenticated,
    checkNotAuthenticated,
    timeNow,
    generateToken,
    getTemplateById,
    getUsers,
    createAuthorisationToken,
    validateAuthTokenFromRequest,
};
