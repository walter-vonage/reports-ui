/**
 * VCR provides an REDIS instance we can use as database.
 * 
 * This function will create the first user 
 * if the database is empty.
 * 
 * Body to send: 
 * {
 *      "email": string,
 *      "password": string,
 *      "name": string,
 * }
 */
const { v4: uuidv4 } = require('uuid');
const userStore = require('../common/user_store')
const Config = require('../config')

async function action(req, res, globalState) {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            console.log('Invalid input', req.body);
            returnInvalidInput(res);
            return;
        }

        //  Can create a user only if:
        //  a) no users are created
        //  b) logged user is Config.data.ADMIN

        // 1) Get existing users from Redis
        const existingUsers = await globalState.hgetall('users');
        const userCount = existingUsers ? Object.keys(existingUsers).length : 0;

        // 2) Check if logged in user is admin
        const passportUser = await req.user;
        let isAdmin = false;
        
        try {
            const jsonPassportUser = JSON.parse(passportUser);
            const loggedUserEmail = jsonPassportUser.email;
            isAdmin = loggedUserEmail === Config.data.ADMIN;
        } catch(ex) {}        

        if (userCount > 0 && !isAdmin) {
            return res.status(200).json({
                success: false,
                message: `Only ${Config.data.ADMIN} can create additional users`
            });
        }        

        await userStore.saveUser(globalState, {
            id: uuidv4(),
            email,
            name,
            password,
        })

        // await globalState.hset('users', {
        //     [email]: JSON.stringify({
        //         id: uuidv4(),
        //         email,
        //         name,
        //         password,
        //     }),
        // })

        return res.status(200).json({
            message: 'User created'
        })

    } catch (ex) {
        console.log(ex)
        return res.status(500).json({
            message: 'Unexpected error'
        })
    }
}

function returnInvalidInput(res) {
    res.status(400).json({
        message: `Invalid input. Expected 
        {
            "email": string,
            "password": string,
            "name": string,
        }
        `
    })
}

module.exports = { action };