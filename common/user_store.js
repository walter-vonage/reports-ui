const USERS_HASH = 'users';

/**
 * Store or update a user
 * @param {Object} globalState 
 * @param {Object} user - Must include email
 */
async function saveUser(globalState, user) {
    if (!user.email) throw new Error('User must have an email');
    const email = user.email;
    await globalState.hset('users', {
        [email]: JSON.stringify(user)
    })
}

/**
 * Get user by email
 * @param {Object} globalState 
 * @param {string} email
 */
async function getUserByEmail(globalState, email) {
    const data = await globalState.hget(USERS_HASH, email);
    return data ? JSON.parse(data) : null;
}

/**
 * Get all users
 * @param {Object} globalState 
 */
async function getAllUsers(globalState) {
    const all = await globalState.hgetall(USERS_HASH);
    const users = [];
    for (const [email, value] of Object.entries(all)) {
        try {
            const user = JSON.parse(value);
            if (user && user.email) {
                users.push(user);
            }
        } catch (err) {
            console.error(`Failed to parse user ${email}:`, err.message);
        }
    }

    return users;
}


/**
 * Search users by name (case-insensitive contains)
 * @param {Object} globalState 
 * @param {string} name
 */
async function searchUsersByName(globalState, name) {
    const users = await getAllUsers(globalState);
    return users.filter((user) =>
        user.name?.toLowerCase().includes(name.toLowerCase())
    );
}

/**
 * Update user (merge partial updates)
 * @param {Object} globalState 
 * @param {string} email
 * @param {Object} updates
 */
async function updateUser(globalState, email, updates) {
    const user = await getUserByEmail(globalState, email);
    if (!user) throw new Error('User not found');
    const updated = { ...user, ...updates };
    await saveUser(globalState, updated);
    return updated;
}

/**
 * Login a user - Must provide all the info
 * @param {Object} globalState 
 * @param {string} email 
 * @param {string} password 
 */
const loginUser = async (globalState, email, password) => {
    const user = {
        email,
        password, // use bcrypt in production!
    };
    await globalState.hset('users', email, JSON.stringify(user));
}

module.exports = {
    saveUser,
    getUserByEmail,
    getAllUsers,
    searchUsersByName,
    updateUser,
    loginUser,
};