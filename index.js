const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
// Railway જાતે PORT આપે છે, નહીંતર 3000 વાપરશે
const port = process.env.PORT || 3000;
let qrData = ''; // આમાં QR કોડની ઇમેજ લિંક સેવ થશે

// વેબસાઈટ પર QR કોડ બતાવવા માટેનું સેટઅપ
app.get('/', (req, res) => {
    if (qrData) {
        res.send(`
            <html>
                <head><title>WhatsApp QR Code</title></head>
                <body style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
                    <h2>WhatsApp ને કનેક્ટ કરવા માટે આ QR કોડ સ્કેન કરો:</h2>
                    <img src="${qrData}" style="border: 2px solid black; padding: 10px; width: 250px; height: 250px;" />
                    <p style="color: green; font-weight: bold;">(જો સ્કેન થઈ જાય, તો તમે આ પેજ બંધ કરી શકો છો)</p>
                </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
                <body style="text-align: center; margin-top: 50px; font-family: Arial, sans-serif;">
                    <h2>QR કોડ જનરેટ થઈ રહ્યો છે...</h2>
                    <p>કૃપા કરીને થોડી સેકન્ડ રાહ જુઓ અને પછી આ પેજ <b>Refresh (Reload)</b> કરો.</p>
                </body>
            </html>
        `);
    }
});

// Railway માટે ખાસ બ્રાઉઝર સેટિંગ્સ (જેથી એરર ના આવે)
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
            '--disable-gpu'
        ],
    }
});

// જ્યારે નવો QR કોડ જનરેટ થાય
client.on('qr', (qr) => {
    console.log('નવો QR કોડ જનરેટ થયો છે! કૃપા કરીને તમારી Railway ની લિંક ઓપન કરો.');
    // QR ટેક્સ્ટને ઇમેજ (Data URL) માં ફેરવીને સેવ કરો
    qrcode.toDataURL(qr, (err, url) => {
        if (err) console.error('QR કોડ બનાવવામાં ભૂલ:', err);
        qrData = url; 
    });
});

// જ્યારે WhatsApp સફળતાપૂર્વક કનેક્ટ થઈ જાય
client.on('ready', () => {
    console.log('અભિનંદન! તમારું WhatsApp સર્વર સફળતાપૂર્વક કનેક્ટ થઈ ગયું છે અને ઓનલાઈન છે!');
    qrData = ''; // કનેક્ટ થયા પછી સુરક્ષા માટે QR કાઢી નાખો
});

// જો કોઈ મેસેજ આવે તો તેનો રિપ્લાય આપવા માટે (ટેસ્ટિંગ)
client.on('message', message => {
    if(message.body === '!ping') {
        message.reply('pong');
    }
});

// કનેક્શન તૂટે તો જાણ કરવા માટે
client.on('disconnected', (reason) => {
    console.log('WhatsApp કનેક્શન તૂટી ગયું છે. કારણ:', reason);
});

// અગત્યનો સુધારો: પહેલા વેબ સર્વર ચાલુ કરો, પછી WhatsApp બોટ ચાલુ કરો
app.listen(port, '0.0.0.0', () => {
    console.log(`Web server is successfully running on port ${port}`);
    console.log('હવે WhatsApp બોટ ચાલુ થઈ રહ્યો છે...');
    
    // ક્લાયન્ટ (બોટ) હવે ચાલુ થશે
    client.initialize();
});
