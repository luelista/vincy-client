// vincy command-line client

var url = require("url"),
    BinaryBuffer = require("binaryBuffer"),
    tls = require("tls"),
    net = require("net"),
    fs = require("fs"),
    util = require("util");

var userVersion = "0.0.1", protoVersion = "000001"; 
var userAgent = "vincy-cli "+userVersion+"; "+require("os").type()+"; "+require("os").hostname();



function connect(server, cb) {
  if (!server.url) {
    cb({conError:"Please configure a URL to connect to.\nFormat: vincy://username:password@server:port"},null,null);
  }
  if (!server.url.port || server.url.port < 1 || server.url.port > 65535) server.url.port = 44711;
  console.log("Connecting to "+server.url.hostname+":"+server.url.port);
  var stream = tls.connect({
    port: server.url.port, host: server.url.hostname,
    rejectUnauthorized: false,
    servername: "vincy-server"
  }, function() {
    var cert = stream.getPeerCertificate();
    if (!server.fingerprint) {
      server.fingerprint = cert.fingerprint;
      cb({conWarning:"New unknown server fingerprint stored. Click OK to continue."}, null, null); stream.end();
      return;
    }
    if (cert.fingerprint != server.fingerprint) {
      cb({conError:"POSSIBLE MITM ATTACK! Certificate fingerprint does not match."}, null, null); stream.end();
      return;
    }
    var bin = new BinaryBuffer(stream);
    stream.write(new Buffer("VINCY-"+protoVersion, "ascii"));
    BinaryBuffer.writeVbStr(stream, userAgent, "ascii");
    bin.request(16, function(serverUa) {
      server.serverVersion = serverUa.toString("ascii",0,12);
      server.serverFlags = serverUa.readUInt32BE(12);
      console.log("Server version: "+ server.serverVersion, "flags="+server.serverFlags," Now authenticating...");
      if ((server.serverFlags & 0x04) == 0x04) {
        BinaryBuffer.writeVbStr(stream, App.config.clientKey, "ascii");
      }
      
      stream.write(new Buffer(2).fill(0)); //reserved
      var auth = server.getAuth();
      console.log("auth:",auth)
      BinaryBuffer.writeVbStr(stream, auth, "ascii");
      bin.request("word", function(authResponse) {
        if (authResponse == 0x00) {
          cb(null, stream, bin);
        } else {
          bin.request(authResponse, function(authErrMsg) {
            console.log("Auth error: "+authErrMsg);
            cb({conError:"Auth error: "+authErrMsg}, null, null);
          });
        }
      })
      
      
    })
  });
  return stream;
}

function listHosts(server, cb) {
  connect(server, function(err, stream, bin) {
    if (err) { server.error=err; cb(err,null); return; }
    BinaryBuffer.writeWord(stream, 0x01);  // 0x01 = command ListHosts
    BinaryBuffer.writeVbStr(stream, "");
    bin.request(4, function(res) {
      var resLen = res.readUInt16BE(2);
      bin.request(resLen, function(hostlist) {
        cb(null, hostlist.toString());
      })
    })
  }).on("error", function(err) {
    cb(err, null);
  });
}

function wakeOnLan(server, hostId, cb) {
  connect(server, function(err, stream, bin) {
    if (err) { cb(err,false); return; }
    BinaryBuffer.writeWord(stream, 0x03);   // 0x03 = command WakeOnLan
    BinaryBuffer.writeVbStr(stream, hostId);
    bin.request("word", function(errLen) {
      if (errLen > 0) {
        bin.request(errLen, function(err) {
          console.log("ERROR: "+err);
          cb(""+err, false);
        });
      } else {
        cb(null, true);
      }
    });
  }).on("error", function(err) {
    server.error = ""+err;
    cb(err, false);
  });
}

function connectHost(server, hostId, mode, remotePort, cb) {
  
  var somePort = 49152+ (stringHashCode(hostId)%5000);
  var connection = { port : somePort, remotePort: remotePort, status: "Listening" };
  
  var listener = net.createServer(function(localStream) {
    localStream.pause();
    
    //localStream.on("data", function(buf) { console.log("Data from vnc:",buf,""+buf) });
    var proxyStream = connect(server, function(err, stream, bin) {
      if (err) { cb(hostId, err); return; }
      localStream.on("end", function() {
        cb(hostId, "Local stream closed");
      });
      //stream.on("data", function(buf) { console.log("Data from server:",buf,""+buf) });
      BinaryBuffer.writeWord(stream, mode);   // 0x02 = command ConnectVNC, 0x04 = command ConnectTCP
      BinaryBuffer.writeVbStr(stream, hostId + (remotePort ? ":"+remotePort : ""));
      bin.request("word", function(errLen) {
        if (errLen > 0) {
          bin.request(errLen, function(err) {
            console.log("ERROR: "+err);
            cb(hostId, "ERROR: "+ err);
          });
          return;
        }
        
        cb(hostId, true);
        
        bin.stopListening();

        localStream.write(bin.buffer);
        
        localStream.pipe(stream);
        stream.pipe(localStream);
      })
    });
    proxyStream.on("error", function(err) {
      console.log("ERROR in proxyConnection: "+ err);
      cb(hostId, "ERROR in proxyConnection: "+err);
      localStream.end();
    })
  }).on("error", function(err) {
    cb(hostId, "Closing and re-opening Vincy might help. Error creating listener on port "+somePort+": "+err);
  }).listen(somePort);
  
  connection.listener = listener;
  
  return connection;
}



function runVncViewer(localPort) {
  console.log("Launching vnc viewer on local port :"+localPort+" ...");
  if (App.config.prefs_vncViewerExecutable) {
    require('child_process').spawn(
        '/bin/sh', 
        ['-c', util.format(App.config.prefs_vncViewerExecutable, localPort)],
        {detached:true}
      );
    return;
  }
  switch(process.platform) {
  case "darwin":
    require('child_process').spawn('/usr/bin/open', ['vnc://someuser:somepw@127.0.0.1:'+localPort], {detached:true}); break;
  case "win32":case "win64":
    require('child_process').spawn('tvnviewer.exe', ['127.0.0.1::'+localPort], {detached:true}); break;
  }
}


//--> Helper functions

var stringHashCode = function(str){
    var hash = 0;
    if (str.length == 0) return hash;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}


App.VincyProtocol = {
  listHosts: listHosts,
  connectHost: connectHost,
  wakeOnLan: wakeOnLan,
  runVncViewer: runVncViewer
};

