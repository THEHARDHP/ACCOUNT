const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');

const app = express();

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let latestQR = ""; // નવો વેરીએબલ, જે QR કોડ સાચવશે

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            // નવા વધારાના કમાન્ડ્સ (RAM નો વપરાશ એકદમ ઘટાડવા માટે)
            '--disable-extensions',
            '--disable-software-rasterizer',
            '--mute-audio',
            '--js-flags="--max-old-space-size=250"' 
        ]
    }
});

// જ્યારે નવો QR આવે ત્યારે તેને સેવ કરો
client.on('qr', (qr) => {
    console.log('✅ નવો QR કોડ જનરેટ થયો છે! તેને જોવા માટે તમારી વેબસાઈટ URL ની પાછળ /qr લગાવીને ખોલો.');
    latestQR = qr; 
});

// કનેક્ટ થઈ જાય એટલે QR ડેટા ક્લિયર કરી દો
client.on('ready', () => {
    console.log('✅ WhatsApp Client રેડી છે અને મેસેજ મોકલવા માટે તૈયાર છે!');
    latestQR = ""; 
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp ડિસ્કાનેક્ટ થયું:', reason);
});

client.initialize();

// ================= API ENDPOINTS =================

app.get('/', (req, res) => {
    res.send('WhatsApp Bot સર્વર ચાલુ છે!');
});

// 🌟 નવો રૂટ: બ્રાઉઝરમાં ચોખ્ખો QR કોડ જોવા માટે 🌟
app.get('/qr', (req, res) => {
    if (latestQR) {
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQR)}`;
        res.send(`
            <html>
                <body style="display:flex; justify-content:center; align-items:center; height:100vh; background-color:#f8fafc; font-family: sans-serif;">
                    <div style="text-align:center; background:white; padding:30px; border-radius:15px; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
                        <h2 style="color: #4F46E5; margin-top:0;">WhatsApp કનેક્ટ કરો</h2>
                        <img src="${qrImageUrl}" alt="QR Code" style="margin: 20px 0; border: 2px solid #E2E8F0; border-radius: 10px;"/>
                        <p style="font-size: 16px; font-weight: bold; color: #1E293B;">તમારા મોબાઈલના WhatsApp માંથી આ કોડ સ્કેન કરો.</p>
                        <p style="font-size:13px; color:#64748B;">(જો કોડ સ્કેન ના થાય, તો પેજને રિફ્રેશ કરો)</p>
                    </div>
                </body>
            </html>
        `);
    } else {
        res.send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h2>હજુ સુધી QR કોડ જનરેટ થયો નથી અથવા WhatsApp ઓલરેડી કનેક્ટેડ છે.</h2>
                <p>થોડીવાર પછી પેજ <b>રિફ્રેશ (Refresh)</b> કરો.</p>
            </div>
        `);
    }
});

app.post('/send', async (req, res) => {
    try {
        const { number, message, mediaBase64, mediaName, mediaMime } = req.body;

        if (!number) {
            return res.status(400).json({ success: false, status: 'error', message: 'મોબાઈલ નંબર આપવો જરૂરી છે' });
        }

        const chatId = `${number}@c.us`;

        if (mediaBase64 && mediaBase64 !== "") {
            const media = new MessageMedia(mediaMime, mediaBase64, mediaName);
            await client.sendMessage(chatId, media, { caption: message || "" });
        } else {
            await client.sendMessage(chatId, message || "");
        }

        res.json({ success: true, status: "success" });

    } catch (error) {
        console.error('મેસેજ મોકલવામાં ભૂલ:', error);
        res.status(500).json({ success: false, status: "error", message: error.toString() });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 સર્વર પોર્ટ ${PORT} પર શરૂ થઈ ગયું છે.`);
});
