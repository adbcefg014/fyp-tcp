// Get application modules
const net = require('net');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

// Configuration ===================================
const port = 8888;
const serviceAccount = require('./gcp_private_key.json');
//=================================================

// Authenticate Firebase Account
initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();
console.log("Firebase authenticated!");

// Create an instance of the TCP server and attach the client handling callback
const server = net.createServer(onClientConnection);

// Start listening on given port and host.
server.listen(port,function(){
   console.log(`Server started on port ${port}`); 
});


//the client handling callback
function onClientConnection(sock){
    //Log when a client connnects.
    console.log(`${sock.remoteAddress}:${sock.remotePort} Connected`);
    
	//Handle the client data.
    sock.on('data',function(data){
        // Process data received from the client
        console.log(`>> data received : ${data} `);
        let inData = JSON.parse(data);
        const id = inData.shift();
		
		// Prepare and send a response to the client 
        let serverResp = "";
        switch (id){
            case (1):
                // Request for which sensor node to read
                let matches = {};
                let count = 0;
                for (const element of inData) {
                    if (Object.hasOwn(toRead, element)) {
                        matches[count] = toRead[element];
                    }
                    count++;
                }
                serverResp = JSON.stringify(matches);
                break;
            case (2):
                // Notification of which sensor node read sent
                let idDone = inData.shift();
                let scannedArray = inData.shift();
                arrayDone = JSON.parse(scannedArray);
                arrayDone.shift();
                let deviceID = arrayDone[idDone];
                console.log(deviceID);

                serverResp = "blank";
                nodeReadSent(deviceID);
                break;
            default:
                // Sensor node incoming data
                serverResp = "blank";
                storeSensorData(id, inData);
        }
		
		// Send resonpse to client & Close the connection 
		sock.write(serverResp);
		sock.end()        
	});
    
	// Handle when client connection is closed
    sock.on('close',function(){
        console.log(`${sock.remoteAddress}:${sock.remotePort} Connection closed`);
    });
    
	// Handle Client connection error.
    sock.on('error',function(error){
        console.error(`${sock.remoteAddress}:${sock.remotePort} Connection Error ${error}`);
    });
};

// Firestore data functions
async function storeSensorData(id, inData){
    let dataObj = {};
    for (let arrayEntry = 0; arrayEntry < inData.length; arrayEntry++) {
        dataObj[arrayEntry] = inData[arrayEntry];
    }

    // Add processed set of sensor readings to Database
    let timestamp = new Date().toISOString();
    dataObj["t"] = timestamp;
    await db.collection(id).add(dataObj);

    return;
}

async function nodeReadSent(id){
    let updateObj = {};
    updateObj[id] = 0;
    query.doc('toRead').update(updateObj);
}

let toRead = {};
const query = db.collection('commands');
const onceObserver = query.onSnapshot(querySnapshot => {
    querySnapshot.docChanges().forEach(change => {
        if (change.doc.id === 'toRead') {
            for (const [key, value] of Object.entries(change.doc.data())) {
                if (value === 0) {
                    delete toRead[key];
                }
                if (value === 1 || value === 2) {
                    toRead[key] = value;
                }
            }
            console.log(toRead);
        }
    })
})