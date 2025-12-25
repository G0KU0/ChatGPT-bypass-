# 1. Alapkép kiválasztása
# Olyan előre elkészített rendszert használunk, amiben már benne van a Node.js és a Chrome is.
FROM ghcr.io/puppeteer/puppeteer:latest

# 2. Munkakönyvtár beállítása
# Ez lesz a mappa a szerveren belül, ahová a bot kerül.
WORKDIR /app

# 3. Függőségek másolása
# Először csak a package.json fájlokat másoljuk át, hogy a telepítés gyorsabb legyen.
COPY package*.json ./

# 4. Telepítés
# Lefuttatjuk az npm install-t a szerveren.
RUN npm install

# 5. A teljes forráskód másolása
# Beletesszük az index.js-t, a proxies.txt-t és minden mást a konténerbe.
COPY . .

# 6. Indítás
# Megadjuk a parancsot, ami elindítja a botot.
CMD ["node", "index.js"]
