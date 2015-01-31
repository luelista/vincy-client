
(function() {
  var nw = require('nw.gui');
  var events = require('events');
  var https=require("https");
  var fs=require("fs");
  var os=require("os");
  var path=require("path");
  var unzip=require('unzip');
  var url=require('url');

  var self = App.AutoUpdater = new events.EventEmitter();
  var userAgent = "vincy-client "+nw.App.manifest.version+"; "+os.type()+"; "+os.arch()+"; "+os.platform()+"; "+os.hostname();

  App.AutoUpdater.httpsGet = function(my_uri, callback) {
    var clientId = require("crypto").createHash("md5").update("client id "+App.config.clientKey).digest("base64");
    var options = url.parse(my_uri);
    options.headers = { "User-Agent": userAgent, "X-Client-ID": clientId };
    return https.get(options, callback);
  }


  App.AutoUpdater.check = function() {
    if (process.env.NO_UPDATE_CHECK) return;

    var uri = nw.App.manifest.update_url + "?version=" + nw.App.manifest.version;
    App.AutoUpdater.httpsGet(uri, function(res) {
      var content = "";
      res.on('data', function(buf) { content += buf.toString(); });
      res.on('end', function() {
        var result = JSON.parse(content);
        if (versionCompare(result.currentVersion, nw.App.manifest.version) > 0) {
          // newer version available
          $("#autoUpdater_info").html("A newer version is available");
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
    if (process.env.NO_UPDATE_CHECK || process.env.NO_UPDATE) return;

    self.emit("updateAvailable");
    $("#autoUpdater_info").html("Running update...");
    var dlFile = os.tmpdir()+'/autoupd.zip';
    console.log("Downloading to",dlFile);
    var output = fs.createWriteStream(dlFile);
    App.AutoUpdater.httpsGet(url, function(res) {
      var pos=0;

      res.on('data', function(dat) {
        pos += dat.length;
        output.write(dat);
        try {
          self.emit("updateProgress", pos/res.headers["content-length"]*100);
        }catch(ex){}
      });
      res.on('end', function() {
        output.end();
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
    //if (process.platform == "darwin") {
      return process.cwd();
    /*} else {
      return path.dirname(process.execPath);
    }*/
  }

  App.AutoUpdater.unzipFile = function(file) {
    try {
      var targetDir = self.getAppDir();
      console.log("extracting from "+file+" to "+targetDir);
      $("#modal_autoUpdater .f-msg").text("Extracting to "+targetDir);

      var extractor = unzip.Extract({ path: targetDir });
      extractor.on("close", function() {
        $("#modal_autoUpdater h3").text("Done! Please re-launch application!");
        setTimeout(function() { nw.App.quit(); }, 5000);
      });
      fs.createReadStream(file).pipe(extractor);
    }catch(ex) {
      $("#modal_autoUpdater .f-msg").html("Failed to extract update: "+ex);
      alert("Failed to extract update: "+ex);
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
