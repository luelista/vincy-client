
(function() {
  var url = require("url");
  
  function VincyServer(key, obj) {
    if (obj) {
      this.url = url.parse(obj.url);
      this.key = key;
    } else {
      this.url = null;
      this.key = null;
    }
    this.error = null;
    this.hosts = [];
    this.loading = false;
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
      out[s.key] = { url: s.urlString() };
    }
    return out;
  }
  
  App.VincyServer = VincyServer;
  
})();

