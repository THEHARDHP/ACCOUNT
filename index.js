const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

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

// જ્યારે નવો QR કોડ જનરેટ થાય ત્યારે ટર્મિનલ/લોગ્સમાં બતાવો
client.on('qr', (qr) => {
    console.log('નવો QR કોડ જનરેટ થયો છે! કૃપા કરીને સ્કેન કરો:');
    qrcode.generate(qr, { small: true });
});

// જ્યારે WhatsApp સફળતાપૂર્વક કનેક્ટ થઈ જાય
client.on('ready', () => {
    console.log('અભિનંદન! તમારું WhatsApp સર્વર સફળતાપૂર્વક કનેક્ટ થઈ ગયું છે અને ઓનલાઈન છે!');
});

// જો કોઈ મેસેજ આવે તો તેનો રિપ્લાય આપવા માટે (ટેસ્ટિંગ માટે)
client.on('message', message => {
    if(message.body === '!ping') {
        message.reply('pong');
    }
});

// કનેક્શન તૂટે તો જાણ કરવા માટે
client.on('disconnected', (reason) => {
    console.log('WhatsApp કનેક્શન તૂટી ગયું છે. કારણ:', reason);
});

// ક્લાયન્ટ ચાલુ કરો
client.initialize();