(function() {
  var nw = require('nw.gui');
  var events = require('events');
  var https=require("https");
  var fs=require("fs");
  var os=require("os");
  var path=require("path");
  
  var self = App.AutoUpdater = new events.EventEmitter();
  
  App.AutoUpdater.check = function() {
    https.get(nw.App.manifest.update_url, function(res) {
      var content = "";
      res.on('data', function(buf) { content += buf.toString(); });
      res.on('end', function() {
        var result = JSON.parse(content);
        if (versionCompare(result.currentVersion, nw.App.manifest.version) > 0) {
          // newer version available
          $("#autoUpdater_info").html("Running update...");
          App.AutoUpdater.download(result.url);
        } else {
          $("#autoUpdater_info").html("Application is up-to-date.");
        }
      });
      
    }).on("error", function(err) {
      console.log("Autoupdate check failed", err);
      $("#autoUpdater_info").html("Check for updates failed: "+err);
    });
  }
  
  App.AutoUpdater.download = function(url) {
    self.emit("updateAvailable");
    var dlFile = os.tmpdir()+'/autoupd.zip';
    var output = fs.createWriteStream(dlFile);
    https.get(url, function(res) {
      var pos=0;
      res.on('data', function(dat) {
        pos += dat.length;
        output.write(dat);
        try {
          self.emit("updateProgress", pos/res.headers["Content-Length"]*100);
        }catch(ex){}
      });
      res.on('end', function() {
        output.close();
        self.unzipFile(dlFile);
      });
    }).on('error', function(err) {
      $("#autoUpdater_info").html("Autoupdate failed: "+err);
      $("#modal_autoUpdater .f-msg").html("Auto-update failed: "+err);
      //alert("Autoupdate failed\n"+err);
      try {
        fs.unlinkSync(dlFile);
      } catch(ex) {}
    })
  }
  
  App.AutoUpdater.getAppDir = function() {
    if (process.platform == "darwin") {
      return process.cwd();
    } else {
      return path.dirname(process.execPath);
    }
  }
  
  App.AutoUpdater.unzipFile = function(file) {
    try {
      var targetDir = self.getAppDir();
      console.log("extracting to "+targetDir);
      $("#modal_autoUpdater .f-msg").text("Extracting to "+targetDir);
    
      fs.createReadStream(file).pipe(unzip.Extract({ path: targetDir }))
      .on("end", function() {
        $("#modal_autoUpdater h3").text("Done! Please re-launch application!");
        setTimeout(function() { nw.App.quit(); }, 3000);
      });
    }catch(ex) {
      $("#modal_autoUpdater .f-msg").html("Failed to extract update: "+ex);
    }
  }
  
  var versionCompare = function(left, right) {
      if (typeof left + typeof right != 'stringstring')
          return false;
    
      var a = left.split('.')
      ,   b = right.split('.')
      ,   i = 0, len = Math.max(a.length, b.length);
        
      for (; i < len; i++) {
          if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
              return 1;
          } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
              return -1;
          }
      }
    
      return 0;
  }
  
})();