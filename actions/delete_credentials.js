async function action(req, res, globalState) {
    try {
        await globalState.delete('credentials');
        res.redirect('/');
    } catch (err) {
        console.error('Failed to delete credentials:', err);
        res.status(500).send('Error deleting credentials.');
    }
}

module.exports = { action };