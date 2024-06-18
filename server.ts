import _https from "https";
import _url from "url";
import _fs from "fs";
import _express from "express";
import _dotenv from "dotenv";
import _cors from "cors";
import _fileUpload from "express-fileupload";
import _cloudinary, { UploadApiResponse } from 'cloudinary';
import _streamifier from "streamifier";
import _axios from "axios";
import _nodemailer from "nodemailer";
import _bcryptjs from "bcryptjs";
import _jwt from "jsonwebtoken";
import { google } from "googleapis";

// Lettura delle password e parametri fondamentali
_dotenv.config({ "path": ".env" });

// Configurazione Cloudinary
_cloudinary.v2.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret
});

// Variabili relative a MongoDB ed Express
import { CommandStartedEvent, MongoClient, ObjectId } from "mongodb";
const DBNAME = process.env.DBNAME;
const connectionString: string = process.env.connectionStringAtlas;
const app = _express();

// Creazione ed avvio del server https, a questo server occorre passare le chiavi RSA (pubblica e privata)
// app è il router di Express, si occupa di tutta la gestione delle richieste https
const HTTPS_PORT: number = parseInt(process.env.PORT);
let paginaErrore;
const PRIVATE_KEY = _fs.readFileSync("./keys/privateKey.pem", "utf8");
const CERTIFICATE = _fs.readFileSync("./keys/certificate.crt", "utf8");
const ENCRYPTION_KEY = _fs.readFileSync("./keys/encryptionKey.txt", "utf8");
const CREDENTIALS = { "key": PRIVATE_KEY, "cert": CERTIFICATE };
const https_server = _https.createServer(CREDENTIALS, app);
// Il secondo parametro facoltativo ipAddress consente di mettere il server in ascolto su una delle interfacce della macchina, se non lo metto viene messo in ascolto su tutte le interfacce (3 --> loopback e 2 di rete)
https_server.listen(HTTPS_PORT, () => {
    init();
    console.log(`Server HTTPS in ascolto sulla porta ${HTTPS_PORT}`);
});

function init() {
    _fs.readFile("./static/error.html", function (err, data) {
        if (err) {
            paginaErrore = `<h1>Risorsa non trovata</h1>`;
        }
        else {
            paginaErrore = data.toString();
        }
    });
}

//********************************************************************************************//
// Routes middleware
//********************************************************************************************//
app.use("/", (req: any, res: any, next: any) => {
    console.log("-----> " + req.method + ": " + req.originalUrl);
    next();
});

app.use("/", _express.static("./static"));

app.use("/", _express.json({ "limit": "50mb" }));
app.use("/", _express.urlencoded({ "limit": "50mb", "extended": true }));

app.use("/", (req: any, res: any, next: any) => {
    if (Object.keys(req["query"]).length > 0)
        console.log("      " + JSON.stringify(req["query"]));
    if (Object.keys(req["body"]).length > 0)
        console.log("      " + JSON.stringify(req["body"]));
    next();
});

// 6. Controllo degli accessi tramite CORS
// Procedura che lascia passare tutto, accetta tutte le richieste
const corsOptions = {
    origin: function (origin, callback) {
        return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));
/*
const whitelist = [
    "http://corneanugeorgealexandru-crudserver.onrender.com",	// porta 80 (default)
    "https://corneanugeorgealexandru-crudserver.onrender.com",	// porta 443 (default)
    "https://localhost:3000",
    "http://localhost:4200" // server angular
];
// Procedura che utilizza la whitelist, accetta solo le richieste presenti nella whitelist
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) // browser direct call
            return callback(null, true);
        if (whitelist.indexOf(origin) === -1) {
            var msg = `The CORS policy for this site does not allow access from the specified Origin.`
            return callback(new Error(msg), false);
        }
        else
            return callback(null, true);
    },
    credentials: true
};
app.use("/", _cors(corsOptions));
*/

// 7. Configurazione di nodemailer

const o_Auth2 = JSON.parse(process.env.oAuthCredential as any)
const OAuth2 = google.auth.OAuth2; // Oggetto OAuth2
const OAuth2Client = new OAuth2(
    o_Auth2["client_id"],
    o_Auth2["client_secret"]
);
OAuth2Client.setCredentials({
    refresh_token: o_Auth2.refresh_token,
});
let message = _fs.readFileSync("./message.html", "utf8");
let message1 = _fs.readFileSync("./message1.html", "utf8");


