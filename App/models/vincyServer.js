
(function() {
  var url = require("url");

  function VincyServer(key, obj) {
    if (obj) {
      this.url = url.parse(obj.url);
      this.key = key;
      this.fingerprint = obj.fingerprint;
    } else {
      this.url = null;
      this.key = null;
      this.fingerprint = null;
    }
    this.error = null;
    this.hosts = {};
    this.loading = false;
  }

  VincyServer.prototype.getAuth = function() {
    if (this.url&&this.url.auth) return this.url.auth;
    return App.config.prefs_username+":"+App.config.prefs_password;
  }

  VincyServer.prototype.setUrl = function(new_url, user, passwd) {
    this.url = url.parse(new_url);
    if (user && passwd)
      this.url.auth = user+':'+passwd;
  }

  VincyServer.prototype.urlString = function() {
    return url.format(this.url);
  }

  VincyServer.prototype.urlViewString = function() {
    return url.format({protocol:this.url.protocol, hostname: this.url.hostname, port: this.url.port, slashes:true});
  }

  VincyServer.prototype.toString = function() {
    return "[VincyServer "+(this.url ? this.url.host : "-")+"]";
  }

  VincyServer.prototype.parseHostlist = function(plainStr) {
    var lines = plainStr.split(/\n/);
    var newHosts = {};
    for(var i = 0; i < lines.length; i++) {
      var d = lines[i].split(/\t/);
      if (d.length<5) continue;
      var id = d[0];
      newHosts[id] = this.hosts[id] ? this.hosts[id] : {};
      newHosts[id].id = d[0];
      newHosts[id].hostname = d[1];
      newHosts[id].group = d[2];
      newHosts[id].online = d[3]=="true";
      newHosts[id].macaddr = d[4];
      newHosts[id].comment = d[5];
    }
    this.hosts = newHosts;
  }

  VincyServer.makeJSON = function(serverList) {
    var out = {};
    for(var i in serverList) {
      var s = serverList[i];
      out[s.key] = { url: s.urlString(), fingerprint: s.fingerprint };
    }
    return out;
  }

  App.VincyServer = VincyServer;

})();
