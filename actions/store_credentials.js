

async function action(req, res, globalState) {
    try {
        const { apiKey, apiSecret, reportsUrl } = req.body;

        if (!apiKey || !apiSecret || !reportsUrl) {
            return res.send('Missing data')
        }

        // Save to Redis hash "credentials"
        await globalState.hset('credentials', {
            apiKey,
            apiSecret,
            reportsUrl,
        });

        res.redirect('/')

    } catch (ex) {
        console.log(ex)
        return res.send('Unexpected error')
    }
}

module.exports = { action };