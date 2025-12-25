FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

COPY package*.json ./

# EZZEL A SORRAL KIHAGYJUK A FELESLEGES LETÖLTÉST:
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm install

COPY . .

CMD ["node", "index.js"]
