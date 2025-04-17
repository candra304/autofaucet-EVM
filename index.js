require('dotenv').config(); // Load environment variables
const axios = require('axios');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const chalk = require('chalk'); // Import chalk for colored output

// Show banner function
function showBanner() {
    console.clear();
    console.log(chalk.magentaBright(`
========================================
  █████╗ ██╗   ██╗████████╗ ██████╗ 
 ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗
 ███████║██║   ██║   ██║   ██║   ██║
 ██╔══██║██║   ██║   ██║   ██║   ██║
 ██║  ██║╚██████╔╝   ██║   ╚██████╔╝
 ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ 
SAT SET 
                           [by Chandra]
========================================
`));
}

// Load environment variables
const API_KEY = process.env.API_KEY;
const SITE_KEY = process.env.SITE_KEY;
const PAGE_URL = process.env.PAGE_URL;
const CLAIM_URL = process.env.CLAIM_URL;

// Read wallet addresses and proxies from files
const wallets = fs.readFileSync('wallet.txt', 'utf-8').split('\n').filter(Boolean);
const proxies = fs.readFileSync('proxies.txt', 'utf-8').split('\n').filter(Boolean);

async function solveCaptcha(proxy, index) {
    const agent = proxy ? new HttpsProxyAgent(proxy) : null;

    try {
        // Submit captcha solving request
        const { data: inData } = await axios.post('http://2captcha.com/in.php', null, {
            params: {
                key: API_KEY,
                method: 'hcaptcha',
                sitekey: SITE_KEY,
                pageurl: PAGE_URL,
                json: 1
            },
            ...(agent && { httpsAgent: agent })
        });

        const requestId = inData.request;
        let attempt = 1;

        // Wait for captcha to be solved
        while (true) {
            console.log(chalk.magentaBright(`[⏳ Waiting: Account ${index + 1} | Attempt ${attempt}]`));
            await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

            const { data: resData } = await axios.get('http://2captcha.com/res.php', {
                params: {
                    key: API_KEY,
                    action: 'get',
                    id: requestId,
                    json: 1
                },
                ...(agent && { httpsAgent: agent })
            });

            if (resData.status === 1) {
                return resData.request; // Captcha solved
            } else if (resData.request !== 'CAPCHA_NOT_READY') {
                throw new Error('Captcha failed: ' + resData.request);
            }

            attempt++;
        }
    } catch (error) {
        throw new Error(`[Captcha Error]: ${error.message}`);
    }
}

async function claim(wallet, proxy, index) {
    const agent = proxy ? new HttpsProxyAgent(proxy) : null;

    try {
        console.log(chalk.magentaBright(`[~] Claiming for wallet: ${wallet} with proxy: ${proxy || 'none'}`));

        // Solve captcha
        const captchaToken = await solveCaptcha(proxy, index);

        // Send claim request
        const res = await axios.post(CLAIM_URL, {
            address: wallet
        }, {
            headers: {
                'Content-Type': 'application/json',
                'H-Captcha-Response': captchaToken
            },
            ...(agent && { httpsAgent: agent })
        });

        console.log(chalk.greenBright(`[✓] Claimed successfully: ${wallet} =>`), res.data);
    } catch (err) {
        console.error(chalk.redBright(`[x] Error claiming wallet ${wallet}: ${err.message}`));
    }
}

(async () => {
    showBanner(); // Display banner
    for (let i = 0; i < wallets.length; i++) {
        const wallet = wallets[i];
        const proxy = proxies[i % proxies.length]; // Rotate proxies

        // Attempt to claim
        await claim(wallet, proxy, i);

        console.log(chalk.magentaBright(`[⏳ Queueing: Completed account ${i + 1}]`));
        await new Promise(r => setTimeout(r, 5000)); // Delay between claims
    }
})();
