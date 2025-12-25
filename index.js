require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Véletlenszerű proxy kiválasztása
function getRandomProxy() {
    try {
        const data = fs.readFileSync('proxies.txt', 'utf8');
        const lines = data.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return null;
        return lines[Math.floor(Math.random() * lines.length)].trim();
    } catch (err) {
        return null;
    }
}

async function chatgptBypass(prompt) {
    const selectedProxy = getRandomProxy();
    const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'];
    let proxyAuth = null;

    if (selectedProxy) {
        if (selectedProxy.includes('@')) {
            const [auth, server] = selectedProxy.split('@');
            const [user, pass] = auth.split(':');
            proxyAuth = { username: user, password: pass };
            args.push(`--proxy-server=${server}`);
        } else {
            args.push(`--proxy-server=${selectedProxy}`);
        }
    }

    const browser = await puppeteer.launch({ headless: "new", args });

    try {
        const page = await browser.newPage();
        if (proxyAuth) await page.authenticate(proxyAuth);

        // User-agent beállítása a Python kód alapján
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
        
        await page.goto('https://chatgpt.com/?model=auto', { waitUntil: 'networkidle2' });

        // Input mező (ProseMirror) megvárása
        const selector = 'div.ProseMirror[contenteditable="true"]';
        await page.waitForSelector(selector, { timeout: 30000 });

        // Prompt beírása JavaScript-tel
        await page.evaluate((text, sel) => {
            const element = document.querySelector(`${sel} p`) || document.querySelector(sel);
            element.innerHTML = text;
            const event = new Event('input', { bubbles: true });
            element.dispatchEvent(event);
        }, prompt, selector);

        // Küldés gomb
        const sendBtn = 'button[aria-label="Send message"], button[data-testid="send-button"]';
        await page.waitForSelector(sendBtn);
        await page.click(sendBtn);

        // Várakozás a generálás befejezésére (Stop gomb eltűnése)
        const stopBtn = 'button[aria-label="Stop generating"], button[data-testid="stop-button"]';
        try {
            await page.waitForSelector(stopBtn, { timeout: 60000 });
            await page.waitForSelector(stopBtn, { hidden: true, timeout: 180000 });
        } catch (e) {
            console.log("Időtúllépés vagy kész a válasz.");
        }

        // Válasz kinyerése
        const responseText = await page.evaluate(() => {
            const messages = document.querySelectorAll('div[data-message-author-role="assistant"]');
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && (lastMessage.innerText.includes("Rate limit") || lastMessage.innerText.includes("Too many requests"))) {
                return "__LIMIT__";
            }
            return lastMessage ? lastMessage.innerText : null;
        });

        return responseText;
    } catch (error) {
        console.error("Hiba a folyamatban:", error);
        return null;
    } finally {
        await browser.close();
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!ai ')) return;

    const prompt = message.content.slice(4);
    const statusMsg = await message.reply("⏳ Kapcsolódás a ChatGPT-hez...");

    let result = null;
    let attempts = 3;

    for (let i = 0; i < attempts; i++) {
        result = await chatgptBypass(prompt);
        if (result && result !== "__LIMIT__") break;
        
        if (i < attempts - 1) {
            await statusMsg.edit(`⚠️ Limitbe ütköztem vagy hiba történt. Újrapróbálkozás másik proxyval (${i + 2}/${attempts})...`);
        }
    }

    if (result && result !== "__LIMIT__") {
        if (result.length > 2000) {
            await statusMsg.edit(result.substring(0, 2000));
        } else {
            await statusMsg.edit(result);
        }
    } else {
        await statusMsg.edit("❌ Sajnos minden próbálkozás sikertelen volt (limit vagy hiba).");
    }
});

client.login(process.env.DISCORD_TOKEN);
