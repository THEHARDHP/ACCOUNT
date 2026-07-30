const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;
let qrData = ''; 

// આ નવી લાઈન છે, જે Apps Script માંથી આવતા ડેટા (JSON) ને વાંચશે
app.use(express.json()); 

// તમારી સિક્રેટ API Key (પાસવર્ડ) - આને કોઈને કહેતા નહીં!
const MY_API_KEY = "maro_secret_password_123";

// QR કોડ બતાવવા માટેનું પેજ
app.get('/', (req, res) => {
    if (qrData) {
        res.send(`<h2>QR કોડ સ્કેન કરો:</h2><img src="${qrData}" />`);
    } else {
        res.send(`<h2>QR કોડ બની રહ્યો છે અથવા WhatsApp પહેલેથી કનેક્ટ છે.</h2>`);
    }
});

// ==== નવો ભાગ: Google Sheet માંથી મેસેજ લેવા માટેની API ====
app.post('/send-message', async (req, res) => {
    const { apiKey, number, message } = req.body;

    // પાસવર્ડ (API Key) ચેક કરો
    if (apiKey !== MY_API_KEY) {
        return res.status(401).send({ error: 'ખોટો પાસવર્ડ (API Key)!' });
    }
    
    // નંબર અને મેસેજ છે કે નહીં તે ચેક કરો
    if (!number || !message) {
        return res.status(400).send({ error: 'નંબર અને મેસેજ આપવો જરૂરી છે.' });
    }

    try {
        // નંબરને WhatsApp ના ફોર્મેટમાં ફેરવો (દા.ત. જો 10 આંકડા હોય તો આગળ 91 લગાવો)
        let formattedNumber = number.toString().replace(/[^0-9]/g, ''); 
        if (formattedNumber.length === 10) {
            formattedNumber = '91' + formattedNumber;
        }
        const chatId = formattedNumber + "@c.us";
        
        // મેસેજ મોકલો
        await client.sendMessage(chatId, message);
        res.send({ success: true, msg: 'મેસેજ મોકલાઈ ગયો!' });
        console.log(`${formattedNumber} ને મેસેજ મોકલ્યો.`);
    } catch (err) {
        res.status(500).send({ error: 'મેસેજ મોકલવામાં ભૂલ: ' + err.toString() });
    }
});
// ==========================================================

// Railway માટે સેટિંગ્સ
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu'],
    }
});

client.on('qr', (qr) => {
    console.log('નવો QR કોડ જનરેટ થયો છે!');
    qrcode.toDataURL(qr, (err, url) => { qrData = url; });
});

client.on('ready', () => {
    console.log('WhatsApp ઓનલાઈન છે!');
    qrData = ''; 
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Web server is running on port ${port}`);
    client.initialize();
});
