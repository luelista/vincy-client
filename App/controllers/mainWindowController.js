(function() {
  var nw = require('nw.gui');
  
  App.MainWindow = {};
  var self = App.MainWindow;
  App.servers = [];
  
  function makeDropdownMenu(title) {
    var m = new nw.MenuItem({ label: title });
    m.submenu = new nw.Menu();
    return m;
  }
  
  function initMainMenu() {
    var win = nw.Window.get();
    var nativeMenuBar = new nw.Menu({ type: "menubar" });
    
    var appMenu, aIndex, accountMenu, windowMenu, wIndex;
    var mod;
    
    if (process.platform === "darwin") {
      mod = "cmd";
      nativeMenuBar.createMacBuiltin("ViNCy");
      appMenu = nativeMenuBar.items[0].submenu; aIndex=2;
      windowMenu = nativeMenuBar.items[2].submenu; wIndex=3;
      nativeMenuBar.insert(makeDropdownMenu("Account"), 1);
      accountMenu = nativeMenuBar.items[1].submenu;
      windowMenu.insert(new nw.MenuItem({ type: "separator" }), wIndex++);
      
    } else {
      mod = "ctrl";
      nativeMenuBar.append(makeDropdownMenu("File"));
      nativeMenuBar.append(makeDropdownMenu("Edit"));
      nativeMenuBar.append(makeDropdownMenu("Tools"));
      nativeMenuBar.append(makeDropdownMenu("Window"));
      accountMenu = nativeMenuBar.items[0].submenu;
      appMenu = nativeMenuBar.items[2].submenu; aIndex=0;
      windowMenu = nativeMenuBar.items[3].submenu; wIndex=0;
    }
    
    
    appMenu.insert(new nw.MenuItem({
      label: "Preferences", modifiers: mod, key: ",",
      click: function() {
        App.MainWindow.showPreferences();
      }
    }), aIndex++);
    appMenu.insert(new nw.MenuItem({ type: "separator" }), aIndex++);
    
    
    accountMenu.append(new nw.MenuItem({
      label: "Add new account ...", modifiers: mod+"-shift", key: "n",
      click: function() {
        App.AccountController.addAccountWithPopup();
      }
    }));
    
    
    windowMenu.insert(new nw.MenuItem({
      label: "Inspector", modifiers: mod, key: "i",
      click: function() {
        nw.Window.get().showDevTools();
      }
    }), wIndex++);
    
    
    win.menu = nativeMenuBar;
    
  }
  
  self.showPreferences = function() {
    $("#modal_preferences").foundation("reveal", "open");
  };
  
  
  
  self.initApp = function() {
    initMainMenu();
    self.loadConfig();
    self.refreshAccountList();
    self.loadHostlists();
    self.attachEvents();
    setInterval(self.loadHostlists, 60000);
  }
  
  
  self.attachEvents = function() {
    $("#contentView").on("click", "tr", onHostlistItemClick);
    $("#accountList_addAccount").click(self.showAddAccount);
    $("#drop_accountList").on("click", ".action", function() {
      var server = App.servers[+$(this).closest("[data-index]").attr("data-index")];
      self.showEditAccount(server);
    });
    $("#drop_accountList").on("click", ".errmes", function() { self.loadHostlists(); });
    $("#tb_hostCommands .f-connect").click(self.connectToHost);
    $("#tb_hostCommands .f-wakeup").click(self.wakeUpHost);
    $("#tb_hostCommands .f-hostinfo").click(self.showHostInfo);
    $("#contentView").on("click", ".f-connect", self.connectToHost);
    $("#contentView").on("click", ".f-wakeup", self.wakeUpHost);
    $(".f-closemodal-btn").on("click", function() { $(this).closest(".reveal-modal").foundation("reveal", "close"); })
  }
  
  
  
  //-->  server/account lists
  
  
  self.accountListTemplate = _.template("<div data-index='<%- index %>'> \
      <i class='fa fa-<%= loading ? 'spinner fa-spin' : (error != null ? 'exclamation-triangle' : 'database') %>' ></i>\
      <%- url.hostname  %> \
      <span class='pull-right'><a href='#' class=action><i class='fa fa-cog'></i></a>\
      </span>\
      </div><%= error != null ? '<div class=errmes>'+error+' (click to retry)</div>' : '' %>");

  
  self.refreshAccountList = function() {
    var $al = $("#accountList");
    $al.html("");
    for(var i = 0; i < App.servers.length; i++) {
      var d = App.servers[i]; d.index=i;
      $al.append(self.accountListTemplate(d));
    }
  }
  
  self.showAddAccount = function() {
    self.showAccountForm(true);
  }
  self.showEditAccount = function(server) {
    var $modal = self.showAccountForm(false);
    $modal.find(".f-url").val(server.urlViewString());
    try {
      var auth = server.url.auth.split(/:/);
      $modal.find(".f-username").val(auth[0]);
      $modal.find(".f-password").val(auth[1]);
    } catch(ex) {
      console.log(ex);
    }
  }
  
  self.showAccountForm = function(isNewAcc) {
    var $modal = $("#modal_addAccount");
    $modal.foundation("reveal", "open");
    $modal.find("h3").html(isNewAcc ? "Add server" : "Edit server");
    $modal.find("input[type=text],input[type=password]").val("");
    $modal.find(".alert-box").hide();
    if(isNewAcc) $modal.find(".f-trash-btn").hide(); else $modal.find(".f-trash-btn").show();
    return $modal;
  }
  
  
  
  //--> manage host lists
  
  self.hostListItemTemplate = _.template("<tr> \
      <td><i class='fa fa-desktop'></i> <%- id  %></td> \
      <td><i class='fa fa-circle' style='color:<%= (online ? 'green' : 'gray') %>'></i> <%= (online ? 'online' : 'n/a') %></td>\
      <td><%- hostname  %></td> \
      <td><%- group  %></td> \
      <td><%- macaddr %></td> \
      <td><%- comment %></td> \
      <td class=actions><a href='#' class='action f-connect' title='Connect'><i class='fa fa-plane'></i></a> <a href='#' class='action f-wakeup' title='Wake up host'><i class='fa fa-bolt'></i></a> </td> \
      </tr>");

  
  self.hostListGroupheaderTemplate = _.template("<tr> \
      <th colspan=7><i class='fa fa-book'></i> <%- group %></th>\
      </tr>");
  
  self.refreshHostlists = function() {
    self.selectedHost = null;    self.selectedHostServer = null; self.onHostSelected();
    var $al = $("#contentView");
    $al.html("<thead class=thead><tr><th>ID</th><th>Status</th><th>Hostname</th><th>Group</th><th>MAC Address</th><th>Comment</th><th></th></tr></thead>");
    for(var i = 0; i < App.servers.length; i++) {
      var server = App.servers[i];
      $al.append(self.hostListGroupheaderTemplate({ group: server.url.host }));
      for(var j in server.hosts) {
        var d = server.hosts[j];
        var $item = $(self.hostListItemTemplate(d)); $item[0].hostInfo = d; $item[0].serverInfo = server;
        $al.append($item);
      }
    }
  }
  
  self.loadHostlists = function() {
    App.servers.forEach(function(server) {
      server.loading=true;
      App.VincyProtocol.listHosts(server, function(err, hostlist) {
        server.loading=false;
        if (!err) {
          server.parseHostlist(hostlist);
          self.refreshHostlists();
        }
        self.refreshAccountList();
      });
    });
    //self.refreshAccountList();
  }
  
  function onHostlistItemClick() {
    if (!this || $(this).closest("TR").length==0) return;
    var $tr = $(this).closest("TR");
    $("#contentView tr.active").removeClass("active");
    $tr.addClass("active");
    self.selectedHost = $tr[0].hostInfo;
    self.selectedHostServer = $tr[0].serverInfo;
    console.log(self.selectedHost);
    self.onHostSelected();
  }
  
  self.onHostSelected = function() {
    if(self.selectedHost) $("#tb_hostCommands li").removeClass("disabled");
                else $("#tb_hostCommands li").addClass("disabled");
  }
  
  
  //--> Action Handlers
  
  self.connectToHost = function() {
    onHostlistItemClick.apply(this);
    if (!self.selectedHost) return;
    var host=self.selectedHost, id = self.selectedHost.id;
    
    try {
      $("#modal_connectionList").foundation("reveal", "open");
      
      if (!host.connection) {
        var firstEstab = true;
        host.connection = App.VincyProtocol.connectHost(self.selectedHostServer, id, function(hostId, msg) {
          if (hostId === false) {
            self.showErrMes(msg);
            host.connection = null;
          } else if (msg === true) {
            if (firstEstab )$("#modal_connectionList").foundation("reveal", "close");
            firstEstab = false;
            host.connection.status = "Established";
          } else {
            //self.showErrMes("An error has occured while connecting to "+id+"<br><br>"+msg);
            host.connection.status = msg;
          }
          self.refreshConnectionList();
        });
        self.refreshConnectionList();
      }
      runVncViewer(host.connection.port);
      
    } catch(err) {
      self.showErrMes("An exception has occured while connecting to "+id+"<br><br>"+err);
    }
  }
  
  self.wakeUpHost = function() {
    onHostlistItemClick.apply(this);
    if (!self.selectedHost) return;
    
    var id = self.selectedHost.id;
    
    App.VincyProtocol.wakeOnLan(self.selectedHostServer, id, function(err, ok) {
      if (err) {
        self.showErrMes("An error has occured while waking up "+id+".<br><br>"+err);
      }
    });
  }
  
  self.showHostInfo = function() {
    if (!self.selectedHost) return;
    var $modal = $("#modal_hostInfo").foundation("reveal", "open");
    var out="";
    for(var key in self.selectedHost) if (key!="comment")
      out += key+": "+self.selectedHost[key]+"<br>";
    $modal.find(".f-info").html(out);
    $modal.find(".f-comment").html(self.selectedHost.comment);
    
  }
  
  
  
  //--> currently open connections
  
  var connectionListitemTemplate = _.template("<tr>\
  <td class=actions><a href='#' class='action f-connect' title='Connect'><i class='fa fa-plane'></i></a> <a href='#' class='action f-closeconn' title='Close connection'><i class='fa fa-close'></i></a> </td>\
  <td><%= host.connection.port %></td><td><%= server.urlViewString() %></td><td><%= host.id %></td><td><%= host.connection.status %></td>\
  </tr>")
  
  self.refreshConnectionList = function() {
    var $tbl = $("#modal_connectionList table tbody").html("");
    App.servers.forEach(function(server) {
      server.hosts.forEach(function(host) {
        if (host.connection) {
          $tbl.append(connectionListitemTemplate({host:host, server:server}));
        }
      })
    })
  }
  
  
  
  
  //--> Helper
  
  self.showErrMes = function(str) {
    try {
      $("#modal_error").foundation("reveal", "open").find(".f-msg").html(str);
    } catch(ex) {
      alert(str);
    }
  }
  
  App.getUserHome = function() {
    return process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
  }
  
  self.loadConfig = function() {
    App.confDir = App.getUserHome() + "/.config/rs/vincy/";
    
    var serverCert;
    if (fs.existsSync(App.confDir + "server-cert.pem"))
      serverCert = fs.readFileSync(App.confDir + "server-cert.pem");
    else if (fs.existsSync(process.execPath + "server-cert.pem"))
      serverCert = fs.readFileSync(process.execPath + "server-cert.pem");
    else { self.showErrMes("Missing server certificate."); }
    
    App.config = {};
    try {
      App.config = JSON.parse(fs.readFileSync(App.confDir+"/config.json"));
    } catch(Ex) { showErrMes("Could not load configuration file<br><br>"+Ex) }
    
    if (App.config.bookmarks) {
      for(var i in App.config.bookmarks) {
        var server = new App.VincyServer(i, App.config.bookmarks[i]);
        server.ca = [ serverCert ];
        App.servers.push(server);
      }
    }
    
    if (!App.config.clientKey) {
      var crypt = require('crypto'), buf;
      try {
        buf = crypt.randomBytes(48);
      }catch(ex) {
        buf = crypt.pseudoRandomBytes(48); console.log("WARNING: Pseudo-random bytes were used for clientKey");
        App.config.clientKeyIsPseudorandom = true;
      }
      App.config.clientKey = buf.toString('base64');
      self.storeConfig();
    }
    
    var out = App.VincyServer.makeJSON(App.servers);
    console.log(out);
  }
  
  self.storeConfig = function() {
    
    App.config.bookmarks = App.VincyServer.makeJSON(App.servers);
    var configString = JSON.stringify(App.config, null, 2);
    fs.writeFileSync(App.confDir+"/config.json", configString);
    
  }
  
})();
