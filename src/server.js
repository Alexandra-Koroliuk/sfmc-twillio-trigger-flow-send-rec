require('dotenv').config();
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');

const app = express();
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Serve configuration UI statically
app.use(express.static(path.join(__dirname, '../public')));

// SFMC signed payloads arrive in raw 'application/jwt' format
app.use(express.raw({ type: 'application/jwt' }));
app.use(express.json());

// JWT Verification Middleware
function verifySfmcJwt(req, res, next) {
    const JWT_SECRET = process.env.SFMC_JWT_SECRET;
    
    if (req.headers['content-type'] === 'application/jwt') {
        try {
            const rawToken = req.body.toString('utf8');
            const decoded = jwt.verify(rawToken, JWT_SECRET, { algorithms: ['HS256'] });
            req.jwtPayload = decoded; 
            next();
        } catch (err) {
            console.error('JWT validation error:', err.message);
            return res.status(401).json({ error: 'Unauthorized: JWT Verification Failed' });
        }
    } else {
        console.warn('Bypassing JWT: Content-type was not application/jwt');
        req.jwtPayload = req.body;
        next();
    }
}

// Keep-Alive and Heatlh-Check endpoint for Render
app.get('/ping', (req, res) => {
    res.status(200).send('pong - active');
});

// Serve metadata configuration file
app.get('/config.json', (req, res) => {
    res.sendFile(path.join(__dirname, '../config.json'));
});

// Primary Contact Execution Endpoint
app.post('/execute', verifySfmcJwt, async (req, res) => {
    try {
        const inArguments = req.jwtPayload.inArguments[0];
        
        const flowSid = inArguments.flowSid;
        const twilioFrom = inArguments.twilioFrom;
        const phoneNumber = inArguments.phoneNumber;

        // Reconstruct the flattened custom parameters back into a structured JSON
        const flowParams = {};
        Object.keys(inArguments).forEach(key => {
            if (key.startsWith('param_')) {
                const cleanKey = key.replace('param_', '');
                flowParams[cleanKey] = inArguments[key];
            }
        });

        console.log(`[Render] Executing activity path for recipient: ${phoneNumber}`);

        // Trigger Twilio Studio Flow Execution
        const execution = await twilioClient.studio.v2
            .flows(flowSid)
            .executions.create({
                to: phoneNumber,
                from: twilioFrom,
                parameters: flowParams
            });

        console.log(`[Render] Success. Studio Execution SID: ${execution.sid}`);
        return res.status(200).json({ status: 'success', executionSid: execution.sid });

    } catch (error) {
        console.error('[Render] Execution Failure:', error.message);
        return res.status(200).json({ status: 'failed', error: error.message });
    }
});

// Required SFMC design-time hooks
app.post('/save', verifySfmcJwt, (req, res) => res.status(200).json({ status: 'saved' }));
app.post('/publish', verifySfmcJwt, (req, res) => res.status(200).json({ status: 'published' }));
app.post('/validate', verifySfmcJwt, (req, res) => res.status(200).json({ status: 'validated' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Render Custom Activity Server actively listening on port ${PORT}`);
});