app.post("/api/addNewUser", async (req, res, next) => {
    let mail = req.body.mail;
    let user = req.body.username;
    let finalPwd = _bcryptjs.hashSync(req.body.password, 10);
    let client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let rq = collection.findOne({ "$or": [{ "mail": mail }, { "username": user }] });
    rq.then((data) => {
        if (data)
            res.status(401).send("Utente già registrato");
        else {
            let rq = collection.insertOne({ "mail": mail, "username": user, "password": finalPwd });
            rq.then((data) => {
                res.send({ "ris": "ok" });
            })
            rq.catch((err) => {
                console.log("Errore aggiornamento password " + err.message);
            })
            rq.finally(() => client.close());
        }
    })
    rq.catch((err) => {
        console.log("Errore aggiornamento password " + err.message);
        client.close();
    })
})

app.post("/api/checkCode", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let cod = req["body"]["codice"];
    let mail = req["body"]["email"];
    let rq = collection.findOne({ "mail": mail, "codice": { "$exists": true } });
    rq.then(async (data) => {
        let date = new Date();
        if (data["codice"]["cod"] == cod) {
            const d = structuredClone(data)
            delete d["codice"];
            delete d["_id"];
            console.log(mail, cod, data)
            let rq = collection.replaceOne({ "mail": mail }, d);
            rq.then((data1) => {
                if (date.getTime() - new Date(data["codice"]["date"]).getTime() <= 600 * 1000) {
                    res.send("Codice valido");
                } else {
                    res.status(401).send("Codice scaduto");
                }
            })
            rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
            rq.finally(() => client.close());
        }
        else {
            res.status(401).send("Codice non valido");
            client.close()
        }
    });
    rq.catch((err) => {
        res.status(500).send(`Errore esecuzione query: ${err.message}`)
        client.close()
    });
})

