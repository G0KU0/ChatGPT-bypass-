require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

async function chatgptBypass(prompt) {
    const browser = await puppeteer.launch({
        headless: "new", // Render-en kötelező a headless mód
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process'
        ]
    });

    try {
        const page = await browser.newPage();
        // User-agent beállítása a beküldött Python kód alapján
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
        
        await page.goto('https://chatgpt.com/?model=auto', { waitUntil: 'networkidle2' });

        const selector = 'div.ProseMirror[contenteditable="true"]';
        await page.waitForSelector(selector);

        // Szöveg bevitele és 'input' event kiváltása a Python kód logikája szerint
        await page.evaluate((text, sel) => {
            const element = document.querySelector(`${sel} p`) || document.querySelector(sel);
            element.innerHTML = text;
            const event = new Event('input', { bubbles: true });
            element.dispatchEvent(event);
        }, prompt, selector);

        const sendBtn = 'button[aria-label="Send message"], button[data-testid="send-button"]';
        await page.waitForSelector(sendBtn);
        await page.click(sendBtn);

        // Várakozás a generálás befejezésére (Stop gomb eltűnése)
        const stopBtn = 'button[aria-label="Stop generating"], button[data-testid="stop-button"]';
        try {
            await page.waitForSelector(stopBtn, { timeout: 60000 });
            await page.waitForSelector(stopBtn, { hidden: true, timeout: 180000 });
        } catch (e) {
            console.log("Időtúllépés vagy a válasz már kész.");
        }

        // Válasz kinyerése az asszisztens szerepkör alapján
        const responseText = await page.evaluate(() => {
            const messages = document.querySelectorAll('div[data-message-author-role="assistant"]');
            return messages[messages.length - 1]?.innerText;
        });

        return responseText;
    } catch (error) {
        console.error("Hiba:", error);
        return "Sajnos hiba történt a lekérdezés során.";
    } finally {
        await browser.close();
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!ai ')) return;

    const prompt = message.content.slice(4);
    const typingMsg = await message.reply("🤖 ChatGPT gondolkodik...");

    const response = await chatgptBypass(prompt);

    if (response && response.length > 2000) {
        await typingMsg.edit(response.substring(0, 2000));
    } else {
        await typingMsg.edit(response || "Nem érkezett válasz.");
    }
});

client.login(process.env.DISCORD_TOKEN);
