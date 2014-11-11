
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
    this.hosts = [];
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
    this.hosts = [];
    for(var i = 0; i < lines.length; i++) {
      var d = lines[i].split(/\t/);
      if (d.length<5) continue;
      this.hosts.push({ id: d[0], hostname: d[1], group: d[2], online: d[3]=="true", macaddr: d[4], comment: d[5] });
    }
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

