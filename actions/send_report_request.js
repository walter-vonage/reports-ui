const axios = require('axios');

async function action(req, res, globalState) {
    try {
        const {
            accountId,
            startDate,
            endDate,
            product,
            direction,
            include_subaccounts,
            include_messages,
            emailTo,
            groupByFields,
            groupByName,
            cron_time,
        } = req.body;

        const normalizeArray = val => (Array.isArray(val) ? val : val ? [val] : []);
        const aggregationType = normalizeArray(req.body.aggregationType);
        const aggregationField = normalizeArray(req.body.aggregationField);
        const aggregationLabel = normalizeArray(req.body.aggregationLabel);

        const cronDays = req.body.cronDays
            ? Array.isArray(req.body.cronDays)
                ? req.body.cronDays
                : [req.body.cronDays]
            : [];

        const cron = {
            startAt: cron_time,
            mon: cronDays.includes('mon'),
            tue: cronDays.includes('tue'),
            wed: cronDays.includes('wed'),
            thu: cronDays.includes('thu'),
            fri: cronDays.includes('fri'),
            sat: cronDays.includes('sat'),
            sun: cronDays.includes('sun'),
        };

        const aggregations = [];

        for (let i = 0; i < aggregationType.length; i++) {
            const type = aggregationType[i];
            const field = aggregationField[i];
            const label = aggregationLabel[i];

            // Only add if all fields are valid (avoid undefined)
            if (type && field && label) {
                aggregations.push({ type, field, label });
            }
        }

        let payload = {
            accountId,
            startDate,
            endDate,
            product,
            direction,
            include_subaccounts: include_subaccounts === 'true',
            include_messages: include_messages === 'true',
            emailTo,
            cron,
            reportJob: {
                filterConfig: {
                    logic: 'AND',
                    filters: [
                        {
                            field: 'session_type',
                            type: 'text',
                            operator: 'regex',
                            value: '^(?!service$).*',
                            options: 'i',
                        },
                    ],
                },
                groupBy: [
                    {
                        name: groupByName,
                        fields: groupByFields.split(',').map(f => f.trim()).filter(f => f.length > 0),
                    },
                ],
                aggregations,
            },
        };

        //  Add the credentials
        payload = await attachCredentials(globalState, payload);

        console.log('Final JSON payload to send:');
        console.log(JSON.stringify(payload, null, 2));

        const response = await sendReportRequest(globalState, payload)
        
        if (response) {
            res.send('Report Generated! <a href="/">Go back</a>');
        } else {
            res.send('Error generating report!');
        }

    } catch (ex) {
        console.log(ex)
        return res.send('Unexpected error')
    }
}

async function attachCredentials(globalState, payload) {
    const credentials = await globalState.hgetall('credentials');
    if (!credentials || !credentials.apiKey || !credentials.apiSecret) {
        throw new Error('Missing stored credentials');
    }
    return {
        ...payload,
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
    };
}

async function sendReportRequest(globalState, reportPayload) {
    try {
        const credentials = await globalState.hgetall('credentials');
        if (!credentials || !credentials.reportsUrl) {
            throw new Error('Missing stored credentials');
        }
        console.log('Sending report request to this URL from Stored Credentials: ', credentials)
        const response = await axios.post(
            credentials.reportsUrl + '/reports',
            reportPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );
        console.log('Report request sent successfully!');
        console.log(response.data);
        return true
    } catch (error) {
        console.error('Error sending report request:', error.response?.data || error.message);
        return false;
    }
}

module.exports = { action };