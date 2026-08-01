const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();

// Base64 મીડિયા (ફોટો/PDF) માટે લિમિટ વધારી છે જેથી મોટી ફાઈલ મોકલી શકાય
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// WhatsApp Client નું સેટઅપ (512MB RAM માટે ઓપ્ટિમાઇઝ્ડ)
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
            '--single-process', // Render ના 512MB પ્લાન માટે ખૂબ જરૂરી
            '--disable-gpu'
        ]
    }
});

// QR કોડ ટર્મિનલ (Render ના Logs) માં બતાવવા માટે
client.on('qr', (qr) => {
    console.log('આ QR કોડ તમારા WhatsApp થી સ્કેન કરો:');
    qrcode.generate(qr, { small: true });
});

// જ્યારે WhatsApp કનેક્ટ થઈ જાય ત્યારે
client.on('ready', () => {
    console.log('✅ WhatsApp Client રેડી છે અને મેસેજ મોકલવા માટે તૈયાર છે!');
});

// જો WhatsApp ડિસ્કાનેક્ટ થાય તો
client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp ડિસ્કાનેક્ટ થયું:', reason);
});

client.initialize();

// ================= API ENDPOINTS =================

// 1. સર્વરને જાગતું રાખવા માટે (Google Apps Script માંથી keepServerAwake ફંક્શન માટે)
app.get('/', (req, res) => {
    res.send('WhatsApp Bot સર્વર ચાલુ છે!');
});

// 2. મેસેજ મોકલવા માટેની મેઇન API (તમારી Google Sheet આ જ API વાપરે છે)
app.post('/send', async (req, res) => {
    try {
        const { number, message, mediaBase64, mediaName, mediaMime } = req.body;

        if (!number) {
            return res.status(400).json({ success: false, status: 'error', message: 'મોબાઈલ નંબર આપવો જરૂરી છે' });
        }

        // WhatsApp માં નંબર પાછળ @c.us લગાવવું જરૂરી છે
        const chatId = `${number}@c.us`;

        if (mediaBase64 && mediaBase64 !== "") {
            // જો ફોટો કે PDF હોય તો
            const media = new MessageMedia(mediaMime, mediaBase64, mediaName);
            await client.sendMessage(chatId, media, { caption: message || "" });
        } else {
            // જો ફક્ત ટેક્સ્ટ મેસેજ હોય તો
            await client.sendMessage(chatId, message || "");
        }

        // તમારી Google Script ને Success નો રિપ્લાય આપશે
        res.json({ success: true, status: "success" });

    } catch (error) {
        console.error('મેસેજ મોકલવામાં ભૂલ:', error);
        res.status(500).json({ success: false, status: "error", message: error.toString() });
    }
});

// સર્વર કયા પોર્ટ પર ચાલશે (Render જાતે PORT ડિસાઇડ કરે છે)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 સર્વર પોર્ટ ${PORT} પર શરૂ થઈ ગયું છે.`);
});
