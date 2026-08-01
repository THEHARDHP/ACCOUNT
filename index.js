const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const qrcode = require('qrcode');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let currentQR = "";
let sock;
let isConnected = false;

async function connectToWhatsApp() {
    // આ લાઈન લોગીન ડેટાને 'auth_info' ફોલ્ડરમાં સેવ કરશે
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), // વધારાના લોગ્સ બંધ કરવા
        browser: ["ProSender CRM", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("નવો QR કોડ આવ્યો છે! /qr લિંક પર જઈને ચેક કરો.");
            currentQR = await qrcode.toDataURL(qr); // બ્રાઉઝર માટે QR જનરેટ કરો
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('WhatsApp ડિસ્કાનેક્ટ થયું. ફરીથી કનેક્ટ કરવાનો પ્રયાસ:', shouldReconnect);
            isConnected = false;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp સફળતાપૂર્વક કનેક્ટ થઈ ગયું છે!');
            currentQR = "";
            isConnected = true;
        }
    });
}

// WhatsApp સિસ્ટમ શરૂ કરો
connectToWhatsApp();

// ================= API ENDPOINTS =================

app.get('/', (req, res) => {
    res.send('WhatsApp Baileys સર્વર સુપરફાસ્ટ સ્પીડમાં ચાલુ છે!');
});

// બ્રાઉઝરમાં સ્કેન કરવા માટે
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
                    <p style="font-size: 16px; font-weight: bold; color: #1E293B;">આ કોડ સ્કેન કરો (RAM ક્રેશ નહીં થાય!)</p>
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

// મેસેજ મોકલવાની મેઇન API
app.post('/send', async (req, res) => {
    if (!isConnected) {
        return res.status(500).json({ success: false, status: 'error', message: 'WhatsApp હજુ કનેક્ટ નથી થયું' });
    }
    
    try {
        const { number, message, mediaBase64, mediaName, mediaMime } = req.body;

        if (!number) {
            return res.status(400).json({ success: false, status: 'error', message: 'મોબાઈલ નંબર આપવો જરૂરી છે' });
        }

        // Baileys માં નંબર પાછળ @s.whatsapp.net લગાવવું પડે છે
        const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;

        if (mediaBase64 && mediaBase64 !== "") {
            // ફોટો કે PDF મોકલવાનું લોજીક
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
            // માત્ર ટેક્સ્ટ મેસેજ
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
