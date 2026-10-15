const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

const WEB_SERVICE_URL = 'http://localhost:8080';
const AI_SERVICE_URL = 'http://localhost:8000';

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        service: 'api-gateway',
        status: 'UP'
    });
});

app.get('/api/web/health', async (req, res) => {
    try {
        const response = await fetch(`${WEB_SERVICE_URL}/health`);
        const data = await response.json();

        res.status(response.status).json(data);
    } catch (error) {
        res.status(503).json({
            service: 'web-service',
            status: 'DOWN',
            error: 'Web service unavailable'
        });
    }
});

app.get('/api/ai/health', async (req, res) => {
    try {
        const response = await fetch(`${AI_SERVICE_URL}/health`);
        const data = await response.json();

        res.status(response.status).json(data);
    } catch (error) {
        res.status(503).json({
            service: 'ai-service',
            status: 'DOWN',
            error: 'AI service unavailable'
        });
    }
});

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});