app.post("/api/setNewPwd", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let mail = req["body"]["email"];
    let pwd = req["body"]["pwd"];
    let finalPwd = _bcryptjs.hashSync(pwd, 10);
    let rq = collection.updateOne({ "mail": mail }, { "$set": { "password": finalPwd } });
    rq.then((data) => {
        res.send("Password cambiata con successo");
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.get("/api/cinemas", async (req, res, next) => {
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("cinema");
    let rq = collection.find().toArray();
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.get("/api/getPrograms", async (req, res, next) => {
    let id = req.query.id;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("cinema");
    let rq = collection.findOne({ "_id": new ObjectId(id as string) }, { "projection": { "programmazione": 1 } });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.post("/api/getSala", async (req, res, next) => {
    let sala = req["body"].sala;
    let _idcinema = req["body"]._idcinema;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("cinema");
    let rq = collection.findOne({ "_id": new ObjectId(_idcinema) }, { "projection": { "sale": 1 } });
    rq.then((data) => {
        console.log(data.sale);
        for (let i = 0; i < data.sale.length; i++) {
            console.log(data.sale[i]);
            if (data.sale[i].sala == sala) {
                res.send(data.sale[i]);
            }
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.post("/api/getlayout", async (req, res, next) => {
    let _idcinema = req["body"]._idcinema;
    let proiezione = req["body"].proiezione;
    let titolo = req["body"].titolo;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("cinema");
    /*let rq = collection.updateOne(
        { _id: new ObjectId(_idcinema as string), 'programmazione.titolo': titolo, 'programmazione.programma.data': proiezione.data, 'programmazione.programma.orario': proiezione.orario, "programmazione.programma.sala":proiezione.sala },
        { $set: { 'programmazione.$[outer].programma.$[inner].layout': layout } },
        { arrayFilters: [{ 'outer.titolo': titolo }, { 'inner.data': proiezione.data, 'inner.orario': proiezione.orario, "inner.sala": proiezione.sala }] }
    );*/
    let rq = collection.findOne({ _id: new ObjectId(_idcinema as string), 'programmazione.titolo': titolo, 'programmazione.programma.data': proiezione.data, 'programmazione.programma.orario': proiezione.orario, "programmazione.programma.sala": proiezione.sala }, { "projection": { "programmazione": 1 } });
    rq.then((data) => {
        console.log(data);
        data = data.programmazione.find((el) => el.titolo == titolo);
        data = data.programma.find((el) => el.data == proiezione.data && el.orario == proiezione.orario && el.sala == proiezione.sala);
        res.send(data.layout);
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

/*app.post("/api/aggiornalayout", async (req, res, next) => {
    let _idcinema = req["body"]._idcinema;
    let proiezione = req["body"].proiezione;
    let titolo = req["body"].titolo;
    let layout = req["body"].layout;
    const client = new MongoClient(connectionString);   
    await client.connect();
    const session = client.startSession();
    session.startTransaction();
    const collection = client.db(DBNAME).collection("cinema");
    let rq = collection.updateOne(
        { _id: new ObjectId(_idcinema as string), 'programmazione.titolo': titolo, 'programmazione.programma.data': proiezione.data, 'programmazione.programma.orario': proiezione.orario, "programmazione.programma.sala":proiezione.sala },
        { $set: { 'programmazione.$[outer].programma.$[inner].layout': layout } },
        { arrayFilters: [{ 'outer.titolo': titolo }, { 'inner.data': proiezione.data, 'inner.orario': proiezione.orario, "inner.sala": proiezione.sala }] });
    
    rq.then(async (data) => { 
        console.log(data);
        await session.commitTransaction();
        session.endSession();
        res.send( { "ris": "ok" })
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});*/


// 8. Login utente 
app.post("/api/loginutenti", async (req, res, next) => {
    let username = req["body"].username;
    let pwd = req["body"].password;
    let campo;
    console.log(username, pwd);
    if (username.includes('@'))
        campo = "mail";
    else {
        campo = "username"
    }
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let regex = new RegExp(`^${username}$`, "i");
    console.log(campo);
    let rq = collection.findOne({ [campo]: regex }, { "projection": { "username": 1, "password": 1 } });
    rq.then((dbUser) => {
        console.log(dbUser)
        if (!dbUser) {
            if (campo == "username")
                res.status(401).send("Username non valido");
            else
                res.status(401).send("Email non valida");
        }
        else {
            _bcryptjs.compare(pwd, dbUser.password, (err, success) => {
                if (err) {
                    res.status(500).send(`Bcrypt compare error: ${err.message}`);
                }
                else {
                    if (!success) {
                        res.status(401).send("Password non valida");
                    }
                    else {
                        let token = creaToken(dbUser);
                        console.log(token);
                        res.setHeader("authorization", token);
                        // Fa si che la header authorization venga restituita al client
                        res.setHeader("access-control-expose-headers", "authorization");
                        res.send({ "ris": "ok" });
                    }
                }
            })
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

//9. login admin
app.post("/api/loginadmin", async (req, res, next) => {
    let username = req["body"].username;
    let pwd = req["body"].password;
    console.log(username, pwd);
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utentiadmin");
    let regex = new RegExp(`^${username}$`, "i");
    let rq = collection.findOne({ "username": regex }, { "projection": { "username": 1, "password": 1 } });
    rq.then((dbUser) => {
        if (!dbUser) {
            res.status(401).send("Username non valido");
        }
        else {
            _bcryptjs.compare(pwd, dbUser.password, (err, success) => {
                if (err) {
                    res.status(500).send(`Bcrypt compare error: ${err.message}`);
                }
                else {
                    if (!success) {
                        res.status(401).send("Password non valida");
                    }
                    else {
                        let token = creaToken(dbUser);
                        console.log(token);
                        res.setHeader("authorization", token);
                        // Fa si che la header authorization venga restituita al client
                        res.setHeader("access-control-expose-headers", "authorization");
                        res.send({ "ris": "ok" });
                    }
                }
            })
        }
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

// Controllo token di google
app.post("/api/googleLogin", async (req: any, res: any, next: any) => {
    //Semplice decodifica del token ottenendo il payload in Base64
    //let payload = _jwt.decode(req["body"]["email"]);
    let email;
    if (req["body"]["user"])
        email = req["body"]["user"].email;
    else
        email = ""
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let regex = new RegExp("^" + email + "$", "i");
    let rq = collection.findOne({ "mail": regex }, { "projection": { "username": 1 } });
    rq.then((dbUser) => {
        console.log(dbUser)
        if (!dbUser) {
            let user = {
                "username": req["body"]["user"].name,
                "mail": email
            }
            let rq = collection.insertOne(user);
            rq.then(() => {
                let token = creaToken({ "username": email }, true);
                res.setHeader("authorization", token);
                res.setHeader("access-control-expose-headers", "authorization");
                res.send({ "ris": "ok" });
            });
            rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
            rq.finally(() => client.close());
        }
        else {
            let token = creaToken(dbUser, true);
            console.log(token);
            res.setHeader("authorization", token)
            //Fa si che venga restituita al client
            res.setHeader("access-control-expose-headers", "authorization")
            res.send({ "ris": "ok" })
        }
    })
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
})

function creaToken(data, google = false) {
    let currentDate = Math.floor(new Date().getTime() / 1000);
    let payload = {
        "_id": data["_id"],
        "username": data["username"],
        "google": google,
        "iat": data.iat || currentDate,
        "exp": currentDate + parseInt(process.env.durata_token)
    }
    let token = _jwt.sign(payload, ENCRYPTION_KEY)

    return (token);

}

app.use("/api/", (req: any, res: any, next: any) => {
    if (!req["body"]["skipCheckToken"]) {
        if (!req.headers["authorization"]) {
            res.status(403).send("Token mancante");
        }
        else {
            let token = req.headers["authorization"];
            console.log(ENCRYPTION_KEY, " ENCRYPTION_KEY");
            _jwt.verify(token, ENCRYPTION_KEY, (err, payload) => {
                console.log(err + "err\n" + payload + "payload");
                if (err) {
                    res.status(403).send("Token corrotto " + err);
                }
                else {
                    let newToken;
                    if (payload.google == true)
                        newToken = creaToken(payload, true);
                    else
                        newToken = creaToken(payload);
                    res.setHeader("authorization", newToken)
                    res.setHeader("access-control-expose-headers", "authorization")
                    req["payload"] = payload;
                    next();
                }
            })
        }
    }
    else {
        next();
    }

})

app.post("/api/aggiornalayout", async (req, res, next) => {
    /*let _idcinema = req["body"]._idcinema;
    let proiezione = req["body"].proiezione;
    let titolo = req["body"].titolo;
    let layout = req["body"].layout;
    let username = req["payload"].username; // assuming payload contains username

    const client = new MongoClient(connectionString);
    await client.connect();
    const session = client.startSession();
    session.startTransaction();

    try {
        const collection = client.db(DBNAME).collection("cinema");

        // Update layout by replacing 'inPrenotazione@' with the username
        layout = layout.replace(/inPrenotazione@/g, username);

        const result = await collection.updateOne(
            { 
                _id: new ObjectId(_idcinema as string), 
                'programmazione.titolo': titolo, 
                'programmazione.programma.data': proiezione.data, 
                'programmazione.programma.orario': proiezione.orario, 
                "programmazione.programma.sala": proiezione.sala 
            },
            { 
                $set: { 'programmazione.$[outer].programma.$[inner].layout': layout } 
            },
            { 
                arrayFilters: [
                    { 'outer.titolo': titolo }, 
                    { 'inner.data': proiezione.data, 'inner.orario': proiezione.orario, "inner.sala": proiezione.sala }
                ] 
            },
            { session }
        );

        if (result.matchedCount === 0) {
            throw new Error("No matching document found");
        }

        await session.commitTransaction();
        res.send({ "ris": "ok" });
    } catch (err) {
        await session.abortTransaction();
        res.status(500).send(`Errore esecuzione query: ${err.message}`);
    } finally {
        session.endSession();
        client.close();
    }*/
    const _idcinema = req.body._idcinema;
    const proiezione = req.body.proiezione;
    const titolo = req.body.titolo;
    let layout = req.body.layout;
    const username = req["payload"].username; // assuming payload contains username
    //console.log(username, "username")
    const client = new MongoClient(connectionString);
    let session;
    try {
        await client.connect();
        session = client.startSession();

        await session.withTransaction(async () => {
            const collection = client.db(DBNAME).collection("cinema");

            // Update layout by replacing 'inPrenotazione@' with the username
            for (let i = 0; i < layout.length; i++) {
                for (let j = 0; j < layout[i].length; j++) {
                    if (layout[i][j].stato == "inPrenotazione@") {
                        layout[i][j].stato = username;
                    }
                }
            }
            const filter = {
                _id: new ObjectId(_idcinema as string),
                'programmazione.titolo': titolo,
                'programmazione.programma.data': proiezione.data,
                'programmazione.programma.orario': proiezione.orario,
                'programmazione.programma.sala': proiezione.sala
            };

            const update = {
                $set: { 'programmazione.$[outer].programma.$[inner].layout': layout }
            };

            const arrayFilters = [
                { 'outer.titolo': titolo },
                { 'inner.data': proiezione.data, 'inner.orario': proiezione.orario, 'inner.sala': proiezione.sala }
            ];

            const result = await collection.updateOne(filter, update, { arrayFilters, session });

            if (result.matchedCount === 0) {
                throw new Error("No matching document found");
            }

        })
        res.send({ "ris": "ok" });
    } catch (err) {
        res.status(500).send(`Errore esecuzione query: ${err.message}`);
    } finally {
        await session.endSession();
        await client.close();
    }
});

app.post("/api/recuperaPwd", async (req: any, res: any, next: any) => {
    let mail = req.body.email;
    let codice = generateRandomPassword(6);
    let client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let regex = new RegExp("^" + mail + "$", "i");
    let rq = collection.findOne({ "mail": regex, "password": { "$exists": true } });
    rq.then((data) => {
        //crea il codice
        if (data) {
            let codicePwd = {
                "cod": codice,
                "date": new Date().toString()
            }
            let rq = collection.updateOne({ "mail": regex }, { $set: { "codice": codicePwd } })
            rq.then(async (data) => {
                let username = "f.pieretto.2292@vallauri.edu"
                let messaggio = message.replace("__user", mail).replace("__password", codice);

                const accessToken = await OAuth2Client.getAccessToken().catch((err) => res.status(500).send("Errore richiesta access token a Google " + err)); //restituisce una promise
                console.log(accessToken);

                const auth = {
                    "type": "OAuth2",
                    "user": username,
                    "clientId": o_Auth2.client_id,
                    "clientSecret": o_Auth2.client_secret,
                    "refreshToken": o_Auth2.refresh_token,
                    "accessToken": accessToken
                }
                const transporter = _nodemailer.createTransport({
                    "service": "gmail",
                    "auth": auth,
                    "tls": {
                        "rejectUnauthorized": false
                    }
                });
                let mailOptions = {
                    "from": auth.user,
                    "to": mail,
                    "subject": "Codice per il cambio password",
                    "html": messaggio,
                }
                transporter.sendMail(mailOptions, function (err, info) {
                    if (err) {
                        res.status(500).send("Errore invio mail:\n" + err.message);
                    }
                    else {
                        res.send("Ok") //ci vuole un JSON, ma stringa e' JSON valido
                    }
                });
            });
            rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
            rq.finally(() => client.close());
        }
        else {
            res.send("Utente non esistente");
            client.close();
        }
    })
    rq.catch((err) => {
        console.log("Errore aggiornamento password " + err.message);
        client.close();
    })

})

app.post("/api/salvadati", async (req: any, res: any, next: any) => {
    let _idcinema = req["body"]._idcinema;
    let proiezione = req["body"].proiezione;
    let titolo = req["body"].titolo;
    let user = req["payload"].username;
    let posti = req["body"].posti;
    let orario = proiezione.orario;
    let data1 = proiezione.data;
    let sala = proiezione.sala;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("cinema");
    let rq = collection.findOne({ "_id": new ObjectId(_idcinema as string) }, { "projection": { "nome": 1 } });
    rq.then((data) => {
        let nomeCinema = data.nome;
        // salva nella collezione prenotazioni i dati della prenotazione
        const collection = client.db(DBNAME).collection("prenotazioni");
        let rq = collection.insertOne({ "username": user, "cinema": nomeCinema, "titolo": titolo, "data": data1, "orario": orario, "sala": sala, "posti": posti });
        rq.then((data) => res.send({ "ris": "ok" }));
        rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
        rq.finally(() => client.close());
    });
    rq.catch((err) => {
        res.status(500).send(`Errore esecuzione query: ${err.message}`)
        client.close();
    });
});

app.post("/api/inviamail", async (req: any, res: any, next: any) => {
    let _idcinema = req["body"]._idcinema;
    let proiezione = req["body"].proiezione;
    let titolo = req["body"].titolo;
    let user = req["payload"].username;
    let posti = req["body"].posti;
    let orario = proiezione.orario;
    let data1 = proiezione.data;
    let sala = proiezione.sala;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    console.log("USERNAME: " + user);
    let rq = collection.findOne({ "username": user }, { "projection": { "username": 1, "mail": 1 } });
    rq.then((data) => {
        console.log(data);
        // prendi la mail
        //let user = data.username;
        let mail = data.mail
        // prendi nome cinme in base all'_id
        const collection = client.db(DBNAME).collection("cinema");
        let rq = collection.findOne({ "_id": new ObjectId(_idcinema as string) }, { "projection": { "nome": 1 } });
        rq.then(async (data) => {
            let nomeCinema = data.nome;
            let messaggio = `Gentile ${user},<br>La ringraziamo per aver scelto il cinema ${nomeCinema} per la proiezione del film ${titolo} il giorno ${data1} alle ore ${orario} nella sala ${sala}.<br>Di seguito i posti prenotati:<br>`;
            for (let i = 0; i < posti.length; i++) {
                let fila = posti[i].split("-")[0];
                let posto = posti[i].split("-")[1];
                //messaggio += `${posti[i]}<br>`;
                messaggio += `Fila: ${fila} Posto: ${posto}<br>`;
            }
            let finemess = `Grazie per aver scelto il nostro cinema.<br>Lo staff di ${nomeCinema}`;
            let username = "f.pieretto.2292@vallauri.edu"
            let msg1 = message1.replace("__messaggio", messaggio).replace("__finemess", finemess);

            const accessToken = await OAuth2Client.getAccessToken().catch((err) => res.status(500).send("Errore richiesta access token a Google " + err)); //restituisce una promise
            console.log(accessToken);

            const auth = {
                "type": "OAuth2",
                "user": username,
                "clientId": o_Auth2.client_id,
                "clientSecret": o_Auth2.client_secret,
                "refreshToken": o_Auth2.refresh_token,
                "accessToken": accessToken
            }
            const transporter = _nodemailer.createTransport({
                "service": "gmail",
                "auth": auth,
                "tls": {
                    "rejectUnauthorized": false
                }
            });
            let mailOptions = {
                "from": auth.user,
                "to": mail,
                "subject": "Riepilogo della tua prenotazione",
                "html": msg1,
            }
            transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                    res.status(500).send("Errore invio mail:\n" + err.message);
                }
                else {
                    res.send("Ok") //ci vuole un JSON, ma stringa e' JSON valido
                }
            });
            res.send(messaggio);
        });
        rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
        rq.finally(() => client.close());
    });
    rq.catch((err) => {
        res.status(500).send(`Errore esecuzione query: ${err.message}`)
        client.close();
    });

});

app.get("/api/getwatchlist", async (req, res, next) => {
    let username = req["payload"].username;
    console.log(username);
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("watchlist");
    // prendere i preferiti dell'utente in base al campo username
    let rq = collection.findOne({ "username": username }, { "projection": { "Preferiti": 1 } });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.get("/api/getfavourites", async (req, res, next) => {
    let username = req["payload"].username;
    console.log(username);
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("preferiti");
    // prendere i preferiti dell'utente in base al campo username
    let rq = collection.findOne({ "username": username }, { "projection": { "Preferiti": 1 } });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.get("/api/getcinemaadmin", async (req, res, next) => {
    let username = req["payload"].username;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("cinema");
    let rq = collection.findOne({ "admin": username });
    rq.then((docs) => res.send(docs));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.post("/api/aggiornaprogrammazione", async (req, res, next) => {
    let username = req["payload"].username;
    let programmazione = req["body"].film;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("cinema");
    // modificare solo il vettore programmazione all'interno della collection cinema
    let rq = collection.updateOne({ "admin": username }, { "$set": { "programmazione": programmazione } });
    rq.then((docs) => res.send({ "ris": "ok" }));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.post("/api/eliminafilm", async (req, res, next) => {
    let username = req["payload"].username;
    let film = req["body"].film;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("cinema");
    // eliminare il film dalla programmazione

    let rq = (collection.updateOne({ "admin": username }, { "$pull": { "programmazione": film as never } }));
    rq.then((docs) => res.send({ "ris": "ok" }));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());

});

app.post("/api/addToWatchlist", async (req, res, next) => {
    let username = req["payload"].username;
    let film = req["body"];
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("watchlist");
    //da aggiungere controllo se il film è già presente
    let rq = collection.updateOne({ "username": username }, { "$addToSet": { "Preferiti": film } }, { "upsert": true });
    rq.then((data) => {
        //console.log(docs);
        res.send(data)
    });
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.post("/api/addToFavourites", async (req, res, next) => {
    let username = req["payload"].username;
    let film = req["body"];
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("preferiti");
    //da aggiungere controllo se il film è già presente
    let rq = collection.updateOne({ "username": username }, { "$addToSet": { "Preferiti": film } }, { "upsert": true });
    rq.then((data) => res.send(data));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.patch("/api/removeFromWatchlist", async (req, res, next) => {
    let username = req["payload"].username;
    let _id = req["body"].id;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("watchlist");
    let rq = collection.updateOne({ "username": username }, { "$pull": { "Preferiti": { "_id": _id } as never } });
    rq.then((data) => res.send({ "ris": "ok" }));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.patch("/api/removeFromFavourites", async (req, res, next) => {
    let username = req["payload"].username;
    let _id = req["body"].id;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("preferiti");
    let rq = collection.updateOne({ "username": username }, { "$pull": { "Preferiti": { "_id": _id } as never } });
    rq.then((data) => res.send({ "ris": "ok" }));
    rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
    rq.finally(() => client.close());
});

app.get("/api/getUserData", async (req, res, next) => {
    if (req["payload"].username) {
        let username = req["payload"].username;
        let google = req["payload"].google;
        console.log(username + " username");
        res.send({ username, google });
    }
});

app.post("/api/getProfile", async (req, res, next) => {
    let username = req["payload"].username;
    const client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let rq = collection.findOne({ "username": username }, { "projection": { "mail": 1 } });
    rq.then((data) => {
        const collection = client.db(DBNAME).collection("prenotazioni");
        let rq = collection.find({ "username": username }).toArray();
        rq.then((data1) => {
            res.send({ "mail": data.mail, "prenotazioni": data1 });
        });
        rq.catch((err) => res.status(500).send(`Errore esecuzione query: ${err.message}`));
        rq.finally(() => client.close());
    });
    rq.catch((err) => {
        res.status(500).send("Errore esecuzione query " + err.message);
        client.close();
    })

});

app.patch("/api/changePassword", async (req: any, res: any) => {
    let username = req.body.username;
    let newPwd = req.body.newPassword;
    let oldPwd = req.body.oldPassword;
    let client = new MongoClient(connectionString);
    await client.connect();
    const collection = client.db(DBNAME).collection("utenti");
    let regex = new RegExp("^" + username + "$", "i");
    let rq = collection.findOne({ "username": regex }, { "projection": { "password": 1 } });
    rq.then((data) => {
        let pwd = data.password;
        if (!_bcryptjs.compareSync(oldPwd, pwd)) {
            res.status(500).send("Password non corretta");
        }
        else {
            let newPassword = _bcryptjs.hashSync(newPwd, 10);
            let rq = collection.updateOne({ "username": regex }, { "$set": { "password": newPassword, "firstAccess": false } });
            rq.then((data) => {
                console.log("Password aggiornata correttamente");
                res.send("ok");
            })
            rq.catch((err) => {
                console.log("Errore aggiornamento password " + err.message);
                client.close();
            })
            rq.finally(() => {
                client.close();
            })
        }
    })
    rq.catch((err) => {
        res.status(500).send("Errore esecuzione query " + err.message);
        client.close();
    })

});

//********************************************************************************************//
// Default route e gestione degli errori
//********************************************************************************************//

app.use("/", (req: any, res: any, next: any) => {
    res.status(404);
    if (req.originalUrl.startsWith("/api/"))
        res.send("api non disponibile");
    else
        res.send(paginaErrore);
});

app.use("/", (err, req, res, next) => {
    console.log("********** SERVER ERROR **********\n", err.stack);
    res.status(500).send(err.message);
})

function generateRandomPassword(length: number): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

