const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs'); // નવું: ફોલ્ડર ડિલીટ કરવા માટે

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let currentQR = "";
let sock;
let isConnected = false;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), 
        // 🌟 અહીં આપણે સ્ટાન્ડર્ડ બ્રાઉઝરનું નામ વાપરીશું જેથી WhatsApp બ્લોક ના કરે
        browser: ["Ubuntu", "Chrome", "20.0.04"] 
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("✅ નવો QR કોડ આવી ગયો છે! /qr લિંક પર જઈને ચેક કરો.");
            currentQR = await qrcode.toDataURL(qr); 
        }
        
        if (connection === 'close') {
            const statusCode = (lastDisconnect.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log('❌ WhatsApp ડિસ્કાનેક્ટ થયું. એરર કોડ:', statusCode);
            isConnected = false;

            // જો 401 (Unauthorized) કે બીજી કોઈ એરર આવે તો કરપ્ટ ફોલ્ડર જાતે જ ડિલીટ કરી નાખશે
            if (statusCode === 401 || statusCode === 403 || statusCode === 500 || !shouldReconnect) {
                console.log('🗑️ જૂનો કરપ્ટ ડેટા ડિલીટ કરી રહ્યા છીએ...');
                try {
                    if (fs.existsSync('./auth_info')) {
                        fs.rmSync('./auth_info', { recursive: true, force: true });
                    }
                } catch(e) { console.log('Delete Error:', e); }
                
                console.log('🔄 ફ્રેશ સિસ્ટમ રીસ્ટાર્ટ થઈ રહી છે...');
                setTimeout(() => connectToWhatsApp(), 3000);
            } else {
                setTimeout(() => connectToWhatsApp(), 5000);
            }
            
        } else if (connection === 'open') {
            console.log('✅ WhatsApp સફળતાપૂર્વક કનેક્ટ થઈ ગયું છે!');
            currentQR = "";
            isConnected = true;
        }
    });
}

connectToWhatsApp();

// ================= API ENDPOINTS =================

app.get('/', (req, res) => {
    res.send('WhatsApp Baileys સર્વર ચાલુ છે!');
});

// 🌟 કટોકટીમાં મેન્યુઅલ રીસેટ કરવા માટે નવી લિંક 🌟
app.get('/reset', (req, res) => {
    try {
        if (fs.existsSync('./auth_info')) {
            fs.rmSync('./auth_info', { recursive: true, force: true });
        }
        res.send('✅ સિસ્ટમ રીસેટ થઈ ગઈ છે. જૂનો ડેટા ડિલીટ થઈ ગયો છે. હવે Render માંથી સર્વર Restart કરો.');
    } catch(e) {
        res.send('❌ રીસેટ કરવામાં ભૂલ આવી.');
    }
});

app.get('/qr', (req, res) => {
    if (isConnected) {
        return res.send(`
            <div style="text-align: center; font-family: sans-serif; margin-top: 50px;">
                <h2 style="color: green;">✅ તમારું WhatsApp સફળતાપૂર્વક કનેક્ટ થઈ ગયું છે!</h2>
                <p>હવે તમે ડેશબોર્ડમાંથી મેસેજ મોકલી શકો છો.</p>
            </div>
        `);
    }
    
    if (currentQR) {
        res.send(`
            <div style="display:flex; justify-content:center; align-items:center; height:100vh; background-color:#f8fafc; font-family: sans-serif;">
                <div style="text-align:center; background:white; padding:30px; border-radius:15px; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
                    <h2 style="color: #4F46E5; margin-top:0;">WhatsApp કનેક્ટ કરો</h2>
                    <img src="${currentQR}" alt="QR Code" style="margin: 20px 0; border: 2px solid #E2E8F0; border-radius: 10px; width: 250px; height: 250px;"/>
                    <p style="font-size: 16px; font-weight: bold; color: #1E293B;">આ નવો કોડ સ્કેન કરો</p>
                </div>
            </div>
        `);
    } else {
        res.send(`
            <div style="text-align: center; font-family: sans-serif; margin-top: 50px;">
                <h2>QR કોડ જનરેટ થઈ રહ્યો છે...</h2>
                <p>કૃપા કરીને 5 સેકન્ડ પછી પેજ <b>રિફ્રેશ (Refresh)</b> કરો.</p>
            </div>
        `);
    }
});

app.post('/send', async (req, res) => {
    if (!isConnected) {
        return res.status(500).json({ success: false, status: 'error', message: 'WhatsApp હજુ કનેક્ટ નથી થયું' });
    }
    
    try {
        const { number, message, mediaBase64, mediaName, mediaMime } = req.body;

        if (!number) {
            return res.status(400).json({ success: false, status: 'error', message: 'મોબાઈલ નંબર આપવો જરૂરી છે' });
        }

        const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;

        if (mediaBase64 && mediaBase64 !== "") {
            const buffer = Buffer.from(mediaBase64, 'base64');
            let messageOptions = {};
            
            if (mediaMime.includes('image')) {
                messageOptions = { image: buffer, caption: message || "" };
            } else if (mediaMime.includes('pdf') || mediaMime.includes('application')) {
                messageOptions = { document: buffer, mimetype: mediaMime, fileName: mediaName || "document", caption: message || "" };
            } else {
                messageOptions = { document: buffer, mimetype: mediaMime, fileName: mediaName || "file", caption: message || "" };
            }
            
            await sock.sendMessage(jid, messageOptions);
        } else {
            await sock.sendMessage(jid, { text: message || "" });
        }

        res.json({ success: true, status: "success" });

    } catch (error) {
        console.error('મેસેજ મોકલવામાં ભૂલ:', error);
        res.status(500).json({ success: false, status: "error", message: error.toString() });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 લાઇટવેઇટ સર્વર પોર્ટ ${PORT} પર શરૂ થઈ ગયું છે.`);
});
