const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;
let qrData = ''; 

// અગત્યનું: ફોટો/PDF (Base64) મોકલવા માટે JSON લિમિટ વધારવી જરૂરી છે (50MB)
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// QR કોડ બતાવવા માટેનું પેજ
app.get('/', (req, res) => {
    if (qrData) {
        res.send(`<h2>QR કોડ સ્કેન કરો:</h2><img src="${qrData}" />`);
    } else {
        res.send(`<h2>✅ WhatsApp ઓનલાઈન છે! QR કોડની જરૂર નથી.</h2>`);
    }
});

// ==== મેસેજ અને મીડિયા મોકલવા માટેની API ====
app.post('/send', async (req, res) => {
    const { number, message, mediaBase64, mediaMime, mediaName } = req.body;

    if (!number) {
        return res.status(400).send({ error: 'નંબર આપવો જરૂરી છે.' });
    }

    try {
        // નંબરને WhatsApp ના ફોર્મેટમાં ફેરવો (દા.ત. 10 આંકડા હોય તો આગળ 91 લગાવો)
        let formattedNumber = number.toString().replace(/[^0-9]/g, ''); 
        if (formattedNumber.length === 10) {
            formattedNumber = '91' + formattedNumber;
        }
        const chatId = formattedNumber + "@c.us";
        
        // ૧. જો મીડિયા (ફોટો/PDF) મોકલવાનું હોય
        if (mediaBase64 && mediaMime) {
            const media = new MessageMedia(mediaMime, mediaBase64, mediaName || 'file');
            
            // જો મેસેજ પણ હોય તો તે ફોટાની નીચે Caption માં જશે
            if (message && message.trim() !== "") {
                await client.sendMessage(chatId, media, { caption: message });
            } else {
                await client.sendMessage(chatId, media);
            }
        } 
        // ૨. જો માત્ર ટેક્સ્ટ મેસેજ હોય
        else if (message && message.trim() !== "") {
            await client.sendMessage(chatId, message);
        }

        res.send({ success: true, msg: 'Success' });
        console.log(`✅ ${formattedNumber} ને મેસેજ મોકલાઈ ગયો.`);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).send({ error: 'Failed', details: err.toString() });
    }
});
// ==========================================================

// Railway માટે સેટિંગ્સ (અહીથી '--single-process' કાઢી નાખ્યું છે જેથી સર્વર ક્રેશ ના થાય)
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
            '--disable-gpu'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('નવો QR કોડ જનરેટ થયો છે!');
    qrcode.toDataURL(qr, (err, url) => { qrData = url; });
});

client.on('ready', () => {
    console.log('WhatsApp એકદમ રેડી છે!');
    qrData = ''; 
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Web server is running on port ${port}`);
    client.initialize();
});
