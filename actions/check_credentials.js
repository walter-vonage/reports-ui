

async function action(req, res, globalState) {
    try {
        const credentials = await globalState.hgetall('credentials');
        return Object.keys(credentials).length > 0;
    } catch (ex) {
        console.log(ex)
        return false;
    }
}

module.exports = { action };