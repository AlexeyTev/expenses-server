const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { createScraper, CompanyTypes } = require('israeli-bank-scrapers');

const app = express();
app.use(cors());
app.use(express.json());

const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

app.post('/scrape', async (req, res) => {
    const { companyId, credentials } = req.body;
    const cacheKey = `${companyId}:${JSON.stringify(credentials)}`;
    const now = Date.now();

    if (cache.has(cacheKey)) {
        const { timestamp, data } = cache.get(cacheKey);
        if (now - timestamp < CACHE_TTL_MS) {
            console.log('Returning cached data');
            return res.json(data);
        } else {
            cache.delete(cacheKey);
        }
    }

    try {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true,
        });

        const options = {
            companyId,
            startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
            combineInstallments: false,
            browser,
            skipCloseBrowser: true,

        };

        const scraper = createScraper(options);
        const result = await scraper.scrape(credentials);

        cache.set(cacheKey, { timestamp: now, data: result });
        res.json(result);
        await browser.close();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3001, () => console.log('Scraper API running on http://localhost:3001'));
